const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const parseJson = file => JSON.parse(read(file));

describe('miniprogram brand color regression', () => {
  test('global shell follows the selected tenant primary color', () => {
    const tenant = require('../../config/current-tenant');
    const app = parseJson('miniprogram/app.json');
    const theme = read('miniprogram/theme.wxss');

    expect(tenant.primaryColor.toLowerCase()).toBe('#4a90e2');
    expect(app.window.navigationBarBackgroundColor.toLowerCase()).toBe(tenant.primaryColor.toLowerCase());
    expect(app.tabBar.selectedColor.toLowerCase()).toBe(tenant.primaryColor.toLowerCase());
    expect(theme).toContain(`--theme-primary: ${tenant.primaryColor}`);
  });

  test('login returns to the tenant-colored full-bleed shell', () => {
    const styles = read('miniprogram/pages/login/login.wxss');
    const loginBlock = styles.slice(styles.indexOf('Version 2 consistency polish'));

    expect(loginBlock).toContain('.page-login {');
    expect(loginBlock).toContain('linear-gradient(145deg, var(--theme-primary)');
    expect(loginBlock).not.toContain('.page-login-wrapper,\n.page-login {');
  });

  test('check-in keeps its primary navigation color', () => {
    const styles = read('miniprogram/pages/checkin/checkin.wxss');
    const polishBlock = styles.slice(styles.indexOf('Version 2 consistency polish'));

    expect(polishBlock).toContain('.custom-nav');
    expect(polishBlock).toContain('linear-gradient(145deg, var(--theme-primary), var(--theme-primary-dark))');
  });

  test('zaichang keeps its forest sub-brand navigation, chips, action, and centered avatars', () => {
    const listJson = parseJson('miniprogram/pages/zaichang/list/list.json');
    const detailJson = parseJson('miniprogram/pages/zaichang/detail/detail.json');
    const publishJson = parseJson('miniprogram/pages/zaichang/publish/publish.json');
    const listStyles = read('miniprogram/pages/zaichang/list/list.wxss');
    const listMarkup = read('miniprogram/pages/zaichang/list/list.wxml');
    const detailStyles = read('miniprogram/pages/zaichang/detail/detail.wxss');
    const applyTenant = read('miniprogram/scripts/apply-tenant.js');

    [listJson, detailJson, publishJson].forEach(pageJson => {
      expect(pageJson.navigationBarBackgroundColor).toBe('#2D5A3D');
    });
    expect(listStyles).toContain('--zc-primary: #2D5A3D');
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
    expect(applyTenant).toContain("pagePath.startsWith('pages/zaichang/')");
  });
});
