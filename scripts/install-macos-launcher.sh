#!/bin/bash
# Install/uninstall only the known, locally built launcher in ~/Applications.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
source "$ROOT/scripts/locale.sh"
if [[ "$(uname -s)" != "Darwin" ]]; then
  csu_error '仅支持 macOS。' 'This command is supported on macOS only.'
  exit 1
fi
APP_NAME='Codex Usage Launcher.app'
SOURCE="$ROOT/dist/$APP_NAME"
TARGET="$HOME/Applications/$APP_NAME"
IDENTIFIER='dev.paperauk.codex-sidebar-usage.launcher'
command -v ditto >/dev/null || { csu_error '未找到 macOS ditto。' 'macOS ditto was not found.'; exit 1; }

check_existing() {
  local plist="$TARGET/Contents/Info.plist"
  if [[ ! -f "$plist" ]] || [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist" 2>/dev/null || true)" != "$IDENTIFIER" ]]; then
    csu_error "拒绝修改未知应用：$TARGET" "Refusing to modify an unknown app: $TARGET"
    exit 1
  fi
}
case "${1:-}" in
  install)
    [[ -d "$SOURCE" ]] || { csu_error '请先运行 npm run launcher:build。' 'Please run npm run launcher:build first.'; exit 1; }
    mkdir -p "$HOME/Applications"
    if [[ -e "$TARGET" ]]; then check_existing; rm -rf -- "$TARGET"; fi
    ditto "$SOURCE" "$TARGET"
    # Notify Finder / Launch Services of the installed bundle, without
    # forcibly restarting Dock or altering the user's pinned items.
    touch "$TARGET"
    LSREGISTER='/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
    if [[ -x "$LSREGISTER" ]]; then
      "$LSREGISTER" -f "$TARGET" >/dev/null 2>&1 || csu_say '提示：应用已安装，但 Launch Services 注册未完成。' 'The app is installed, but Launch Services registration did not complete.'
    fi
    csu_say "安装完成：$TARGET" "Installed: $TARGET"
    csu_say '可以从 Finder 打开此应用，或将 ~/Applications 中的 Launcher 拖到 Dock。' 'Open the app in Finder or drag the Launcher from ~/Applications to the Dock.'
    csu_say '如果 Dock 仍显示旧图标，请移除旧的 Dock 固定项，再从上述路径拖入新版。' 'If Dock shows an old icon, unpin it and drag the installed Launcher from ~/Applications back to Dock.'
    ;;
  uninstall)
    if [[ -e "$TARGET" ]]; then check_existing; rm -rf -- "$TARGET"; fi
    csu_say '应用已移除；未删除源码、修改 ChatGPT 或停用旧版 LaunchAgent。' 'Launcher removed. Source files, ChatGPT, and legacy LaunchAgent remain unchanged.'
    ;;
  *) echo 'Usage: bash scripts/install-macos-launcher.sh install|uninstall' >&2; exit 2;;
esac
