import { tryGetD1 } from "../../../db/runtime";
import { getSiteUser } from "../../../lib/identity";
import { errorResponse } from "../_lib";

export async function GET(request: Request) {
  try {
    const user = getSiteUser(request);
    if (!user) return Response.json({ user: null, storage: "local" });
    return Response.json({ user, storage: (await tryGetD1()) ? "cloud" : "local" });
  } catch (error) {
    return errorResponse(error);
  }
}
