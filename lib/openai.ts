export type InterviewAnalysis = {
  source: "ai" | "fallback";
  headline: string;
  summary: string;
  overallScore: number;
  dimensions: { relevance:number; structure:number; depth:number; evidence:number; clarity:number };
  strengths: string[];
  improvements: string[];
  actionPlan: string[];
  questionFeedback: Array<{ questionIndex:number; score:number; feedback:string; betterAnswer:string }>;
};

const DEFAULT_MODEL = "gpt-5.4-mini";

function outputText(payload: unknown) {
  const response = payload as { output_text?:string; output?:Array<{content?:Array<{type?:string;text?:string}>}> };
  if (response.output_text) return response.output_text;
  return response.output?.flatMap(item=>item.content??[]).find(item=>item.type==="output_text")?.text ?? "";
}

async function structuredResponse<T>(name:string,schema:Record<string,unknown>,instructions:string,input:Array<Record<string,unknown>>):Promise<{data:T;model:string}> {
  const apiKey=process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_UNAVAILABLE");
  const model=process.env.OPENAI_MODEL||DEFAULT_MODEL;
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"authorization":`Bearer ${apiKey}`,"content-type":"application/json"},
    body:JSON.stringify({model,store:false,instructions,input,text:{format:{type:"json_schema",name,strict:true,schema}},max_output_tokens:2200}),
    signal:AbortSignal.timeout(45000),
  });
  if(!response.ok){const detail=await response.text();console.error("OpenAI response error",response.status,detail.slice(0,500));throw new Error(`OPENAI_API_${response.status}`)}
  const payload=await response.json();
  const text=outputText(payload);
  if(!text)throw new Error("OPENAI_EMPTY_OUTPUT");
  return {data:JSON.parse(text) as T,model};
}

function arrayBufferToBase64(buffer:ArrayBuffer){const bytes=new Uint8Array(buffer);let binary="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)}

export async function generateInterviewQuestions(input:{role:string;jd:string;interviewType:string;difficulty:string;resume?:{name:string;bytes:ArrayBuffer};resumeText?:string}){
  const content:Array<Record<string,unknown>>=[{type:"input_text",text:`目标岗位：${input.role}\n面试类型：${input.interviewType}\n难度：${input.difficulty}\n职位描述：\n${input.jd}`}];
  if(input.resumeText)content.push({type:"input_text",text:`候选人简历（由 ResumePilot 导入）：\n${input.resumeText}`});
  if(input.resume)content.push({type:"input_file",filename:input.resume.name,file_data:`data:application/pdf;base64,${arrayBufferToBase64(input.resume.bytes)}`});
  return structuredResponse<{questions:string[]}>("interview_questions",{type:"object",additionalProperties:false,properties:{questions:{type:"array",minItems:4,maxItems:4,items:{type:"string"}}},required:["questions"]},"你是一位严格但友善的中文面试官。根据候选人简历与职位描述生成4道互不重复的问题，覆盖项目证据、岗位技能、技术取舍与协作场景。问题必须具体、可口头回答，不得捏造简历内容。",[{role:"user",content}]);
}

export async function analyzeInterview(input:{role:string;jd:string;questions:string[];answers:string[]}){
  const pairs=input.questions.map((question,index)=>({question,answer:input.answers[index]||"未回答"}));
  const dimension={type:"object",additionalProperties:false,properties:{relevance:{type:"integer",minimum:0,maximum:100},structure:{type:"integer",minimum:0,maximum:100},depth:{type:"integer",minimum:0,maximum:100},evidence:{type:"integer",minimum:0,maximum:100},clarity:{type:"integer",minimum:0,maximum:100}},required:["relevance","structure","depth","evidence","clarity"]};
   const schema={type:"object",additionalProperties:false,properties:{headline:{type:"string"},summary:{type:"string"},overallScore:{type:"integer",minimum:0,maximum:100},dimensions:dimension,strengths:{type:"array",minItems:2,maxItems:2,items:{type:"string"}},improvements:{type:"array",minItems:3,maxItems:3,items:{type:"string"}},actionPlan:{type:"array",minItems:3,maxItems:3,items:{type:"string"}},questionFeedback:{type:"array",minItems:pairs.length,maxItems:pairs.length,items:{type:"object",additionalProperties:false,properties:{questionIndex:{type:"integer"},score:{type:"integer",minimum:0,maximum:100},feedback:{type:"string"},betterAnswer:{type:"string"}},required:["questionIndex","score","feedback","betterAnswer"]}}},required:["headline","summary","overallScore","dimensions","strengths","improvements","actionPlan","questionFeedback"]};
  const result=await structuredResponse<Omit<InterviewAnalysis,"source">>("interview_analysis",schema,"你是一位专业、具体且友善的中文求职教练。严格依据岗位描述和候选人的实际回答评分。逐题检查岗位相关性、STAR结构、个人行动、专业深度、方案取舍、量化证据与表达清晰度。每题反馈必须先概括或引用该回答中的至少一个具体信息，再指出最值得补充的一到两个要素；不得只因字数少就判定回答差，也不要在不同题目中重复同一句建议。优化方向必须具体可执行，不得虚构候选人未提供的经历或数据。",[{role:"user",content:[{type:"input_text",text:`目标岗位：${input.role}\n职位描述：\n${input.jd}\n\n问答记录：\n${JSON.stringify(pairs)}`}]}]);
  return {data:{...result.data,source:"ai" as const},model:result.model};
}

type AnswerSignals = {
  text:string;
  context:boolean;
  action:boolean;
  result:boolean;
  evidence:boolean;
  ownership:boolean;
  tradeoff:boolean;
  collaboration:boolean;
  reflection:boolean;
};

const signalPatterns = {
  context: /当时|背景|场景|项目中|团队|需求|目标|负责|遇到|面临|为了/,
  action: /我(?:先|负责|通过|采用|选择|设计|实现|分析|推动|协调|优化|拆分|排查|制定|搭建|完成|增加|调整|验证|测试)|具体|步骤|方案/,
  result: /最终|结果|因此|从而|上线|交付|完成|解决|达成|提升|降低|减少|增加|改善|获得/,
  evidence: /\d+(?:\.\d+)?\s*(?:%|个|人|名|次|倍|毫秒|秒|分钟|小时|天|周|月|条|项|家|万|千)?|百分之[一二三四五六七八九十百]+|从.{1,20}(?:到|至).{1,20}/,
  ownership: /我(?:负责|主导|提出|设计|实现|推动|增加|调整|采用|选择|协调|组织|完成)|我的职责|由我|个人负责/,
  tradeoff: /取舍|权衡|相比|对比|原因|因为|考虑到|选择.+而不是|优缺点|成本/,
  collaboration: /协作|沟通|同步|对齐|产品|设计|工程|前端|后端|测试|同学|成员|团队|评审/,
  reflection: /复盘|反思|学到|教训|改进|下一次|如果重来|后来我|不足|避免再次/,
};

function inspectAnswer(raw:string):AnswerSignals{
  const text=raw.trim();
  return {
    text,
    context:signalPatterns.context.test(text),
    action:signalPatterns.action.test(text),
    result:signalPatterns.result.test(text),
    evidence:signalPatterns.evidence.test(text),
    ownership:signalPatterns.ownership.test(text),
    tradeoff:signalPatterns.tradeoff.test(text),
    collaboration:signalPatterns.collaboration.test(text),
    reflection:signalPatterns.reflection.test(text),
  };
}

function questionIntent(question:string){
  if(/协作|沟通|产品|设计|团队|冲突|推进/.test(question))return "collaboration" as const;
  if(/复盘|不如预期|失败|教训|改进/.test(question))return "reflection" as const;
  if(/技术|方案|取舍|复杂问题|实现/.test(question))return "technical" as const;
  return "project" as const;
}

function answerExcerpt(text:string){
  const compact=text.replace(/\s+/g," ").replace(/[。！？；][\s\S]*$/,"").trim();
  if(!compact)return "";
  return compact.length>34?`${compact.slice(0,34)}…`:compact;
}

function scoreAnswer(signals:AnswerSignals,intent:ReturnType<typeof questionIntent>){
  if(!signals.text)return 35;
  let score=48;
  score+=signals.context?6:0;
  score+=signals.action?10:0;
  score+=signals.ownership?6:0;
  score+=signals.result?9:0;
  score+=signals.evidence?8:0;
  score+=signals.tradeoff?6:0;
  if(intent==="collaboration")score+=signals.collaboration?8:-4;
  if(intent==="reflection")score+=signals.reflection?8:-4;
  if(intent==="technical")score+=signals.tradeoff?4:-3;
  if(intent==="project")score+=signals.result?3:0;
  score+=signals.text.length>=45?3:signals.text.length>=20?1:0;
  return Math.max(35,Math.min(94,score));
}

function feedbackFor(question:string,signals:AnswerSignals){
  const intent=questionIntent(question);
  const excerpt=answerExcerpt(signals.text);
  if(!signals.text)return {
    score:35,
    feedback:"这道题目前没有有效回答。先写出一个真实案例，再补充你本人采取的行动和最终结果。",
    betterAnswer:"先用一句话说明当时的场景与目标，再依次回答“我做了什么—为什么这样做—产生了什么结果”。",
  };

  const strengths:string[]=[];
  if(signals.action)strengths.push("说明了具体行动");
  if(signals.ownership)strengths.push("个人职责比较清楚");
  if(signals.tradeoff)strengths.push("交代了选择依据或取舍");
  if(signals.evidence)strengths.push("提供了数据或可验证证据");
  if(intent==="collaboration"&&signals.collaboration)strengths.push("覆盖了协作过程");
  if(intent==="reflection"&&signals.reflection)strengths.push("给出了复盘和改进");
  if(signals.result)strengths.push("回答包含最终结果");

  const missing:string[]=[];
  if(!signals.action)missing.push("你本人采取的关键行动");
  if(!signals.ownership)missing.push("你在其中承担的职责");
  if(intent==="technical"&&!signals.tradeoff)missing.push("为什么选择该方案以及放弃了什么方案");
  if(intent==="collaboration"&&!signals.collaboration)missing.push("你如何与相关角色对齐并推进");
  if(intent==="reflection"&&!signals.reflection)missing.push("复盘后的具体改进");
  if(!signals.result)missing.push("行动带来的最终结果");
  if(!signals.evidence)missing.push("能够验证结果的数据或事实");

  const opening=strengths.length
    ? `你提到“${excerpt}”，并且${strengths.slice(0,2).join("、")}。`
    : `你已经围绕“${excerpt}”给出了真实信息。`;
  const next=missing.length
    ? `下一步重点补充${missing.slice(0,2).join("，以及")}。`
    : "内容要素已经较完整，可以进一步压缩铺垫，让关键行动和结果更靠前。";
  const structureHint=!signals.context
    ? "先用一句话补齐场景和目标，"
    : "保留现有背景，";
  const detailHint=missing.length
    ? `重点写清${missing.slice(0,2).join("和")}。`
    : "把最能证明能力的行动与结果放在前两句。";
  return {score:scoreAnswer(signals,intent),feedback:`${opening}${next}`,betterAnswer:`保留你提到的“${excerpt}”；${structureHint}${detailHint}`};
}

export function fallbackAnalysis(questions:string[],answers:string[]):InterviewAnalysis{
  const signals=questions.map((_,index)=>inspectAnswer(answers[index]||""));
  const questionFeedback=questions.map((question,index)=>({questionIndex:index,...feedbackFor(question,signals[index])}));
  const overallScore=Math.round(questionFeedback.reduce((sum,item)=>sum+item.score,0)/Math.max(1,questionFeedback.length));
  const count=(key:keyof Omit<AnswerSignals,"text">)=>signals.filter(item=>item[key]).length;
  const total=Math.max(1,questions.length);
  const actionCount=count("action");
  const resultCount=count("result");
  const evidenceCount=count("evidence");
  const ownershipCount=count("ownership");
  const tradeoffCount=count("tradeoff");
  const contextCount=count("context");
  const answered=signals.filter(item=>item.text).length;
  const strengths=[
    actionCount>=Math.ceil(total/2)?"多数回答已经包含具体行动，能够看出解决问题的过程":"已经提供了可继续打磨的真实经历和信息",
    evidenceCount>=Math.ceil(total/2)?"多道回答包含数据或可验证事实，可信度较好":resultCount>=Math.ceil(total/2)?"多数回答交代了事情的最终结果":"完整保留了本轮问答，便于逐题复盘",
  ];
  const improvementCandidates=[
    {missing:total-actionCount,text:"把泛泛描述改成你本人采取的关键行动"},
    {missing:total-ownershipCount,text:"明确你在项目中的职责和实际贡献"},
    {missing:total-resultCount,text:"补充行动后的结果，形成完整闭环"},
    {missing:total-evidenceCount,text:"为结果增加可验证的数据、范围或前后对比"},
    {missing:total-tradeoffCount,text:"解释方案选择依据、限制条件和技术取舍"},
  ].sort((a,b)=>b.missing-a.missing);
  const improvements=improvementCandidates.slice(0,3).map(item=>item.text);
  const weakest=questionFeedback.reduce((lowest,item)=>item.score<lowest.score?item:lowest,questionFeedback[0]||{questionIndex:0,score:0});
  return {
    source:"fallback",
    headline:"已根据每道回答生成针对性改进建议。",
    summary:`本次完成 ${answered}/${questions.length} 道回答；报告按内容检查了背景、个人行动、方案取舍、结果证据与复盘，而不是仅依据回答长度。`,
    overallScore,
    dimensions:{
      relevance:Math.max(40,Math.min(96,Math.round(overallScore+(answered===questions.length?4:0)))),
      structure:Math.max(35,Math.min(96,Math.round(42+(contextCount+actionCount+resultCount)/total*18))),
      depth:Math.max(35,Math.min(96,Math.round(44+(actionCount+tradeoffCount+ownershipCount)/total*17))),
      evidence:Math.max(35,Math.min(96,Math.round(40+(resultCount+evidenceCount)/total*24))),
      clarity:Math.max(40,Math.min(96,Math.round(overallScore+2))),
    },
    strengths,
    improvements,
    actionPlan:[
      `先重答第 ${weakest.questionIndex+1} 题，只补齐报告指出的缺失要素`,
      evidenceCount<total?"为至少两道回答加入真实数据或可验证结果":"把已有数据放到结果句中，突出前后变化",
      "用“场景—任务—行动—结果—复盘”录制一版两分钟口述",
    ],
    questionFeedback,
  };
}
