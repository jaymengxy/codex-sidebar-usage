#!/usr/bin/env node
/**
 * Runs a local, read-only quota bridge: Codex App Server JSON-RPC <-> local CDP.
 * No HTTP listener, injected credentials, third-party packages, or app changes.
 * Keep this foreground process alive to enable the refresh button/hover polling.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CodexAppServer, resolveCodexCommand } from '../src/app-server.mjs';

const HOST = '127.0.0.1';
const PORT = 9238;
const bindingName = '__codexUsageFetchV02';
const scriptPath = fileURLToPath(new URL('../src/sidebar.js', import.meta.url));

class CdpSession {
  #socket;
  #sequence = 0;
  #pending = new Map();
  onBinding = null;
  onClose = null;
  #closing = false;

  async connect() {
    const response = await fetch(`http://${HOST}:${PORT}/json/list`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`CDP 发现失败: HTTP ${response.status}`);
    const targets = await response.json();
    const main = targets.find(t => t.type === 'page' && t.url === 'app://-/index.html');
    if (!main?.webSocketDebuggerUrl) throw new Error('未找到 ChatGPT 主窗口 app://-/index.html');
    const endpoint = new URL(main.webSocketDebuggerUrl);
    if (endpoint.protocol !== 'ws:' || endpoint.hostname !== HOST || Number(endpoint.port) !== PORT) {
      throw new Error('拒绝连接非本机 CDP 地址');
    }
    this.#socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP 连接超时')), 5000);
      this.#socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.#socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP WebSocket 连接失败')); }, { once: true });
    });
    this.#socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.id != null && this.#pending.has(message.id)) {
        const entry = this.#pending.get(message.id);
        this.#pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error || message.result?.exceptionDetails) {
          entry.reject(new Error(`CDP 执行失败: ${message.error?.message ?? message.result?.exceptionDetails?.text ?? '未知错误'}`));
        } else entry.resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.bindingCalled' && message.params?.name === bindingName) {
        this.onBinding?.(message.params.payload);
      }
    });
    this.#socket.addEventListener('close', () => {
      for (const [, entry] of this.#pending) { clearTimeout(entry.timer); entry.reject(new Error('CDP 连接已关闭')); }
      this.#pending.clear();
      if (!this.#closing) this.onClose?.(new Error('CDP 已断开；请重新运行 npm start'));
    });
  }

  call(method, params = {}) {
    if (this.#socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP 未连接'));
    const id = ++this.#sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#pending.delete(id); reject(new Error(`CDP ${method} 超时`)); }, 5000);
      this.#pending.set(id, { resolve, reject, timer });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { this.#closing = true; this.#socket?.close(); }
}

function options(argv) {
  let once = false;
  let codexPath;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--once') once = true;
    else if (argv[i] === '--codex-path') codexPath = argv[++i];
    else if (argv[i] === '--help') {
      console.log('Usage: npm start [-- --once] [-- --codex-path /path/to/codex]\n  --once: read only, no CDP injection.');
      process.exit(0);
    } else throw new Error(`未知参数: ${argv[i]}`);
  }
  if (codexPath === undefined && argv.includes('--codex-path')) throw new Error('--codex-path 缺少路径');
  return { once, codexPath };
}

async function main() {
  const { once, codexPath } = options(process.argv.slice(2));
  const command = await resolveCodexCommand(codexPath);
  const app = new CodexAppServer(command);
  let cdp;
  let inFlight;
  let finish;
  const lifespan = new Promise((resolve, reject) => { finish = { resolve, reject }; });
  const shutdown = () => { cdp?.close(); app.close(); };
  process.once('SIGINT', () => { shutdown(); process.exit(0); });
  process.once('SIGTERM', () => { shutdown(); process.exit(0); });
  try {
    await app.start();
    if (once) {
      const data = await app.readLimits();
      for (const [label, value] of [['5h', data.fiveHour], ['7d', data.weekly]]) {
        console.log(`${label}: ${value ? `${Math.round(100 - value.usedPercent)}% 剩余` : '未返回'}`);
      }
      console.log('请与 ChatGPT 客户端的剩余用量页面核对，确认是同一账户。');
      return;
    }
    cdp = new CdpSession();
    cdp.onClose = error => finish.reject(error);
    await cdp.connect();
    await cdp.call('Runtime.enable');
    await cdp.call('Runtime.addBinding', { name: bindingName });
    cdp.onBinding = async payload => {
      let request;
      try { request = JSON.parse(payload); } catch { return; }
      if (request?.action !== 'read' || typeof request.id !== 'string' || !/^request-\d{1,8}$/.test(request.id)) return;
      const respond = async response => {
        const js = `globalThis.__codexUsageSidebarV02?.receive(${JSON.stringify(response)})`;
        await cdp.call('Runtime.evaluate', { expression: js });
      };
      try {
        // Share an in-flight request; the renderer also prevents duplicate calls.
        inFlight ??= app.readLimits().finally(() => { inFlight = null; });
        const data = await inFlight;
        await respond({ id: request.id, data });
      } catch (error) {
        try { await respond({ id: request.id, error: error.message || '额度读取失败' }); } catch { /* disconnected */ }
      }
    };
    const source = await readFile(scriptPath, 'utf8');
    await cdp.call('Runtime.evaluate', { expression: source, returnByValue: true });
    console.log('v0.2 已注入：保持本进程运行以支持自动、悬停及手动刷新。Ctrl+C 退出。');
    console.log('请将 5h / 7d 数字与 ChatGPT 原生用量页核对；不一致时先停止使用。');
    await lifespan;
  } finally {
    shutdown();
  }
}

main().catch(error => { console.error('启动失败:', error.message); process.exitCode = 1; });
