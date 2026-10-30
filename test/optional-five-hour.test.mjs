import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeRateLimits } from '../src/rate-limits.mjs';

const bucket = (windowDurationMins, usedPercent) => ({
  windowDurationMins, usedPercent, resetsAt: 1793500000,
});

test('weekly-only Codex quota never invents a five-hour window', () => {
  const usage = normalizeRateLimits({ rateLimits: {
    primary: bucket(10080, 27), secondary: null,
  }});
  assert.equal(usage.fiveHour, null);
  assert.equal(usage.weekly.usedPercent, 27);
});

test('Plus or Business Standard style 5h + 7d buckets remain supported', () => {
  const usage = normalizeRateLimits({ rateLimits: {
    primary: bucket(300, 14), secondary: bucket(10080, 45),
  }});
  assert.equal(usage.fiveHour.windowDurationMins, 300);
  assert.equal(usage.weekly.windowDurationMins, 10080);
});

test('a 5h bucket in either slot can activate the 5h row', () => {
  const usage = normalizeRateLimits({ rateLimits: {
    primary: bucket(10080, 31), secondary: bucket(300, 84),
  }});
  assert.equal(usage.fiveHour.usedPercent, 84);
  assert.equal(usage.weekly.usedPercent, 31);
});

test('unknown quota periods never masquerade as five-hour quota', () => {
  const usage = normalizeRateLimits({ rateLimits: {
    primary: bucket(60, 5), secondary: bucket(10080, 33),
  }});
  assert.equal(usage.fiveHour, null);
  assert.equal(usage.weekly.usedPercent, 33);
});

test('sidebar starts with five-hour row hidden to avoid initial flicker', async () => {
  const source = await readFile(new URL('../src/sidebar.js', import.meta.url), 'utf8');
  assert.match(source, /data-quota="five" hidden/);
  assert.match(source, /\.quota\[hidden\]\{display:none\}/);
  assert.match(source, /fiveHourElement\.hidden = snapshot\?\.fiveHour == null/);
  assert.match(source, /fiveHourElement\.hidden && popoverKey === 'five'/);
});

test('weekly row remains visible even if a response lacks a weekly window', async () => {
  const source = await readFile(new URL('../src/sidebar.js', import.meta.url), 'utf8');
  assert.match(source, /data-quota="week"/);
  assert.doesNotMatch(source, /data-quota="week" hidden/);
  assert.match(source, /remaining === null \? '--'/);
});

test('weekly popover and refresh are unaffected by a missing five-hour bucket', async () => {
  const source = await readFile(new URL('../src/sidebar.js', import.meta.url), 'utf8');
  assert.match(source, /const windowData = key === 'five' \? snapshot\?\.fiveHour : snapshot\?\.weekly/);
  assert.match(source, /l\('每周额度', 'Weekly quota'\)/);
  assert.match(source, /refreshButton\.addEventListener\('click', onClick\)/);
});
