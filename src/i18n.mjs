import { execFileSync } from 'node:child_process';

/** The macOS user preference takes precedence over a Terminal shell's LANG. */
export function firstAppleLanguage(text = '') {
  const quoted = text.match(/"([^"]+)"/);
  if (quoted) return quoted[1];
  return text.match(/\b(?:zh|en|ja|ko|fr|de)(?:[-_][a-zA-Z0-9]+)*\b/i)?.[0] ?? '';
}

export function languageFromLocale(locale) {
  return /^zh(?:[-_]|$)/i.test(String(locale || '').trim()) ? 'zh' : 'en';
}

/** Mac system language, or a deliberate CSU_LANG override supplied by Swift. */
export function systemLanguage({
  env = process.env,
  platform = process.platform,
  readPreferences = () => execFileSync('/usr/bin/defaults', ['read', '-g', 'AppleLanguages'], {
    encoding: 'utf8', timeout: 1500,
  }),
} = {}) {
  if (env.CSU_LANG) return languageFromLocale(env.CSU_LANG);
  if (platform === 'darwin') {
    try {
      const first = firstAppleLanguage(readPreferences());
      if (first) return languageFromLocale(first);
    } catch { /* user/global preference unavailable */ }
  }
  return languageFromLocale(env.LC_ALL || env.LC_MESSAGES || env.LANG || 'en');
}

export const language = systemLanguage();
export const tr = (zh, en) => language === 'zh' ? zh : en;
