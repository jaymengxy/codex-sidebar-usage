#!/bin/bash
# Install/uninstall only the known, locally built launcher in ~/Applications.
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo '仅支持 macOS。' >&2
  exit 1
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
APP_NAME='Codex Usage Launcher.app'
SOURCE="$ROOT/dist/$APP_NAME"
TARGET="$HOME/Applications/$APP_NAME"
IDENTIFIER='dev.paperauk.codex-sidebar-usage.launcher'
command -v ditto >/dev/null || { echo '未找到 macOS ditto。' >&2; exit 1; }

check_existing() {
  local plist="$TARGET/Contents/Info.plist"
  if [[ ! -f "$plist" ]] || [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist" 2>/dev/null || true)" != "$IDENTIFIER" ]]; then
    echo "拒绝修改未知应用：$TARGET" >&2
    exit 1
  fi
}
case "${1:-}" in
  install)
    [[ -d "$SOURCE" ]] || { echo '请先运行 npm run launcher:build。' >&2; exit 1; }
    mkdir -p "$HOME/Applications"
    if [[ -e "$TARGET" ]]; then check_existing; rm -rf -- "$TARGET"; fi
    ditto "$SOURCE" "$TARGET"
    echo "安装完成：$TARGET"
    echo 'Finder 中打开此应用，或拖到 Dock。更新 Node 或源代码后请重新构建并安装。'
    ;;
  uninstall)
    if [[ -e "$TARGET" ]]; then check_existing; rm -rf -- "$TARGET"; fi
    echo '应用已移除；未删除源码、修改 ChatGPT 或停用旧版 LaunchAgent。'
    ;;
  *) echo 'Usage: bash scripts/install-macos-launcher.sh install|uninstall' >&2; exit 2;;
esac
