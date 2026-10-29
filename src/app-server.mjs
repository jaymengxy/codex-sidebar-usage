import { spawn } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, delimiter, isAbsolute, join } from 'node:path';
import { homedir } from 'node:os';
import { normalizeRateLimits } from './rate-limits.mjs';
import { tr } from './i18n.mjs';

const DEFAULT_BUNDLED = '/Applications/ChatGPT.app/Contents/Resources/codex';

async function executable(file) {
  try {
    if (!(await stat(file)).isFile()) return false;
    await access(file, constants.X_OK);
    return true;
  } catch { return false; }
}

/**
 * Resolve a real absolute executable before spawn(). Finder/Dock applications
 * may not inherit the user's terminal PATH, so never fall back to a bare
 * 'codex' that could fail with an unhelpful ENOENT.
 *
 * options is injectable to test resolution without a macOS app bundle.
 */
export async function resolveCodexCommand(explicitPath, options = {}) {
  const {
    env = process.env,
    home = homedir(),
    nodeExecutable = process.execPath,
    bundled = DEFAULT_BUNDLED,
    isExecutable = executable,
  } = options;
  // Select only the quota helper CLI; never override ChatGPT's App Server.
  const chosen = explicitPath || env.CSU_CODEX_CLI_PATH;
  if (chosen) {
    if (!isAbsolute(chosen) || !(await isExecutable(chosen))) {
      throw new Error(`${tr('Codex 可执行文件不可用', 'Codex executable is unavailable')}: ${chosen}. ${tr('请在 Launcher 中选择正确的 Codex 文件（终端执行 command -v codex 可查询）。', 'Select the correct Codex file in the Launcher (use command -v codex to locate it).')}`);
    }
    return chosen;
  }

  const candidates = [
    bundled,
    join(dirname(nodeExecutable), 'codex'),
    ...(env.PATH || '').split(delimiter).filter(Boolean).map(dir => join(dir, 'codex')),
    '/opt/homebrew/bin/codex',
    '/usr/local/bin/codex',
    join(home, '.local', 'bin', 'codex'),
    join(home, 'bin', 'codex'),
  ];
  const seen = new Set();
  for (const file of candidates) {
    if (!isAbsolute(file) || seen.has(file)) continue;
    seen.add(file);
    if (await isExecutable(file)) return file;
  }
  throw new Error(
    tr('找不到 Codex CLI（不是额度接口错误）。请在终端运行 command -v codex，然后在 Codex Usage Launcher 点击「选择 Codex…」指定该文件。如果终端也找不到，请先安装或恢复 Codex CLI。', 'Codex CLI could not be found. Run command -v codex in Terminal, then use Select Codex… in the Launcher. If Terminal cannot find it, install or restore the Codex CLI.')
  );
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
    // A Codex wrapper may use `#!/usr/bin/env node`. Make the Node binary
    // available even when the launcher inherited a minimal GUI PATH.
    const binDir = dirname(process.execPath);
    const runtimePath = [binDir, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin',
      process.env.PATH || ''].filter(Boolean).join(delimiter);
    const childEnv = { ...process.env, PATH: runtimePath };
    delete childEnv.CODEX_CLI_PATH;
    this.#child = spawn(this.command, ['app-server', '--listen', 'stdio://'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: childEnv,
    });
    const lines = createInterface({ input: this.#child.stdout });
    lines.on('line', line => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg?.id == null || !this.#pending.has(msg.id)) return;
      const entry = this.#pending.get(msg.id);
      this.#pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new Error(`App Server RPC ${msg.error.code ?? ''}: ${String(msg.error.message ?? tr('请求失败','request failed'))}`));
      else entry.resolve(msg.result);
    });
    // Do not log stderr; it may contain account or diagnostic information.
    this.#child.stderr.resume();
    this.#child.on('error', error => this.#rejectPending(
      `${tr('App Server 启动失败', 'App Server failed to start')} (${this.command}): ${error.code ?? error.message}; ${tr('请确认所选 Codex CLI 可执行。','check that the selected Codex CLI is executable.')}`));
    this.#child.on('exit', () => this.#rejectPending(tr('App Server 已退出', 'App Server exited')));

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
    if (!this.#child?.stdin.writable) throw new Error(tr('App Server stdin 不可用', 'App Server stdin is unavailable'));
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params, timeoutMs = 12000) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`App Server ${method} ${tr('超时', 'timed out')}`));
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
    if (!this.#ready) throw new Error(tr('App Server 尚未初始化', 'App Server is not initialized'));
    const result = await this.request('account/rateLimits/read');
    return normalizeRateLimits(result);
  }

  close() {
    this.#ready = false;
    this.#rejectPending(tr('App Server 已关闭', 'App Server is closed'));
    if (this.#child && !this.#child.killed) this.#child.kill('SIGTERM');
  }
}
