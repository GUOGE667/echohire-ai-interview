export type QuestionEvidence = { section: "项目经历" | "实习经历"; excerpt: string };

const SECTION_NAMES = /^(姓名|求职方向|个人简介|教育经历|实习经历|项目经历|专业技能)\s*[：:]/;
const ACTION = /参与|负责|主导|设计|开发|实现|搭建|优化|重构|测试|验证|部署|排查|解决|使用|基于|通过|协作|完成/;
const DETAIL = /[A-Za-z]{2,}|系统|平台|页面|组件|接口|功能|流程|模型|指标|用户|业务|缓存|性能|需求|数据|测试|体验|部署|自动化/;
const TECH_TERMS = ["React", "TypeScript", "JavaScript", "Vue", "Next.js", "Python", "Java", "SQL", "Docker", "Git", "Agent", "RAG", "数据分析", "机器学习"];

type Candidate = QuestionEvidence & { score: number };

function candidatesFromResume(resumeText: string, jd: string): Candidate[] {
  const bySection: Record<QuestionEvidence["section"], string[]> = { 项目经历: [], 实习经历: [] };
  let section: QuestionEvidence["section"] | null = null;
  for (const rawLine of resumeText.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    const header = SECTION_NAMES.exec(line);
    if (header) {
      section = header[1] === "项目经历" || header[1] === "实习经历" ? header[1] : null;
      if (section) bySection[section].push(line.slice(header[0].length).trim());
    } else if (section && line) bySection[section].push(line);
  }

  return (["项目经历", "实习经历"] as const).flatMap((name) =>
    bySection[name].flatMap((line) => line.split(/[；;。！？]/).flatMap((fragment) => {
      const excerpt = fragment.trim().slice(0, 130);
      if (excerpt.length < 18 || !ACTION.test(excerpt) || !DETAIL.test(excerpt) ||
          /^(未填写|暂无|待填写|请填写)/.test(excerpt)) return [];
      const sharedTerms = TECH_TERMS.filter((term) => jd.toLowerCase().includes(term.toLowerCase()) &&
        excerpt.toLowerCase().includes(term.toLowerCase()));
      return [{ section: name, excerpt, score: sharedTerms.length * 4 + (/[\d%]/.test(excerpt) ? 2 : 0) + Math.min(excerpt.length, 90) / 90 }];
    })),
  );
}

export function buildOfflineQuestions(role: string, jd: string, resumeText = ""): {
  questions: string[];
  questionEvidence: Array<QuestionEvidence | null>;
} {
  const text = jd.toLowerCase();
  const topic = text.includes("react") ? "React" : text.includes("python") ? "Python" : text.includes("java") ? "Java" : text.includes("数据") ? "数据分析" : "核心专业能力";
  const questions = [
    `请介绍一个最能证明你胜任${role}的项目。你承担了什么，结果如何？`,
    `这个岗位强调${topic}。请讲一次你解决相关复杂问题的完整过程和技术取舍。`,
    "如果入职后发现需求目标与现有实现冲突，你会如何和产品、设计或工程团队推进？",
    "回顾一个结果不如预期的项目。你如何复盘，并把教训应用到下一次交付中？",
  ];
  const questionEvidence: Array<QuestionEvidence | null> = Array(questions.length).fill(null);
  if (!resumeText.trim()) return { questions, questionEvidence };

  const candidates = candidatesFromResume(resumeText, jd);
  for (const [section, index] of ([ ["项目经历", 0], ["实习经历", 1] ] as const)) {
    const best = candidates.filter((candidate) => candidate.section === section).sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    questionEvidence[index] = { section, excerpt: best.excerpt };
    questions[index] = section === "项目经历"
      ? "请结合这段项目经历，说明你本人负责的关键实现、当时的技术取舍，以及你如何验证结果？"
      : "请结合这段实习经历，说明当时的任务、你具体采取的行动，以及最后有什么可核实的结果？";
  }
  return { questions, questionEvidence };
}

export function normalizeQuestionEvidence(value: unknown, count: number): Array<QuestionEvidence | null> {
  if (!Array.isArray(value)) return Array(count).fill(null);
  return Array.from({ length: count }, (_, index) => {
    const item = value[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const { section, excerpt } = item as Record<string, unknown>;
    return (section === "项目经历" || section === "实习经历") && typeof excerpt === "string" && excerpt.length >= 18 && excerpt.length <= 130
      ? { section, excerpt } : null;
  });
}
