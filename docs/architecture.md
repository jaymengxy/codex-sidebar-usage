# Architecture (v0.2 candidate)

```text
ChatGPT.app signed UI (52px rail)
        ↑ CDP Runtime.evaluate (quota values only)
Node.js scripts/run.mjs (127.0.0.1:9238)
        ↓ JSONL over process stdio
Local bundled Codex App Server
        ↓ account/rateLimits/read (existing authenticated account)
OpenAI quota snapshot
```

- Renderer `src/sidebar.js` is an ephemeral, 36px-wide component attached to the avatar's `NAV` direct child, as confirmed by user DOM inspection. It contains a CDP `Runtime.addBinding` callback to request only a quota read; the renderer does not access auth or make network requests.
- `src/app-server.mjs` starts a local child Codex process, performs JSON-RPC handshake (`initialize`, `initialized`), sends `account/rateLimits/read`. It does not read authentication files.
- `src/rate-limits.mjs` classifies snapshots strictly by `windowDurationMins` = 300 and 10080, regardless of slot order.
- The `scripts/run.mjs` helper keeps the local CDP binding and App Server process active. No HTTP server is exposed; it only connects to localhost CDP.
- UI always shows remaining percent (`100 - usedPercent`), reset timestamp, local last-success time; missing windows show `--`. On a read error it retains the prior snapshot, marked stale.
- A backend snapshot can lag real usage; there is no guarantee of live counters.

## 0.2 acceptance checklist (pending Mac testing)

- [ ] `npm run probe` produces 5h/7d values matching the ChatGPT Usage page for the active account (allow backend reporting lag).
- [ ] `npm start` inserts the component above avatar, preserving 52px rail and avatar click.
- [ ] No content overlap when ChatGPT window is short, light and dark themes render.
- [ ] Hover tooltip shows absolute reset time; hover after 60s triggers another request.
- [ ] Manual click refreshes, with 10s cooldown, and does not double-fetch.
- [ ] Automatic refresh every 120s and stale-on-error behave as expected.
- [ ] `Ctrl+C` stops local helper; reload and re-run restores the widget.
- [ ] Signed-in mismatch or missing quota window is handled clearly.

## Known constraints

- A running shell helper is required for refresh; `npm run inject-layout` is for layout-only testing.
- This version does not automatically reconnect after renderer reload. That is future work.
- A normal child app-server might use a different `CODEX_HOME` or account than the UI; user must compare the read-only probe.
- This relies on unsupported CDP injection, not an OpenAI plugin API.
