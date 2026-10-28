# Architecture: v0.3 development

```text
macOS login (optional)
  └─ LaunchAgent `dev.paperauk.codex-sidebar-usage` (user only)
       └─ scripts/launch.mjs
            ├─ checks loopback CDP; never force-quits ChatGPT
            ├─ starts ChatGPT with loopback CDP if not already running
            └─ scripts/run.mjs (reconnection monitor)
                 ├─ `GET /json/list` @ 127.0.0.1:9238 every ~3 seconds
                 ├─ validates app://-/index.html target and loopback ws URL
                 ├─ CDP Runtime.addBinding + Runtime.evaluate
                 ├─ restores widget if missing after renderer/DOM replacement
                 └─ Codex App Server JSON-RPC stdio
                     └─ account/rateLimits/read (read-only)
```

## Boundaries

- `src/monitor-utils.mjs` identifies only the main Codex renderer, rejecting webviews, avatar overlays, remote/non-loopback websocket addresses.
- `scripts/run.mjs` has one CDP session at a time, monitors `Runtime.evaluate` widget presence, retries a missing target/connection, and shares in-flight quota reads. It does not create a local network server.
- `scripts/launch.mjs` launches signed `/Applications/ChatGPT.app/Contents/MacOS/ChatGPT` with loopback CDP only when CDP absent and no ChatGPT process exists. This is intentional: silently killing or spawning duplicates would be intrusive.
- `scripts/login-item.mjs` writes a single user LaunchAgent and logs under `~/Library/Logs/CodexSidebarUsage`. Install/uninstall are *explicit*. It writes no system LaunchDaemon and never requires sudo.
- `src/sidebar.js` remains the already tested 36px quota UI, green/orange bars and hover/manual/automatic refresh. It exposes a `receive` method for its local CDP binding, but no network calls.
- Authentication is owned by Codex App Server. This project does not inspect `~/.codex/auth.json` or inject tokens into the renderer.

## Acceptance gates

- [x] Unit and syntax tests for target detection, URL safeguards, launcher no-kill behavior, plist XML escaping, quota mapping and colors.
- [ ] `npm run launch` from all-apps-closed state opens ChatGPT with active CDP and injects the widget.
- [ ] App renderer reload destroys previous widget and the monitor restores it.
- [ ] App window replacement returns to an exactly-one-widget state.
- [ ] An already-running non-CDP ChatGPT is left untouched, with an actionable error.
- [ ] Manual, hover and 120s refresh work after a renderer reattach.
- [ ] `login:install` takes effect at login; `login:uninstall` removes only our helper, preserving ChatGPT settings.
- [ ] Run under light/dark and narrow/short windows without overlapping native controls.

## Known limitations

- If the user relaunches ChatGPT without CDP after quitting, the monitor cannot inject: use `npm run launch` with the ordinary app closed.
- If the app-server child exits, current release may require helper restart to restore quota reads.
- The LaunchAgent does not auto-restart on helper crash, to avoid login crash loops.
- DOM classes/selector may change in future app versions; these are not official extension hooks.
