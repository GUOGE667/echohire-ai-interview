import type { InterviewAnalysis } from "./openai";

export type StoredInterview = {
  id: string;
  role: string;
  jobDescription: string;
  interviewType: string;
  difficulty: string;
  status: string;
  questions: string[];
  answers: string[];
  analysis: InterviewAnalysis | null;
  aiStatus: string;
  aiModel: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
};

type InterviewRow = {
  id: string;
  role: string;
  job_description: string;
  interview_type: string;
  difficulty: string;
  status: string;
  questions_json: string;
  answers_json: string;
  analysis_json: string | null;
  ai_status: string;
  ai_model: string | null;
  score: number | null;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapInterview(row: InterviewRow): StoredInterview {
  return {
    id: row.id,
    role: row.role,
    jobDescription: row.job_description,
    interviewType: row.interview_type,
    difficulty: row.difficulty,
    status: row.status,
    questions: parseJson<string[]>(row.questions_json, []),
    answers: parseJson<string[]>(row.answers_json, []),
    analysis: parseJson<InterviewAnalysis | null>(row.analysis_json, null),
    aiStatus: row.ai_status,
    aiModel: row.ai_model,
    score: row.score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureUser(db: D1Database, user: { userId: string; email: string; displayName: string }) {
  await db.prepare(`
    INSERT INTO users (id, email, display_name)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name
  `).bind(user.userId, user.email, user.displayName).run();
}

export async function listInterviews(db: D1Database, userId: string) {
  const result = await db.prepare(`
    SELECT id, role, job_description, interview_type, difficulty, status,
      questions_json, answers_json, analysis_json, ai_status, ai_model, score,
      created_at, updated_at
    FROM interviews
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(userId).all<InterviewRow>();
  return result.results.map(mapInterview);
}

export async function getInterview(db: D1Database, userId: string, id: string) {
  const row = await db.prepare(`
    SELECT id, role, job_description, interview_type, difficulty, status,
      questions_json, answers_json, analysis_json, ai_status, ai_model, score,
      created_at, updated_at
    FROM interviews
    WHERE user_id = ? AND id = ?
  `).bind(userId, id).first<InterviewRow>();
  return row ? mapInterview(row) : null;
}

export async function createInterview(db: D1Database, userId: string, interview: StoredInterview) {
  await db.prepare(`
    INSERT INTO interviews (
      id, user_id, role, job_description, interview_type, difficulty, status,
      questions_json, answers_json, analysis_json, ai_status, ai_model, score,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    interview.id, userId, interview.role, interview.jobDescription,
    interview.interviewType, interview.difficulty, interview.status,
    JSON.stringify(interview.questions), JSON.stringify(interview.answers), null,
    interview.aiStatus, interview.aiModel, null, interview.createdAt, interview.updatedAt,
  ).run();
}

export async function saveInterviewProgress(
  db: D1Database,
  userId: string,
  id: string,
  answers: string[],
  completed: boolean,
  analysis: InterviewAnalysis | null,
  aiStatus: string,
) {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE interviews
    SET answers_json = ?, status = ?, analysis_json = ?, ai_status = ?, score = ?, updated_at = ?
    WHERE user_id = ? AND id = ?
  `).bind(
    JSON.stringify(answers), completed ? "completed" : "in_progress",
    analysis ? JSON.stringify(analysis) : null, aiStatus,
    analysis?.overallScore ?? null, now, userId, id,
  ).run();
}

const dimensions = [
  ["relevance", "岗位匹配"],
  ["structure", "表达结构"],
  ["depth", "专业深度"],
  ["evidence", "案例证据"],
  ["clarity", "表达清晰度"],
] as const;

export async function saveSkillMemory(db: D1Database, userId: string, interviewId: string, analysis: InterviewAnalysis) {
  const insight = analysis.improvements[0] || analysis.summary;
  const statements = dimensions.flatMap(([key, label]) => {
    const score = analysis.dimensions[key];
    return [
      db.prepare(`
        INSERT INTO skill_evidence (id, user_id, interview_id, skill_key, score, insight)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(interview_id, skill_key) DO UPDATE SET
          score = excluded.score,
          insight = excluded.insight
      `).bind(crypto.randomUUID(), userId, interviewId, key, score, insight),
      db.prepare(`
        INSERT INTO skill_profiles (user_id, skill_key, label, score, evidence_count, latest_insight, updated_at)
        SELECT ?, ?, ?, ROUND(AVG(score)), COUNT(*), ?, ?
        FROM skill_evidence
        WHERE user_id = ? AND skill_key = ?
        ON CONFLICT(user_id, skill_key) DO UPDATE SET
          score = excluded.score,
          evidence_count = excluded.evidence_count,
          latest_insight = excluded.latest_insight,
          updated_at = excluded.updated_at
      `).bind(userId, key, label, insight, new Date().toISOString(), userId, key),
    ];
  });
  await db.batch(statements);
}

export async function listSkillProfiles(db: D1Database, userId: string) {
  const result = await db.prepare(`
    SELECT skill_key AS skillKey, label, score, evidence_count AS evidenceCount,
      latest_insight AS latestInsight, updated_at AS updatedAt
    FROM skill_profiles
    WHERE user_id = ?
    ORDER BY score ASC, label ASC
  `).bind(userId).all<{
    skillKey: string; label: string; score: number; evidenceCount: number;
    latestInsight: string; updatedAt: string;
  }>();
  return result.results;
}
