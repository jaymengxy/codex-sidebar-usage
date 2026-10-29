#!/usr/bin/env node
/** macOS opt-in launcher, never quits an existing ChatGPT instance. */
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { run } from './run.mjs';
import { tr } from '../src/i18n.mjs';

const execFileAsync = promisify(execFile);
export const CHATGPT_APP = '/Applications/ChatGPT.app';
export const CDP_FLAGS = Object.freeze([
  '--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=9238'
]);

export function chatGPTLaunchEnvironment(source = process.env) {
  const env = { ...source };
  delete env.CODEX_CLI_PATH;
  delete env.CSU_CODEX_CLI_PATH;
  return env;
}

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

/** Launch the signed macOS app through Launch Services, not its private binary. */
export async function ensureChatGPTStarted({
  running = isChatGPTRunning,
  portOpen = isDebugPortOpen,
  open = execFileAsync,
  app = CHATGPT_APP,
  checkAccess = access,
  env = process.env,
} = {}) {
  if (await portOpen()) return 'cdp-ready';
  if (await running()) {
    throw new Error(tr('ChatGPT 已运行但没有开放 9238 CDP。请 Cmd+Q 完全退出，再启动 Launcher；不会强制关闭 ChatGPT。', 'ChatGPT is running without CDP on port 9238. Fully quit it with Cmd+Q, then start the Launcher. ChatGPT will not be force-closed.'));
  }
  await checkAccess(app, constants.R_OK);
  try {
    await open('/usr/bin/open', ['-a', app, '--args', ...CDP_FLAGS], {
      env: chatGPTLaunchEnvironment(env), timeout: 15000,
    });
  } catch (error) {
    throw new Error(`${tr('无法通过 macOS Launch Services 启动 ChatGPT', 'Could not start ChatGPT through macOS Launch Services')}: ${error.message}`);
  }
  return 'launched';
}

export async function launchAndRun() {
  if (process.platform !== 'darwin') throw new Error(tr('自动启动仅适用于 macOS', 'Automatic launch is supported on macOS only'));
  const action = await ensureChatGPTStarted();
  console.log(action === 'launched' ? tr('已通过 macOS Launch Services 启动 ChatGPT（本机 CDP）', 'Started ChatGPT through Launch Services (local CDP)') : tr('复用已开放 CDP 的 ChatGPT', 'Using the running ChatGPT CDP session'));
  await run([]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  launchAndRun().catch(error => { console.error(error.message); process.exitCode = 1; });
}
