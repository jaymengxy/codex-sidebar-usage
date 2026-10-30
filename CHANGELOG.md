# Changelog

## v0.3.3 — released (2026-10-30)

- Show the five-hour quota row only when `account/rateLimits/read` provides a valid 300-minute window. Hide the row until the first successful response to avoid a temporary placeholder.
- Preserve the weekly quota, refresh controls, and existing `--` fallback if weekly data is unavailable.
- When the five-hour window disappears on a refresh, close any open five-hour reset-time popup.
- Add weekly-only example illustrations to both READMEs, retaining the original two-window screenshots.
- Include tests for weekly-only, dual-window, and unknown-period API responses. Enterprise credits remain out of scope.


## v0.3.2 — release

- Swift/AppKit Launcher and macOS build/install scripts select Chinese for Chinese-preferred macOS systems and English otherwise.
- Terminal quota diagnostics use the same locale with English fallback; Launcher connection state follows locale-independent machine event markers.
- Quota reset popovers, tooltips, accessibility text and date formatting prefer ChatGPT renderer's declared page language, falling back to system/browser language.
- No private ChatGPT preference or account storage is inspected. In-app language settings may not always update the renderer's `lang` attribute.
- The native bundle includes the Node locale module and automated localization regression checks.
- Manual verification confirmed the English sidebar reset-time popover on the user's Mac. Automated CI validates Chinese and English Node output, Bash syntax, and Swift/AppKit compilation. Other ChatGPT language/system combinations are not independently device-verified.


## v0.3.1 — released (2026-10-29)

- **Native icon sizing correction (2026-10-29):** remove the 98%-occupancy source icon enlargement, which created a Launcher Dock icon about 18% bigger than native ChatGPT in a user screenshot. Draw the ChatGPT artwork at its original canvas scale, preserving macOS-safe transparent padding; measure visible alpha only to position/size the decorative green/orange badge. Increment the bundle build number to help icon cache registration. The user confirmed the corrected Dock icon size and appearance on macOS.


- **Swift Launcher stop control:** make stop state idempotent; suppress late “connected” logs during stop, disable redundant clicks, add a 5-second child-process watchdog and stop-state cleanup. Node supervisor now interrupts its 3-second poll immediately when SIGTERM arrives. The status only becomes “stopped” after process exit is confirmed.
- **Quota interaction:** replace the question-mark hover cursor with the normal cursor. Click a five-hour or weekly quota to open an explicit reset-time popover; never create a duplicate while the same popover is open. Click elsewhere or press Esc to dismiss; keyboard Enter/Space supported. Remove the redundant native hover tooltip, update panel contents after successful refresh, and clean up events on widget removal.
- **Native app icon:** generate AppIcon.icns at build time from the locally installed ChatGPT.app icon, overlaying two fixed decorative green/orange bars in the lower-left corner. Original ChatGPT logo bytes are not committed to the repository.
- **Icon sizing and Dock refresh:** normalize transparent padding in the source icon so the artwork occupies most of the icon canvas; explicitly load the bundled `.icns` at runtime and refresh Launch Services registration when installing. Existing pinned Dock shortcuts may still require manual removal and re-pinning.
- **Documentation:** rewritten English README with language badges; complete `README.zh-CN.md`, both showing Terminal and native Launcher launch modes. Update acceptance boundaries and troubleshooting.
- **Automated regression coverage:** `test/v03-polish.test.mjs` adds eight checks for stop UI, popover behavior, asset generation and bilingual docs.
- **Acceptance:** v0.3.0 core recovery tests PASS (user-reported 4/4); the v0.3.1 corrected Dock icon size was confirmed by the user. The revised stop-button and quota-popover UI are implemented but have not been separately re-verified in a documented macOS test.

## v0.3.0 — accepted for native Launcher workflow (2026-10-28)

**Mac acceptance:** user confirmed four of four core scenarios: widget auto-reinjection after removal, renderer reload recovery, full quit/restart using the native Swift Launcher, and exactly one widget with correct quota and refresh behavior. Also confirmed normal ChatGPT startup after the CLI environment isolation fix.

### Features
- Add native Swift/AppKit `Codex Usage Launcher.app` with double-click ChatGPT/CDP startup, quota monitor controls and log view; packages its JS runtime locally.
- Add local CDP supervision (3s polling) with renderer/DOM reattachment and idempotent widget injection.
- Add `npm run launch` one-terminal mode and optional, **not device-accepted**, legacy user LaunchAgent login workflow.
- Keep existing five-hour / weekly quota UI and refresh mechanism.

### Startup and compatibility fixes
- Resolve the App Server executable to an absolute path, with GUI-selectable Codex CLI fallback; address GUI `ENOENT` caused by missing `PATH` entry.
- Isolate quota-helper `CSU_CODEX_CLI_PATH` from ChatGPT's own `CODEX_CLI_PATH`; launch ChatGPT through macOS Launch Services to avoid interfering with native App Server initialization.
- Maintain loopback-only CDP connection, no credential extraction, no app bundle modifications.

### Verification / known limits
- Prior development automation result: 40/40 Node tests PASS, Swift syntax checks PASS. No GitHub CI checks are currently configured for this PR.
- User-reported macOS acceptance: 4/4 core recovery cases PASS. See [acceptance](docs/acceptance-v0.3.md).
- Legacy LaunchAgent login cycle, non-CDP collision flow, alternative macOS/ChatGPT versions, notarization and long-term compatibility are **not verified**, not part of this acceptance claim.
- The native app is ad-hoc signed for local use and depends on an installed Node.js 22+ runtime.

## v0.2.1 — accepted

- Correct progress fill geometry; five-hour `#16A34A` green and weekly `#D97706` orange.
- User confirmed live quota UI and progress bar colors on macOS.

## v0.2.0

- Read-only Codex App Server quota bridge and automatic/manual/hover refresh.

## v0.1.0

- First narrow 52px rail DOM injection prototype, user accepted.
