import test from "node:test";
import assert from "node:assert/strict";
import { fallbackFollowUp } from "../lib/follow-up.ts";
import { fallbackAnalysis } from "../lib/openai.ts";
import { getSiteUser } from "../lib/identity.ts";
import { getInterview, saveInterviewProgress } from "../lib/interview-memory.ts";

test("empty answers never trigger a follow-up", () => {
  assert.equal(fallbackFollowUp({ question: "介绍项目", answer: "  " }), null);
});

test("follow-up asks for personal contribution when action is missing", () => {
  const question = fallbackFollowUp({ question: "介绍项目", answer: "团队做了一个招聘系统。" });
  assert.match(question, /你本人具体做了什么/);
});

test("follow-up asks for evidence after action and outcome", () => {
  const question = fallbackFollowUp({ question: "介绍项目", answer: "我设计了缓存方案，最终提升了响应速度。" });
  assert.match(question, /怎么验证这个结果/);
});

test("complete technical answer does not receive a redundant follow-up", () => {
  const question = fallbackFollowUp({
    question: "你如何选择技术方案？",
    answer: "我负责设计缓存方案，因为成本限制选择了现有组件，最终将耗时降低了 30%，通过压测验证。",
  });
  assert.equal(question, null);
});

test("fallback report is marked as fallback and contains per-question feedback", () => {
  const report = fallbackAnalysis(
    ["介绍项目", "说明技术取舍"],
    ["我负责设计接口，最终将耗时降低了 30%。", "我选择了现有组件，因为维护成本较低。"],
  );
  assert.equal(report.source, "fallback");
  assert.equal(report.questionFeedback.length, 2);
  assert.deepEqual(report.questionFeedback.map((item) => item.questionIndex), [0, 1]);
  assert.ok(report.overallScore >= 0 && report.overallScore <= 100);
  assert.equal(report.agentTrace.at(-1)?.status, "fallback");
});

test("deployed requests require platform identity headers", () => {
  assert.equal(getSiteUser(new Request("https://example.com")), null);
  const request = new Request("https://example.com", {
    headers: {
      "oai-authenticated-user-id": "user-1",
      "oai-authenticated-user-email": "student@example.com",
    },
  });
  assert.equal(getSiteUser(request)?.userId, "user-1");
});

test("stored interview JSON restores submitted answers and questions", async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /WHERE user_id = \? AND id = \?/);
      return {
        bind(userId, id) {
          assert.deepEqual([userId, id], ["user-1", "interview-1"]);
          return {
            async first() {
              return {
                id, role: "前端开发", job_description: "React 开发", interview_type: "综合面试",
                difficulty: "中级", status: "in_progress", questions_json: '["项目经历","技术取舍"]',
                answers_json: '["我负责设计组件"]', analysis_json: null, ai_status: "fallback",
                ai_model: null, score: null, created_at: "2026-09-01", updated_at: "2026-09-02",
              };
            },
          };
        },
      };
    },
  };
  const interview = await getInterview(db, "user-1", "interview-1");
  assert.deepEqual(interview.questions, ["项目经历", "技术取舍"]);
  assert.deepEqual(interview.answers, ["我负责设计组件"]);
  assert.equal(interview.status, "in_progress");
});

test("progress update is scoped to both user and interview", async () => {
  let bound;
  const db = {
    prepare(sql) {
      assert.match(sql, /WHERE user_id = \? AND id = \?/);
      return {
        bind(...args) {
          bound = args;
          return { async run() { return { success: true }; } };
        },
      };
    },
  };
  await saveInterviewProgress(db, "user-1", "interview-1", ["项目经历"], ["我的回答"], false, null, "fallback");
  assert.equal(bound[2], "in_progress");
  assert.deepEqual(bound.slice(-2), ["user-1", "interview-1"]);
});
