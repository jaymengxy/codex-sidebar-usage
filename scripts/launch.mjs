#!/usr/bin/env node
/** macOS opt-in launcher, never quits an existing ChatGPT instance. */
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { run } from './run.mjs';

const execFileAsync = promisify(execFile);
export const CHATGPT_BINARY = '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT';

export async function isChatGPTRunning(check = execFileAsync) {
  try {
    const { stdout } = await check('/usr/bin/pgrep', ['-x', 'ChatGPT']);
    return Boolean(stdout.trim());
  } catch (error) {
    if (error.code === 1) return false;
    throw error;
  }
}

export async function isDebugPortOpen(fetcher = fetch) {
  try {
    const response = await fetcher('http://127.0.0.1:9238/json/version', { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch { return false; }
}

export async function ensureChatGPTStarted({ running = isChatGPTRunning, portOpen = isDebugPortOpen, launch = spawn, binary = CHATGPT_BINARY, checkAccess = access } = {}) {
  if (await portOpen()) return 'cdp-ready';
  if (await running()) {
    // Do not relaunch, kill or silently modify an already-running app.
    throw new Error('ChatGPT 已运行但没有开放 9238 CDP。请 Cmd+Q 完全退出，再运行 npm run launch；如启用登录启动，请关闭 ChatGPT 自身的开机启动以避免抢先启动。');
  }
  await checkAccess(binary, constants.X_OK);
  const child = launch(binary, [
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=9238',
  ], { detached: true, stdio: 'ignore' });
  child.unref?.();
  return 'launched';
}

export async function launchAndRun() {
  if (process.platform !== 'darwin') throw new Error('自动启动仅适用于 macOS');
  const action = await ensureChatGPTStarted();
  console.log(action === 'launched' ? '已启动 ChatGPT（本机 CDP）' : '复用已开放 CDP 的 ChatGPT');
  await run([]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  launchAndRun().catch(error => { console.error(error.message); process.exitCode = 1; });
}
