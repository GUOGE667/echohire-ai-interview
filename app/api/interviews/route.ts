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
import { analyzeInterview, fallbackAnalysis, generateInterviewQuestions } from "../../../lib/openai";
import { ApiError, errorResponse } from "../_lib";

function requireUser(request: Request) {
  const user = getSiteUser(request);
  if (!user) throw new ApiError("请先登录后再使用面试训练。", 401);
  return user;
}

function buildQuestions(role: string, jd: string) {
  const text = jd.toLowerCase();
  const topic = text.includes("react") ? "React" : text.includes("python") ? "Python" : text.includes("java") ? "Java" : text.includes("数据") ? "数据分析" : "核心专业能力";
  return [
    `请结合简历介绍一个最能证明你胜任${role}的项目。你承担了什么，结果如何？`,
    `这个岗位强调${topic}。请讲一次你解决相关复杂问题的完整过程和技术取舍。`,
    "如果入职后发现需求目标与现有实现冲突，你会如何和产品、设计或工程团队推进？",
    "回顾一个结果不如预期的项目。你如何复盘，并把教训应用到下一次交付中？",
  ];
}

export async function GET(request: Request) {
  try {
    const user = requireUser(request);
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
    const user = requireUser(request);
    const form = await request.formData();
    const file = form.get("file");
    const resumeText = String(form.get("resumeText") ?? "").trim();
    const role = String(form.get("role") ?? "").trim();
    const jd = String(form.get("jobDescription") ?? "").trim();
    const interviewType = String(form.get("interviewType") ?? "综合面试");
    const difficulty = String(form.get("difficulty") ?? "中级");
    const hasPdf = file instanceof File && file.size > 0;
    if (!hasPdf && resumeText.length < 20) throw new ApiError("请上传 PDF 简历，或从 ResumePilot 导入简历。", 400);
    if (hasPdf && file.type !== "application/pdf") throw new ApiError("请选择一份 PDF 简历。", 400);
    if (hasPdf && file.size > 5 * 1024 * 1024) throw new ApiError("PDF 不能超过 5MB。", 400);
    if (!role || jd.length < 20) throw new ApiError("请填写目标岗位和至少 20 字的职位描述。", 400);

    let questions = buildQuestions(role, jd);
    let aiStatus = "fallback";
    let aiModel: string | null = null;
    try {
      const generated = await generateInterviewQuestions({
        role, jd, interviewType, difficulty,
        resume: hasPdf ? { name: file.name, bytes: await file.arrayBuffer() } : undefined,
        resumeText: resumeText || undefined,
      });
      questions = generated.data.questions;
      aiStatus = "generated";
      aiModel = generated.model;
    } catch (error) {
      console.warn("AI question generation fallback", error instanceof Error ? error.message : error);
    }

    const now = new Date().toISOString();
    const interview: StoredInterview = {
      id: crypto.randomUUID(), role, jobDescription: jd, interviewType, difficulty,
      status: "in_progress", questions, answers: [], analysis: null,
      aiStatus, aiModel, score: null, createdAt: now, updatedAt: now,
    };
    const db = await tryGetD1();
    if (db) {
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
    const user = requireUser(request);
    const body = await request.json() as {
      id?: string; role?: string; jobDescription?: string; questions?: string[];
      answers?: string[]; complete?: boolean;
    };
    if (!body.id || !Array.isArray(body.answers)) throw new ApiError("面试记录格式无效。", 400);

    const db = await tryGetD1();
    const stored = db ? await getInterview(db, user.userId, body.id) : null;
    const role = stored?.role || body.role;
    const jd = stored?.jobDescription || body.jobDescription;
    const questions = stored?.questions || body.questions;
    if (!role || !jd || !Array.isArray(questions)) throw new ApiError("没有找到这场面试。", 404);

    if (!body.complete) {
      if (db) await saveInterviewProgress(db, user.userId, body.id, body.answers, false, null, stored?.aiStatus || "generated");
      return Response.json({ saved: true, score: null, analysis: null, aiStatus: stored?.aiStatus || "generated", storage: db ? "cloud" : "local" });
    }

    let analysis;
    let aiStatus = "analyzed";
    try {
      const result = await analyzeInterview({ role, jd, questions, answers: body.answers });
      analysis = result.data;
    } catch (error) {
      console.warn("AI analysis fallback", error instanceof Error ? error.message : error);
      analysis = fallbackAnalysis(questions, body.answers);
      aiStatus = "fallback";
    }
    if (db) {
      await saveInterviewProgress(db, user.userId, body.id, body.answers, true, analysis, aiStatus);
      await saveSkillMemory(db, user.userId, body.id, analysis);
    }
    return Response.json({ saved: true, score: analysis.overallScore, analysis, aiStatus, storage: db ? "cloud" : "local" });
  } catch (error) {
    return errorResponse(error);
  }
}
