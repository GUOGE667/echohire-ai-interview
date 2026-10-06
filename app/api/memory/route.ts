import { tryGetD1 } from "../../../db/runtime";
import { getSiteUser } from "../../../lib/identity";
import { ensureUser, listSkillProfiles } from "../../../lib/interview-memory";
import { errorResponse } from "../_lib";

export async function GET(request: Request) {
  try {
    const user = getSiteUser(request);
    if (!user) return Response.json({ profiles: [], storage: "local" });
    const db = await tryGetD1();
    if (!db) return Response.json({ profiles: [], storage: "local" });
    await ensureUser(db, user);
    return Response.json({ profiles: await listSkillProfiles(db, user.userId), storage: "cloud" });
  } catch (error) {
    return errorResponse(error);
  }
}
