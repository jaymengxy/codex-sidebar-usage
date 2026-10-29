#!/bin/bash
# Human-facing language support for macOS build/install scripts.
# Prefer the macOS language over Terminal LANG; fall back to English.
csu_preferred_language() {
  local lang=''
  if [[ "$(uname -s)" == "Darwin" && -x /usr/bin/defaults ]]; then
    lang="$(/usr/bin/defaults read -g AppleLanguages 2>/dev/null |
      /usr/bin/awk -F '"' 'NF > 1 { print $2; exit }' || true)"
  fi
  printf '%s' "${CSU_LANG:-${lang:-${LC_ALL:-${LC_MESSAGES:-${LANG:-en}}}}}"
}
CSU_DISPLAY_LANG="$(csu_preferred_language)"
csu_say() {
  case "$CSU_DISPLAY_LANG" in
    zh|zh-*|zh_*|ZH|ZH-*|ZH_*) printf '%s\n' "$1";;
    *) printf '%s\n' "$2";;
  esac
}
csu_error() { csu_say "$1" "$2" >&2; }
