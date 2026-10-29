#!/usr/bin/env node
/**
 * v0.3 persistent read-only Codex quota bridge.
 * Reconnects after CDP renderer reload, app restart and target replacement.
 * Does not start the ChatGPT app; scripts/launch.mjs does that optionally.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tr } from '../src/i18n.mjs';
import { CodexAppServer, resolveCodexCommand } from '../src/app-server.mjs';
import { CDP_HOST, CDP_PORT, findMainTarget, localWebSocketUrl, WIDGET_PROBE, probeState, abortableSleep } from '../src/monitor-utils.mjs';

const bindingName = '__codexUsageFetchV02';
const scriptPath = fileURLToPath(new URL('../src/sidebar.js', import.meta.url));
class CdpSession {
  #socket;
  #sequence = 0;
  #pending = new Map();
  onBinding = null;
  closed = false;

  async connect(url) {
    this.#socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(tr('CDP 连接超时', 'CDP connection timed out'))), 5000);
      this.#socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.#socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error(tr('CDP 连接失败', 'CDP connection failed'))); }, { once: true });
    });
    this.#socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.id != null && this.#pending.has(message.id)) {
        const entry = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error || message.result?.exceptionDetails) {
          entry.reject(new Error(message.error?.message ?? message.result?.exceptionDetails?.text ?? tr('CDP 执行失败', 'CDP evaluation failed')));
        } else entry.resolve(message.result);
      } else if (message.method === 'Runtime.bindingCalled' && message.params?.name === bindingName) {
        this.onBinding?.(message.params.payload);
      }
    });
    this.#socket.addEventListener('close', () => {
      this.closed = true;
      for (const [, entry] of this.#pending) { clearTimeout(entry.timer); entry.reject(new Error(tr('CDP 已断开', 'CDP disconnected'))); }
      this.#pending.clear();
    });
    this.#socket.addEventListener('error', () => { this.closed = true; });
  }

  call(method, params = {}) {
    if (this.closed || this.#socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error(tr('CDP 未连接', 'CDP not connected')));
    const id = ++this.#sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#pending.delete(id); reject(new Error(`tr('CDP 请求超时', 'CDP request timed out') + `: ${method}`)); }, 5000);
      this.#pending.set(id, { resolve, reject, timer });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.closed = true;
    this.#socket?.close();
  }
}

export function parseArguments(argv) {
  const options = { once: false, pollMs: 3000 };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item === '--once') options.once = true;
    else if (item === '--codex-path') {
      options.codexPath = argv[++i];
      if (!options.codexPath) throw new Error(tr('--codex-path 缺少路径', '--codex-path requires a path'));
    } else if (item === '--poll-ms') {
      options.pollMs = Number(argv[++i]);
      if (!Number.isInteger(options.pollMs) || options.pollMs < 1000 || options.pollMs > 60000) {
        throw new Error(tr('--poll-ms 范围必须是 1000–60000', '--poll-ms must be in the range 1000–60000'));
      }
    } else if (item === '--help') options.help = true;
    else throw new Error(`${tr('未知参数','Unknown option')}: ${item}`);
  }
  return options;
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    console.log('Usage: node scripts/run.mjs [--once] [--codex-path /absolute/path] [--poll-ms 3000]');
    return;
  }
  const command = await resolveCodexCommand(options.codexPath);
  const app = new CodexAppServer(command);
  let session = null;
  let targetId = null;
  let inFlight = null;
  let stopping = false;
  const stopSignal = new AbortController();
  const stop = () => { if (stopping) return; stopping = true; stopSignal.abort(); session?.close(); app.close(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await app.start();
    if (options.once) {
      const data = await app.readLimits();
      for (const [name, value] of [['5h', data.fiveHour], ['7d', data.weekly]]) {
        console.log(`${name}: ${value ? `${Math.round(100 - value.usedPercent)}% ${tr('剩余', 'remaining')}` : tr('未返回', 'unavailable')}`);
      }
      console.log(tr('务必与 ChatGPT 原生额度页面对照，排除账号不一致。', 'Compare these numbers with ChatGPT usage to rule out account differences.'));
      return;
    }
    const source = await readFile(scriptPath, 'utf8');
    console.log(tr('Codex Sidebar Usage v0.3：监视 CDP；Ctrl+C 停止。', 'Codex Sidebar Usage: monitoring CDP; press Ctrl+C to stop.'));
    let lastLog = '';
    const logOnce = (message, event) => {
      if (message !== lastLog) { console.log(message); lastLog = message; }
      // Stable machine event for Swift; never parse translated human logs.
      if (event) console.log(`CSU_EVENT:${event}`);
    };
    while (!stopping) {
      try {
        const response = await fetch(`http://${CDP_HOST}:${CDP_PORT}/json/list`, {
          signal: AbortSignal.timeout(2000),
        });
        if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
        const target = findMainTarget(await response.json());
        if (!target?.webSocketDebuggerUrl) {
          session?.close(); session = null; targetId = null;
          logOnce(tr('等待 ChatGPT 主窗口 / Codex 导航栏出现…', 'Waiting for ChatGPT main window / navigation sidebar…'));
        } else {
          const url = localWebSocketUrl(target.webSocketDebuggerUrl);
          if (!session || session.closed || target.id !== targetId) {
            session?.close();
            session = new CdpSession();
            await session.connect(url);
            targetId = target.id;
            await session.call('Runtime.enable');
            await session.call('Runtime.addBinding', { name: bindingName });
            const active = session;
            active.onBinding = async payload => {
              let request;
              try { request = JSON.parse(payload); } catch { return; }
              if (request?.action !== 'read' || typeof request.id !== 'string' ||
                  !/^request-\d{1,8}$/.test(request.id)) return;
              const respond = async data => {
                const js = `globalThis.__codexUsageSidebarV02?.receive(${JSON.stringify(data)})`;
                await active.call('Runtime.evaluate', { expression: js });
              };
              try {
                inFlight ??= app.readLimits().finally(() => { inFlight = null; });
                await respond({ id: request.id, data: await inFlight });
              } catch (error) {
                try { await respond({ id: request.id, error: String(error.message ?? tr('额度读取失败', 'Failed to read quota')) }); }
                catch { /* target replaced */ }
              }
            };
            logOnce(tr('已连接 ChatGPT 主窗口，监控重新渲染和重启。', 'Connected to ChatGPT main window; monitoring reloads.'), 'connected');
          }
          const probe = probeState(await session.call('Runtime.evaluate', {
            expression: WIDGET_PROBE, returnByValue: true,
          }));
          if (probe === 'missing') {
            await session.call('Runtime.evaluate', { expression: source, returnByValue: true });
            logOnce(tr('额度组件已注入或恢复。', 'Quota widget attached or restored.'), 'injected');
          } else if (probe === 'waiting') {
            logOnce(tr('等待 Codex 侧栏 DOM 渲染…', 'Waiting for sidebar to render…'));
          }
        }
      } catch (error) {
        session?.close(); session = null; targetId = null;
        if (!stopping) logOnce(`${tr('CDP 暂不可用，稍后自动重试', 'CDP unavailable, retrying')}: ${error.message}`);
      }
      if (!stopping) await abortableSleep(options.pollMs, stopSignal.signal);
    }
  } finally {
    stop();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch(error => { console.error(tr('运行失败:', 'Monitor failed:'), error.message); process.exitCode = 1; });
}
