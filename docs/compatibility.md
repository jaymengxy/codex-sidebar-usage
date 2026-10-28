# Compatibility / evidence

Environment provided by one user on 2026-10-28:

| Field | Value |
| --- | --- |
| App bundle path | `/Applications/ChatGPT.app` |
| `CFBundleShortVersionString` | `26.1021.31345` |
| Bundle ID | `com.openai.codex` |
| Executable | `ChatGPT` |
| CDP endpoint | `http://127.0.0.1:9238/json/list` (when launched with flags) |
| Primary renderer | `app://-/index.html` (`type: page`) |
| Sidebar rail | `nav` with class containing `group/sidebar-rail` |
| Sidebar width | 52px |
| Avatar | `img.shrink-0.object-cover.rounded-full.size-6` 24px, inside button 36px |
| Bottom avatar branch | direct nav child `.relative.shrink-0.w-9`, width 36px |

**Observed:** A fixed-position `CDP OK` badge was inserted into the main page successfully.

**Not yet observed:** Final widget anchored into the native navigation flex flow, actual quota retrieval, or successful automated launcher injection. These remain unverified until a device test is reported.

Beware: `app://-/index.html?initialRoute=%2Favatar-overlay` is a separate overlay renderer, not the intended main window. Embedded `chatgpt.com` and `codex-sandbox://` WebViews are also not the target.
