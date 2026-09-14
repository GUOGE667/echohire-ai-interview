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

export async function generateInterviewQuestions(input:{role:string;jd:string;interviewType:string;difficulty:string;resume?:{name:string;bytes:ArrayBuffer}}){
  const content:Array<Record<string,unknown>>=[{type:"input_text",text:`目标岗位：${input.role}\n面试类型：${input.interviewType}\n难度：${input.difficulty}\n职位描述：\n${input.jd}`}];
  if(input.resume)content.push({type:"input_file",filename:input.resume.name,file_data:`data:application/pdf;base64,${arrayBufferToBase64(input.resume.bytes)}`});
  return structuredResponse<{questions:string[]}>("interview_questions",{type:"object",additionalProperties:false,properties:{questions:{type:"array",minItems:4,maxItems:4,items:{type:"string"}}},required:["questions"]},"你是一位严格但友善的中文面试官。根据候选人简历与职位描述生成4道互不重复的问题，覆盖项目证据、岗位技能、技术取舍与协作场景。问题必须具体、可口头回答，不得捏造简历内容。",[{role:"user",content}]);
}

export async function analyzeInterview(input:{role:string;jd:string;questions:string[];answers:string[]}){
  const pairs=input.questions.map((question,index)=>({question,answer:input.answers[index]||"未回答"}));
  const dimension={type:"object",additionalProperties:false,properties:{relevance:{type:"integer",minimum:0,maximum:100},structure:{type:"integer",minimum:0,maximum:100},depth:{type:"integer",minimum:0,maximum:100},evidence:{type:"integer",minimum:0,maximum:100},clarity:{type:"integer",minimum:0,maximum:100}},required:["relevance","structure","depth","evidence","clarity"]};
   const schema={type:"object",additionalProperties:false,properties:{headline:{type:"string"},summary:{type:"string"},overallScore:{type:"integer",minimum:0,maximum:100},dimensions:dimension,strengths:{type:"array",minItems:2,maxItems:2,items:{type:"string"}},improvements:{type:"array",minItems:3,maxItems:3,items:{type:"string"}},actionPlan:{type:"array",minItems:3,maxItems:3,items:{type:"string"}},questionFeedback:{type:"array",minItems:pairs.length,maxItems:pairs.length,items:{type:"object",additionalProperties:false,properties:{questionIndex:{type:"integer"},score:{type:"integer",minimum:0,maximum:100},feedback:{type:"string"},betterAnswer:{type:"string"}},required:["questionIndex","score","feedback","betterAnswer"]}}},required:["headline","summary","overallScore","dimensions","strengths","improvements","actionPlan","questionFeedback"]};
  const result=await structuredResponse<Omit<InterviewAnalysis,"source">>("interview_analysis",schema,"你是一位专业的中文求职教练。严格依据岗位描述和候选人的实际回答评分。逐题检查岗位相关性、STAR结构、专业深度、量化证据与表达清晰度；建议必须具体可执行，优化示例不得虚构候选人未提供的经历或数据。",[{role:"user",content:[{type:"input_text",text:`目标岗位：${input.role}\n职位描述：\n${input.jd}\n\n问答记录：\n${JSON.stringify(pairs)}`}]}]);
  return {data:{...result.data,source:"ai" as const},model:result.model};
}

export function fallbackAnalysis(questions:string[],answers:string[]):InterviewAnalysis{
  const lengths=answers.map(answer=>answer.trim().length);const average=lengths.reduce((a,b)=>a+b,0)/Math.max(1,lengths.length);const evidence=answers.filter(answer=>/\d|%|秒|分钟|用户|性能|提升|降低/.test(answer)).length;const score=Math.max(58,Math.min(82,Math.round(60+Math.min(12,average/18)+evidence*2)));
  return {source:"fallback",headline:"回答已保存，AI 深度分析暂未启用。",summary:"系统已完成基础完整度与证据检查；启用 AI 后会自动生成语义级逐题点评。",overallScore:score,dimensions:{relevance:score+2,structure:score-2,depth:score,evidence:Math.max(50,score-7),clarity:score+3},strengths:["完整回答了本场面试问题","回答内容已形成可持续复盘的训练档案"],improvements:["用 STAR 结构明确背景、任务、行动和结果","为关键结果补充可验证的量化指标","说明个人职责以及方案取舍"],actionPlan:["挑选一个项目补齐前后对比数据","把最长回答压缩成两分钟版本","再次练习最薄弱的一道题"],questionFeedback:questions.map((_,index)=>({questionIndex:index,score:Math.max(55,Math.min(85,score+(lengths[index]>120?3:-3))),feedback:lengths[index]>120?"信息较完整，下一步突出技术取舍和结果证据。":"回答偏短，建议补充具体行动、技术取舍与结果。",betterAnswer:"按“背景—目标—具体行动—量化结果—复盘”重新组织，并只使用你的真实经历和数据。"}))};
}
