import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRateLimits } from '../src/rate-limits.mjs';

const windowFor = (windowDurationMins, usedPercent, resetsAt = 1793200000) => ({
  windowDurationMins, usedPercent, resetsAt,
});

test('maps 5h and weekly windows by length instead of slot', () => {
  const data = normalizeRateLimits({ rateLimits: {
    primary: windowFor(10080, 24), secondary: windowFor(300, 80),
  }});
  assert.equal(data.fiveHour.usedPercent, 80);
  assert.equal(data.weekly.usedPercent, 24);
});

test('maps typical 5h primary 7d secondary', () => {
  const data = normalizeRateLimits({result:{rateLimits: {
    primary: windowFor(300, 38), secondary: windowFor(10080, 59),
  }}});
  assert.equal(data.fiveHour.windowDurationMins, 300);
  assert.equal(data.weekly.windowDurationMins, 10080);
});

test('weekly-only returns null for absent five hour', () => {
  const data = normalizeRateLimits({rateLimits: { primary: windowFor(10080, 15), secondary: null }});
  assert.equal(data.fiveHour, null);
  assert.equal(data.weekly.usedPercent, 15);
});

test('unknown buckets do not get mislabeled as 5h/weekly', () => {
  const data = normalizeRateLimits({rateLimits: { primary: windowFor(60, 70), secondary: windowFor(1440, 10) }});
  assert.equal(data.fiveHour, null);
  assert.equal(data.weekly, null);
});

test('rejects malformed values', () => {
  const data = normalizeRateLimits({rateLimits: { primary: windowFor(300, 110), secondary: windowFor(10080, -1) }});
  assert.equal(data.fiveHour, null);
  assert.equal(data.weekly, null);
});

test('preserves zero percent and zero-usage window', () => {
  const data = normalizeRateLimits({rateLimits: { primary: windowFor(300, 0) }});
  assert.equal(data.fiveHour.usedPercent, 0);
});

test('prioritizes codex key over extra model limits', () => {
  const data = normalizeRateLimits({ rateLimitsByLimitId: {
    codex: {primary: windowFor(300, 23)}, other: {primary: windowFor(300, 99)},
  }, rateLimits: { primary: windowFor(300, 87) }});
  assert.equal(data.fiveHour.usedPercent, 23);
});

test('missing snapshot fails rather than fabricating quota', () => {
  assert.throws(() => normalizeRateLimits({result:{}}), /rateLimits/);
});

test('reset time null stays null', () => {
  const data = normalizeRateLimits({rateLimits: { primary: windowFor(300, 11, null) }});
  assert.equal(data.fiveHour.resetsAt, null);
});

test('fetched timestamp is numeric', () => {
  const data = normalizeRateLimits({rateLimits: {}});
  assert.ok(Number.isFinite(data.fetchedAt));
});
