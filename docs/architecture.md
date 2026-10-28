# Architecture — v0.3.0

## Runtime

```text
Codex Usage Launcher.app (native macOS Swift/AppKit)
  └─ bundled JS helper, run by installed Node.js 22+
       ├─ macOS Launch Services: open -a /Applications/ChatGPT.app --args CDP flags
       │    └─ ChatGPT renderer app://-/index.html (127.0.0.1:9238)
       │         └─ 36px widget inside 52px navigation rail
       ├─ CDP supervisor, reconnect / reinject every ~3 seconds
       │    └─ Runtime.addBinding and Runtime.evaluate
       └─ Codex App Server (child process, stdio JSON-RPC)
            └─ account/rateLimits/read (read-only)
```

The native Launcher controls **only its own helper process**. Quitting/stopping it does not terminate ChatGPT, nor does it rewrite `ChatGPT.app`. A helper must be running for refreshed quota data and re-injection. A separate CLI option `npm run launch` uses the same workflow without the native window.

## Quota semantics

- `src/rate-limits.mjs` maps 5h and weekly by `windowDurationMins=300` and `10080`. Values displayed as `100 - usedPercent`.
- Missing buckets display `--`; errors retain the last data with a stale tooltip.
- Refresh: user click (10s cooldown), hover if cached data is at least 60s old, interval ~120s.
- Quota is a backend snapshot, not a live continuous count.

## Security and process boundaries

- CDP bound only to `127.0.0.1:9238`; renderer targeting excludes avatar overlays and embedded webviews.
- The quota helper prefers an absolute executable. Its optional path override is `CSU_CODEX_CLI_PATH`, **not** `CODEX_CLI_PATH`; the ChatGPT launcher subprocess strips both variables before running `/usr/bin/open -a ... --args`. This does **not** change system-wide launchd settings.
- The embedded JS runtime and CDP binding do not read or expose auth files, passwords or session tokens. Only quota percentages and reset times are delivered to the widget.
- The native `.app` is built and ad-hoc signed on the user's Mac; distribution notarization is not provided.
- The legacy `scripts/login-item.mjs` LaunchAgent is an optional alternative, not meant to run alongside the native Launcher.

## Verification and acceptance

See [v0.3 acceptance](acceptance-v0.3.md). Four core macOS restart/recovery scenarios have been reported PASS by the owner (2026-10-28). Automatic tests were reported 40/40 PASS during v0.3 development. No current GitHub CI check runs exist.

Out-of-scope or pending manual verification: legacy login LaunchAgent install/uninstall and login cycle, behavior when ChatGPT is already running without CDP, alternate application builds, older/newer macOS and full installer/notarization.

Unsupported coupling to the current ChatGPT renderer means future DOM changes may break the component; there is no official supported UI plugin API.
