import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createInterface } from 'node:readline';
import { normalizeRateLimits } from './rate-limits.mjs';

const DEFAULT_BUNDLED = '/Applications/ChatGPT.app/Contents/Resources/codex';

async function executable(file) {
  try { await access(file, constants.X_OK); return true; } catch { return false; }
}

export async function resolveCodexCommand(explicitPath) {
  if (explicitPath) {
    if (!(await executable(explicitPath))) throw new Error(`找不到可执行 Codex: ${explicitPath}`);
    return explicitPath;
  }
  if (await executable(DEFAULT_BUNDLED)) return DEFAULT_BUNDLED;
  return 'codex'; // PATH fallback; may have a different login from ChatGPT desktop.
}

export class CodexAppServer {
  #child;
  #nextId = 1;
  #pending = new Map();
  #ready = false;

  constructor(command) {
    this.command = command;
  }

  async start() {
    this.#child = spawn(this.command, ['app-server', '--listen', 'stdio://'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    const lines = createInterface({ input: this.#child.stdout });
    lines.on('line', line => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg?.id == null || !this.#pending.has(msg.id)) return;
      const entry = this.#pending.get(msg.id);
      this.#pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new Error(`App Server RPC ${msg.error.code ?? ''}: ${String(msg.error.message ?? '请求失败')}`));
      else entry.resolve(msg.result);
    });
    // Do not log stderr; it may contain account or diagnostic information.
    this.#child.stderr.resume();
    this.#child.on('error', error => this.#rejectPending(`App Server 启动失败: ${error.code ?? error.message}`));
    this.#child.on('exit', () => this.#rejectPending('App Server 已退出'));

    await this.request('initialize', {
      clientInfo: { name: 'codex_sidebar_usage', title: 'Codex Sidebar Usage', version: '0.2.0' },
    });
    this.#send({ method: 'initialized' });
    this.#ready = true;
  }

  #rejectPending(message) {
    for (const [, entry] of this.#pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(message));
    }
    this.#pending.clear();
  }

  #send(message) {
    if (!this.#child?.stdin.writable) throw new Error('App Server stdin 不可用');
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params, timeoutMs = 12000) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`App Server ${method} 超时`));
      }, timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });
      try { this.#send({ id, method, ...(params === undefined ? {} : { params }) }); }
      catch (error) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(error);
      }
    });
  }

  async readLimits() {
    if (!this.#ready) throw new Error('App Server 尚未初始化');
    const result = await this.request('account/rateLimits/read');
    return normalizeRateLimits(result);
  }

  close() {
    this.#ready = false;
    this.#rejectPending('App Server 已关闭');
    if (this.#child && !this.#child.killed) this.#child.kill('SIGTERM');
  }
}
