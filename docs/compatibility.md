# Compatibility and verification

Target evidence from user on 2026-10-28:

| Item | Value |
| --- | --- |
| ChatGPT version | `26.1021.31345` |
| Bundle ID / executable | `com.openai.codex` / `ChatGPT` |
| Main renderer | `app://-/index.html` |
| CDP | loopback `127.0.0.1:9238` (`--remote-debugging-port=9238`) |
| Sidebar rail | `nav` class contains `group/sidebar-rail`, width 52px |
| Avatar / inner content | avatar image 24px; narrow content rail 36px |
| v0.1 UI acceptance | PASS |
| v0.2.1 quota and colors | PASS |
| v0.3 supervisor | unit tests PASS; real Mac/LaunchAgent pending |

The CDP response can contain multiple targets: `avatar-overlay` is not the main window, and embedded `chatgpt.com` or `codex-sandbox://` must not be modified.

To test v0.3:

1. Quit ChatGPT fully (`Cmd+Q`).
2. From checked-out v0.3 branch, run `npm run launch` and confirm CDP `http://127.0.0.1:9238/json/list` lists the main renderer.
3. Confirm exactly one widget appears above the avatar. Inspect its tooltip and manual refresh.
4. Reload the renderer through DevTools; allow a few seconds for re-attachment; confirm values refresh.
5. Exit normally; no automatic app relaunch should occur. Reopen using `npm run launch` only after stopping the former helper.
6. Only after previous tests pass, optionally install the login item. Disable ChatGPT's native startup setting to avoid a CDP-free process race.

No version compatibility guarantee is made for macOS ChatGPT updates. Document changes to renderer DOM structure before modifying selectors.

## Native AppKit launcher (v0.3 candidate)

- macOS 13+ target set with `LSMinimumSystemVersion`; the ChatGPT target version remains `26.1021.31345`.
- Requires Xcode Command Line Tools and a macOS host to compile Swift/AppKit. Linux static Swift parser tests do not replace a Mac compile.
- `node` 22+ must be available at the absolute path stored by the build script; the launcher includes a Node file chooser as a fallback.
- `.app` embeds quota-monitor runtime and can move independently of the Git checkout. Updates require rebuilding/reinstalling.
- Not notarized or Developer-ID signed; Mac security policy may block copied builds.
- The old LaunchAgent and native `.app` should not be simultaneously active.

## Swift Launcher compatibility

- `LSMinimumSystemVersion` is set to macOS 13.0. Requires Xcode Command Line Tools for local compilation and Node 22+ at runtime.
- A locally built `.app` includes quota source and is independent of the Git checkout path; it still needs the configured Node executable (user-selectable in GUI).
- Built for the current Mac architecture; ad-hoc signed, not notarized. External distribution may encounter macOS Gatekeeper approval.
- No actual macOS AppKit compilation or Dock/login testing has been performed in this environment.

### GUI Codex lookup

A macOS Dock/Finder launch might not inherit the interactive terminal's Node/Codex `PATH`. Before v0.3 fix, this could appear as `App Server 启动失败: ENOENT`. The v0.3 fix resolves absolute paths, embeds a build-time CLI location when available, provides native manual selection, and logs a specific missing-executable explanation. Verify on the user's macOS installation before marking native acceptance PASS.

## Native launcher startup isolation

- If ordinary ChatGPT launches but the older Swift Launcher shows an organization settings error, first isolate the CLI environment; do not remove authentication data.
- This branch now uses private `CSU_CODEX_CLI_PATH` for quota reading and macOS Launch Services for ChatGPT.
- Rebuild and reinstall the `.app` after pulling these changes. The CDP startup test and GUI behavior require macOS verification.
