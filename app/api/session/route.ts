import { tryGetD1 } from "../../../db/runtime";
import { getSiteUser } from "../../../lib/identity";
import { ApiError, errorResponse } from "../_lib";

export async function GET(request: Request) {
  try {
    const user = getSiteUser(request);
    if (!user) throw new ApiError("请先登录后再查看训练档案。", 401);
    return Response.json({ user, storage: (await tryGetD1()) ? "cloud" : "local" });
  } catch (error) {
    return errorResponse(error);
  }
}
