import test from 'node:test';
import assert from 'node:assert/strict';
import { findMainTarget, localWebSocketUrl, WIDGET_PROBE, probeState } from '../src/monitor-utils.mjs';
import { parseArguments } from '../scripts/run.mjs';
import { isChatGPTRunning, ensureChatGPTStarted } from '../scripts/launch.mjs';
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
  let launches = 0;
  const mocks = { launch: () => { launches++; return { unref() {} }; }, checkAccess: async () => {} };
  const present = await ensureChatGPTStarted({ ...mocks, portOpen: async () => true, running: async () => false });
  assert.equal(present, 'cdp-ready');
  await assert.rejects(ensureChatGPTStarted({ ...mocks, portOpen: async () => false, running: async () => true }), /已运行/);
  assert.equal(launches, 0);
});

test('launcher starts ChatGPT with loopback CDP only when not running', async () => {
  let call;
  const launched = await ensureChatGPTStarted({
    portOpen: async () => false,
    running: async () => false,
    checkAccess: async () => {},
    launch(binary, args, opts) { call = { binary, args, opts }; return { unref() {} }; },
  });
  assert.equal(launched, 'launched');
  assert.deepEqual(call.args, ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9238']);
  assert.equal(call.opts.detached, true);
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
