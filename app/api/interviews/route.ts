import { tryGetD1 } from "../../../db/runtime";
import { getSiteUser } from "../../../lib/identity";
import {
  createInterview as persistInterview,
  ensureUser,
  getInterview,
  listInterviews,
  saveInterviewProgress,
  saveSkillMemory,
  type StoredInterview,
} from "../../../lib/interview-memory";
import { fallbackFollowUp } from "../../../lib/follow-up";
import { buildOfflineQuestions, normalizeQuestionEvidence } from "../../../lib/resume-questions";
import { analyzeInterview, decideFollowUp, fallbackAnalysis, generateInterviewQuestions } from "../../../lib/openai";
import { ApiError, errorResponse } from "../_lib";

export async function GET(request: Request) {
  try {
    const user = getSiteUser(request);
    if (!user) return Response.json({ interviews: [], storage: "local" });
    const db = await tryGetD1();
    if (!db) return Response.json({ interviews: [], storage: "local" });
    await ensureUser(db, user);
    return Response.json({ interviews: await listInterviews(db, user.userId), storage: "cloud" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = getSiteUser(request);
    const json = request.headers.get("content-type")?.includes("application/json")
      ? await request.json() as Record<string, unknown>
      : null;
    const form = json ? null : await request.formData();
    const field = (name: string) => json ? json[name] : form?.get(name);
    const file = form?.get("file");
    const pdf = typeof File !== "undefined" && file instanceof File ? file : null;
    const resumeText = String(field("resumeText") ?? "").trim();
    const role = String(field("role") ?? "").trim();
    const jd = String(field("jobDescription") ?? "").trim();
    const interviewType = String(field("interviewType") ?? "综合面试");
    const difficulty = String(field("difficulty") ?? "中级");
    const hasPdf = !!pdf && pdf.size > 0;
    if (user && !hasPdf && resumeText.length < 20) throw new ApiError("请上传 PDF 简历，或从 ResumePilot 导入简历。", 400);
    if (hasPdf && pdf.type !== "application/pdf") throw new ApiError("请选择一份 PDF 简历。", 400);
    if (hasPdf && pdf.size > 5 * 1024 * 1024) throw new ApiError("PDF 不能超过 5MB。", 400);
    if (!role || jd.length < 20) throw new ApiError("请填写目标岗位和至少 20 字的职位描述。", 400);
    if (role.length > 120 || jd.length > 6000 || resumeText.length > 15000 ||
        interviewType.length > 80 || difficulty.length > 80) {
      throw new ApiError("填写内容过长，请适当精简后重试。", 400);
    }

    const offline = buildOfflineQuestions(role, jd, resumeText);
    let questions = offline.questions;
    let questionEvidence = offline.questionEvidence;
    let aiStatus = "fallback";
    let aiModel: string | null = null;
    if (user && process.env.ECHOHIRE_ALLOW_PAID_API === "true") {
      try {
        const generated = await generateInterviewQuestions({
          role, jd, interviewType, difficulty,
          resume: hasPdf ? { name: pdf.name, bytes: await pdf.arrayBuffer() } : undefined,
          resumeText: resumeText || undefined,
        });
        questions = generated.data.questions;
        questionEvidence = normalizeQuestionEvidence(null, questions.length);
        aiStatus = "generated";
        aiModel = generated.model;
      } catch (error) {
        console.warn("AI question generation fallback", error instanceof Error ? error.message : error);
      }
    }

    const now = new Date().toISOString();
    const interview: StoredInterview = {
      id: crypto.randomUUID(), role, jobDescription: jd, interviewType, difficulty,
      status: "in_progress", questions, questionEvidence, answers: [], analysis: null,
      aiStatus, aiModel, score: null, createdAt: now, updatedAt: now,
    };
    const db = user ? await tryGetD1() : null;
    if (db && user) {
      await ensureUser(db, user);
      await persistInterview(db, user.userId, interview);
    }
    return Response.json({ interview, storage: db ? "cloud" : "local" }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = getSiteUser(request);
    const body = await request.json() as {
      id?: string; role?: string; jobDescription?: string; questions?: string[];
      answers?: string[]; complete?: boolean; aiStatus?: string; questionEvidence?: unknown;
    };
    if (!body.id || !Array.isArray(body.answers) || !body.answers.every((answer) => typeof answer === "string")) {
      throw new ApiError("面试记录格式无效。", 400);
    }

    const db = user ? await tryGetD1() : null;
    const stored = db && user ? await getInterview(db, user.userId, body.id) : null;
    if (db && !stored) throw new ApiError("没有找到这场面试。", 404);
    const role = stored?.role || body.role;
    const jd = stored?.jobDescription || body.jobDescription;
    const questions = stored?.questions || body.questions;
    if (!role || !jd || !Array.isArray(questions) || !questions.length) throw new ApiError("没有找到这场面试。", 404);
    if (role.length > 120 || jd.length > 6000 || questions.length > 6 ||
        questions.some((question) => typeof question !== "string" || question.length > 500) ||
        body.answers.length > 6) throw new ApiError("面试记录格式无效。", 400);
    const questionEvidence = normalizeQuestionEvidence(stored?.questionEvidence ?? body.questionEvidence, questions.length);
    const currentAiStatus = stored?.aiStatus || (body.aiStatus === "generated" ? "generated" : "fallback");
    if (stored && body.answers.length === stored.answers.length && body.answers.every((answer, index) => answer === stored.answers[index])) {
      return Response.json({ saved: true, questions, questionEvidence, score: stored.score, analysis: stored.analysis, aiStatus: stored.aiStatus, storage: "cloud" });
    }
    if (stored?.status === "completed") throw new ApiError("这场面试已完成。", 409);
    const previousAnswers = stored?.answers ?? body.answers.slice(0, -1);
    const answerIndex = previousAnswers.length;
    const submittedAnswer = body.answers[answerIndex]?.trim();
    if (body.answers.length !== answerIndex + 1 ||
        body.answers.slice(0, answerIndex).some((answer, index) => answer !== previousAnswers[index]) ||
        !submittedAnswer || submittedAnswer.length < 20 || submittedAnswer.length > 8000 ||
        answerIndex >= questions.length) {
      throw new ApiError("答题进度已变化，请刷新页面后重试。", 409);
    }
    const answers = [...previousAnswers, submittedAnswer];
    const complete = answerIndex === questions.length - 1;

    if (!complete) {
      const updatedQuestions = [...questions];
      const updatedEvidence = [...questionEvidence];
      const followUpCount = questions.filter((question) => question.startsWith("追问：")).length;
      if (followUpCount < 2) {
        let followUp: string | null = null;
        if (user && process.env.ECHOHIRE_ALLOW_PAID_API === "true") {
          try {
            followUp = await decideFollowUp({ jobDescription: jd, question: questions[answerIndex], answer: submittedAnswer });
          } catch (error) {
            console.warn("AI follow-up fallback", error instanceof Error ? error.message : error);
            followUp = fallbackFollowUp({ question: questions[answerIndex], answer: submittedAnswer });
          }
        } else {
          followUp = fallbackFollowUp({ question: questions[answerIndex], answer: submittedAnswer });
        }
        if (followUp && !updatedEvidence[answerIndex + 1]) {
          updatedQuestions[answerIndex + 1] = followUp;
          updatedEvidence[answerIndex + 1] = null;
        }
      }
      if (db && user) await saveInterviewProgress(db, user.userId, body.id, updatedQuestions, answers, false, null, currentAiStatus, updatedEvidence);
      return Response.json({ saved: true, questions: updatedQuestions, questionEvidence: updatedEvidence, score: null, analysis: null, aiStatus: currentAiStatus, storage: db ? "cloud" : "local" });
    }

    let analysis = fallbackAnalysis(questions, answers);
    let aiStatus = "fallback";
    if (user && process.env.ECHOHIRE_ALLOW_PAID_API === "true") {
      try {
        const result = await analyzeInterview({ role, jd, questions, answers });
        analysis = result.data;
        aiStatus = "analyzed";
      } catch (error) {
        console.warn("AI analysis fallback", error instanceof Error ? error.message : error);
      }
    }
    if (db && user) {
      await saveInterviewProgress(db, user.userId, body.id, questions, answers, true, analysis, aiStatus, questionEvidence);
      await saveSkillMemory(db, user.userId, body.id, analysis);
    }
    return Response.json({ saved: true, questions, questionEvidence, score: analysis.overallScore, analysis, aiStatus, storage: db ? "cloud" : "local" });
  } catch (error) {
    return errorResponse(error);
  }
}
