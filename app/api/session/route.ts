import { errorResponse, requireApiUser } from "../_lib";

export async function GET() {
  try {
    const user = await requireApiUser();
    return Response.json({ user });
  } catch (error) { return errorResponse(error); }
}
