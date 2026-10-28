# Changelog

## v0.3.0 (development — macOS device gate open)

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
