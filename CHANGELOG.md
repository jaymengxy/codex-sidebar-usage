# Changelog

## v0.2.1 (candidate)

- Fix missing colored progress fill in the 52px sidebar: the `<span>` track is now an explicit block positioned as a layout container, and its `<span>` fill is a positioned block sized relative to the track.
- Preserve the fixed palette: five-hour `#16A34A` (green), weekly `#D97706` (orange).
- No change to Codex App Server quota fetching, CDP binding, auto/manual/hover refresh, or reset tooltips.
- Add three CSS structure regression tests. Node syntax check and all 13 tests pass; still requires a macOS UI recheck.

## v0.2.0 (candidate)

- Read-only Codex App Server quota bridge and local CDP widget updates.

## v0.1.0

- Basic 52px side rail insertion prototype; manually accepted.
