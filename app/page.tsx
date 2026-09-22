"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  History,
  Home,
  LoaderCircle,
  Mic2,
  Paperclip,
  Play,
  Plus,
  Send,
  Sparkles,
  Target,
  UserRound,
  X,
} from "lucide-react";

type View =
  | "dashboard"
  | "setup"
  | "interview"
  | "report"
  | "history"
  | "analytics";
type Analysis = {
  source: "ai" | "fallback";
  headline: string;
  summary: string;
  overallScore: number;
  dimensions: {
    relevance: number;
    structure: number;
    depth: number;
    evidence: number;
    clarity: number;
  };
  strengths: string[];
  improvements: string[];
  actionPlan: string[];
  questionFeedback: Array<{
    questionIndex: number;
    score: number;
    feedback: string;
    betterAnswer: string;
  }>;
  agentTrace?: Array<{
    tool: string;
    title: string;
    summary: string;
    status: "completed" | "fallback";
  }>;
};
type InterviewRecord = {
  id: string;
  role: string;
  jobDescription: string;
  interviewType: string;
  difficulty: string;
  status: string;
  questions: string[];
  answers: string[];
  analysis: Analysis | null;
  aiStatus: string;
  aiModel: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
};
type User = { userId: string; displayName: string; email: string };
type SkillProfile = {
  skillKey: string;
  label: string;
  score: number;
  evidenceCount: number;
  latestInsight: string;
  updatedAt: string;
};
type ResumeHandoff = {
  name?: string;
  title?: string;
  summary?: string;
  school?: string;
  degree?: string;
  company?: string;
  role?: string;
  experience?: string;
  project?: string;
  projectRole?: string;
  projectDetail?: string;
  skills?: string;
};
const navItems = [
  { label: "概览", icon: Home, view: "dashboard" as View },
  { label: "开始面试", icon: Mic2, view: "setup" as View },
  { label: "历史记录", icon: History, view: "history" as View },
  { label: "能力分析", icon: BarChart3, view: "analytics" as View },
];
const skills = [
  { label: "专业深度", value: 82 },
  { label: "表达结构", value: 68 },
  { label: "案例证据", value: 61 },
];
const RESUME_PILOT_URL =
  "https://resumepilot-ai-career.guolinghao6.chatgpt.site/";

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "请求失败，请稍后重试。");
  return data;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function HomePage() {
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "dashboard";
    const hash = window.location.hash.replace("#", "").split("?")[0] as View;
    return [
      "dashboard",
      "setup",
      "interview",
      "report",
      "history",
      "analytics",
    ].includes(hash)
      ? hash
      : "dashboard";
  });
  const [step, setStep] = useState(1);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jd, setJd] = useState("");
  const [role, setRole] = useState("前端开发工程师");
  const [interviewType, setInterviewType] = useState("综合面试");
  const [difficulty, setDifficulty] = useState("中级");
  const [active, setActive] = useState<InterviewRecord | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [records, setRecords] = useState<InterviewRecord[]>([]);
  const [profiles, setProfiles] = useState<SkillProfile[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [storageMode, setStorageMode] = useState<"cloud" | "local">("local");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ user: User; storage: "cloud" | "local" }>("/api/session")
      .then(async (session) => {
        setUser(session.user);
        setStorageMode(session.storage);
        const saved = localStorage.getItem("echohire-interviews");
        const localRecords = saved
          ? (JSON.parse(saved) as InterviewRecord[])
          : [];
        const [history, memory] = await Promise.all([
          api<{ interviews: InterviewRecord[] }>("/api/interviews").catch(
            () => ({ interviews: [] }),
          ),
          api<{ profiles: SkillProfile[] }>("/api/memory").catch(() => ({
            profiles: [],
          })),
        ]);
        setRecords(
          history.interviews.length ? history.interviews : localRecords,
        );
        setProfiles(memory.profiles);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!loading)
      localStorage.setItem("echohire-interviews", JSON.stringify(records));
  }, [records, loading]);
  useEffect(() => {
    const query = window.location.hash.split("?")[1];
    if (!query) return;
    const encoded = new URLSearchParams(query).get("handoff");
    if (!encoded) return;
    try {
      const payload = JSON.parse(encoded) as {
        resume?: ResumeHandoff;
        jobDescription?: string;
      };
      if (!payload.resume) throw new Error("missing resume");
      const resume = payload.resume;
      const text = [
        `姓名：${resume.name || "未填写"}`,
        `求职方向：${resume.title || "未填写"}`,
        `个人简介：${resume.summary || ""}`,
        `教育经历：${resume.school || ""} ${resume.degree || ""}`,
        `实习经历：${resume.company || ""}｜${resume.role || ""}\n${resume.experience || ""}`,
        `项目经历：${resume.project || ""}｜${resume.projectRole || ""}\n${resume.projectDetail || ""}`,
        `专业技能：${resume.skills || ""}`,
      ].join("\n\n");
      setResumeText(text);
      setRole(resume.title || "目标岗位");
      setJd(payload.jobDescription || "");
      setStep(3);
      setView("setup");
      window.history.replaceState(null, "", "#setup");
    } catch {
      setError("ResumePilot 的简历信息无法读取，请返回后重新发起面试。");
    }
  }, []);
  useEffect(() => {
    type WebMCP = {
      registerTool: (
        tool: unknown,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: WebMCP })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const navigate = (next: View) => {
      setView(next);
      location.hash = next;
    };
    void Promise.resolve(
      context.registerTool(
        {
          name: "start_interview_setup",
          title: "开始创建模拟面试",
          description: "打开 EchoHire 的面试创建流程。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: () => {
            navigate("setup");
            return { view: "setup", status: "ready" };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    void Promise.resolve(
      context.registerTool(
        {
          name: "open_latest_interview_report",
          title: "查看最近面试报告",
          description: "打开最近一次已保存的模拟面试报告。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: () => {
            navigate("report");
            return { view: "report" };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function go(next: View) {
    setError("");
    setView(next);
    location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openRecord(record: InterviewRecord) {
    setActive(record);
    setQuestionIndex(
      Math.min(record.answers.length, record.questions.length - 1),
    );
    go(record.status === "completed" ? "report" : "interview");
  }
  async function createInterview() {
    if (!resumeFile && !resumeText) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      if (resumeFile) form.append("file", resumeFile);
      if (resumeText) form.append("resumeText", resumeText);
      form.append("role", role);
      form.append("jobDescription", jd);
      form.append("interviewType", interviewType);
      form.append("difficulty", difficulty);
      const result = await api<{ interview: InterviewRecord }>(
        "/api/interviews",
        { method: "POST", body: form },
      );
      setActive(result.interview);
      setRecords((items) => [result.interview, ...items]);
      setQuestionIndex(0);
      setAnswer("");
      go("interview");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建失败，请重试。");
    } finally {
      setSaving(false);
    }
  }
  async function submitAnswer() {
    if (!active) return;
    setSaving(true);
    setError("");
    const answers = [...active.answers];
    answers[questionIndex] = answer.trim();
    const complete = questionIndex === active.questions.length - 1;
    try {
      const saved = await api<{
        score: number | null;
        analysis: Analysis | null;
        aiStatus: string;
      }>("/api/interviews", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: active.id,
          role: active.role,
          jobDescription: active.jobDescription,
          questions: active.questions,
          answers,
          complete,
        }),
      });
      const updated = {
        ...active,
        answers,
        status: complete ? "completed" : "in_progress",
        score: saved.score,
        analysis: saved.analysis,
        aiStatus: saved.aiStatus,
        updatedAt: new Date().toISOString(),
      };
      setActive(updated);
      setRecords((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (complete) {
        const memory = await api<{ profiles: SkillProfile[] }>(
          "/api/memory",
        ).catch(() => ({ profiles: [] }));
        if (memory.profiles.length) setProfiles(memory.profiles);
        go("report");
      } else {
        setQuestionIndex((value) => value + 1);
        setAnswer("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  }

  const latest = active ?? records[0] ?? null;
  const displayName = user?.displayName?.split(/[\s@]/)[0] || "同学";
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="app-shell">
        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => go("dashboard")}
            aria-label="EchoHire 首页"
          >
            <span className="brand-mark">
              <BrainCircuit size={19} />
            </span>
            <span>EchoHire</span>
          </button>
          <nav className="nav-list" aria-label="主导航">
            {navItems.map(({ label, icon: Icon, view: itemView }) => (
              <button
                key={label}
                onClick={() => go(itemView)}
                className={`nav-item ${view === itemView ? "is-active" : ""}`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="mini-profile">
              <span className="avatar">{displayName.slice(0, 1)}</span>
              <span>
                <strong>{displayName}</strong>
                <small>{user?.email || "数据同步中"}</small>
              </span>
            </div>
            <button className="icon-button" aria-label="个人资料">
              <UserRound size={18} />
            </button>
          </div>
        </aside>
        <section className="workspace" id="top">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="关闭">
                <X size={15} />
              </button>
            </div>
          )}
          {loading ? (
            <Loading />
          ) : (
            <>
              {view === "dashboard" && (
                <Dashboard
                  records={records}
                  profiles={profiles}
                  storageMode={storageMode}
                  onStart={() => go("setup")}
                  onOpen={openRecord}
                />
              )}{" "}
              {view === "setup" && (
                <Setup
                  step={step}
                  setStep={setStep}
                  resumeFile={resumeFile}
                  setResumeFile={setResumeFile}
                  resumeText={resumeText}
                  setResumeText={setResumeText}
                  jd={jd}
                  setJd={setJd}
                  role={role}
                  setRole={setRole}
                  interviewType={interviewType}
                  setInterviewType={setInterviewType}
                  difficulty={difficulty}
                  setDifficulty={setDifficulty}
                  saving={saving}
                  onStart={createInterview}
                />
              )}{" "}
              {view === "interview" && active && (
                <Interview
                  record={active}
                  questionIndex={questionIndex}
                  answer={answer}
                  setAnswer={setAnswer}
                  saving={saving}
                  onSubmit={submitAnswer}
                  onExit={() => go("dashboard")}
                />
              )}{" "}
              {view === "interview" && !active && (
                <Empty
                  title="还没有进行中的面试"
                  action="创建第一场面试"
                  onAction={() => go("setup")}
                />
              )}{" "}
              {view === "report" && (
                <Report record={latest} onAgain={() => go("setup")} />
              )}{" "}
              {view === "history" && (
                <HistoryView
                  records={records}
                  onOpen={openRecord}
                  onStart={() => go("setup")}
                />
              )}{" "}
              {view === "analytics" && (
                <Analytics
                  records={records}
                  profiles={profiles}
                  onStart={() => go("setup")}
                />
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Loading() {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin-icon" size={28} />
      <p>正在载入你的训练档案…</p>
    </div>
  );
}
function Empty({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <BrainCircuit size={30} />
      <h2>{title}</h2>
      <p>完成的训练会安全保存在你的账户档案中。</p>
      <button className="primary-button" onClick={onAction}>
        <Plus size={16} />
        {action}
      </button>
    </div>
  );
}

function Dashboard({
  records,
  profiles,
  storageMode,
  onStart,
  onOpen,
}: {
  records: InterviewRecord[];
  profiles: SkillProfile[];
  storageMode: "cloud" | "local";
  onStart: () => void;
  onOpen: (r: InterviewRecord) => void;
}) {
  const completed = records.filter((r) => r.status === "completed");
  const recent = records[0];
  const average = completed.length
    ? Math.round(
        completed.reduce((s, r) => s + (r.score || 0), 0) / completed.length,
      )
    : 0;
  const displaySkills = profiles.length
    ? profiles.slice(0, 3).map((profile) => ({
        label: profile.label,
        value: profile.score,
      }))
    : skills;
  const focus = profiles[0];
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            今日训练 · {storageMode === "cloud" ? "账户云端同步" : "本地安全保存"}
          </p>
          <h1>准备好再进一步了吗？</h1>
        </div>
        <button className="primary-button" onClick={onStart}>
          <Plus size={17} />
          开始新面试
        </button>
      </header>
      <div className="dashboard-grid">
        <article className="readiness-card">
          <div className="card-heading">
            <div>
              <span className="label">面试准备度</span>
              <h2>综合能力状态</h2>
            </div>
            <span className="trend">
              <ArrowUpRight size={14} />
              {completed.length} 场已完成
            </span>
          </div>
          <div className="readiness-content">
            <div className="score-orbit">
              <div className="orbit-ring orbit-one" />
              <div className="orbit-ring orbit-two" />
              <div className="score-core">
                <strong>{average || "—"}</strong>
                <span>{average ? "/ 100" : "等待首场"}</span>
              </div>
            </div>
            <div className="score-copy">
              <span className="status-pill">
                <Sparkles size={13} />
                真实训练数据
              </span>
              <h3>
                {average
                  ? "你的每一次回答都已进入长期档案"
                  : "完成第一场面试，建立能力基线"}
              </h3>
              <p>
                {storageMode === "cloud"
                  ? "岗位、答题进度和能力变化已进入你的长期档案。"
                  : "当前为本地预览，数据同时保留在浏览器中。"}
              </p>
              {recent && (
                <button className="text-button" onClick={() => onOpen(recent)}>
                  查看最近记录 <ChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        </article>
        <article className="focus-card">
          <div className="focus-icon">
            <Target size={20} />
          </div>
          <span className="label">本周训练重点</span>
          <h2>{focus ? `加强${focus.label}` : "让案例更有证据"}</h2>
          <p>
            {focus?.latestInsight ||
              "把“优化了页面”改成包含指标、方法与结果的完整表述。"}
          </p>
          <div className="task-progress">
            <span
              style={{ width: `${Math.min(100, completed.length * 20)}%` }}
            />
          </div>
          <div className="task-meta">
            <span>{completed.length} / 5 次训练</span>
            <strong>{Math.min(100, completed.length * 20)}%</strong>
          </div>
        </article>
        <article className="recent-card">
          <div className="card-heading">
            <div>
              <span className="label">最近面试</span>
              <h2>{recent?.role || "暂无记录"}</h2>
            </div>
            {recent && (
              <button className="icon-button" onClick={() => onOpen(recent)}>
                <ChevronRight size={19} />
              </button>
            )}
          </div>
          {recent ? (
            <div className="interview-row">
              <div className="company-mark">{recent.role.slice(0, 2)}</div>
              <div className="interview-copy">
                <strong>
                  {recent.interviewType} · {recent.difficulty}
                </strong>
                <span>
                  <Clock3 size={13} />
                  {formatDate(recent.createdAt)} ·{" "}
                  {recent.status === "completed" ? "已完成" : "进行中"}
                </span>
              </div>
              <div className="compact-score">
                <strong>{recent.score ?? "—"}</strong>
                <span>{recent.score ? "已评分" : "待完成"}</span>
              </div>
              <button
                className="secondary-button"
                onClick={() => onOpen(recent)}
              >
                <Play size={15} />
                {recent.status === "completed" ? "查看复盘" : "继续面试"}
              </button>
            </div>
          ) : (
            <p className="muted-copy">
              上传简历和职位描述，开始第一场专属训练。
            </p>
          )}
        </article>
        <article className="skills-card">
          <div className="card-heading">
            <div>
              <span className="label">能力分布</span>
              <h2>训练关注点</h2>
            </div>
            <span className="period">持续更新</span>
          </div>
          <div className="skill-list">
            {displaySkills.map((s) => (
              <div className="skill-row" key={s.label}>
                <div>
                  <span>{s.label}</span>
                  <strong>{completed.length ? s.value : "—"}</strong>
                </div>
                <div className="skill-track">
                  <span
                    style={{ width: completed.length ? `${s.value}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="quick-card">
          <FileText size={22} />
          <div>
            <span className="label">快捷开始</span>
            <h2>用一份 JD 生成专属面试</h2>
          </div>
          <button className="round-button" onClick={onStart}>
            <ArrowUpRight size={20} />
          </button>
        </article>
      </div>
    </>
  );
}

function Setup(p: {
  step: number;
  setStep: (n: number) => void;
  resumeFile: File | null;
  setResumeFile: (f: File | null) => void;
  resumeText: string;
  setResumeText: (s: string) => void;
  jd: string;
  setJd: (s: string) => void;
  role: string;
  setRole: (s: string) => void;
  interviewType: string;
  setInterviewType: (s: string) => void;
  difficulty: string;
  setDifficulty: (s: string) => void;
  saving: boolean;
  onStart: () => void;
}) {
  const canNext =
    p.step === 1
      ? !!p.resumeFile || !!p.resumeText
      : p.step === 2
        ? p.jd.trim().length >= 20
        : !!p.role.trim() &&
          p.jd.trim().length >= 20 &&
          !!(p.resumeFile || p.resumeText);
  return (
    <div className="flow-page">
      <header className="flow-header">
        <div>
          <p className="eyebrow">创建专属面试</p>
          <h1>让每一道题都与你有关</h1>
        </div>
        <span className="step-count">{p.step} / 3</span>
      </header>
      <div className="stepper">
        {["添加简历", "粘贴职位", "面试设置"].map((item, index) => (
          <div key={item} className={index + 1 <= p.step ? "done" : ""}>
            <span>{index + 1 < p.step ? <Check size={14} /> : index + 1}</span>
            <small>{item}</small>
          </div>
        ))}
      </div>
      <section className="form-card">
        {p.step === 1 && (
          <div className="form-section">
            <span className="section-icon">
              <Paperclip size={21} />
            </span>
            <h2>添加你的简历</h2>
            <p>
              支持 ResumePilot 一键导入或 PDF 上传，仅在生成本次面试问题时处理。
            </p>
            {p.resumeText ? (
              <div className="imported-resume">
                <span>
                  <Check size={18} />
                </span>
                <div>
                  <strong>ResumePilot 简历已导入</strong>
                  <small>个人简介、经历、项目和技能均已就绪</small>
                </div>
                <button type="button" onClick={() => p.setResumeText("")}>
                  改用 PDF
                </button>
              </div>
            ) : (
              <label
                className={`upload-zone ${p.resumeFile ? "has-file" : ""}`}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => p.setResumeFile(e.target.files?.[0] || null)}
                />
                {p.resumeFile ? (
                  <>
                    <FileText size={28} />
                    <strong>{p.resumeFile.name}</strong>
                    <small>
                      {(p.resumeFile.size / 1024 / 1024).toFixed(2)} MB ·
                      待用于本次生成
                    </small>
                  </>
                ) : (
                  <>
                    <Paperclip size={28} />
                    <strong>选择 PDF 简历</strong>
                    <small>仅用于生成本次面试</small>
                  </>
                )}
              </label>
            )}
          </div>
        )}
        {p.step === 2 && (
          <div className="form-section">
            <span className="section-icon">
              <FileText size={21} />
            </span>
            <h2>粘贴职位描述</h2>
            <p>内容越完整，生成的问题越贴合真实岗位。</p>
            <label className="field-label">
              职位 JD
              <textarea
                value={p.jd}
                onChange={(e) => p.setJd(e.target.value)}
                placeholder="粘贴岗位职责、任职要求和加分项……"
              />
            </label>
            <div className="char-count">{p.jd.length} 字 · 至少 20 字</div>
          </div>
        )}
        {p.step === 3 && (
          <div className="form-section">
            <span className="section-icon">
              <Target size={21} />
            </span>
            <h2>设置面试方式</h2>
            <p>
              {p.resumeText
                ? "ResumePilot 简历与职位 JD 已自动带入，请确认设置后开始。"
                : "AI 将结合简历与职位要求生成问题，回答会在每题提交后自动保存。"}
            </p>
            {p.resumeText && (
              <div className="handoff-note">
                <Check size={16} />
                已连接 ResumePilot · 简历和 JD 均已就绪
              </div>
            )}
            <div className="field-grid">
              <label className="field-label">
                目标岗位
                <input
                  value={p.role}
                  onChange={(e) => p.setRole(e.target.value)}
                />
              </label>
              <label className="field-label">
                面试类型
                <select
                  value={p.interviewType}
                  onChange={(e) => p.setInterviewType(e.target.value)}
                >
                  <option>综合面试</option>
                  <option>技术面试</option>
                  <option>行为面试</option>
                </select>
              </label>
              <label className="field-label">
                难度
                <select
                  value={p.difficulty}
                  onChange={(e) => p.setDifficulty(e.target.value)}
                >
                  <option>初级</option>
                  <option>中级</option>
                  <option>高级</option>
                </select>
              </label>
              <label className="field-label">
                数据保存
                <input value="账户云端保存" readOnly />
              </label>
            </div>
            <div className="tag-row">
              <span>AI 岗位定制</span>
              <span>逐题复盘</span>
              <span>简历不留存</span>
              <span>能力档案</span>
            </div>
          </div>
        )}
        <div className="form-actions">
          {p.step > 1 ? (
            <button
              className="ghost-button"
              onClick={() => p.setStep(p.step - 1)}
            >
              <ArrowLeft size={16} />
              上一步
            </button>
          ) : (
            <span />
          )}
          <button
            className="primary-button"
            disabled={!canNext || p.saving}
            onClick={() => (p.step < 3 ? p.setStep(p.step + 1) : p.onStart())}
          >
            {p.saving ? (
              <>
                <LoaderCircle className="spin-icon" size={16} />
                AI 正在准备
              </>
            ) : (
              <>
                {p.step < 3 ? "继续" : "生成面试"}
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function Interview({
  record,
  questionIndex,
  answer,
  setAnswer,
  saving,
  onSubmit,
  onExit,
}: {
  record: InterviewRecord;
  questionIndex: number;
  answer: string;
  setAnswer: (s: string) => void;
  saving: boolean;
  onSubmit: () => void;
  onExit: () => void;
}) {
  return (
    <div className="interview-page">
      <header className="interview-top">
        <button className="ghost-button" onClick={onExit}>
          <X size={17} />
          退出
        </button>
        <div className="session-title">
          <span>{record.role}</span>
          <small>
            {record.interviewType} · {record.difficulty}
          </small>
        </div>
        <span className="live-pill">
          <i />
          答题后自动保存
        </span>
      </header>
      <div className="interview-progress">
        <span
          style={{
            width: `${((questionIndex + 1) / record.questions.length) * 100}%`,
          }}
        />
      </div>
      <div className="interview-stage">
        <aside className="question-rail">
          <span className="label">面试进度</span>
          <strong>
            {questionIndex + 1}
            <small> / {record.questions.length}</small>
          </strong>
          {record.questions.map((_, i) => (
            <div
              key={i}
              className={`rail-item ${i === questionIndex ? "current" : i < questionIndex ? "complete" : ""}`}
            >
              <span>{i < questionIndex ? <Check size={13} /> : i + 1}</span>
              <small>
                {i === questionIndex
                  ? "当前问题"
                  : i < questionIndex
                    ? "已保存"
                    : "待回答"}
              </small>
            </div>
          ))}
        </aside>
        <section className="conversation">
          <div className="ai-message">
            <div className="ai-avatar">
              <BrainCircuit size={19} />
            </div>
            <div>
              <span>岗位面试官</span>
              <h1>{record.questions[questionIndex]}</h1>
              <p>请尽量说明背景、你的具体行动以及最终结果。</p>
            </div>
          </div>
          <div className="answer-box">
            <label htmlFor="answer">你的回答</label>
            <textarea
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="可以先描述当时的业务背景……"
            />
            <div className="answer-tools">
              <button className="mic-button" type="button">
                <Mic2 size={18} />
                <span>语音回答（即将上线）</span>
              </button>
              <span>{answer.length} 字</span>
              <button
                className="send-button"
                disabled={answer.trim().length < 20 || saving}
                onClick={onSubmit}
              >
                {saving ? "保存中…" : "提交并保存"}
                <Send size={16} />
              </button>
            </div>
          </div>
        </section>
        <aside className="tip-panel">
          <Sparkles size={18} />
          <span className="label">回答提示</span>
          <h3>试试 STAR 结构</h3>
          <p>
            <b>S</b> 情境：问题出现在哪里
          </p>
          <p>
            <b>T</b> 任务：你需要完成什么
          </p>
          <p>
            <b>A</b> 行动：你具体做了什么
          </p>
          <p>
            <b>R</b> 结果：带来了什么变化
          </p>
        </aside>
      </div>
    </div>
  );
}

function Report({
  record,
  onAgain,
}: {
  record: InterviewRecord | null;
  onAgain: () => void;
}) {
  if (!record)
    return (
      <Empty
        title="还没有可以查看的报告"
        action="开始一次面试"
        onAction={onAgain}
      />
    );
  const analysis = record.analysis;
  const dimensions = analysis
    ? [
        { name: "岗位相关性", score: analysis.dimensions.relevance },
        { name: "表达结构", score: analysis.dimensions.structure },
        { name: "专业深度", score: analysis.dimensions.depth },
        { name: "案例证据", score: analysis.dimensions.evidence },
        { name: "表达清晰度", score: analysis.dimensions.clarity },
      ]
    : [];
  const feedbackUrl = analysis
    ? `${RESUME_PILOT_URL}#career-feedback=${encodeURIComponent(JSON.stringify({ source: "echohire", role: record.role, score: record.score, headline: analysis.headline, summary: analysis.summary, strengths: analysis.strengths, improvements: analysis.improvements, actionPlan: analysis.actionPlan }))}`
    : RESUME_PILOT_URL;
  return (
    <div className="report-page">
      <header className="topbar report-header">
        <div>
          <p className="eyebrow">
            {analysis?.source === "ai" ? "AI Agent 深度报告" : "内容分析报告"} ·{" "}
            {formatDate(record.createdAt)}
          </p>
          <h1>{analysis?.headline || "这场面试仍在进行中。"}</h1>
          <p className="header-note">
            {analysis?.summary ||
              "完成全部问题后，系统会生成逐题分析和改进建议。"}
          </p>
        </div>
        <div className="report-actions">
          <button className="secondary-button" onClick={onAgain}>
            <Play size={16} />
            再练一次
          </button>
          {analysis && (
            <a className="primary-button" href={feedbackUrl}>
              返回 ResumePilot 优化简历
              <ArrowUpRight size={16} />
            </a>
          )}
        </div>
      </header>
      <div className="report-grid">
        <article className="report-score">
          <div className="report-score-number">
            <strong>{record.score ?? "—"}</strong>
            <span>综合得分</span>
          </div>
          <div>
            <span
              className={`status-pill ${analysis?.source === "ai" ? "" : "fallback-pill"}`}
            >
              <Sparkles size={13} />
              {analysis?.source === "ai"
                ? "Agent 已完成工具分析"
                : "已按回答内容分析"}
            </span>
            <h2>{record.role}</h2>
            <p>
              {record.interviewType} · {record.difficulty} ·{" "}
              {record.answers.length}/{record.questions.length} 题
            </p>
          </div>
        </article>
        <article className="dimension-card">
          <span className="label">能力拆解</span>
          <h2>五维评分</h2>
          {dimensions.map((d) => (
            <div className="dimension-row" key={d.name}>
              <span>{d.name}</span>
              <div>
                <i style={{ width: `${d.score}%` }} />
              </div>
              <strong>{d.score}</strong>
            </div>
          ))}
        </article>
        <article className="evidence-card">
          <span className="label">关键发现</span>
          <h2>亮点与改进</h2>
          <div className="evidence-good">
            <Check size={17} />
            <div>
              <strong>值得保留</strong>
              <p>
                {analysis?.strengths[0] || "完成整场面试并保存了全部回答。"}
              </p>
            </div>
          </div>
          <div className="evidence-improve">
            <Target size={17} />
            <div>
              <strong>优先改进</strong>
              <p>
                {analysis?.improvements[0] ||
                  "补充具体行动、技术取舍和量化结果。"}
              </p>
            </div>
          </div>
        </article>
        <article className="plan-card">
          <span className="label">下一轮建议</span>
          <h2>个性化行动计划</h2>
          {(
            analysis?.actionPlan || [
              "重做最薄弱的一道题",
              "补齐项目量化结果",
              "准备两分钟精简版本",
            ]
          ).map((t, i) => (
            <div className="plan-item" key={t}>
              <span>{i + 1}</span>
              <p>{t}</p>
            </div>
          ))}
        </article>
      </div>
      {analysis?.agentTrace?.length ? (
        <section className="agent-trace">
          <div className="trace-heading">
            <span className="label">Agent 执行轨迹</span>
            <h2>这份报告是怎样生成的</h2>
          </div>
          <div className="trace-list">
            {analysis.agentTrace.map((step, index) => (
              <article
                key={`${step.tool}-${index}`}
                className={step.status === "fallback" ? "is-fallback" : ""}
              >
                <span className="trace-index">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.summary}</p>
                  <code>{step.tool}</code>
                </div>
                <Check size={17} />
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {analysis?.questionFeedback?.length ? (
        <section className="feedback-section">
          <div className="feedback-heading">
            <span className="label">逐题复盘</span>
            <h2>把每个回答打磨成可复用案例</h2>
          </div>
          <div className="feedback-list">
            {analysis.questionFeedback.map((item, index) => (
              <article className="feedback-card" key={item.questionIndex}>
                <div className="feedback-score">
                  <span>问题 {index + 1}</span>
                  <strong>{item.score}</strong>
                </div>
                <div>
                  <h3>
                    {record.questions[item.questionIndex] ||
                      record.questions[index]}
                  </h3>
                  <p>{item.feedback}</p>
                  <div className="better-answer">
                    <Sparkles size={15} />
                    <span>
                      <b>优化方向</b>
                      {item.betterAnswer}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HistoryView({
  records,
  onOpen,
  onStart,
}: {
  records: InterviewRecord[];
  onOpen: (r: InterviewRecord) => void;
  onStart: () => void;
}) {
  return (
    <div className="flow-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">账户训练档案</p>
          <h1>历史面试</h1>
        </div>
        <button className="primary-button" onClick={onStart}>
          <Plus size={17} />
          新面试
        </button>
      </header>
      {records.length ? (
        <div className="history-list">
          {records.map((r) => (
            <button
              className="history-item"
              key={r.id}
              onClick={() => onOpen(r)}
            >
              <span className="company-mark">{r.role.slice(0, 2)}</span>
              <span>
                <strong>{r.role}</strong>
                <small>
                  {r.interviewType} · {formatDate(r.createdAt)} ·{" "}
                  {r.status === "completed" ? "已完成" : "进行中"}
                </small>
              </span>
              <span className="history-score">
                {r.score ?? "—"}
                <small>{r.score ? "分" : ""}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="训练档案还是空的"
          action="创建第一场面试"
          onAction={onStart}
        />
      )}
    </div>
  );
}

function Analytics({
  records,
  profiles,
  onStart,
}: {
  records: InterviewRecord[];
  profiles: SkillProfile[];
  onStart: () => void;
}) {
  const scores = records
    .filter((r) => r.score !== null)
    .slice(0, 5)
    .reverse()
    .map((r) => r.score as number);
  const average = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const points = scores.map((score, i) => ({
    x: 30 + i * (540 / Math.max(1, scores.length - 1)),
    y: 175 - score * 1.45,
  }));
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const displaySkills = profiles.length
    ? profiles.map((profile) => ({ label: profile.label, value: profile.score }))
    : skills.concat([{ label: "岗位匹配", value: 86 }]);
  return (
    <div className="flow-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">真实训练趋势</p>
          <h1>能力分析</h1>
        </div>
        <span className="period">最近 {scores.length} 场</span>
      </header>
      {scores.length ? (
        <div className="analytics-grid">
          <article className="chart-card">
            <span className="label">综合得分趋势</span>
            <h2>平均得分 {average}</h2>
            <div className="line-chart">
              <svg viewBox="0 0 600 190">
                <path
                  d={path}
                  fill="none"
                  stroke="#8a6cff"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    fill="#0f1320"
                    stroke="#b3a4ff"
                    strokeWidth="3"
                  />
                ))}
              </svg>
              <div>
                {scores.map((_, i) => (
                  <span key={i}>第 {i + 1} 场</span>
                ))}
              </div>
            </div>
          </article>
          <article className="analytics-summary">
            <span className="label">训练累计</span>
            <strong>{records.length}</strong>
            <h2>场面试</h2>
            <p>数据来自你的真实面试记录，不再使用演示样本。</p>
          </article>
          <article className="dimension-card wide">
            <span className="label">当前能力</span>
            <h2>阶段性关注点</h2>
            {displaySkills.map((s) => (
              <div className="dimension-row" key={s.label}>
                <span>{s.label}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.min(100, Math.round((s.value + average) / 2))}%`,
                    }}
                  />
                </div>
                <strong>
                  {Math.min(100, Math.round((s.value + average) / 2))}
                </strong>
              </div>
            ))}
          </article>
        </div>
      ) : (
        <Empty
          title="完成面试后才能生成趋势"
          action="开始训练"
          onAction={onStart}
        />
      )}
    </div>
  );
}
