# Codex Sidebar Usage

An **unofficial** compact quota indicator for the Codex sidebar of the ChatGPT macOS desktop app. It shows **5-hour and weekly remaining percentages**, colored progress bars, reset timestamps, and manual/hover/automatic refresh, without modifying `ChatGPT.app` or reading authentication files.

> ⚠️ Experimental: CDP renderer injection is **not an OpenAI-supported extension API**. It may break after an app update. Use it only on your own computer.

## Status

| Version | Status | Scope |
| --- | --- | --- |
| v0.1 | **PASS** (user tested) | 52px rail / 36px content, avatar-relative placement, DOM injection |
| v0.2.1 | **PASS** (user tested, merged `main`) | Real Codex rate limits, refresh, 5h green / 7d orange bars |
| v0.3 | **Development / device acceptance pending** | Restart/reload reconnection; optional macOS launcher and LaunchAgent |

**Verified Mac:** ChatGPT `26.1021.31345`, bundle ID `com.openai.codex`, main renderer `app://-/index.html`. Other versions and login-start behavior are unverified.

## Requirements

- macOS; ChatGPT installed at `/Applications/ChatGPT.app`.
- Node.js **22+** (`node --version`). No `npm install` required.
- Codex App Server executable in the ChatGPT bundle (or a separately authenticated `codex` executable). Check quota values against ChatGPT's built-in Usage page before relying on them.
- CDP bound **only** to `127.0.0.1:9238`.

## Quick start — recommended v0.3 preview

```bash
git clone git@github.com:jaymengxy/codex-sidebar-usage.git
cd codex-sidebar-usage
git switch feat/auto-launch-v0.3
npm run check
npm test
npm run probe        # read quota only; verify values against native Usage page
npm run launch       # launches ChatGPT with CDP if not already running; monitors/re-injects widget
```

`npm run launch` is the **one-terminal alternative** to starting ChatGPT with CDP in one Terminal and `npm start` in another. Leave the terminal running for refresh and automatic recovery.

**If ChatGPT is already running without CDP**, `npm run launch` refuses to spawn another process and prints instructions. Quit ChatGPT completely with `Cmd+Q`, then rerun `npm run launch`. It will never kill or patch an existing process.

`npm start` remains available if you have *already launched ChatGPT with CDP*. `npm run probe` works without CDP; it only requests read-only rate limits.

## Optional: start automatically at macOS login

**Opt in only after manual `npm run launch` works on your Mac.** Stop the manual helper with `Ctrl+C` before installing to avoid running two monitors. Disable ChatGPT's own “Open at Login” option first to avoid a race where ChatGPT launches without CDP.

```bash
npm run login:install   # writes ~/Library/LaunchAgents/dev.paperauk.codex-sidebar-usage.plist
npm run login:status
npm run login:uninstall # removes this LaunchAgent; does not quit ChatGPT
```

The generated LaunchAgent points to **this repository's absolute path** and the **current Node executable**. Keep the repo and Node binary at those locations. If you move the repository or upgrade your Node installation, uninstall and reinstall the login item.

When installed, LaunchAgent starts the helper on login; the helper launches ChatGPT with loopback-only CDP if the app isn't already running. It is not an app patch or privileged daemon. Logs, without credential dumps, are written under `~/Library/Logs/CodexSidebarUsage/`. The LaunchAgent does **not** continually restart itself after a crash (`KeepAlive=false`); this is intentional for safety.

## Resilience and limitations

- The monitoring loop polls CDP every **3 seconds** (configurable using `npm start -- --poll-ms 5000`). After a renderer reload, app window replacement, or DOM recreation, it finds the `app://-/index.html` target and re-injects the widget if necessary.
- If ChatGPT quits, the helper waits for CDP to return. If you later relaunch ChatGPT **normally** without CDP, injection cannot resume; relaunch using `npm run launch` after quitting normal ChatGPT. The helper intentionally does not reopen the app after you quit it.
- Quota refresh semantics remain v0.2.1: startup read, every 120 seconds, manual button (10s cooldown), hover when cached data is 60s+ old. These are backend snapshots, **not second-by-second live counters**.
- Missing windows display `--` rather than invented quota; failed reads retain stale values and mark them as such in tooltips.
- App Server failures may still require restarting the helper; this is a development preview, not a production release.

## Development and security

```bash
npm run check
npm test
npm run probe
npm start
```

The bridge reads only `account/rateLimits/read` from the Codex App Server over local stdio, and sends normalized percentages and reset timestamps to the renderer through CDP. The injected UI never receives account tokens. We do **not** extract credentials, host an HTTP server, or modify the `.app` bundle.

**CDP grants broad control over the renderer to other local processes.** Do not expose port 9238 to the network (`0.0.0.0` is unsafe); never share CDP WebSocket URLs, app-server raw responses or session files.

To remove the widget temporarily from DevTools:

```js
window.__codexUsageSidebarV02?.destroy();
```

The monitor will re-inject it while running; stop the helper first (`Ctrl+C`) if you want it gone. `npm run login:uninstall` disables future login launches.

See [architecture](docs/architecture.md), [compatibility](docs/compatibility.md) and [changelog](CHANGELOG.md).
