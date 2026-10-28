# Codex Sidebar Usage

An **unofficial** compact quota indicator for the Codex sidebar of the ChatGPT macOS desktop app. It shows **5-hour and weekly remaining percentages**, colored progress bars, reset timestamps, and manual/hover/automatic refresh, without modifying `ChatGPT.app` or reading authentication files.

> ⚠️ Experimental: CDP renderer injection is **not an OpenAI-supported extension API**. It may break after an app update. Use it only on your own computer.

## Status

| Version | Status | Scope |
| --- | --- | --- |
| v0.1 | **PASS** (user tested) | 52px rail / 36px content, avatar-relative placement, DOM injection |
| v0.2.1 | **PASS** (user tested, merged `main`) | Real Codex rate limits, refresh, 5h green / 7d orange bars |
| v0.3.0 | **PASS (user-accepted on one Mac, 2026-10-28)** | Native Swift Launcher, startup, DOM restoration, renderer reload, full restart, quota refresh |

**Verified Mac:** ChatGPT `26.1021.31345`, bundle ID `com.openai.codex`, main renderer `app://-/index.html`. Device acceptance covers the four native Launcher / recovery cases listed in [v0.3 acceptance](docs/acceptance-v0.3.md). Other ChatGPT versions and legacy login LaunchAgent behavior remain unverified.

## v0.3.0 macOS acceptance (2026-10-28)

The owner confirmed these four tests on the local macOS ChatGPT build:

| Test | Result |
| --- | --- |
| Delete the sidebar widget; monitor automatically re-injects it | **PASS** |
| Reload the ChatGPT main renderer; quota indicator returns | **PASS** |
| Fully quit both applications; double-click Swift Launcher to reopen ChatGPT and restore quota | **PASS** |
| Exactly one widget, live quota/refresh and correct progress colors after recovery | **PASS** |

The revised Launcher also starts ChatGPT normally after the earlier App Server path / organization-settings startup fixes. This is **user-reported device acceptance**, not a remotely reproduced test. The prior development run reported **40/40 Node tests passing**; the repo currently has no GitHub CI check runs for this PR.

**Not included in the acceptance:** old `login:install` LaunchAgent login-cycle testing, independently testing the non-CDP-running conflict flow, Node/Codex chooser edge cases, macOS cross-version compatibility, public distribution/notarization. These are optional follow-ups, not verified functionality. See [full acceptance record](docs/acceptance-v0.3.md).

## Requirements

- macOS 13+; ChatGPT installed at `/Applications/ChatGPT.app`.
- **Native .app build:** Xcode Command Line Tools (`xcode-select --install`, provides `swiftc`).
- Node.js **22+** (`node --version`). No `npm install` required.
- Codex App Server executable in the ChatGPT bundle (or a separately authenticated `codex` executable). Check quota values against ChatGPT's built-in Usage page before relying on them.
- CDP bound **only** to `127.0.0.1:9238`.

## Quick start — v0.3.0

```bash
git clone git@github.com:jaymengxy/codex-sidebar-usage.git
cd codex-sidebar-usage
git switch main
npm run check
npm test
npm run probe        # read quota only; verify values against native Usage page
npm run launch       # launches ChatGPT with CDP if not already running; monitors/re-injects widget
```

`npm run launch` is the **one-terminal alternative** to starting ChatGPT with CDP in one Terminal and `npm start` in another. Leave the terminal running for refresh and automatic recovery.

**If ChatGPT is already running without CDP**, `npm run launch` refuses to spawn another process and prints instructions. Quit ChatGPT completely with `Cmd+Q`, then rerun `npm run launch`. It will never kill or patch an existing process.

`npm start` remains available if you have *already launched ChatGPT with CDP*. `npm run probe` works without CDP; it only requests read-only rate limits.

## Native Swift Launcher.app — double-click, no Terminal during normal use

v0.3 includes a **real AppKit macOS app**, not an Automator / `.command` wrapper. The `.app` embeds an explicit allowlist of quota-monitor JS source files (not account data); it calls the installed Node.js 22+ executable to run them. It does **not** modify `ChatGPT.app`.

**First-time build on a Mac** (the build requires the macOS SDK, so a ready-to-run `.app` cannot be compiled from Linux):

```bash
cd ~/Code/codex-sidebar-usage
git fetch origin
git switch main
npm run check && npm test
npm run launcher:build   # Swift/AppKit compile + bundle JS runtime + local ad-hoc signing
npm run launcher:open    # double-click equivalent, for first test
```

**Optional installation into your personal Applications folder:**

```bash
npm run launcher:install
open "$HOME/Applications/Codex Usage Launcher.app"
# Then you may drag the app from Finder into the Dock.
```

The app opens a small native window, **starts the helper automatically**, and provides **Start monitor / Stop monitor / Select Node…** controls plus a live, local-only diagnostic log. Closing its window leaves it running; click its Dock icon to reopen. **Cmd+Q** quits the launcher and stops *its own* helper; ChatGPT remains running. The helper only needs a separate terminal if you are intentionally using the older CLI approach.

**Node path:** the builder records your absolute `node` executable path in the app's `Info.plist`. If the Node executable is moved during an `nvm`/Homebrew upgrade, click **选择 Node…** in the app to select the new Node 22+ binary, or rebuild/reinstall. The application bundle remains usable after moving it into `~/Applications` without access to the Git clone; code changes require rebuilding and reinstalling the `.app`.

**Avoid duplicate helpers:** stop old `npm run launch` / `npm start` terminals before running the native launcher. If the previous LaunchAgent is installed, remove it with `npm run login:uninstall` before launching the new `.app`. The GUI deliberately refuses to run alongside a detected old LaunchAgent. Do not enable both the old login item and the new app's startup at login simultaneously. Login startup for the native `.app` itself has **not** been automated. The old LaunchAgent workflow is optional and remains **unverified on-device**; it is not part of the v0.3 acceptance scope.

**When ChatGPT is already open without CDP**, the helper reports an actionable error instead of closing or modifying it. Quit ChatGPT with Cmd+Q and press **启动监控** in the launcher again. It launches ChatGPT with CDP when the app is not running.

To remove only the installed native launcher (not ChatGPT or the source repository):

```bash
npm run launcher:uninstall
```

The `.app` is ad-hoc signed for *local use*, not Apple Developer ID notarized or intended for general public distribution. macOS may require explicit user approval for unsigned/ad-hoc applications outside your own build environment.

### 修复：原生 ChatGPT 正常、Launcher 启动却提示组织设置无法加载

旧版 v0.3 Swift Launcher 会把你为额度读取服务选择的 Codex CLI 通过 `CODEX_CLI_PATH` 传给启动 ChatGPT 的子进程。ChatGPT 本身也会读取这个变量并可能错误地使用不兼容的外部 App Server。**这不是用户登录失效的证据，无需删除缓存或退出登录。**

修复版改为使用仅供额度助手读取的 `CSU_CODEX_CLI_PATH`，ChatGPT 通过 macOS Launch Services (`/usr/bin/open -a ... --args`) 启动。请退出 Launcher 和 ChatGPT (Cmd+Q)，更新并重新编译**已安装的 .app**：

```bash
cd ~/Code/codex-sidebar-usage
git switch main
git pull --ff-only
npm run check && npm test
npm run launcher:build && npm run launcher:install
open "$HOME/Applications/Codex Usage Launcher.app"
```

如果仍有问题，先退出两款应用，然后**单独测试 CDP 参数**，不要启动额度助手：

```bash
/usr/bin/open -a "/Applications/ChatGPT.app" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9238
curl --noproxy '*' -fsS http://127.0.0.1:9238/json/version
```

如果原生正常但这个 CDP 启动失败，请暂时停止使用 Launcher；如果 CDP 启动正常而 Launcher 失败，则继续排查其 Node 运行环境。可以通过 `launchctl getenv CODEX_CLI_PATH` **只读检查**系统登录环境是否存在覆盖，本项目不会修改该全局设置。修复后的原生 Launcher 已在一台 macOS 设备上通过启动、额度显示与自动恢复验收；其他客户端版本尚未验证。

## Optional legacy LaunchAgent login startup (experimental / not device-accepted)

**Opt in only after manual `npm run launch` works on your Mac.** Disable ChatGPT's own “Open at Login” option first to avoid a race where ChatGPT launches without CDP.

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

The monitor will re-inject it while running; stop the helper first (`Ctrl+C`) if you want it gone. `npm run login:uninstall` disables legacy LaunchAgent login launches. `npm run launcher:uninstall` removes the new native `.app` installation.

See [architecture](docs/architecture.md), [compatibility](docs/compatibility.md) and [changelog](CHANGELOG.md).
