import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png'
};

let browser;
let origin;
let server;

before(async () => {
  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requestedPath = resolve(root, `.${pathname}`);
    if (!requestedPath.startsWith(`${root}${sep}`) || !existsSync(requestedPath) || !statSync(requestedPath).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.setHeader('Content-Type', contentTypes[extname(requestedPath)] || 'application/octet-stream');
    response.end(readFileSync(requestedPath));
  });
  await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(chromePath) ? { executablePath: chromePath } : {})
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolveClosed) => server?.close(resolveClosed));
});

for (const slug of ['fanren', 'starry']) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    test(`${slug} guide works at ${viewport.width}x${viewport.height}`, async () => {
      const page = await browser.newPage({ viewport });
      await page.goto(`${origin}/docs/admin-guide/fanren-reading-admin-guide.html?slug=${slug}`, {
        waitUntil: 'domcontentloaded'
      });
      await page.waitForFunction(() => [...document.images].every((image) => image.complete));

      const state = await page.evaluate(() => {
        const nav = document.querySelector('.nav');
        const main = document.querySelector('main');
        const selector = document.querySelector('#mobile-section-select');
        const frames = [...document.querySelectorAll('.shot-frame')];
        return {
          bodyWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
          desktopGroupsHidden: [...document.querySelectorAll('.nav-group')]
            .every((group) => getComputedStyle(group).display === 'none'),
          imagesLoaded: [...document.images]
            .every((image) => image.complete && image.naturalWidth > 0),
          mobileSelectorVisible: getComputedStyle(selector).display !== 'none',
          framesScrollable: frames.every((frame) => frame.scrollWidth > frame.clientWidth),
          headerDoesNotOverlapMain: nav.getBoundingClientRect().bottom <= main.getBoundingClientRect().top
        };
      });

      assert.equal(state.bodyWidth, state.innerWidth, 'page must not overflow horizontally');
      assert.equal(state.desktopGroupsHidden, true);
      assert.equal(state.imagesLoaded, true);
      assert.equal(state.mobileSelectorVisible, true);
      assert.equal(state.framesScrollable, true);
      assert.equal(state.headerDoesNotOverlapMain, true);

      await page.selectOption('#mobile-section-select', 'analytics');
      assert.equal(await page.evaluate(() => window.location.hash), '#analytics');
      await page.close();
    });
  }
}

test('tenant name cannot be overridden independently from the validated slug', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(
    `${origin}/docs/admin-guide/fanren-reading-admin-guide.html?slug=starry&brandName=Injected`,
    { waitUntil: 'domcontentloaded' }
  );

  assert.equal(await page.title(), '若星生活家管理员操作指南');
  assert.equal(await page.locator('[data-brand-name]').first().innerText(), '若星生活家');
  await page.close();
});
