# Codex Sidebar Usage

An **unofficial, experimental** 52px sidebar quota widget for Codex in the ChatGPT macOS desktop app. No app bundle patches, third-party packages, or token extraction.

## Acceptance status

- **v0.1 PASS (user tested):** main renderer CDP and 52px rail/36px avatar placement on ChatGPT `26.1021.31345` (`com.openai.codex`).
- **v0.2 CANDIDATE (partial acceptance):** User confirmed live quota display; progress-bar colors required a CSS fix (0.2.1), pending macOS visual recheck. Snapshot refresh and other interaction details are still pending separate acceptance.
- **v0.3 planned:** persistent startup and resilience to app updates.

This is not an official OpenAI extension; CDP renderer injection is unsupported and may break with application updates.

## Requirements

- ChatGPT for macOS with CDP open at `127.0.0.1:9238` (user has validated this on version `26.1021.31345`).
- Node.js 22+, no `npm install` required.
- Signed-in Codex account accessible to the bundled `/Applications/ChatGPT.app/Contents/Resources/codex` app-server. If the binary is missing, a `codex` binary on `PATH` is tried; that may use a **different account**.

## Quick start

1. Quit ChatGPT with `Cmd+Q`.
2. Start the signed ChatGPT app with loopback-only CDP:

   ```bash
   APP="/Applications/ChatGPT.app"
   EXE=$(plutil -extract CFBundleExecutable raw -o - "$APP/Contents/Info.plist")
   "$APP/Contents/MacOS/$EXE" \
      --remote-debugging-address=127.0.0.1 \
      --remote-debugging-port=9238
   ```

3. Open the Codex view; leave it visible. In the repository directory:

   ```bash
   npm run check
   npm test
   npm run probe  # read-only, does not inject UI
   ```

4. **Compare `probe` percentages with the built-in ChatGPT/Codex Usage display.** If they differ materially, do not proceed: it may be another account or an upstream reporting difference.
5. To inject and keep the read-only bridge active:

   ```bash
   npm start
   ```

   The narrow widget shows **remaining** (100 minus `usedPercent`), not consumed %. Hover on each value for reset timestamp and last successful update. Click ↻ to request a snapshot immediately (10s retry cooldown). Hover fetches only if last successful snapshot is 60+ seconds old. Automatic refresh checks every 120 seconds. This is a server snapshot, **not exact real-time accounting**.

**Keep the terminal running** for refresh. `Ctrl+C` stops the helper; re-injection is needed after renderer reload/restart. The injected element can be removed without changing the app binary:

```js
window.__codexUsageSidebarV02?.destroy();
```

Note: `npm run inject-layout` only injects HTML, without the persistent quota bridge. To fetch quota, use `npm start`.

## Data source and trust boundary

The local Node process launches Codex App Server using its built-in **read-only** `account/rateLimits/read` RPC. It does not inspect or copy auth files, and communicates with the ChatGPT renderer only over an already enabled CDP loopback port. CDP binding carries a fixed `read` action and returns normalized **usage % + reset timestamps only**; no account IDs or credentials enter the renderer.

5h is identified by `windowDurationMins=300`; weekly by `10080`. Missing windows show `--` (e.g., some accounts only expose a weekly bucket). Errors retain the last successful snapshot and show a stale warning in the tooltip.

**Important:** API rates depend on the account authenticated for the spawned app-server, which is not guaranteed to be identical to the visible ChatGPT desktop profile. The manual `npm run probe` comparison is a required acceptance step.

### Security

- Run CDP only on `127.0.0.1`, not a LAN interface. CDP grants broad renderer access to local processes.
- Do not publish session tokens, `~/.codex/auth.json`, WebSocket URLs, or raw App Server responses.
- `npm start` does not host an HTTP server and never makes direct requests from an embedded browser to OpenAI usage endpoints.
- This code is a private utility, not an officially supported extension point.

## Roadmap

- [x] v0.1: DOM probe, 52px sidebar placement (user verified)
- [ ] v0.2: quota bridge and refresh behavior (live quota values verified by user; 0.2.1 bar colors need visual recheck)
- [ ] v0.3: restart/update compatibility, optional launcher

See [architecture](docs/architecture.md) and [compatibility](docs/compatibility.md).
