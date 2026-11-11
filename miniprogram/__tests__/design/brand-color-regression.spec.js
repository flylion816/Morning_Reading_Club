const fs = require('fs');
const path = require('path');
const { BRAND_NAV_PAGES, PAPER_NAV, ZAICHANG_NAV, resolvePageNavBar } = require('../../scripts/nav-shell');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const parseJson = file => JSON.parse(read(file));
const lower = value => String(value || '').toLowerCase();

// 晨光（版本三）之后的品牌色规则：
// 外壳默认是暖纸色；品牌主色留在品牌页和主行动上；「在场」只有列表页保留深绿导航。
describe('miniprogram brand color regression', () => {
  test('global shell is dawn paper while brand pages follow the selected tenant primary color', () => {
    const tenant = require('../../config/current-tenant');
    const app = parseJson('miniprogram/app.json');
    const theme = read('miniprogram/theme.wxss');
    const primary = lower(tenant.primaryColor);

    expect(primary).toBe('#4a90e2');
    expect(lower(app.window.navigationBarBackgroundColor)).toBe(PAPER_NAV.bgColor);
    expect(app.window.navigationBarTextStyle).toBe(PAPER_NAV.textStyle);
    expect(lower(app.tabBar.backgroundColor)).toBe(PAPER_NAV.bgColor);
    expect(lower(app.tabBar.selectedColor)).toBe(primary);
    expect(theme).toContain(`--theme-primary: ${tenant.primaryColor}`);

    expect(BRAND_NAV_PAGES).toContain('pages/periods/periods');
    BRAND_NAV_PAGES.forEach(pagePath => {
      const pageJson = parseJson(`miniprogram/${pagePath}.json`);
      expect(lower(pageJson.navigationBarBackgroundColor)).toBe(primary);
      expect(pageJson.navigationBarTextStyle).toBe('white');
    });
  });

  test('login is a dawn scene led by the tenant color, not a pale or flat full-bleed page', () => {
    const styles = read('miniprogram/pages/login/login.wxss');
    const markup = read('miniprogram/pages/login/login.wxml');
    const dawnStart = styles.indexOf('Version 3 dawn');
    const dawnBlock = styles.slice(dawnStart);

    expect(dawnStart).toBeGreaterThan(styles.indexOf('Version 2 consistency polish'));
    // 上半屏仍由租户主色主导，并且只用主题变量（换租户即换色）
    expect(dawnBlock).toMatch(/\.login-sky\s*\{[^}]*var\(--theme-primary-dark\)[^}]*var\(--theme-primary\)/);
    expect(dawnBlock).not.toMatch(/\.login-sky\s*\{[^}]*#4a90e2/i);
    // 地平线以下是暖纸，太阳用晨光色
    expect(dawnBlock).toMatch(/\.login-ground\s*\{[^}]*var\(--app-paper\)/);
    expect(dawnBlock).toMatch(/\.login-sun\s*\{[^}]*var\(--app-dawn\)/);
    // emoji 徽标换成线描徽记；「稍后登录」仍是可见的按钮
    expect(markup).not.toContain('📚');
    expect(markup).toContain('login-emblem');
    expect(markup).toContain('login-skip-btn');
  });

  test('check-in uses the paper header and keeps the brand color on its primary action', () => {
    const styles = read('miniprogram/pages/checkin/checkin.wxss');
    const pageJson = parseJson('miniprogram/pages/checkin/checkin.json');
    const dawnStart = styles.indexOf('Version 3 dawn');
    const dawnBlock = styles.slice(dawnStart);

    expect(dawnStart).toBeGreaterThan(styles.indexOf('Version 2 consistency polish'));
    expect(dawnBlock).toMatch(/\.custom-nav\s*\{[^}]*background:\s*var\(--app-paper\)/);
    expect(dawnBlock).toMatch(/\.nav-title\s*\{[^}]*color:\s*var\(--app-text\)/);
    expect(dawnBlock).toContain('var(--app-dawn)');
    expect(pageJson.navigationStyle).toBe('custom');
    expect(pageJson.navigationBarTextStyle).toBe('black');
    // 主行动保留品牌色：原规则用主题色，晨光块不得把它改成中性色
    expect(styles).toMatch(/\.btn-submit\s*\{[^}]*var\(--theme-primary/);
    expect(dawnBlock).not.toMatch(/\.btn-submit\s*\{[^}]*background(?:-color)?:\s*var\(--app-/);
  });

  test('zaichang keeps its forest sub-brand on the list page and shares the dawn paper', () => {
    const listJson = parseJson('miniprogram/pages/zaichang/list/list.json');
    const detailJson = parseJson('miniprogram/pages/zaichang/detail/detail.json');
    const publishJson = parseJson('miniprogram/pages/zaichang/publish/publish.json');
    const listStyles = read('miniprogram/pages/zaichang/list/list.wxss');
    const listMarkup = read('miniprogram/pages/zaichang/list/list.wxml');
    const detailStyles = read('miniprogram/pages/zaichang/detail/detail.wxss');
    const publishStyles = read('miniprogram/pages/zaichang/publish/publish.wxss');
    const applyTenant = read('miniprogram/scripts/apply-tenant.js');
    const otherTenantNav = { bgColor: '#448426', textStyle: 'white' };

    // 列表页是子品牌门面：深绿导航，不随租户变化
    expect(listJson.navigationBarBackgroundColor).toBe('#2D5A3D');
    expect(listJson.navigationBarTextStyle).toBe('white');
    expect(resolvePageNavBar('pages/zaichang/list/list', listJson, otherTenantNav)).toEqual({ ...ZAICHANG_NAV });

    // 详情页、发布页是内容页：纸色导航
    [detailJson, publishJson].forEach(pageJson => {
      expect(lower(pageJson.navigationBarBackgroundColor)).toBe(PAPER_NAV.bgColor);
      expect(pageJson.navigationBarTextStyle).toBe('black');
    });
    expect(resolvePageNavBar('pages/zaichang/detail/detail', detailJson, otherTenantNav)).toEqual({ ...PAPER_NAV });
    expect(applyTenant).toMatch(/require\(['"]\.\/nav-shell['"]\)/);

    // 同一张纸，换一种印泥：中性色跟全局，深绿做作用域内的主题色
    [listStyles, detailStyles, publishStyles].forEach(styles => {
      expect(styles).toContain('--zc-primary: #2D5A3D');
      expect(styles).toContain('--theme-primary: #2D5A3D');
      expect(styles).toContain('--zc-bg: var(--app-page-bg)');
    });

    expect(listStyles).toContain('background: var(--zc-primary)');
    expect(listStyles).toContain('border-color: var(--zc-primary)');
    expect(listStyles).toContain('.avatar-text');
    expect(listStyles).toContain('.author-avatar-text');
    expect(listMarkup).toContain('class="avatar-initial"');
    expect(listStyles).toContain('.avatar-wrap { width: 56rpx; height: 56rpx; border-radius: 50%; overflow: hidden; border: 2rpx solid #fff; box-sizing: border-box; }');
    expect(listStyles).toContain('.avatar-text { width: 100%; height: 100%;');
    expect(listStyles).toContain('position: relative;');
    expect(listStyles).toContain('.avatar-initial');
    expect(listStyles).toContain('left: 50%; top: 50%; transform: translate(-50%, -50%);');
    expect(detailStyles).toContain('display: grid; place-items: center;');
    expect(detailStyles).toContain('.avatar-initial');
  });
});
