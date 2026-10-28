# Changelog

## v0.3.0 — accepted for native Launcher workflow (2026-10-28)

**Mac acceptance:** user confirmed four of four core scenarios: widget auto-reinjection after removal, renderer reload recovery, full quit/restart using the native Swift Launcher, and exactly one widget with correct quota and refresh behavior. Also confirmed normal ChatGPT startup after the CLI environment isolation fix.

### Features
- Add native Swift/AppKit `Codex Usage Launcher.app` with double-click ChatGPT/CDP startup, quota monitor controls and log view; packages its JS runtime locally.
- Add local CDP supervision (3s polling) with renderer/DOM reattachment and idempotent widget injection.
- Add `npm run launch` one-terminal mode and optional, **not device-accepted**, legacy user LaunchAgent login workflow.
- Keep existing five-hour / weekly quota UI and refresh mechanism.

### Startup and compatibility fixes
- Resolve the App Server executable to an absolute path, with GUI-selectable Codex CLI fallback; address GUI `ENOENT` caused by missing `PATH` entry.
- Isolate quota-helper `CSU_CODEX_CLI_PATH` from ChatGPT's own `CODEX_CLI_PATH`; launch ChatGPT through macOS Launch Services to avoid interfering with native App Server initialization.
- Maintain loopback-only CDP connection, no credential extraction, no app bundle modifications.

### Verification / known limits
- Prior development automation result: 40/40 Node tests PASS, Swift syntax checks PASS. No GitHub CI checks are currently configured for this PR.
- User-reported macOS acceptance: 4/4 core recovery cases PASS. See [acceptance](docs/acceptance-v0.3.md).
- Legacy LaunchAgent login cycle, non-CDP collision flow, alternative macOS/ChatGPT versions, notarization and long-term compatibility are **not verified**, not part of this acceptance claim.
- The native app is ad-hoc signed for local use and depends on an installed Node.js 22+ runtime.

## v0.2.1 — accepted

- Correct progress fill geometry; five-hour `#16A34A` green and weekly `#D97706` orange.
- User confirmed live quota UI and progress bar colors on macOS.

## v0.2.0

- Read-only Codex App Server quota bridge and automatic/manual/hover refresh.

## v0.1.0

- First narrow 52px rail DOM injection prototype, user accepted.
