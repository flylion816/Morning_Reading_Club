import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const guidePath = new URL('../docs/admin-guide/fanren-reading-admin-guide.html', import.meta.url);
const guide = readFileSync(guidePath, 'utf8');
const require = createRequire(import.meta.url);
const fanrenConfig = require('../miniprogram/config/tenants/fanren.js');
const starryConfig = require('../miniprogram/config/tenants/starry.js');

function guideAccent(slug) {
  const theme = guide.match(new RegExp(`html\\[data-tenant="${slug}"\\]\\{([^}]*)\\}`));
  assert.ok(theme, `missing ${slug} guide theme`);
  const accent = theme[1].match(/--accent:(#[0-9a-f]{6})/i);
  assert.ok(accent, `missing ${slug} accent color`);
  return accent[1].toLowerCase();
}

test('matches guide accents to tenant configuration primary colors', () => {
  assert.equal(guideAccent('fanren'), fanrenConfig.primaryColor.toLowerCase());
  assert.equal(guideAccent('starry'), starryConfig.primaryColor.toLowerCase());
  assert.match(guide, /document\.documentElement\.dataset\.tenant\s*=\s*imageSlug/);
});

test('uses a compact mobile section navigator', () => {
  assert.match(guide, /class="mobile-section-nav"/);
  assert.match(guide, /id="mobile-section-select"/);
  assert.match(guide, /@media\(max-width:900px\)[\s\S]*?\.nav-group\{display:none\}/);
});

test('keeps screenshots readable inside mobile scroll frames', () => {
  const shots = guide.match(/<img class="shot"/g) || [];
  const frames = guide.match(/class="shot-frame"/g) || [];

  assert.equal(shots.length, 19);
  assert.equal(frames.length, shots.length);
  assert.match(guide, /@media\(max-width:900px\)[\s\S]*?\.shot\{[^}]*min-width:760px/);
});
