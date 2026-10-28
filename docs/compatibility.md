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
