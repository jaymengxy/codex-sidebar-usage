# v0.3.0 macOS acceptance record

**Date:** 2026-10-28  
**Product:** Codex Sidebar Usage — native Swift/AppKit Launcher  
**Branch under review:** `feat/auto-launch-v0.3` (PR #2)  
**Test environment:** User's Mac, ChatGPT `26.1021.31345` (`com.openai.codex`), loopback CDP `127.0.0.1:9238`

## Confirmed by the user

| ID | Procedure | Acceptance result |
| --- | --- | --- |
| A1 | Remove `#codex-sidebar-usage-widget` in main renderer; wait for supervisor re-injection | **PASS** |
| A2 | Reload `app://-/index.html`; verify widget/quotas reappear | **PASS** |
| A3 | Quit both ChatGPT and Launcher, then double-click native Launcher; verify ChatGPT/quotas start normally | **PASS** |
| A4 | Verify exactly one widget after recovery; quotas, refresh and progress-bar colors work | **PASS** |

The user separately confirmed that the revised Swift Launcher opens ChatGPT without the previous organization-settings error and that actual remaining quotas display normally after the startup environment fix.

**Evidence classification:** User-reported macOS manual acceptance. No screenshot/video/device telemetry was independently collected here. Automated development tests previously reported 40/40 PASS on Node.js; those are not a substitute for the Mac tests and were not rerun as part of this documentation-only acceptance commit.

## Merge decision

**Ready to merge into `main` for the native Swift Launcher + quota/reinjection workflow** on the tested Mac/ChatGPT build. The four scenarios cover the release's primary user-facing goal. Keep optional legacy features documented as experimental.

## Explicitly not independently verified

- Legacy LaunchAgent `npm run login:install` startup at macOS login and its uninstall workflow.
- Running non-CDP ChatGPT collision handling, all Node/Codex chooser and Start/Stop edge cases.
- Long-duration stability, unexpected App Server crashes, and compatibility across other ChatGPT/macOS versions.
- Developer ID signing, notarization, public software distribution.

These remain future optional QA tasks; they must not be marked `PASS` by inference. A new ChatGPT renderer version should be retested before claiming compatibility.

## Follow-up regression suggestions

After macOS/ChatGPT or Node upgrades: verify CLI resolution; native app normal login; sidebar widget deletion/recovery; renderer reload/recovery; one-widget invariant; accurate five-hour/weekly windows and refresh. If the normal ChatGPT launch succeeds but Launcher fails, isolate CDP startup and helper CLI override before changing user credentials or cached state.


## v0.3.1 follow-up acceptance (not yet device verified)

This development iteration follows the user's original **v0.3.0 PASS** and does not supersede it. Required quick recheck on a Mac after `npm run launcher:build && npm run launcher:install`:

- [ ] One click on **停止监控** updates to the stopped state after helper exit; late log output does not revert the label; no second click is needed.
- [ ] Quota hover retains the normal pointer with no question-mark and no native title popup.
- [ ] Clicking 5h/7d opens exactly one reset-time panel; repeated click on the same item never duplicates; clicking outside or Escape closes it; no rail clipping.
- [ ] Newly installed `Codex Usage Launcher.app` shows the local ChatGPT icon with two lower-left green/orange horizontal bars in Finder and Dock (decorative, not live data).
- [ ] Original startup, quota accuracy, refresh and 4/4 restart/recovery scenarios remain passing.

Linux/static tests cannot substitute for these AppKit/Finder/rendered UI checks. **Do not mark v0.3.1 as accepted until these are completed.**

## v0.3.1 release acceptance update (2026-10-29)

- The owner supplied a screenshot showing the Launcher icon was visibly oversized relative to ChatGPT in Dock. The icon generator was changed to preserve the original artwork's macOS transparent inset, while scaling only the two-bar overlay.
- On 2026-10-29 the owner confirmed the corrected icon's proportions were acceptable and explicitly requested merge, tag, and release of v0.3.1.
- Previously reported v0.3.0 manual recovery acceptance (4/4) remains unchanged.
- **Evidence boundary:** the revised Swift stop status and new reset-time popover have source-level regression coverage, but there is no separate explicit on-device acceptance report for those two cases.

Release decision: approved by the owner for v0.3.1 on the tested macOS ChatGPT build. Other application versions and the optional legacy login LaunchAgent remain outside the acceptance scope.
