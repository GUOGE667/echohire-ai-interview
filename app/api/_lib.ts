export class ApiError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}

export function errorResponse(error: unknown) {
  console.error(error);
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof ApiError ? error.message : "服务暂时不可用，请稍后重试。";
  return Response.json({ error: message }, { status });
}
