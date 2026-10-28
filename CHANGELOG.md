# Changelog

## v0.3.0 (development — macOS device gate open)

### Startup environment isolation fix (requires Mac re-test)
- Fix Swift Launcher forwarding `CODEX_CLI_PATH` to ChatGPT, potentially causing an incompatible App Server and the “organization settings could not be loaded” startup error.
- Use private `CSU_CODEX_CLI_PATH` only for the quota reader. Never change user-wide environment variables.
- Launch signed ChatGPT via macOS Launch Services instead of raw bundle executable.
- Add regression tests and recovery instructions; quotas UI and data flow unchanged.


- Add a native **Swift/AppKit** `Codex Usage Launcher.app` with one-click startup, monitor controls, local diagnostics, and Node-path selection.
- Add `npm run launcher:build`, `launcher:open`, `launcher:install`, `launcher:uninstall`; package the JS runtime inside `.app` without credentials. Local ad-hoc signing; macOS build and GUI device gate still open.
- Add a CDP supervisor that monitors the ChatGPT main `app://-/index.html` renderer and reconnects when the target disappears or the WebSocket disconnects.
- Reinject the existing widget after renderer reload and sidebar DOM re-creation without duplicating an already healthy instance.
- Add `npm run launch`: starts ChatGPT with loopback CDP when not already running, then runs the persistent quota bridge. Never terminates or replaces a running app.
- Add opt-in `npm run login:install`, `login:status`, and `login:uninstall` to manage a user-level macOS LaunchAgent. No changes to `ChatGPT.app`.
- Update README, architecture, compatibility and automated coverage.
- Static / unit checks PASS; runtime macOS login and reconnection tests still pending.

## v0.2.1 (accepted, merged into main)

- Fix bar fill geometry: explicit block track and positioned span fill.
- Five-hour #16A34A green, weekly #D97706 orange.
- User confirmed real quota UI and visual output on macOS.

## v0.2.0

- Read-only Codex App Server quota bridge, automatic/manual/hover refresh.

## v0.1.0

- First 52px sidebar injection prototype, user accepted.
