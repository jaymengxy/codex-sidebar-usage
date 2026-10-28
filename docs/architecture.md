# Architecture and acceptance plan

## Architecture

- `scripts/inject.mjs`: Node.js 22+ client for local CDP discovery and one-off `Runtime.evaluate`, no external dependencies.
- `src/sidebar.js`: ephemeral DOM widget, idempotent re-injection, avatar anchor detection, display-only support for mock data.
- Quota transport: **TBD**. Explore the documented Codex App Server `account/rateLimits/read` and verify it belongs to the currently signed-in app account. Never inject tokens into the renderer.
- Future data adapter should normalize `{fiveHour:{usedPercent,resetsAt}, weekly:{usedPercent,resetsAt}}` and clearly distinguish absent data.

## Desired quota refresh contract (not implemented yet)

- Initial fetch on start, periodic background fetch every 120s.
- Hover fetch only when last success is at least 60s old; suppress duplicates.
- Manual button triggers a fresh request with 10s duplicate suppression.
- Fresh server results may themselves lag actual usage: show an `updated at` tooltip.
- Reset clock derives from server `resetsAt` and can count down locally without network calls.
- Errors keep the old value but mark it stale; missing window is `--`, never 100%.

## v0.1 acceptance checklist

- [ ] Injection attaches immediately before the avatar branch under `nav.group/sidebar-rail`.
- [ ] Native avatar remains clickable and aligned after inserting widget.
- [ ] Rail stays 52px wide with inner widgets capped at 36px.
- [ ] No overlap with upper navigation icons at typical window heights.
- [ ] Light/dark themes legible and hover tips accessible.
- [ ] Repeated injections do not create duplicate widgets.
- [ ] Destroy removes the widget and leaves the native UI intact.
