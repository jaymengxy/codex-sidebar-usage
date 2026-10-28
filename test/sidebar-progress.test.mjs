import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/sidebar.js', import.meta.url), 'utf8');

test('progress track spans have explicit block layout and a positioning context', () => {
  assert.match(source, /\.track\{[^}]*display:block;[^}]*position:relative;[^}]*width:32px;height:3px;/);
});

test('progress fill spans are visible absolutely-positioned blocks', () => {
  assert.match(source, /\.fill\{[^}]*display:block;position:absolute;top:0;left:0;height:100%;width:0%;/);
});

test('five-hour green and weekly orange are scoped separately', () => {
  assert.match(source, /\[data-quota="five"\] \.fill\{background:#16a34a\}/);
  assert.match(source, /\[data-quota="week"\] \.fill\{background:#d97706\}/);
});
