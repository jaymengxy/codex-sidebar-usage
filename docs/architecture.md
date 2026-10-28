# Architecture: v0.3 development

```text
macOS native Swift AppKit .app (recommended interactive launcher)
  ├─ Process launches bundled runtime/scripts/launch.mjs via installed Node 22+
  ├─ Logs/status; Start/Stop/Select Node controls; manages helper only
  └─ Same quota bridge and CDP monitor described below

Legacy macOS login (optional alternative; NOT used simultaneously with .app)
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

## Native .app distribution boundary

- `macos/Launcher.swift`: AppKit UI + child-process lifecycle, no Electron/Swift WebView or app patching. It starts only its own Node helper and does not terminate the ChatGPT process.
- `scripts/build-macos-launcher.sh` copies an allowlisted JS runtime to the `.app` bundle, compiles for the current Mac CPU using `swiftc`, writes the local Node binary path in `Info.plist`, then applies an ad-hoc local signature.
- `scripts/install-macos-launcher.sh` manages only `~/Applications/Codex Usage Launcher.app`, refusing to overwrite unknown bundle identifiers.
- The `.app` is movable without the source checkout, but requires the configured Node executable to remain available; a Node selector is provided. It is neither Developer ID signed nor notarized.
- Do not run the old LaunchAgent or manual `npm start` helper in parallel with the new launcher.

## Boundaries

- `src/monitor-utils.mjs` identifies only the main Codex renderer, rejecting webviews, avatar overlays, remote/non-loopback websocket addresses.
- `scripts/run.mjs` has one CDP session at a time, monitors `Runtime.evaluate` widget presence, retries a missing target/connection, and shares in-flight quota reads. It does not create a local network server.
- `scripts/launch.mjs` launches signed `/Applications/ChatGPT.app/Contents/MacOS/ChatGPT` with loopback CDP only when CDP absent and no ChatGPT process exists. This is intentional: silently killing or spawning duplicates would be intrusive.
- `scripts/login-item.mjs` writes a single user LaunchAgent and logs under `~/Library/Logs/CodexSidebarUsage`. Install/uninstall are *explicit*. It writes no system LaunchDaemon and never requires sudo.
- `src/sidebar.js` remains the already tested 36px quota UI, green/orange bars and hover/manual/automatic refresh. It exposes a `receive` method for its local CDP binding, but no network calls.
- Authentication is owned by Codex App Server. This project does not inspect `~/.codex/auth.json` or inject tokens into the renderer.

## Acceptance gates

- [x] Unit and syntax tests for target detection, URL safeguards, launcher no-kill behavior, plist XML escaping, quota mapping and colors.
- [ ] `npm run launcher:build` compiles a working `.app` on an actual macOS host.
- [ ] Double-click `.app` and verify automatic ChatGPT/CDP startup + quota UI, native Start/Stop, Dock reopen and Cmd+Q cleanup.
- [ ] `launcher:install` and `launcher:uninstall` affect only the known launcher bundle.
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

## Native Launcher.app

- `macos/Launcher.swift` is a native Dock/window AppKit utility: opens and owns `Process` running `scripts/launch.mjs` through the user's installed Node 22+, displays logs, and can stop only its helper.
- `scripts/build-macos-launcher.sh` compiles Swift on a local Mac, packages an explicit allowlist of JS source under `Contents/Resources/runtime` (never account or `.env` files), stores the Node executable path, and applies a local ad-hoc signature.
- `scripts/install-macos-launcher.sh` copies only the recognized bundle ID into `~/Applications`; does not touch `ChatGPT.app`.
- The native app refuses to run alongside the old LaunchAgent, preventing accidental duplicate quota monitors through that path. Stop manual monitors before using the native app.
- AppKit build and runtime verification remain device-gated.

## Native launcher CLI discovery (v0.3 ENOENT fix)

- Finder-launched `.app` does not necessarily inherit shell `PATH`. `src/app-server.mjs` must resolve an **absolute executable** before calling `spawn`. It never falls back to a bare `codex` command.
- Resolution priority: user override (`CODEX_CLI_PATH`), ChatGPT bundle path if executable, next to active Node binary, inherited `PATH`, Homebrew and common user bins.
- `scripts/build-macos-launcher.sh` captures the verified terminal `codex` executable path in `CSUCodexPath` at build time (when found). `macos/Launcher.swift` lets the user override via **选择 Codex…** without editing application internals.
- App Server child PATH includes the active Node executable directory to support `#!/usr/bin/env node` wrappers. No tokens, credentials or raw app-server JSON are logged.
