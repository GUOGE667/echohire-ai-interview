export async function GET() {
  return Response.json({
    user: { userId: "local-portfolio-user", displayName: "同学", email: "本设备私有数据" },
  });
}
