import test from 'node:test';
import assert from 'node:assert/strict';
import { findMainTarget, localWebSocketUrl, WIDGET_PROBE, probeState } from '../src/monitor-utils.mjs';
import { parseArguments } from '../scripts/run.mjs';
import { isChatGPTRunning, ensureChatGPTStarted, chatGPTLaunchEnvironment, CDP_FLAGS } from '../scripts/launch.mjs';
import { xmlEscape, makePlist } from '../scripts/login-item.mjs';

const main = { id: 'main', type: 'page', url: 'app://-/index.html', webSocketDebuggerUrl: 'ws://127.0.0.1:9238/devtools/page/main' };

test('chooses the main renderer, not avatar overlay and webview', () => {
  assert.equal(findMainTarget([
    { id: 'overlay', type: 'page', url: 'app://-/index.html?initialRoute=%2Favatar-overlay' },
    { id: 'browser', type: 'webview', url: 'https://chatgpt.com/' }, main,
  ]), main);
  assert.equal(findMainTarget([]), null);
});

test('CDP connection accepts only loopback ws page for required port', () => {
  assert.equal(localWebSocketUrl(main.webSocketDebuggerUrl), main.webSocketDebuggerUrl);
  for (const url of [
    'ws://192.168.0.10:9238/devtools/page/x',
    'wss://127.0.0.1:9238/devtools/page/x',
    'ws://127.0.0.1:9222/devtools/page/x',
    'ws://127.0.0.1:9238/devtools/browser/x',
  ]) assert.throws(() => localWebSocketUrl(url));
});

test('probe recognizes ready/missing/waiting and rejects exception', () => {
  for (const state of ['ready', 'missing', 'waiting']) {
    assert.equal(probeState({ result: { value: state } }), state);
  }
  assert.equal(probeState({ result: { value: 'unrecognized' } }), 'waiting');
  assert.throws(() => probeState({ exceptionDetails: { text: 'Context destroyed' } }));
  assert.match(WIDGET_PROBE, /codex-sidebar-usage-widget/);
});

test('parses options with bounded polling', () => {
  assert.deepEqual(parseArguments([]), { once: false, pollMs: 3000 });
  assert.equal(parseArguments(['--poll-ms', '1000']).pollMs, 1000);
  assert.equal(parseArguments(['--once']).once, true);
  assert.throws(() => parseArguments(['--poll-ms', '0']));
  assert.throws(() => parseArguments(['--codex-path']));
  assert.throws(() => parseArguments(['--bad']));
});

test('never relaunches when CDP exists or ChatGPT already runs', async () => {
  let calls = 0;
  const mocks = { open: async () => { calls++; }, checkAccess: async () => {} };
  assert.equal(await ensureChatGPTStarted({ ...mocks, portOpen: async () => true, running: async () => false }), 'cdp-ready');
  await assert.rejects(ensureChatGPTStarted({ ...mocks, portOpen: async () => false, running: async () => true }), /已运行/);
  assert.equal(calls, 0);
});

test('starts via Launch Services and passes CDP flags, not helper overrides', async () => {
  let call;
  const result = await ensureChatGPTStarted({
    portOpen: async () => false, running: async () => false, checkAccess: async () => {},
    open: async (cmd, args, opts) => { call = { cmd, args, opts }; return {stdout:'',stderr:''}; },
    env: {PATH:'/usr/bin',CODEX_CLI_PATH:'/other/codex',CSU_CODEX_CLI_PATH:'/helper/codex'},
  });
  assert.equal(result,'launched');
  assert.equal(call.cmd,'/usr/bin/open');
  assert.deepEqual(call.args,['-a','/Applications/ChatGPT.app','--args',...CDP_FLAGS]);
  assert.equal(call.opts.env.CODEX_CLI_PATH,undefined);
  assert.equal(call.opts.env.CSU_CODEX_CLI_PATH,undefined);
});

test('does not modify global or caller environment', () => {
  const original={PATH:'/usr/bin',CODEX_CLI_PATH:'/other/codex',CSU_CODEX_CLI_PATH:'/helper/codex'};
  assert.deepEqual(chatGPTLaunchEnvironment(original),{PATH:'/usr/bin'});
  assert.equal(original.CODEX_CLI_PATH,'/other/codex');
});

test('native open failures remain diagnosable', async () => {
  await assert.rejects(ensureChatGPTStarted({
    portOpen: async () => false, running: async () => false, checkAccess: async () => {},
    open: async () => {throw Error('No application registered')},
  }),/Launch Services.*No application registered/);
});

test('pgrep treats exit code 1 as not running, other errors propagate', async () => {
  assert.equal(await isChatGPTRunning(async () => { throw Object.assign(new Error('not found'), { code: 1 }); }), false);
  assert.equal(await isChatGPTRunning(async () => ({ stdout: '321\n' })), true);
  await assert.rejects(isChatGPTRunning(async () => { throw new Error('unexpected'); }));
});

test('LaunchAgent plist escapes paths and runs only when explicitly installed', () => {
  assert.equal(xmlEscape('a<&"'), 'a&lt;&amp;&quot;');
  const plist = makePlist({ node: '/tmp/node & 22', root: '/Users/me/Code/<repo>', home: '/Users/me' });
  assert.match(plist, /\/tmp\/node &amp; 22/);
  assert.match(plist, /&lt;repo&gt;/);
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key><false\/>/);
});
