import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERVIEW_CASES } from '../evals/interview-cases.mjs';
import { evaluateOffline, summarize } from '../evals/run-offline.mjs';

test('the fictional holdout is separate, uniquely identified, and balanced', () => {
  assert.equal(INTERVIEW_CASES.length, 40);
  assert.equal(new Set(INTERVIEW_CASES.map(item => item.id)).size, 40);
  assert.deepEqual(
    Object.fromEntries(['action', 'result', 'evidence', 'tradeoff', 'none'].map(label => [label, INTERVIEW_CASES.filter(item => item.expected === label).length])),
    { action:8, result:8, evidence:8, tradeoff:8, none:8 },
  );
  assert.ok(INTERVIEW_CASES.every(item => item.question && item.answer && item.scenario));
});

test('offline evaluation reports its denominators and cannot make a network request', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('A network request was attempted'); };
  try {
    const result = evaluateOffline();
    assert.equal(result.total, 40);
    assert.equal(result.classMetrics.reduce((sum, row) => sum + row.support, 0), 40);
    assert.equal(result.reportFocusTotal, 32);
    assert.equal(result.followUpQuoteTotal, result.rows.filter(row => row.followUp).length);
    assert.ok(result.rows.every(row => row.reportSource === 'fallback'));
    assert.equal(summarize(result).mismatches.length, result.total - result.exactCount);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
