import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const resumes = sqliteTable("resumes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("resumes_user_created_idx").on(table.userId, table.createdAt)]);

export const interviews = sqliteTable("interviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  resumeId: text("resume_id").references(() => resumes.id),
  role: text("role").notNull(),
  jobDescription: text("job_description").notNull(),
  interviewType: text("interview_type").notNull().default("综合面试"),
  difficulty: text("difficulty").notNull().default("中级"),
  status: text("status").notNull().default("in_progress"),
  questionsJson: text("questions_json").notNull(),
  answersJson: text("answers_json").notNull().default("[]"),
  analysisJson: text("analysis_json"),
  aiStatus: text("ai_status").notNull().default("pending"),
  aiModel: text("ai_model"),
  score: integer("score"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("interviews_user_created_idx").on(table.userId, table.createdAt)]);

export const skillProfiles = sqliteTable("skill_profiles", {
  userId: text("user_id").notNull().references(() => users.id),
  skillKey: text("skill_key").notNull(),
  label: text("label").notNull(),
  score: integer("score").notNull(),
  evidenceCount: integer("evidence_count").notNull().default(1),
  latestInsight: text("latest_insight").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userId, table.skillKey] }),
  index("skill_profiles_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const skillEvidence = sqliteTable("skill_evidence", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  interviewId: text("interview_id").notNull().references(() => interviews.id),
  skillKey: text("skill_key").notNull(),
  score: integer("score").notNull(),
  insight: text("insight").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("skill_evidence_user_created_idx").on(table.userId, table.createdAt),
  index("skill_evidence_interview_idx").on(table.interviewId),
  uniqueIndex("skill_evidence_interview_skill_unique").on(table.interviewId, table.skillKey),
]);
