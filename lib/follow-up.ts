export type FollowUpInput = {
  question: string;
  answer: string;
};

function answerReference(answer: string) {
  const firstSentence = answer.trim().replace(/\s+/g, " ").split(/[。！？；]/)[0];
  return firstSentence.length > 36 ? `${firstSentence.slice(0, 36)}…` : firstSentence;
}

export function fallbackFollowUp(input: FollowUpInput): string | null {
  const answer = input.answer.trim();
  if (!answer) return null;

  const reference = answerReference(answer);
  const opening = `你提到“${reference}”。`;
  const hasAction = /我(?:负责|主导|提出|设计|实现|推动|协调|优化|排查|制定|搭建|完成|采用|选择|测试|验证)|我的职责|由我|具体(?:做了|采取|负责)/.test(answer);
  const hasResult = /最终|结果|因此|从而|上线|交付|解决|达成|提升|降低|减少|增加|改善|获得|反馈/.test(answer);
  const hasEvidence = /\d+(?:\.\d+)?\s*(?:%|个|人|名|次|倍|毫秒|秒|分钟|小时|天|周|月|条|项|家|万|千)?|百分之|前后对比|用户反馈|验收/.test(answer);
  const hasReason = /因为|原因|考虑到|权衡|取舍|相比|对比|优缺点|成本|限制/.test(answer);

  if (!hasAction) return `${opening}这件事里你本人具体做了什么？请说出关键步骤和你负责的部分。`;
  if (!hasResult) return `${opening}你的行动最后带来了什么结果？如果尚未结束，你如何判断它是否有效？`;
  if (!hasEvidence) return `${opening}你是怎么验证这个结果的？请补充真实指标、前后对比或可核实的反馈。`;
  if (/技术|方案|架构|实现|性能|系统|代码/.test(input.question) && !hasReason) {
    return `${opening}当时还考虑过什么做法？为什么最终选择这个方案？`;
  }
  return null;
}
