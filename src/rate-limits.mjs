/**
 * Pure, credential-free normalization for the Codex App Server rate-limits RPC.
 * A missing bucket is unknown, not 100% remaining.
 */
export const FIVE_HOUR_MINUTES = 300;
export const WEEK_MINUTES = 10080;

function normalizeWindow(value) {
  if (!value || typeof value !== 'object') return null;
  const minutes = Number(value.windowDurationMins);
  const used = Number(value.usedPercent);
  if (!Number.isInteger(minutes) || !Number.isFinite(used) || used < 0 || used > 100) return null;
  const timestamp = value.resetsAt;
  const reset = timestamp == null ? null : Number(timestamp);
  return {
    windowDurationMins: minutes,
    usedPercent: used,
    resetsAt: Number.isFinite(reset) && reset > 0 ? reset : null,
  };
}

export function normalizeRateLimits(response) {
  const result = response?.result ?? response;
  // Explicitly select the default Codex quota, not model-specific extras.
  const snapshot = result?.rateLimitsByLimitId?.codex ?? result?.rateLimits;
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Codex App Server 未返回 rateLimits');
  }
  const windows = [snapshot.primary, snapshot.secondary]
    .map(normalizeWindow)
    .filter(Boolean);
  const find = minutes => windows.find(w => w.windowDurationMins === minutes) ?? null;
  return {
    fiveHour: find(FIVE_HOUR_MINUTES),
    weekly: find(WEEK_MINUTES),
    fetchedAt: Date.now(),
  };
}
