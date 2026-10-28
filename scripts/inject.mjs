#!/usr/bin/env node
/**
 * Dependency-free CDP injector for the local ChatGPT desktop main renderer.
 * Connects only to localhost. Does not read any session credentials.
 * Requires Node.js 22+ (built-in WebSocket).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const port = 9238;
const sourcePath = fileURLToPath(new URL('../src/sidebar.js', import.meta.url));

async function run() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/inject.mjs\nConnects to an existing local ChatGPT CDP session at 127.0.0.1:9238.');
    return;
  }
  if (typeof WebSocket !== 'function') {
    throw new Error('Node.js 22+ with built-in WebSocket support is required.');
  }
  const response = await fetch(`http://${host}:${port}/json/list`, {
    signal: AbortSignal.timeout(4000)
  });
  if (!response.ok) throw new Error(`CDP discovery failed: HTTP ${response.status}`);
  const targets = await response.json();
  const main = targets.find(t => t.type === 'page' && t.url === 'app://-/index.html');
  if (!main?.webSocketDebuggerUrl) {
    throw new Error('Main app://-/index.html renderer not found. Open the ChatGPT main window.');
  }
  const wsUrl = new URL(main.webSocketDebuggerUrl);
  if (wsUrl.hostname !== host || Number(wsUrl.port) !== port) {
    throw new Error('Refusing non-local CDP WebSocket URL.');
  }
  const source = await readFile(sourcePath, 'utf8');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP runtime evaluation timed out.'));
    }, 5000);
    const finish = err => {
      clearTimeout(timeout);
      ws.close();
      err ? reject(err) : resolve();
    };
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: source, returnByValue: true }
      }));
    });
    ws.addEventListener('message', event => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.id !== 1) return;
      if (data.error || data.result?.exceptionDetails) {
        finish(new Error(JSON.stringify(data.error ?? data.result.exceptionDetails)));
      } else {
        finish();
      }
    });
    ws.addEventListener('error', () => finish(new Error('CDP WebSocket connection failed.')));
  });
  console.log('Injection request completed. Check ChatGPT sidebar; quotas remain unconnected (--).');
}

run().catch(error => {
  console.error('Injection failed:', error.message);
  process.exitCode = 1;
});
