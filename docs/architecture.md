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


## v0.3.1 optional interaction and icon

- The quota renderer appends one fixed-position reset-time panel to `document.body` so the 36px rail does not clip it. Clicking the same quota is idempotent; outside click, Escape, layout changes and widget destruction close the panel. No new network/API calls are introduced.
- The Swift stop command sends SIGTERM only to the owned Node helper. Node immediately aborts its polling timeout and closes CDP/App Server. The launcher disables redundant clicks, ignores late log updates, and has a watchdog that checks the actual child process state before reporting stopped.
- `macos/generate-icon.swift` reads the icon of **the user's installed** `/Applications/ChatGPT.app` via AppKit at build time. It draws two static colored bars and generates a local PNG. `scripts/build-macos-launcher.sh` uses `sips` and `iconutil` to create `Contents/Resources/AppIcon.icns` and signs the resulting bundle. No image assets from ChatGPT are committed; the bars do not reflect actual usage.
- Bilingual entrypoints: `README.md` and `README.zh-CN.md`. Both cover Node CLI and native Swift Launcher.
