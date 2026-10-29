import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { firstAppleLanguage, languageFromLocale, systemLanguage } from '../src/i18n.mjs';

test('Chinese system locales select Chinese, all other languages English', () => {
  for (const locale of ['zh', 'zh-CN', 'zh-Hans', 'zh-Hant-TW', 'ZH_TW']) {
    assert.equal(languageFromLocale(locale), 'zh');
  }
  for (const locale of ['en-US', 'ja-JP', 'fr-FR', 'ko-KR', 'de-DE', '', 'ezh']) {
    assert.equal(languageFromLocale(locale), 'en');
  }
});

test('recognizes the first macOS AppleLanguages locale', () => {
  assert.equal(firstAppleLanguage('(\n    "zh-Hans-CN",\n    "en-US"\n)'), 'zh-Hans-CN');
  assert.equal(firstAppleLanguage('(\n    "ja-JP",\n    "zh-Hans"\n)'), 'ja-JP');
  assert.equal(firstAppleLanguage(''), '');
});

test('macOS preference wins over Terminal LANG, launcher override wins over preference', () => {
  const readPreferences = () => '(\n    "zh-Hans-CN",\n    "en-US"\n)';
  assert.equal(systemLanguage({ platform:'darwin', env:{LANG:'en_US.UTF-8'}, readPreferences }), 'zh');
  assert.equal(systemLanguage({ platform:'darwin', env:{CSU_LANG:'en', LANG:'zh_CN.UTF-8'}, readPreferences }), 'en');
  assert.equal(systemLanguage({ platform:'linux', env:{LANG:'zh_CN.UTF-8'} }), 'zh');
  assert.equal(systemLanguage({ platform:'linux', env:{LANG:'ja_JP.UTF-8'} }), 'en');
  assert.equal(systemLanguage({ platform:'darwin', env:{LANG:'en_US.UTF-8'}, readPreferences:()=>{throw Error('no defaults')} }), 'en');
});

test('sidebar supports the page lang and system fallback without reading ChatGPT private settings', async () => {
  const source = await readFile(new URL('../src/sidebar.js', import.meta.url), 'utf8');
  assert.match(source, /document\.documentElement\.getAttribute\('lang'\)/);
  assert.match(source, /navigator\.languages\?\.\[0\] \|\| navigator\.language/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /languageObserver\.disconnect\(\)/);
  assert.match(source, /toLocaleString\(isChinese\(\) \? 'zh-CN' : 'en-US'\)/);
  assert.match(source, /'Five-hour quota'/);
  assert.match(source, /'Weekly quota'/);
  assert.match(source, /'Refresh quota'/);
  assert.match(source, /'Remaining'/);
  assert.match(source, /'Resets'/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});

test('Swift launcher uses macOS language and machine-readable status events', async () => {
  const swift = await readFile(new URL('../macos/Launcher.swift', import.meta.url), 'utf8');
  const node = await readFile(new URL('../scripts/run.mjs', import.meta.url), 'utf8');
  const build = await readFile(new URL('../scripts/build-macos-launcher.sh', import.meta.url), 'utf8');
  assert.match(swift, /Locale\.preferredLanguages\.first/);
  assert.match(swift, /environment\["CSU_LANG"\] = L\.isChinese \? "zh" : "en"/);
  assert.match(swift, /CSU_EVENT:connected/);
  assert.match(swift, /CSU_EVENT:injected/);
  assert.match(node, /CSU_EVENT:/);
  assert.match(build, /src\/i18n\.mjs/);
  assert.match(build, /source "\$ROOT\/scripts\/locale\.sh"/);
});

test('terminal build and installer choose macOS preference, include English fallback', async () => {
  const locale = await readFile(new URL('../scripts/locale.sh', import.meta.url), 'utf8');
  const build = await readFile(new URL('../scripts/build-macos-launcher.sh', import.meta.url), 'utf8');
  const install = await readFile(new URL('../scripts/install-macos-launcher.sh', import.meta.url), 'utf8');
  assert.match(locale, /defaults read -g AppleLanguages/);
  assert.match(locale, /CSU_DISPLAY_LANG/);
  assert.match(locale, /csu_say/);
  assert.match(build, /csu_say/);
  assert.match(install, /csu_say/);
});
