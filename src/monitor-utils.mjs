/** Pure CDP target discovery and URL checks; no side effects. */
export const CDP_HOST = '127.0.0.1';
export const CDP_PORT = 9238;
export const MAIN_PAGE = 'app://-/index.html';

export function findMainTarget(targets) {
  if (!Array.isArray(targets)) return null;
  return targets.find(target => target.type === 'page' && target.url === MAIN_PAGE) ?? null;
}

export function localWebSocketUrl(value, port = CDP_PORT) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'ws:' || parsed.hostname !== CDP_HOST || Number(parsed.port) !== port ||
      !parsed.pathname.startsWith('/devtools/page/')) {
    throw new Error('拒绝连接非本机主窗口 CDP WebSocket');
  }
  return parsed.toString();
}

// Returns a string for Runtime.evaluate's JSON-serializable result.
export const WIDGET_PROBE = `(() => {
  const rail = [...document.querySelectorAll('nav')]
    .find(el => String(el.className).includes('group/sidebar-rail'));
  if (!rail) return 'waiting';
  const widget = document.getElementById('codex-sidebar-usage-widget');
  return widget && rail.contains(widget) &&
    typeof globalThis.__codexUsageSidebarV02?.receive === 'function' ? 'ready' : 'missing';
})()`;

export function probeState(result) {
  if (result?.exceptionDetails) throw new Error('Renderer execution context unavailable');
  const value = result?.result?.value;
  return ['waiting', 'ready', 'missing'].includes(value) ? value : 'waiting';
}


/**
 * Delayed polling that wakes immediately when the helper receives SIGTERM.
 * Resolves (never rejects) on timeout or abort and removes its listener.
 */
export function abortableSleep(ms, signal) {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const onAbort = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
