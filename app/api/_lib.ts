import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../chatgpt-auth";

export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError("请先使用 ChatGPT 账户登录。", 401);
  if (!env.DB) throw new ApiError("数据服务暂时不可用，请稍后再试。", 503);
  await env.DB.prepare(
    `INSERT INTO users (id, email, display_name)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name`,
  ).bind(user.userId, user.email, user.displayName).run();
  return user;
}

export class ApiError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}

export function errorResponse(error: unknown) {
  console.error(error);
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof ApiError ? error.message : "服务暂时不可用，请稍后重试。";
  return Response.json({ error: message }, { status });
}

export function parseList(value: string): string[] {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; }
  catch { return []; }
}
