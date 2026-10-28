# Compatibility and device evidence

## Accepted environment (reported 2026-10-28)

| Field | Observed |
| --- | --- |
| Host | User's macOS device |
| ChatGPT build | `26.1021.31345` |
| ChatGPT bundle ID | `com.openai.codex` |
| Main renderer | `app://-/index.html` |
| CDP endpoint | `127.0.0.1:9238` (loopback only) |
| Sidebar | 52px nav rail / 36px widget area |
| Native launcher | Locally built Swift/AppKit `.app` |
| Node requirement | 22+ |
| v0.1 DOM placement | User PASS |
| v0.2.1 quota and progress colors | User PASS |
| v0.3 native launch and recovery | User PASS (four core tests) |

User-confirmed v0.3 recovery tests: DOM widget deletion and return; renderer reload and return; complete quit and double-click launcher; exactly one widget with correct quota/refresh/colors. Earlier `ENOENT` and organization-settings errors were resolved in the local tested setup following absolute path resolution and App Server launch environment isolation.

The separate `avatar-overlay` target and embedded webviews are not valid injection targets. The app may change this internal layout in later releases.

## Device acceptance boundaries

The four cases are **user-reported**. We did not remotely inspect or run the Mac UI. The tests do **not** independently establish legacy LaunchAgent login operation, all Start/Stop/Node chooser edge cases, starting when ChatGPT is already running without CDP, or compatibility with other ChatGPT builds. No GitHub CI check runs currently exist.

See [acceptance-v0.3.md](acceptance-v0.3.md) for the complete acceptance record and follow-up gates.

## Known limitations

- Code has not been verified against future ChatGPT updates; CDP is an unofficial debugging interface, not an extension contract.
- The locally built `.app` is ad-hoc signed and not notarized for general distribution; it depends on an installed Node 22+ executable path.
- A helper already running separately should be stopped before using the GUI to avoid duplicate processes.
- If ChatGPT is relaunched without CDP, injection cannot be guaranteed until it is restarted through the Launcher.
