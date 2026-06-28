const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildMiniTenantConfig,
  parseArgs,
  syncTenantConfig
} = require('../../scripts/sync-tenant-config');

describe('sync-tenant-config script', () => {
  const tenantPayload = {
    slug: 'fanren',
    name: '凡人共读',
    wxAppIds: ['wx0000000000000001'],
    wechatLogin: { appId: 'wx2b9a3c1d5e4195f8' },
    wechatPay: { mchId: '1900000109' },
    cloudEnv: 'cloudbase-test',
    subscribeTemplates: {
      enrollment_result: 'ENROLL_TPL'
    },
    branding: {
      brandName: '凡人共读',
      primaryColor: '#123456',
      logo: '/assets/tenants/fanren/logo.png',
      shareCover: '/assets/tenants/fanren/share-cover.jpg',
      navBarBgColor: '#234567',
      navBarTextStyle: 'black',
      tabBarColor: '#111111',
      tabBarSelectedColor: '#222222',
      tabBarBackgroundColor: '#ffffff'
    },
    legalEntity: '凡人共读主体',
    contactEmail: 'support@example.com',
    apiBaseUrl: 'https://example.com/api/v1'
  };

  test('parses slug and options in any order', () => {
    expect(parseArgs(['node', 'script', '--file', 'tenant.json', 'fanren', '--out', 'out.js'])).toEqual({
      slug: 'fanren',
      options: {
        file: 'tenant.json',
        out: 'out.js'
      }
    });
  });

  test('builds mini program tenant config from backend tenant payload', () => {
    const config = buildMiniTenantConfig(tenantPayload, 'fanren');

    expect(config).toEqual(expect.objectContaining({
      slug: 'fanren',
      brandName: '凡人共读',
      wxAppId: 'wx2b9a3c1d5e4195f8',
      cloudEnv: 'cloudbase-test',
      wechatPayMchId: '1900000109',
      primaryColor: '#123456',
      logo: '/assets/tenants/fanren/logo.png',
      shareCover: '/assets/tenants/fanren/share-cover.jpg',
      legalEntity: '凡人共读主体',
      contactEmail: 'support@example.com',
      apiBaseUrl: 'https://example.com/api/v1'
    }));
    expect(config.navBar).toEqual({
      title: '凡人共读',
      bgColor: '#234567',
      textStyle: 'black'
    });
    expect(config.tabBar).toEqual({
      color: '#111111',
      selectedColor: '#222222',
      backgroundColor: '#ffffff',
      iconsDir: '/assets/tenants/fanren'
    });
    expect(config.subscribeTemplates.enrollment_result).toBe('ENROLL_TPL');
    expect(config.subscribeTemplates.payment_result).toBe('');
  });

  test('writes generated config from backend JSON file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-sync-'));
    const inputPath = path.join(tempDir, 'tenant.json');
    const outPath = path.join(tempDir, 'fanren.js');
    fs.writeFileSync(inputPath, JSON.stringify({ tenant: tenantPayload }));

    const result = await syncTenantConfig('fanren', {
      file: inputPath,
      out: outPath
    });

    expect(result.outPath).toBe(outPath);
    expect(fs.existsSync(outPath)).toBe(true);
    const generated = require(outPath);
    expect(generated.brandName).toBe('凡人共读');
    expect(generated.wxAppId).toBe('wx2b9a3c1d5e4195f8');
    expect(generated.subscribeTemplates.enrollment_result).toBe('ENROLL_TPL');
  });

  test('rejects payload whose slug does not match argument', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tenant-sync-'));
    const inputPath = path.join(tempDir, 'tenant.json');
    const outPath = path.join(tempDir, 'fanren.js');
    fs.writeFileSync(inputPath, JSON.stringify({ ...tenantPayload, slug: 'chaoren' }));

    await expect(syncTenantConfig('fanren', {
      file: inputPath,
      out: outPath
    })).rejects.toMatchObject({
      isCliError: true
    });
  });
});
