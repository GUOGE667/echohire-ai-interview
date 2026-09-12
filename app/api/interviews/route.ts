import { env } from "cloudflare:workers";
import { ApiError, errorResponse, parseList, requireApiUser } from "../_lib";

type InterviewRow = {
  id: string; role: string; interview_type: string; difficulty: string; status: string;
  questions_json: string; answers_json: string; score: number | null; created_at: string; updated_at: string;
};

function serialize(row: InterviewRow) {
  return { id: row.id, role: row.role, interviewType: row.interview_type, difficulty: row.difficulty,
    status: row.status, questions: parseList(row.questions_json), answers: parseList(row.answers_json),
    score: row.score, createdAt: row.created_at, updatedAt: row.updated_at };
}

function buildQuestions(role: string, jd: string) {
  const text = jd.toLowerCase();
  const topic = text.includes("react") ? "React" : text.includes("python") ? "Python" : text.includes("java") ? "Java" : text.includes("数据") ? "数据分析" : "核心专业能力";
  return [
    `请结合简历介绍一个最能证明你胜任${role}的项目。你承担了什么，结果如何？`,
    `这个岗位强调${topic}。请讲一次你解决相关复杂问题的完整过程和技术取舍。`,
    `如果入职后发现需求目标与现有实现冲突，你会如何和产品、设计或工程团队推进？`,
  ];
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const result = await env.DB!.prepare(
      `SELECT id, role, interview_type, difficulty, status, questions_json, answers_json, score, created_at, updated_at
       FROM interviews WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 30`,
    ).bind(user.userId).all<InterviewRow>();
    return Response.json({ interviews: result.results.map(serialize) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as { resumeId?: string; role?: string; jobDescription?: string; interviewType?: string; difficulty?: string };
    const role = body.role?.trim() ?? "";
    const jd = body.jobDescription?.trim() ?? "";
    if (!role || jd.length < 20) throw new ApiError("请填写目标岗位和至少 20 字的职位描述。", 400);
    if (body.resumeId) {
      const resume = await env.DB!.prepare("SELECT id FROM resumes WHERE id = ?1 AND user_id = ?2").bind(body.resumeId, user.userId).first();
      if (!resume) throw new ApiError("找不到这份简历，请重新上传。", 400);
    }
    const id = crypto.randomUUID();
    const questions = buildQuestions(role, jd);
    await env.DB!.prepare(
      `INSERT INTO interviews (id, user_id, resume_id, role, job_description, interview_type, difficulty, questions_json)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(id, user.userId, body.resumeId ?? null, role, jd, body.interviewType ?? "综合面试", body.difficulty ?? "中级", JSON.stringify(questions)).run();
    return Response.json({ interview: { id, role, interviewType: body.interviewType ?? "综合面试", difficulty: body.difficulty ?? "中级", status: "in_progress", questions, answers: [], score: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as { id?: string; answers?: string[]; complete?: boolean };
    if (!body.id || !Array.isArray(body.answers)) throw new ApiError("面试记录格式无效。", 400);
    const score = body.complete ? Math.min(92, 66 + body.answers.reduce((sum, item) => sum + Math.min(8, Math.floor(item.trim().length / 45)), 0)) : null;
    const result = await env.DB!.prepare(
      `UPDATE interviews SET answers_json = ?1, status = ?2, score = ?3, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?4 AND user_id = ?5`,
    ).bind(JSON.stringify(body.answers), body.complete ? "completed" : "in_progress", score, body.id, user.userId).run();
    if (!result.meta.changes) throw new ApiError("找不到这场面试。", 404);
    return Response.json({ saved: true, score });
  } catch (error) { return errorResponse(error); }
}
