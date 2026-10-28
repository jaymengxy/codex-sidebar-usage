import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../macos/Launcher.swift', import.meta.url), 'utf8');
const build = await readFile(new URL('../scripts/build-macos-launcher.sh', import.meta.url), 'utf8');
const installer = await readFile(new URL('../scripts/install-macos-launcher.sh', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const info = await readFile(new URL('../macos/Info.plist', import.meta.url), 'utf8');

test('native app uses AppKit and manages an owned Node Process', () => {
  assert.match(source, /^import AppKit/m);
  assert.match(source, /final class LauncherDelegate: NSObject, NSApplicationDelegate/);
  assert.match(source, /process\.executableURL = URL\(fileURLWithPath: node\)/);
  assert.match(source, /process\.terminate\(\)/);
});

test('native app refuses to run in parallel with legacy LaunchAgent', () => {
  assert.match(source, /Library\/LaunchAgents\/dev\.paperauk\.codex-sidebar-usage\.plist/);
  assert.match(source, /FileManager\.default\.fileExists\(atPath: oldAgent\.path\)/);
});

test('build script bundles runtime files and signs locally', () => {
  assert.match(build, /swiftc -O -framework AppKit/);
  assert.match(build, /src\/sidebar\.js/);
  assert.match(build, /scripts\/run\.mjs/);
  assert.match(build, /scripts\/launch\.mjs/);
  assert.match(build, /plutil -insert CSUNodePath/);
  assert.match(build, /codesign --force --deep --sign -/);
  assert.doesNotMatch(build, /auth\.json|\.env\.local/);
});

test('installer rejects mismatched bundle identifiers before removal', () => {
  assert.match(installer, /check_existing\(\)/);
  assert.match(installer, /CFBundleIdentifier/);
  assert.match(installer, /dev\.paperauk\.codex-sidebar-usage\.launcher/);
  assert.match(installer, /\[\[ -e "\$TARGET" \]\]; then check_existing;/);
});

test('package exposes native build, open, install and uninstall commands', () => {
  for (const item of ['launcher:build', 'launcher:open', 'launcher:install', 'launcher:uninstall']) {
    assert.equal(typeof packageJson.scripts[item], 'string');
  }
});

test('app bundle contains correct launch identity and minimum macOS', () => {
  assert.match(info, /<key>CFBundleExecutable<\/key><string>CodexUsageLauncher<\/string>/);
  assert.match(info, /<key>LSMinimumSystemVersion<\/key><string>13\.0<\/string>/);
  assert.match(info, /dev\.paperauk\.codex-sidebar-usage\.launcher/);
});

test('Swift launcher allows explicit Codex CLI selection and passes it to Node', () => {
  assert.match(source, /chooseCodex\(_ sender: Any\?\)/);
  assert.match(source, /CSUCodexOverride/);
  assert.match(source, /CSUCodexPath/);
  assert.match(build, /plutil -insert CSUCodexPath/);
  assert.match(source, /environment\["CSU_CODEX_CLI_PATH"\] = codex/);
  assert.match(source, /environment\.removeValue\(forKey: "CODEX_CLI_PATH"\)/);
});
