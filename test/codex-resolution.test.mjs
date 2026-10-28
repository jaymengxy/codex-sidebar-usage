import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCodexCommand } from '../src/app-server.mjs';

const make = ({ existing = [], env = {}, bundled = '/Applications/ChatGPT.app/Contents/Resources/codex', nodeExecutable = '/opt/node/bin/node' } = {}) => ({
  env, bundled, nodeExecutable, home: '/Users/example',
  isExecutable: async file => existing.includes(file),
});

test('prefers explicitly selected Codex CLI over all other locations', async () => {
  const options = make({ existing: ['/custom/bin/codex', '/opt/node/bin/codex'] });
  assert.equal(await resolveCodexCommand('/custom/bin/codex', options), '/custom/bin/codex');
});

test('GUI-configured CODEX_CLI_PATH works with an empty PATH', async () => {
  const options = make({ existing: ['/Users/example/custom/codex'], env: {CODEX_CLI_PATH:'/Users/example/custom/codex'} });
  assert.equal(await resolveCodexCommand(undefined, options), '/Users/example/custom/codex');
});

test('bundled Codex is preferred over user PATH when present', async () => {
  const bundled = '/Applications/ChatGPT.app/Contents/Resources/codex';
  const options = make({ existing: [bundled, '/opt/homebrew/bin/codex'], env: {PATH:'/opt/homebrew/bin'} });
  assert.equal(await resolveCodexCommand(undefined, options), bundled);
});

test('finds npm installed codex alongside the selected Node binary', async () => {
  const options = make({ existing: ['/Users/example/.nvm/versions/node/v22/bin/codex'], nodeExecutable:'/Users/example/.nvm/versions/node/v22/bin/node' });
  assert.equal(await resolveCodexCommand(undefined, options), '/Users/example/.nvm/versions/node/v22/bin/codex');
});

test('finds Homebrew binary even with minimal Finder PATH', async () => {
  const options = make({ existing: ['/opt/homebrew/bin/codex'], env: { PATH:'/usr/bin:/bin' } });
  assert.equal(await resolveCodexCommand(undefined, options), '/opt/homebrew/bin/codex');
});

test('finds CLI from supplied PATH', async () => {
  const options = make({ existing: ['/my/bin/codex'], env: { PATH:'/my/bin:/usr/bin' } });
  assert.equal(await resolveCodexCommand(undefined, options), '/my/bin/codex');
});

test('invalid explicit CLI fails with a path-specific error', async () => {
  const options = make();
  await assert.rejects(resolveCodexCommand('/missing/codex', options), /Codex 可执行文件不可用：\/missing\/codex/);
});

test('a nonabsolute CODEX_CLI_PATH is rejected rather than spawned', async () => {
  const options = make({env: {CODEX_CLI_PATH:'codex'}});
  await assert.rejects(resolveCodexCommand(undefined, options), /Codex 可执行文件不可用：codex/);
});

test('unavailable Codex CLI reports actionable instructions instead of ENOENT', async () => {
  await assert.rejects(resolveCodexCommand(undefined, make()), /command -v codex/);
});
