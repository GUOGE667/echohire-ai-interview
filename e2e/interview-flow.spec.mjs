import { test, expect } from "@playwright/test";

const questions = [
  "请介绍你负责的项目和具体贡献。",
  "你如何处理技术方案之间的取舍？",
  "团队意见不同时你如何推进？",
  "项目结束后你怎样复盘？",
];
const answers = [
  "我负责把项目拆成四个阶段，先完成原型，再逐步验证关键流程，最终按计划交付。",
  "我比较了两种实现的维护成本，选择更简单的方案，并通过测试验证性能满足要求。",
  "我先收集各方担忧，再组织讨论明确验收标准，最后和团队一起确定实施顺序。",
  "我复盘了交付中的沟通延迟，记录原因和改进措施，并在下一个项目提前同步风险。",
];

test("创建面试、逐题保存、刷新恢复并查看报告", async ({ page }) => {
  const unexpectedRequests = [];
  const apiCalls = [];
  const id = "offline-browser-test";
  const createdAt = "2026-01-01T00:00:00.000Z";
  let record;

  // Every API request is mocked before navigation. No server route or third-party API is called.
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== "http://localhost:5173") {
      unexpectedRequests.push(request.url());
      await route.abort();
      return;
    }
    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }
    apiCalls.push(`${request.method()} ${url.pathname}`);
    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
    if (url.pathname === "/api/session" && request.method() === "GET") {
      await json({ user: { userId: "e2e", displayName: "测试用户", email: "test@example.invalid" }, storage: "local" });
    } else if (url.pathname === "/api/memory" && request.method() === "GET") {
      await json({ profiles: [] });
    } else if (url.pathname === "/api/interviews" && request.method() === "GET") {
      // Empty cloud history makes the app restore the saved local browser record.
      await json({ interviews: [], storage: "local" });
    } else if (url.pathname === "/api/interviews" && request.method() === "POST") {
      const body = request.postData() || "";
      expect(body).toContain("前端开发工程师");
      record = {
        id, role: "前端开发工程师", jobDescription: "负责前端产品开发，能够完成需求分析、团队协作、测试和交付。",
        interviewType: "综合面试", difficulty: "中级", status: "in_progress",
        questions, answers: [], analysis: null, aiStatus: "fallback", aiModel: null,
        score: null, createdAt, updatedAt: createdAt,
      };
      await json({ interview: record, storage: "local" }, 201);
    } else if (url.pathname === "/api/interviews" && request.method() === "PATCH") {
      const body = JSON.parse(request.postData() || "{}");
      expect(body.id).toBe(id);
      expect(body.answers).toEqual(answers.slice(0, body.answers.length));
      record.answers = body.answers;
      const complete = body.answers.length === questions.length;
      const analysis = complete ? {
        source: "fallback", headline: "已完成本次面试复盘", summary: "回答覆盖了项目行动、取舍、协作和复盘。",
        overallScore: 82,
        dimensions: { relevance: 83, structure: 82, depth: 80, evidence: 81, clarity: 84 },
        strengths: ["说明了个人行动", "覆盖了团队协作"],
        improvements: ["补充可核实的结果", "解释方案取舍", "给出更具体的复盘"],
        actionPlan: ["补充结果证据", "练习方案比较", "整理复盘案例"],
        questionFeedback: questions.map((_, questionIndex) => ({ questionIndex, score: 82, feedback: "回答有具体行动。", betterAnswer: "再补充可验证的结果。" })),
        agentTrace: [],
      } : null;
      await json({ saved: true, questions, score: complete ? 82 : null, analysis, aiStatus: "fallback", storage: "local" });
    } else {
      unexpectedRequests.push(`${request.method()} ${url.pathname}`);
      await route.abort();
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: "开始新面试" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "fictional-resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await page.getByRole("button", { name: "继续" }).click();
  await page.getByRole("textbox", { name: "职位 JD" }).fill("负责前端产品开发，能够完成需求分析、团队协作、测试和交付。");
  await page.getByRole("button", { name: "继续" }).click();
  await page.getByRole("button", { name: "生成面试" }).click();
  await expect(page.getByRole("heading", { name: questions[0] })).toBeVisible();

  await page.getByRole("textbox", { name: "你的回答" }).fill(answers[0]);
  await page.getByRole("button", { name: "提交并保存" }).click();
  await expect(page.getByRole("heading", { name: questions[1] })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("echohire-interviews") || "[]")[0]?.answers.length)).toBe(1);

  await page.reload();
  await expect(page.getByRole("heading", { name: questions[1] })).toBeVisible();
  await expect(page.getByText("2 / 4")).toBeVisible();

  for (let index = 1; index < questions.length; index += 1) {
    await page.getByRole("textbox", { name: "你的回答" }).fill(answers[index]);
    await page.getByRole("button", { name: "提交并保存" }).click();
    if (index < questions.length - 1) await expect(page.getByRole("heading", { name: questions[index + 1] })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "已完成本次面试复盘" })).toBeVisible();
  await expect(page.getByText("逐题复盘")).toBeVisible();
  await expect(page.locator(".feedback-card")).toHaveCount(4);
  await expect(page.locator(".report-score-number strong")).toHaveText("82");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("echohire-interviews") || "[]")[0]?.status)).toBe("completed");
  expect(apiCalls.filter((call) => call === "PATCH /api/interviews")).toHaveLength(4);
  expect(unexpectedRequests).toEqual([]);
});
