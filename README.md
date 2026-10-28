# Codex Sidebar Usage

A **non-official, experimental** narrow sidebar usage indicator for the Codex view inside the ChatGPT macOS desktop app.

![Status](https://img.shields.io/badge/status-layout%20prototype-orange)

## Scope / current status

- ✅ CDP port and main renderer discovered by user on ChatGPT `26.1021.31345` (`com.openai.codex`).
- ✅ Simple `CDP OK` element inserted into main renderer by user via DevTools.
- ✅ User inspected profile avatar hierarchy and found a 52px sidebar rail with 36px content area.
- ⚠️ Widget placement is implemented from that hierarchy, **not yet verified on the actual device**.
- ⬜ Real five-hour / weekly quota data source is **not connected**. Labels show `--` by default.
- ⬜ Refresh button is **disabled** until an async quota fetcher is provided. Hover and manual refresh need a verified data adapter.
- ⬜ Persistent injection at login and update compatibility remain future work.

## Requirements

- macOS ChatGPT app matching the above structure (other versions untested)
- Node.js 22+ for the optional dependency-free injector
- An existing ChatGPT process started with CDP bound to `127.0.0.1:9238`

This project is **not affiliated with or endorsed by OpenAI**. Chromium CDP is a debugging mechanism; OpenAI does not officially promise a renderer DOM plugin API.

## Quick start (layout only)

1. Quit ChatGPT completely (Cmd+Q).
2. In Terminal:

   ```bash
   APP="/Applications/ChatGPT.app"
   EXE=$(plutil -extract CFBundleExecutable raw -o - "$APP/Contents/Info.plist")
   "$APP/Contents/MacOS/$EXE" \
     --remote-debugging-address=127.0.0.1 \
     --remote-debugging-port=9238
   ```

3. With the ChatGPT main window showing the 52px Codex sidebar, from the project folder run:

   ```bash
   npm run check
   npm run inject
   ```

4. If no widget appears, inspect the app via `chrome://inspect/#devices`, and inspect the main `app://-/index.html` renderer. The script logs diagnostics to its Console. It does not change any application bundle files.

The UI should show **5h --** and **7d --** plus a disabled refresh button directly above the avatar. Successful injection is only a DOM layout test, *not* evidence that quota fetching works.

### Simulated values (for layout review only)

With the main renderer DevTools Console open:

```js
window.__codexUsageSidebarPrototype.update({
  fiveHour: { usedPercent: 38, resetsAt: 1793200000 },
  weekly: { usedPercent: 59, resetsAt: 1793500000 }
});
```

The widget displays **remaining** percent (62% and 41%) by subtracting `usedPercent` from 100. Timestamps here are sample data only.

Uninstall from the running view:

```js
window.__codexUsageSidebarPrototype?.destroy();
```

This is ephemeral and disappears when the window is reloaded. No files in ChatGPT.app are changed.

## Roadmap

- **v0.1**: Confirm DOM anchor, sizing, dark mode and responsive sidebar behavior on target macOS app.
- **v0.2**: Add a trusted, least-privilege local quota adapter with mapping for 5h and 7d windows, initial load, manual refresh and TTL-limited hover refresh; retain stale data on errors.
- **v0.3**: Optional automatic injection when ChatGPT launches, tests and compatibility checks for updates.

## Security notes

CDP has extensive powers over a local application renderer. Use `127.0.0.1` only, never `0.0.0.0`, and stop the debugging instance when done. Never post full session URLs, tokens, WebSocket identifiers or authenticated responses into issues. Do not commit `~/.codex/auth.json` or any login/session data. The project will not need to read app credentials for the layout prototype.

See [architecture](docs/architecture.md) and [compatibility notes](docs/compatibility.md).

## Publish to GitHub

Suggested repository name: `jaymengxy/codex-sidebar-usage` (initially **private**). See [macOS publishing instructions (中文)](docs/发布到GitHub.md).
