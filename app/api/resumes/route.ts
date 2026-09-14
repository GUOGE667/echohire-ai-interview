export async function POST() {
  return Response.json({ error: "请通过面试创建流程提交简历。" }, { status: 410 });
}
