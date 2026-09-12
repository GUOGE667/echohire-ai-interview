"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BarChart3, BrainCircuit, Check, ChevronRight, Clock3, FileText, History, Home, Mic2, Paperclip, Play, Plus, Send, Sparkles, Target, UserRound, X } from "lucide-react";

type View = "dashboard" | "setup" | "interview" | "report" | "history" | "analytics";
const questions = [
  "请介绍一个你主导解决的前端性能问题。你如何定位瓶颈，最终结果如何？",
  "如果一个 React 页面频繁重复渲染，你会怎样系统地分析并优化？",
  "讲一次你和产品或后端意见不一致的经历。你最后如何推动项目继续进行？",
];
const navItems = [
  { label: "概览", icon: Home, view: "dashboard" as View },
  { label: "开始面试", icon: Mic2, view: "setup" as View },
  { label: "历史记录", icon: History, view: "history" as View },
  { label: "能力分析", icon: BarChart3, view: "analytics" as View },
];
const skills = [{ label: "专业深度", value: 82 }, { label: "表达结构", value: 68 }, { label: "案例证据", value: 61 }];

export default function HomePage() {
  const [view, setView] = useState<View>("dashboard");
  const [step, setStep] = useState(1);
  const [resumeName, setResumeName] = useState("");
  const [jd, setJd] = useState("");
  const [role, setRole] = useState("前端开发工程师");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const hash = location.hash.replace("#", "") as View;
    if (["dashboard", "setup", "interview", "report", "history", "analytics"].includes(hash)) setView(hash);
  }, []);

  useEffect(() => {
    type WebMCP = { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: WebMCP }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const navigate = (next: View) => { setView(next); location.hash = next; };
    void Promise.resolve(context.registerTool({
      name: "start_interview_setup",
      title: "开始创建模拟面试",
      description: "打开 EchoHire 的面试创建流程，让用户添加简历和职位描述。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input: unknown) => {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("此操作不接受参数");
        navigate("setup"); return { view: "setup", status: "ready" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({
      name: "open_latest_interview_report",
      title: "查看最近面试报告",
      description: "打开最近一次模拟面试的能力评分和改进建议。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input: unknown) => {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("此操作不接受参数");
        navigate("report"); return { view: "report", score: 78 };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function go(next: View) { setView(next); location.hash = next; window.scrollTo({ top: 0, behavior: "smooth" }); }
  function nextQuestion() {
    setSubmitted(true);
    setTimeout(() => {
      if (questionIndex === questions.length - 1) go("report");
      else { setQuestionIndex((value) => value + 1); setAnswer(""); setSubmitted(false); }
    }, 850);
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="app-shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => go("dashboard")} aria-label="EchoHire 首页"><span className="brand-mark"><BrainCircuit size={19} /></span><span>EchoHire</span></button>
          <nav className="nav-list" aria-label="主导航">{navItems.map(({ label, icon: Icon, view: itemView }) => (<button key={label} onClick={() => go(itemView)} className={`nav-item ${view === itemView ? "is-active" : ""}`} type="button"><Icon size={18} /><span>{label}</span></button>))}</nav>
          <div className="sidebar-footer"><div className="mini-profile"><span className="avatar">林</span><span><strong>林同学</strong><small>前端开发方向</small></span></div><button className="icon-button" aria-label="个人资料" type="button"><UserRound size={18} /></button></div>
        </aside>

        <section className="workspace" id="top">
          {view === "dashboard" && <Dashboard onStart={() => go("setup")} onReport={() => go("report")} />}
          {view === "setup" && <Setup step={step} setStep={setStep} resumeName={resumeName} setResumeName={setResumeName} jd={jd} setJd={setJd} role={role} setRole={setRole} onStart={() => { setQuestionIndex(0); setAnswer(""); go("interview"); }} />}
          {view === "interview" && <Interview questionIndex={questionIndex} answer={answer} setAnswer={setAnswer} submitted={submitted} onSubmit={nextQuestion} onExit={() => go("dashboard")} />}
          {view === "report" && <Report onAgain={() => go("setup")} />}
          {view === "history" && <HistoryView onOpen={() => go("report")} />}
          {view === "analytics" && <Analytics />}
        </section>
      </div>
    </main>
  );
}

function Dashboard({ onStart, onReport }: { onStart: () => void; onReport: () => void }) {
  return <><header className="topbar"><div><p className="eyebrow">9 月 12 日 · 今日训练</p><h1>准备好再进一步了吗？</h1></div><button className="primary-button" onClick={onStart}><Plus size={17} /> 开始新面试</button></header>
    <div className="dashboard-grid">
      <article className="readiness-card"><div className="card-heading"><div><span className="label">面试准备度</span><h2>综合能力状态</h2></div><span className="trend"><ArrowUpRight size={14} /> 12%</span></div><div className="readiness-content"><div className="score-orbit" aria-label="面试准备度 76 分"><div className="orbit-ring orbit-one" /><div className="orbit-ring orbit-two" /><div className="score-core"><strong>76</strong><span>/ 100</span></div></div><div className="score-copy"><span className="status-pill"><Sparkles size={13} /> 稳步提升</span><h3>你已经超过 68% 的同方向候选人</h3><p>继续加强案例中的量化结果，你的回答会更有说服力。</p><button className="text-button" onClick={onReport}>查看完整分析 <ChevronRight size={15} /></button></div></div></article>
      <article className="focus-card"><div className="focus-icon"><Target size={20} /></div><span className="label">本周训练重点</span><h2>让案例更有证据</h2><p>把“优化了页面”改成包含指标、方法与结果的完整表述。</p><div className="task-progress"><span style={{ width: "60%" }} /></div><div className="task-meta"><span>3 / 5 次训练</span><strong>60%</strong></div></article>
      <article className="recent-card"><div className="card-heading"><div><span className="label">最近面试</span><h2>前端开发工程师</h2></div><button className="icon-button" onClick={onReport} aria-label="打开面试详情"><ChevronRight size={19} /></button></div><div className="interview-row"><div className="company-mark">FE</div><div className="interview-copy"><strong>综合模拟 · 中级</strong><span><Clock3 size={13} /> 9 月 10 日 · 18 分钟</span></div><div className="compact-score"><strong>78</strong><span>良好</span></div><button className="secondary-button" onClick={onReport}><Play size={15} fill="currentColor" /> 继续复盘</button></div></article>
      <article className="skills-card"><div className="card-heading"><div><span className="label">能力分布</span><h2>最近 5 场表现</h2></div><span className="period">近 30 天</span></div><div className="skill-list">{skills.map((skill) => (<div className="skill-row" key={skill.label}><div><span>{skill.label}</span><strong>{skill.value}</strong></div><div className="skill-track"><span style={{ width: `${skill.value}%` }} /></div></div>))}</div></article>
      <article className="quick-card"><FileText size={22} /><div><span className="label">快捷开始</span><h2>用一份 JD 生成专属面试</h2></div><button className="round-button" onClick={onStart} aria-label="创建专属面试"><ArrowUpRight size={20} /></button></article>
    </div></>;
}

function Setup({ step, setStep, resumeName, setResumeName, jd, setJd, role, setRole, onStart }: { step:number; setStep:(n:number)=>void; resumeName:string; setResumeName:(s:string)=>void; jd:string; setJd:(s:string)=>void; role:string; setRole:(s:string)=>void; onStart:()=>void }) {
  const canNext = step === 1 ? !!resumeName : step === 2 ? jd.trim().length > 20 : true;
  return <div className="flow-page"><header className="flow-header"><div><p className="eyebrow">创建专属面试</p><h1>让每一道题都与你有关</h1></div><span className="step-count">{step} / 3</span></header><div className="stepper">{["添加简历", "粘贴职位", "面试设置"].map((item, index) => <div key={item} className={index + 1 <= step ? "done" : ""}><span>{index + 1 < step ? <Check size={14}/> : index + 1}</span><small>{item}</small></div>)}</div>
    <section className="form-card">
      {step === 1 && <div className="form-section"><span className="section-icon"><Paperclip size={21}/></span><h2>添加你的简历</h2><p>支持 PDF，系统会识别项目经历和技术能力。</p><label className={`upload-zone ${resumeName ? "has-file" : ""}`}><input type="file" accept="application/pdf" onChange={(event) => setResumeName(event.target.files?.[0]?.name || "")}/>{resumeName ? <><FileText size={28}/><strong>{resumeName}</strong><small>已准备好解析</small></> : <><Paperclip size={28}/><strong>选择 PDF 简历</strong><small>文件仅用于本次面试分析</small></>}</label></div>}
      {step === 2 && <div className="form-section"><span className="section-icon"><FileText size={21}/></span><h2>粘贴职位描述</h2><p>内容越完整，生成的问题越贴合真实岗位。</p><label className="field-label">职位 JD<textarea value={jd} onChange={(e)=>setJd(e.target.value)} placeholder="粘贴岗位职责、任职要求和加分项……"/></label><div className="char-count">{jd.length} 字</div></div>}
      {step === 3 && <div className="form-section"><span className="section-icon"><Target size={21}/></span><h2>设置面试方式</h2><p>你随时可以暂停，回答会自动保留在当前页面。</p><div className="field-grid"><label className="field-label">目标岗位<input value={role} onChange={(e)=>setRole(e.target.value)}/></label><label className="field-label">面试类型<select><option>综合面试</option><option>技术面试</option><option>行为面试</option></select></label><label className="field-label">难度<select><option>中级</option><option>初级</option><option>高级</option></select></label><label className="field-label">预计时长<select><option>10 分钟</option><option>20 分钟</option><option>30 分钟</option></select></label></div><div className="tag-row"><span>React</span><span>TypeScript</span><span>性能优化</span><span>团队协作</span></div></div>}
      <div className="form-actions">{step > 1 ? <button className="ghost-button" onClick={()=>setStep(step-1)}><ArrowLeft size={16}/> 上一步</button> : <span/>}<button className="primary-button" disabled={!canNext} onClick={()=> step < 3 ? setStep(step+1) : onStart()}>{step < 3 ? "继续" : "生成面试"}<ChevronRight size={16}/></button></div>
    </section></div>;
}

function Interview({ questionIndex, answer, setAnswer, submitted, onSubmit, onExit }: { questionIndex:number; answer:string; setAnswer:(s:string)=>void; submitted:boolean; onSubmit:()=>void; onExit:()=>void }) {
  return <div className="interview-page"><header className="interview-top"><button className="ghost-button" onClick={onExit}><X size={17}/> 退出</button><div className="session-title"><span>前端开发工程师</span><small>综合模拟 · 中级</small></div><span className="live-pill"><i/> AI 面试进行中</span></header><div className="interview-progress"><span style={{width:`${((questionIndex+1)/questions.length)*100}%`}}/></div>
    <div className="interview-stage"><aside className="question-rail"><span className="label">面试进度</span><strong>{questionIndex+1}<small> / {questions.length}</small></strong>{questions.map((_,i)=><div key={i} className={`rail-item ${i===questionIndex?"current":i<questionIndex?"complete":""}`}><span>{i<questionIndex?<Check size={13}/>:i+1}</span><small>{i===questionIndex?"当前问题":i<questionIndex?"已回答":"待回答"}</small></div>)}</aside>
      <section className="conversation"><div className="ai-message"><div className="ai-avatar"><BrainCircuit size={19}/></div><div><span>AI 面试官</span><h1>{questions[questionIndex]}</h1><p>请尽量说明背景、你的具体行动以及最终结果。</p></div></div><div className="answer-box"><label htmlFor="answer">你的回答</label><textarea id="answer" value={answer} onChange={(e)=>setAnswer(e.target.value)} placeholder="可以先描述当时的业务背景……"/><div className="answer-tools"><button className="mic-button" type="button" aria-label="开始录音"><Mic2 size={18}/><span>语音回答</span></button><span>{answer.length} 字</span><button className="send-button" disabled={answer.trim().length<20||submitted} onClick={onSubmit}>{submitted ? "分析中…" : "提交回答"}<Send size={16}/></button></div></div></section>
      <aside className="tip-panel"><Sparkles size={18}/><span className="label">回答提示</span><h3>试试 STAR 结构</h3><p><b>S</b> 情境：问题出现在哪里</p><p><b>T</b> 任务：你需要完成什么</p><p><b>A</b> 行动：你具体做了什么</p><p><b>R</b> 结果：带来了什么变化</p></aside></div></div>;
}

function Report({ onAgain }: { onAgain:()=>void }) {
  const dimensions=[{name:"内容相关性",score:86},{name:"表达结构",score:72},{name:"专业深度",score:81},{name:"案例证据",score:64},{name:"表达清晰度",score:84}];
  return <div className="report-page"><header className="topbar report-header"><div><p className="eyebrow">面试报告 · 9 月 12 日</p><h1>你的技术判断不错，证据还可以更锋利。</h1><p className="header-note">你准确识别了性能瓶颈，但两次关键回答没有给出优化前后的数据对比。</p></div><button className="primary-button" onClick={onAgain}><Play size={16}/> 再练一次</button></header><div className="report-grid"><article className="report-score"><div className="report-score-number"><strong>78</strong><span>综合得分</span></div><div><span className="status-pill"><ArrowUpRight size={13}/> 比上次提高 6 分</span><h2>表现良好</h2><p>已具备中级前端岗位所需的主要能力。</p></div></article><article className="dimension-card"><span className="label">能力拆解</span><h2>五维评分</h2>{dimensions.map(d=><div className="dimension-row" key={d.name}><span>{d.name}</span><div><i style={{width:`${d.score}%`}}/></div><strong>{d.score}</strong></div>)}</article><article className="evidence-card"><span className="label">关键发现</span><h2>让回答更有说服力</h2><div className="evidence-good"><Check size={17}/><div><strong>值得保留</strong><p>你说明了通过 Performance 面板定位长任务，并把问题缩小到列表渲染。</p></div></div><div className="evidence-improve"><Target size={17}/><div><strong>下一步改进</strong><p>补充“首屏渲染从 2.4 秒降至 1.1 秒”等真实指标，并解释测量方式。</p></div></div><blockquote>“我使用虚拟列表减少了页面一次性渲染的节点数量……”</blockquote></article><article className="plan-card"><span className="label">7 天提升计划</span><h2>下一轮重点训练</h2>{["准备 3 个带量化结果的项目案例","用 STAR 结构重写团队协作回答","完成一次 10 分钟技术追问训练"].map((t,i)=><div className="plan-item" key={t}><span>{i+1}</span><p>{t}</p></div>)}</article></div></div>;
}

function HistoryView({onOpen}:{onOpen:()=>void}) { return <div className="flow-page"><header className="topbar"><div><p className="eyebrow">训练档案</p><h1>历史面试</h1></div><button className="primary-button"><Plus size={17}/> 新面试</button></header><div className="history-list">{[["前端开发工程师","78","9 月 12 日"],["React 工程师","72","9 月 7 日"],["Web 前端实习生","69","8 月 29 日"]].map(([name,score,date],i)=><button className="history-item" key={name} onClick={onOpen}><span className="company-mark">{i===0?"FE":"RE"}</span><span><strong>{name}</strong><small>综合模拟 · {date}</small></span><span className="history-score">{score}<small>分</small></span><ChevronRight size={18}/></button>)}</div></div> }

function Analytics(){ return <div className="flow-page"><header className="topbar"><div><p className="eyebrow">长期能力变化</p><h1>能力分析</h1></div><span className="period">最近 30 天</span></header><div className="analytics-grid"><article className="chart-card"><span className="label">综合得分趋势</span><h2>5 场面试提高了 17 分</h2><div className="line-chart" aria-label="最近五场面试得分依次为 61、65、69、72、78"><svg viewBox="0 0 600 190" role="img"><path d="M30 150 C120 145 120 128 170 125 S245 104 295 108 S365 88 415 91 S510 55 570 49" fill="none" stroke="#8a6cff" strokeWidth="5" strokeLinecap="round"/><path d="M30 150 C120 145 120 128 170 125 S245 104 295 108 S365 88 415 91 S510 55 570 49 L570 180 L30 180Z" fill="url(#area)"/><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8a6cff" stopOpacity=".26"/><stop offset="1" stopColor="#8a6cff" stopOpacity="0"/></linearGradient></defs>{[[30,150],[170,125],[295,108],[415,91],[570,49]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="6" fill="#0f1320" stroke="#b3a4ff" strokeWidth="3"/>)}</svg><div><span>8/15</span><span>8/22</span><span>8/29</span><span>9/7</span><span>9/12</span></div></div></article><article className="analytics-summary"><span className="label">最大进步</span><strong>+21</strong><h2>专业深度</h2><p>你开始主动说明排查路径和技术取舍，而不只是描述最后方案。</p></article><article className="dimension-card wide"><span className="label">当前能力</span><h2>优势与提升空间</h2>{skills.concat([{label:"岗位匹配",value:86}]).map(s=><div className="dimension-row" key={s.label}><span>{s.label}</span><div><i style={{width:`${s.value}%`}}/></div><strong>{s.value}</strong></div>)}</article></div></div> }
