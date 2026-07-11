#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '../../../..');
const guidePath = resolve(root, 'docs/admin-guide/fanren-reading-admin-guide.html');
const guide = readFileSync(guidePath, 'utf8');
const require = createRequire(import.meta.url);
const slugs = ['fanren', 'starry'];
const expectedShots = [
  'annotated-01-dashboard.png',
  'annotated-02-analytics.png',
  'annotated-03-registrations.png',
  'annotated-03b-registration-statistics.png',
  'annotated-04-users.png',
  'annotated-05-payments.png',
  'annotated-06-sections.png',
  'annotated-07-contents.png',
  'annotated-08a-checkins-records.png',
  'annotated-08b-checkins-celebration.png',
  'annotated-09a-insights-list.png',
  'annotated-09b-insights-view-unmasked.png',
  'annotated-10-applications.png',
  'annotated-11-completion-reports.png',
  'annotated-12-imprints.png',
  'annotated-13-activities.png',
  'annotated-14-coupons.png',
  'annotated-15-home-config.png',
  'annotated-16-audit.png'
];

function pngDimensions(path) {
  const png = readFileSync(path);
  assert.ok(png.length >= 24, `${path} is too small to be a PNG`);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path} has an invalid PNG signature`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function themeAccent(slug) {
  const theme = guide.match(new RegExp(`html\\[data-tenant="${slug}"\\]\\{([^}]*)\\}`));
  assert.ok(theme, `guide is missing the ${slug} theme`);
  const accent = theme[1].match(/--accent:(#[0-9a-f]{6})/i);
  assert.ok(accent, `guide is missing the ${slug} accent`);
  return accent[1].toLowerCase();
}

const referencedShots = [...guide.matchAll(/data-shot="([^"]+\.png)"/g)].map((match) => match[1]);
assert.deepEqual(referencedShots, expectedShots, 'guide screenshot references differ from the required screenshot map');
const assetVersion = guide.match(/var assetVersion = '([0-9]{8}-[0-9]{4})';/);
assert.ok(assetVersion, 'assetVersion must use YYYYMMDD-HHMM');
const hardcodedVersions = [...guide.matchAll(/[?&]v=([0-9]{8}-[0-9]{4})/g)].map((match) => match[1]);
assert.ok(hardcodedVersions.length > 0, 'guide must version hardcoded social-preview images');
assert.ok(hardcodedVersions.every((version) => version === assetVersion[1]), 'hardcoded image versions must match assetVersion');
assert.match(guide, /document\.documentElement\.dataset\.tenant\s*=\s*imageSlug/, 'theme slug must follow the validated screenshot slug');
assert.match(guide, /class="mobile-section-nav"/, 'mobile section navigation is missing');
assert.match(guide, /@media\(max-width:900px\)[\s\S]*?\.nav-group\{display:none\}/, 'desktop navigation must collapse on mobile');
assert.match(guide, /@media\(max-width:900px\)[\s\S]*?\.shot\{[^}]*min-width:760px/, 'mobile screenshots must remain readable in a scroll frame');

for (const slug of slugs) {
  const config = require(resolve(root, `miniprogram/config/tenants/${slug}.js`));
  assert.equal(themeAccent(slug), config.primaryColor.toLowerCase(), `${slug} guide accent differs from tenant config`);

  for (const filename of expectedShots) {
    const path = resolve(root, 'docs/admin-guide-assets', slug, filename);
    assert.ok(existsSync(path), `missing ${slug} screenshot: ${filename}`);
    assert.deepEqual(pngDimensions(path), { width: 1512, height: 771 }, `${slug}/${filename} must be 1512x771`);
  }
}

console.log(`Admin guide audit passed: ${slugs.length} tenants, ${expectedShots.length} screenshots each.`);
console.log('Manual checks still required: privacy masks, annotation accuracy, and desktop/mobile visual review.');
