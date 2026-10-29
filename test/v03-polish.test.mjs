import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sidebar = await readFile(new URL('../src/sidebar.js', import.meta.url), 'utf8');
const swift = await readFile(new URL('../macos/Launcher.swift', import.meta.url), 'utf8');
const icon = await readFile(new URL('../macos/generate-icon.swift', import.meta.url), 'utf8');
const builder = await readFile(new URL('../scripts/build-macos-launcher.sh', import.meta.url), 'utf8');
const plist = await readFile(new URL('../macos/Info.plist', import.meta.url), 'utf8');
const runner = await readFile(new URL('../scripts/run.mjs', import.meta.url), 'utf8');
const en = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const zh = await readFile(new URL('../README.zh-CN.md', import.meta.url), 'utf8');

test('quota hover uses normal cursor, never question-mark help cursor', () => {
  assert.match(sidebar, /\.quota\{[^}]*cursor:default/);
  assert.doesNotMatch(sidebar, /cursor:help/);
  assert.match(sidebar, /el\.removeAttribute\('title'\)/);
  assert.doesNotMatch(sidebar, /data-quota="five" title=/);
});

test('clicking same quota does not duplicate the reset-time popover', () => {
  assert.match(sidebar, /popover\?\.isConnected && popoverKey === key\) return/);
  assert.match(sidebar, /closePopover\(\);\s*const rect = anchor\.getBoundingClientRect\(\)/);
  assert.match(sidebar, /document\.body\.appendChild\(panel\)/);
  assert.match(sidebar, /codex-sidebar-usage-popover/);
});

test('popover supports outside click, Escape, keyboard activation, and cleanup', () => {
  assert.match(sidebar, /event\.key === 'Escape'/);
  assert.match(sidebar, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(sidebar, /document\.addEventListener\('pointerdown', onOutsidePointer, true\)/);
  assert.match(sidebar, /document\.removeEventListener\('pointerdown', onOutsidePointer, true\)/);
  assert.match(sidebar, /closePopover\(\);[\s\S]*?root\.remove\(\)/);
});

test('reset popover content follows quota snapshot refresh', () => {
  assert.match(sidebar, /重置：/);
  assert.match(sidebar, /if \(popover\?\.isConnected && popoverKey\) popover\.textContent = detailsFor\(popoverKey\)/);
});

test('stop button enters a single pending state and ignores late connected logs', () => {
  assert.match(swift, /guard !stopping else \{ return \}/);
  assert.match(swift, /stopButton\.isEnabled = false/);
  assert.match(swift, /self\?\.stopping == false &&/);
  assert.match(swift, /finishMonitorExit\(code: code\)/);
  assert.match(swift, /stopWatchdog\?\.cancel\(\)/);
});

test('SIGTERM aborts the Node monitor poll without waiting for next timer', () => {
  assert.match(runner, /const stopSignal = new AbortController\(\)/);
  assert.match(runner, /stopSignal\.abort\(\)/);
  assert.match(runner, /abortableSleep\(options\.pollMs, stopSignal\.signal\)/);
});

test('native icon builds from installed ChatGPT icon and never checks in source image', () => {
  assert.match(icon, /NSWorkspace\.shared\.icon\(forFile: chatGPTPath\)/);
  assert.match(icon, /sample\.colorAt\(x: x, y: y\)/);
  assert.match(icon, /pixel\.alphaComponent >= 0\.08/);
  assert.match(icon, /let visibleSize = max\(visibleWidth, visibleHeight\)/);
  assert.match(icon, /appIcon\.draw\(in: iconRect/);
  assert.match(swift, /NSApp\.applicationIconImage = iconImage/);
  assert.match(icon, /bar\(y: 207, fraction: 0\.74/);
  assert.match(icon, /bar\(y: 145, fraction: 0\.48/);
  assert.match(builder, /macos\/generate-icon\.swift/);
  assert.match(builder, /iconutil -c icns/);
  assert.match(builder, /Contents\/Resources\/AppIcon\.icns/);
  assert.match(plist, /CFBundleIconFile<\/key><string>AppIcon/);
});

test('both READMEs offer language switch and both usage modes', () => {
  for (const text of [en, zh]) {
    assert.match(text, /README\.zh-CN\.md/);
    assert.match(text, /README\.md/);
    assert.match(text, /npm run launch/);
    assert.match(text, /npm run launcher:build/);
    assert.match(text, /npm run launcher:install/);
  }
});
