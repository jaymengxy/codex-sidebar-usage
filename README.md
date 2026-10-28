# Codex Sidebar Usage

[![English](https://img.shields.io/badge/README-English-377cfb)](README.md) [![简体中文](https://img.shields.io/badge/README-简体中文-777777)](README.zh-CN.md)

A small **unofficial** macOS helper that shows the Codex quota inside the **ChatGPT desktop app's narrow sidebar**. It displays five-hour and weekly remaining quota, colored progress bars, reset times, and refresh controls.

> **Not affiliated with OpenAI.** This relies on Chromium DevTools Protocol (CDP) and internal ChatGPT UI selectors, not a supported extension API. Future ChatGPT updates may break it. Use on your own computer only.

## What it does

- Shows **5h** and **7d** remaining percentages (not usage spent).
- Progress bars: five-hour **green** (`#16A34A`), weekly **orange** (`#D97706`).
- Click either quota to open a small reset-time panel. Clicking an already-open value does not create a duplicate. Click elsewhere or press **Esc** to dismiss. Normal arrow cursor on hover.
- Refresh via ↻, hover (only for data older than 60s), or periodic refresh (~120s). Usage is a delayed service snapshot, **not** a second-by-second counter.
- Reconnects to the main ChatGPT window after a renderer reload or sidebar DOM replacement (checks about every 3s).
- Includes a real **Swift/AppKit Launcher.app** that starts ChatGPT and the helper without a Terminal window.

## Requirements

- macOS 13+ with `/Applications/ChatGPT.app`.
- Node.js **22+** (`node --version`). No third-party npm dependencies.
- To build the native Launcher: Apple Command Line Tools (`xcode-select --install`).
- A Codex CLI / App Server available to the same signed-in account. Compare displayed values with the built-in ChatGPT Usage page.
- CDP binds **only** to `127.0.0.1:9238`.

## Get the project

```bash
git clone git@github.com:jaymengxy/codex-sidebar-usage.git
cd codex-sidebar-usage
# Until PR #2 is merged, the latest version is on this development branch:
git switch feat/auto-launch-v0.3

node --version
npm run check
npm test
npm run probe
```

The `npm run probe` command reads quota without opening ChatGPT or injecting UI. Compare the output with the native Usage page before continuing.

## Option A — Run directly from Terminal (simplest)

Quit ChatGPT completely (**Cmd+Q**), then from the repository folder:

```bash
npm run launch
```

That's it: the script launches ChatGPT with loopback CDP (if not running), then attaches the quota monitor. **Leave the Terminal process running** to keep refresh/recovery active. To stop it, press **Ctrl+C**; this does not quit ChatGPT.

If ChatGPT is **already running with CDP**, you can alternatively use `npm start`. If the existing instance is running **without** CDP, quit it first; the helper intentionally will not kill it or create a conflicting instance.

For advanced troubleshooting, manually start ChatGPT with CDP and run the helper separately:

```bash
/usr/bin/open -a "/Applications/ChatGPT.app" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9238
# In a second Terminal:
npm start
```

## Option B — Build and use the native macOS Launcher.app

This provides a normal app you can double-click from Finder or pin to the Dock. The built app embeds the quota-monitor JavaScript files, but still uses your installed Node.js 22+ and Codex CLI. It does **not** modify ChatGPT.app.

```bash
# Stop any existing npm start / npm run launch helper first.
# If an old login item was installed, remove it:
npm run login:uninstall

npm run launcher:build
npm run launcher:install
open "$HOME/Applications/Codex Usage Launcher.app"
```

The Launcher offers **Start monitor**, **Stop monitor**, **Select Node…**, **Select Codex…**, and a log view. Closing its window does not stop the helper; clicking its Dock icon reopens the window. **Cmd+Q** quits the Launcher and stops its own helper but leaves ChatGPT running.

**Custom icon:** the build uses the icon from **your locally installed ChatGPT.app**, adding two decorative progress bars (green/orange) at its lower-left. These are **not live usage values**. The source repository does not contain or redistribute the ChatGPT icon. Rebuild/reinstall to update the app or icon.

```bash
npm run launcher:uninstall   # Removes only ~/Applications/Codex Usage Launcher.app
```

The resulting app is **locally ad-hoc signed**, not notarized or officially distributed by OpenAI. Moving it to another Mac may trigger macOS security prompts. Rebuild it locally after source or Node path changes.

### Which should I choose?

| | Terminal | Native Launcher |
|---|---|---|
| First-time setup | Node 22+ | Node 22+ and Swift build tools |
| Daily use | Run `npm run launch`, keep Terminal open | Double-click `Codex Usage Launcher.app` |
| Stop monitoring | Ctrl+C | Stop monitor or Cmd+Q |
| Automatic re-injection | Yes | Yes |
| ChatGPT itself | Original app, with CDP flags | Original app, with CDP flags |

## Troubleshooting

**Launcher says `App Server ... ENOENT`.** GUI applications may have a different `PATH` from Terminal. Use **Select Codex…**, choosing the executable found with `command -v codex`, then restart monitoring. The helper never silently runs an unverified bare `codex` command.

**ChatGPT shows “organization settings could not be loaded” only when using Launcher.** Quit both apps, pull the latest changes, then rebuild/reinstall. The current Launcher isolates its own `CSU_CODEX_CLI_PATH` from ChatGPT's `CODEX_CLI_PATH` and uses macOS Launch Services. Do **not** delete login data or reset ChatGPT as a first troubleshooting step.

**Launcher stuck at “Stopping monitor…”** This version interrupts the Node polling delay on SIGTERM, ignores late log messages while stopping, disables duplicate stop clicks and reports the final process exit state. If the child remains alive after the watchdog interval, it shows a diagnostic instead of falsely claiming success.

**No widget.** Make sure the native ChatGPT window is open, your session has the Codex navigation rail, CDP is listening on loopback port 9238, and there is no competing quota helper. The monitor intentionally attaches only to `app://-/index.html`, not embedded webviews.

**Wrong usage numbers.** `npm run probe` may use an account different from the one in ChatGPT. Compare with the native Usage page. Missing windows display `--`, never a fabricated percentage.

**Old login startup.** The optional legacy `npm run login:install` LaunchAgent is **experimental** and must not be used together with the native Launcher. It was **not** included in the four macOS recovery acceptance cases. Disable ChatGPT's own “Open at Login” before using that alternative.

## Acceptance and compatibility

Core v0.3 native startup and recovery were **user-tested PASS (4/4)** on ChatGPT build `26.1021.31345` on 2026-10-28: sidebar removal/reinjection, renderer reload, full quit/restart from Launcher, and unique widget with working quotas. See [acceptance record](docs/acceptance-v0.3.md).

**The current popover, stop-state and decorative app icon changes are newer than that acceptance**; they still require a quick macOS visual / process test after rebuilding. See [changelog](CHANGELOG.md) and [compatibility notes](docs/compatibility.md).

## Security and limitations

- CDP on loopback gives local processes powerful debugging access. Never expose it on `0.0.0.0` or over the network.
- The helper reads `account/rateLimits/read` from a local Codex App Server via stdio. It does not copy login files or put tokens into the browser renderer.
- Only percentages and reset timestamps reach the sidebar. The reset-time panel is attached to this app's renderer and never makes network requests.
- The custom icon derives from the user's locally installed ChatGPT app **at build time**. It identifies an unofficial utility, not an official OpenAI app.
- No guaranteed compatibility with future ChatGPT UI updates or unattended login startup.

[Architecture](docs/architecture.md) · [Compatibility](docs/compatibility.md) · [Changelog](CHANGELOG.md)
