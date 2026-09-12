import { env } from "cloudflare:workers";
import { ApiError, errorResponse, requireApiUser } from "../_lib";

const MAX_PDF_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!env.BUCKET) throw new ApiError("简历存储服务暂时不可用。", 503);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("请选择一份 PDF 简历。", 400);
    if (file.type !== "application/pdf") throw new ApiError("仅支持 PDF 格式。", 400);
    if (file.size > MAX_PDF_BYTES) throw new ApiError("PDF 不能超过 5MB。", 400);

    const id = crypto.randomUUID();
    const objectKey = `resumes/${user.userId}/${id}.pdf`;
    await env.BUCKET.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { owner: user.userId, originalName: file.name },
    });
    try {
      await env.DB!.prepare(
        `INSERT INTO resumes (id, user_id, file_name, object_key, size, content_type)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(id, user.userId, file.name, objectKey, file.size, file.type).run();
    } catch (error) {
      await env.BUCKET.delete(objectKey);
      throw error;
    }
    return Response.json({ resume: { id, fileName: file.name, size: file.size } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
