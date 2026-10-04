import { INTERVIEW_CASES } from './interview-cases.mjs';
import { fallbackFollowUp } from '../lib/follow-up.ts';
import { fallbackAnalysis } from '../lib/openai.ts';
import { pathToFileURL } from 'node:url';

const LABELS = ['action', 'result', 'evidence', 'tradeoff', 'none'];
const focusPatterns = {
  action:/个人|本人|职责|行动|贡献|关键步骤|具体做了什么/,
  result:/结果|成效|影响|效果/,
  evidence:/数据|证据|验证|指标|前后对比|事实/,
  tradeoff:/方案|选择依据|取舍|权衡|放弃/,
};

function followUpKind(question) {
  if (!question) return 'none';
  if (/你本人具体做了什么/.test(question)) return 'action';
  if (/你的行动最后带来了什么结果/.test(question)) return 'result';
  if (/你是怎么验证这个结果/.test(question)) return 'evidence';
  if (/当时还考虑过什么做法/.test(question)) return 'tradeoff';
  return 'other';
}

function quoteFidelity(text, answer) {
  const quote = text.match(/“([^”]+)”/)?.[1];
  if (!quote) return false;
  const normalized = value => value.replace(/\s+/g, ' ').trim();
  return normalized(answer).includes(normalized(quote.replace(/…$/, '')));
}

export function evaluateOffline(cases = INTERVIEW_CASES) {
  const rows = cases.map(item => {
    const followUp = fallbackFollowUp({ question:item.question, answer:item.answer });
    const actual = followUpKind(followUp);
    const report = fallbackAnalysis([item.question], [item.answer]);
    const feedback = report.questionFeedback[0];
    // Exclude the echoed answer so a keyword in the answer cannot count as coaching.
    const coaching = `${feedback.feedback} ${feedback.betterAnswer}`.replace(/“[^”]*”/g, '');
    return {
      id:item.id, scenario:item.scenario, expected:item.expected, actual,
      correct:item.expected === actual,
      followUp,
      reportFocusHit:item.expected === 'none' ? null : focusPatterns[item.expected].test(coaching),
      reportQuoteFaithful:quoteFidelity(feedback.feedback, item.answer),
      reportScore:feedback.score,
      reportSource:report.source,
      reportFeedback:feedback.feedback,
    };
  });
  const confusion = Object.fromEntries(LABELS.map(expected => [expected, Object.fromEntries([...LABELS, 'other'].map(actual => [actual, 0]))]));
  for (const row of rows) confusion[row.expected][row.actual]++;
  const classMetrics = LABELS.map(label => {
    const support = rows.filter(row => row.expected === label).length;
    const predicted = rows.filter(row => row.actual === label).length;
    const truePositive = rows.filter(row => row.expected === label && row.actual === label).length;
    const precision = predicted ? truePositive / predicted : null;
    const recall = support ? truePositive / support : null;
    return { label, support, predicted, precision, recall, f1:precision == null || recall == null || precision + recall === 0 ? null : 2 * precision * recall / (precision + recall) };
  });
  const targetRows = rows.filter(row => row.expected !== 'none');
  const predictedRows = rows.filter(row => row.followUp);
  return {
    protocol:'fictional_author_labeled_holdout_v1',
    total:rows.length,
    exactCount:rows.filter(row => row.correct).length,
    exactAccuracy:rows.filter(row => row.correct).length / rows.length,
    followUpDecisionAccuracy:rows.filter(row => (row.expected !== 'none') === (row.actual !== 'none')).length / rows.length,
    falseFollowUps:rows.filter(row => row.expected === 'none' && row.actual !== 'none').length,
    missedFollowUps:rows.filter(row => row.expected !== 'none' && row.actual === 'none').length,
    reportFocusHitCount:targetRows.filter(row => row.reportFocusHit).length,
    reportFocusTotal:targetRows.length,
    reportQuoteFaithfulCount:rows.filter(row => row.reportQuoteFaithful).length,
    followUpQuoteFaithfulCount:predictedRows.filter(row => quoteFidelity(row.followUp, cases.find(item => item.id === row.id).answer)).length,
    followUpQuoteTotal:predictedRows.length,
    classMetrics, confusion, rows,
  };
}

export function summarize(result) {
  const { rows, ...metrics } = result;
  return {
    ...metrics,
    mismatches:rows.filter(row => !row.correct).map(row => ({ id:row.id, expected:row.expected, actual:row.actual })),
    reportFocusMissIds:rows.filter(row => row.reportFocusHit === false).map(row => row.id),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Fail closed if a future code change accidentally tries to call any network API.
  globalThis.fetch = () => { throw new Error('Offline evaluation attempted a network request.'); };
  const result = evaluateOffline();
  if (process.argv.includes('--summary-json')) {
    process.stdout.write(`${JSON.stringify(summarize(result), null, 2)}\n`);
  } else if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const pct = value => `${Math.round(value * 1000) / 10}%`;
    console.log(`Offline interview evaluation: ${result.exactCount}/${result.total} exact (${pct(result.exactAccuracy)})`);
    console.log(`Follow-up decision accuracy: ${pct(result.followUpDecisionAccuracy)}; false follow-ups: ${result.falseFollowUps}; missed follow-ups: ${result.missedFollowUps}`);
    console.log(`Report focus keyword hit: ${result.reportFocusHitCount}/${result.reportFocusTotal}; report quote fidelity: ${result.reportQuoteFaithfulCount}/${result.total}`);
    console.log(`Follow-up quote fidelity: ${result.followUpQuoteFaithfulCount}/${result.followUpQuoteTotal}`);
    for (const row of result.classMetrics) console.log(`${row.label.padEnd(9)} support=${row.support} precision=${row.precision == null ? 'n/a' : pct(row.precision)} recall=${row.recall == null ? 'n/a' : pct(row.recall)}`);
    console.log('Mismatches:');
    for (const row of result.rows.filter(row => !row.correct)) console.log(`  ${row.id} ${row.scenario}: expected ${row.expected}, got ${row.actual}`);
  }
}
