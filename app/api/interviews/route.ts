import { ApiError, errorResponse } from "../_lib";
import { analyzeInterview, fallbackAnalysis, generateInterviewQuestions } from "../../../lib/openai";

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

export async function GET() {
  return Response.json({ interviews: [] });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const role = String(form.get("role") ?? "").trim();
    const jd = String(form.get("jobDescription") ?? "").trim();
    const interviewType = String(form.get("interviewType") ?? "综合面试");
    const difficulty = String(form.get("difficulty") ?? "中级");
    if (!(file instanceof File) || file.type !== "application/pdf") throw new ApiError("请选择一份 PDF 简历。", 400);
    if (file.size > 5 * 1024 * 1024) throw new ApiError("PDF 不能超过 5MB。", 400);
    if (!role || jd.length < 20) throw new ApiError("请填写目标岗位和至少 20 字的职位描述。", 400);

    let questions = buildQuestions(role, jd);
    let aiStatus = "fallback";
    let aiModel: string | null = null;
    try {
      const generated = await generateInterviewQuestions({
        role, jd, interviewType, difficulty,
        resume: { name: file.name, bytes: await file.arrayBuffer() },
      });
      questions = generated.data.questions;
      aiStatus = "generated";
      aiModel = generated.model;
    } catch (error) {
      console.warn("AI question generation fallback", error instanceof Error ? error.message : error);
    }
    const now = new Date().toISOString();
    return Response.json({
      interview: {
        id: crypto.randomUUID(), role, jobDescription: jd, interviewType, difficulty,
        status: "in_progress", questions, answers: [], analysis: null,
        aiStatus, aiModel, score: null, createdAt: now, updatedAt: now,
      },
    }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as {
      role?: string; jobDescription?: string; questions?: string[]; answers?: string[]; complete?: boolean;
    };
    if (!body.role || !body.jobDescription || !Array.isArray(body.questions) || !Array.isArray(body.answers)) {
      throw new ApiError("面试记录格式无效。", 400);
    }
    if (!body.complete) return Response.json({ saved: true, score: null, analysis: null, aiStatus: "generated" });

    let analysis;
    let aiStatus = "analyzed";
    try {
      const result = await analyzeInterview({ role: body.role, jd: body.jobDescription, questions: body.questions, answers: body.answers });
      analysis = result.data;
    } catch (error) {
      console.warn("AI analysis fallback", error instanceof Error ? error.message : error);
      analysis = fallbackAnalysis(body.questions, body.answers);
      aiStatus = "fallback";
    }
    return Response.json({ saved: true, score: analysis.overallScore, analysis, aiStatus });
  } catch (error) { return errorResponse(error); }
}
