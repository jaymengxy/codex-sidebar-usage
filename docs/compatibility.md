# Version compatibility

## Observed target

- macOS ChatGPT `26.1021.31345`, bundle ID `com.openai.codex`
- CDP enabled by `--remote-debugging-address=127.0.0.1 --remote-debugging-port=9238`
- Main renderer `app://-/index.html`
- Rail `nav` class includes `group/sidebar-rail`; width 52px
- Avatar image 24x24; content rail 36px
- v0.1 layout accepted by user on target build.
- v0.2 real quota bridge is a candidate; no Mac runtime acceptance yet.

## Detect breakage

- If no rail or avatar is found, injection aborts rather than patching an arbitrary element.
- Changes in Codex installation binary path may require `npm start -- --codex-path /absolute/path/to/codex`.
- If CDP port is absent, start ChatGPT with the debug flags. Never expose CDP on a non-loopback address.
- Do not confuse the main page with `avatar-overlay`, `detached-window`, or embedded webview targets.
