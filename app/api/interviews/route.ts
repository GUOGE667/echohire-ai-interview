import { env } from "cloudflare:workers";
import { ApiError, errorResponse, parseList, requireApiUser } from "../_lib";
import { analyzeInterview, fallbackAnalysis, generateInterviewQuestions, type InterviewAnalysis } from "../../../lib/openai";

type InterviewRow = {
  id: string; role: string; interview_type: string; difficulty: string; status: string;
  questions_json: string; answers_json: string; analysis_json: string | null; ai_status: string; ai_model: string | null; score: number | null; created_at: string; updated_at: string;
};
type ResumeRow = { id:string; file_name:string; object_key:string };

function parseAnalysis(value:string|null):InterviewAnalysis|null{if(!value)return null;try{return JSON.parse(value) as InterviewAnalysis}catch{return null}}

function serialize(row: InterviewRow) {
  return { id: row.id, role: row.role, interviewType: row.interview_type, difficulty: row.difficulty,
    status: row.status, questions: parseList(row.questions_json), answers: parseList(row.answers_json), analysis:parseAnalysis(row.analysis_json), aiStatus:row.ai_status, aiModel:row.ai_model,
    score: row.score, createdAt: row.created_at, updatedAt: row.updated_at };
}

function buildQuestions(role: string, jd: string) {
  const text = jd.toLowerCase();
  const topic = text.includes("react") ? "React" : text.includes("python") ? "Python" : text.includes("java") ? "Java" : text.includes("数据") ? "数据分析" : "核心专业能力";
  return [
    `请结合简历介绍一个最能证明你胜任${role}的项目。你承担了什么，结果如何？`,
    `这个岗位强调${topic}。请讲一次你解决相关复杂问题的完整过程和技术取舍。`,
    `如果入职后发现需求目标与现有实现冲突，你会如何和产品、设计或工程团队推进？`,
    `回顾一个结果不如预期的项目。你如何复盘，并把教训应用到下一次交付中？`,
  ];
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const result = await env.DB!.prepare(
      `SELECT id, role, interview_type, difficulty, status, questions_json, answers_json, analysis_json, ai_status, ai_model, score, created_at, updated_at
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
    let resume: ResumeRow|null=null;
    if (body.resumeId) {
      resume = await env.DB!.prepare("SELECT id, file_name, object_key FROM resumes WHERE id = ?1 AND user_id = ?2").bind(body.resumeId, user.userId).first<ResumeRow>()??null;
      if (!resume) throw new ApiError("找不到这份简历，请重新上传。", 400);
    }
    const id = crypto.randomUUID();
    let questions=buildQuestions(role,jd);let aiStatus="fallback";let aiModel:string|null=null;
    try{
      const object=resume&&env.BUCKET?await env.BUCKET.get(resume.object_key):null;
      const generated=await generateInterviewQuestions({role,jd,interviewType:body.interviewType??"综合面试",difficulty:body.difficulty??"中级",resume:object&&resume?{name:resume.file_name,bytes:await object.arrayBuffer()}:undefined});
      questions=generated.data.questions;aiStatus="generated";aiModel=generated.model;
    }catch(error){console.warn("AI question generation fallback",error instanceof Error?error.message:error)}
    await env.DB!.prepare(
      `INSERT INTO interviews (id, user_id, resume_id, role, job_description, interview_type, difficulty, questions_json, ai_status, ai_model)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    ).bind(id,user.userId,body.resumeId??null,role,jd,body.interviewType??"综合面试",body.difficulty??"中级",JSON.stringify(questions),aiStatus,aiModel).run();
    return Response.json({ interview:{id,role,interviewType:body.interviewType??"综合面试",difficulty:body.difficulty??"中级",status:"in_progress",questions,answers:[],analysis:null,aiStatus,aiModel,score:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} },{status:201});
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json() as { id?: string; answers?: string[]; complete?: boolean };
    if (!body.id || !Array.isArray(body.answers)) throw new ApiError("面试记录格式无效。", 400);
    const current=await env.DB!.prepare("SELECT role, job_description, questions_json FROM interviews WHERE id = ?1 AND user_id = ?2").bind(body.id,user.userId).first<{role:string;job_description:string;questions_json:string}>();
    if(!current)throw new ApiError("找不到这场面试。",404);
    let analysis:InterviewAnalysis|null=null;let score:number|null=null;let aiStatus="generated";let aiModel:string|null=null;
    if(body.complete){
      const questions=parseList(current.questions_json);
      try{const result=await analyzeInterview({role:current.role,jd:current.job_description,questions,answers:body.answers});analysis=result.data;score=analysis.overallScore;aiStatus="analyzed";aiModel=result.model}
      catch(error){console.warn("AI analysis fallback",error instanceof Error?error.message:error);analysis=fallbackAnalysis(questions,body.answers);score=analysis.overallScore;aiStatus="fallback"}
    }
    const result = await env.DB!.prepare(
      `UPDATE interviews SET answers_json = ?1, status = ?2, score = ?3, analysis_json = ?4, ai_status = ?5, ai_model = COALESCE(?6, ai_model), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?7 AND user_id = ?8`,
    ).bind(JSON.stringify(body.answers),body.complete?"completed":"in_progress",score,analysis?JSON.stringify(analysis):null,body.complete?aiStatus:"generated",aiModel,body.id,user.userId).run();
    if (!result.meta.changes) throw new ApiError("找不到这场面试。", 404);
    return Response.json({ saved:true,score,analysis,aiStatus });
  } catch (error) { return errorResponse(error); }
}
