#!/usr/bin/env node
/** Install/remove an explicit opt-in user LaunchAgent; no modifications to ChatGPT.app. */
import { mkdir, writeFile, unlink, access } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tr } from '../src/i18n.mjs';

export const LABEL = 'dev.paperauk.codex-sidebar-usage';
export const PLIST_PATH = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function makePlist({node = process.execPath, root = REPO_ROOT, home = homedir()} = {}) {
  const str = value => `<string>${xmlEscape(value)}</string>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key>${str(LABEL)}
  <key>ProgramArguments</key><array>${str(node)}${str(join(root, 'scripts', 'launch.mjs'))}</array>
  <key>WorkingDirectory</key>${str(root)}
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key>${str(join(home, 'Library', 'Logs', 'CodexSidebarUsage', 'stdout.log'))}
  <key>StandardErrorPath</key>${str(join(home, 'Library', 'Logs', 'CodexSidebarUsage', 'stderr.log'))}
</dict></plist>
`;
}

function launchctl(args) {
  const result = spawnSync('/bin/launchctl', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `launchctl ${args[0]} ${tr('失败','failed')}`).trim());
}

export async function main(args = process.argv.slice(2)) {
  if (process.platform !== 'darwin') throw new Error(tr('登录启动项只支持 macOS', 'Login items are supported on macOS only'));
  const action = args[0];
  if (!['install', 'uninstall', 'status'].includes(action)) {
    console.log('Usage: node scripts/login-item.mjs install|uninstall|status');
    return;
  }
  const domain = `gui/${process.getuid()}`;
  if (action === 'status') {
    try { await access(PLIST_PATH); console.log(tr('登录项已安装：', 'Login item installed: ') + PLIST_PATH); }
    catch { console.log(tr('登录项未安装', 'Login item is not installed')); }
    return;
  }
  if (action === 'uninstall') {
    try { launchctl(['bootout', domain, PLIST_PATH]); } catch { /* may not be loaded */ }
    try { await unlink(PLIST_PATH); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    console.log(tr('登录项已卸载；不会修改或关闭 ChatGPT。', 'Login item removed. ChatGPT remains unchanged and running.'));
    return;
  }
  await mkdir(dirname(PLIST_PATH), { recursive: true });
  await mkdir(join(homedir(), 'Library', 'Logs', 'CodexSidebarUsage'), { recursive: true });
  await access(process.execPath);
  await access(join(REPO_ROOT, 'scripts', 'launch.mjs'));
  try { launchctl(['bootout', domain, PLIST_PATH]); } catch { /* not running */ }
  await writeFile(PLIST_PATH, makePlist(), { mode: 0o600 });
  launchctl(['bootstrap', domain, PLIST_PATH]);
  console.log(tr('登录项已安装：', 'Login item installed: ') + PLIST_PATH);
  console.log(tr('请禁用 ChatGPT 自带的“登录时打开”，避免它先于本工具启动并占用无 CDP 的进程。', 'Disable ChatGPT’s own Open at Login option, or it may start without CDP before this helper.'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(tr('登录项操作失败：', 'Login item error: ') + error.message); process.exitCode = 1; });
}
