/**
 * 从后端租户记录生成小程序构建租户配置。
 *
 * 用法:
 *   node miniprogram/scripts/sync-tenant-config.js <slug>
 *   node miniprogram/scripts/sync-tenant-config.js <slug> --file tenant.json
 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const DEFAULT_SHARE_COVER = '/assets/images/share-default.jpg';
const USAGE = '用法: node miniprogram/scripts/sync-tenant-config.js <slug> [--file tenant.json] [--mongo-uri mongodb://...] [--out path]';
const { validateTenant } = require(path.join(ROOT, 'config/tenants/_schema.js'));
const REQUIRED_TAB_ICONS = [
  'tab-home.png',
  'tab-home-active.png',
  'tab-book.png',
  'tab-book-active.png',
  'tab-my.png',
  'tab-my-active.png'
];

function createCliError(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  error.isCliError = true;
  return error;
}

function parseArgs(argv = process.argv) {
  const args = argv.slice(2);
  const positionals = [];
  const options = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file') {
      if (!args[i + 1]) throw createCliError('--file 需要提供 JSON 文件路径');
      options.file = args[i + 1];
      i += 1;
    } else if (arg === '--mongo-uri') {
      if (!args[i + 1]) throw createCliError('--mongo-uri 需要提供 MongoDB 连接串');
      options.mongoUri = args[i + 1];
      i += 1;
    } else if (arg === '--out') {
      if (!args[i + 1]) throw createCliError('--out 需要提供输出路径');
      options.out = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--')) {
      throw createCliError(`未知参数: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  const slug = positionals[0];
  if (!slug) {
    throw createCliError(USAGE);
  }
  if (positionals.length > 1) {
    throw createCliError(`多余参数: ${positionals.slice(1).join(' ')}`);
  }
  return { slug, options };
}

function normalizeTenantPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.data && typeof payload.data === 'object') return normalizeTenantPayload(payload.data);
  if (payload.tenant && typeof payload.tenant === 'object') return normalizeTenantPayload(payload.tenant);
  return payload;
}

function loadTenantFromFile(filePath) {
  const resolved = path.resolve(REPO, filePath);
  if (!fs.existsSync(resolved)) {
    throw createCliError(`租户 JSON 文件不存在: ${resolved}`);
  }
  return normalizeTenantPayload(JSON.parse(fs.readFileSync(resolved, 'utf8')));
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return;
    const key = match[1];
    if (process.env[key] !== undefined) return;
    process.env[key] = match[2].replace(/^['"]|['"]$/g, '');
  });
}

async function loadTenantFromMongo(slug, mongoUri) {
  const backendRequire = createRequire(path.join(REPO, 'backend/package.json'));
  let mongoose;
  try {
    mongoose = backendRequire('mongoose');
  } catch (error) {
    throw createCliError('缺少 backend/node_modules/mongoose，请先在 backend 目录安装依赖，或改用 --file tenant.json');
  }

  const uri = mongoUri || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw createCliError('缺少 MongoDB 连接串，请设置 MONGODB_URI/MONGO_URI 或使用 --file tenant.json');
  }

  const Tenant = backendRequire('./src/models/Tenant');
  await mongoose.connect(uri);
  try {
    const tenant = await Tenant.findOne({ slug }).select('+wechatLogin.appSecret').lean();
    if (!tenant) {
      throw createCliError(`后端租户不存在: ${slug}`);
    }
    return tenant;
  } finally {
    await mongoose.disconnect();
  }
}

function pickWxAppId(tenant) {
  return tenant.wechatLogin?.appId || (Array.isArray(tenant.wxAppIds) ? tenant.wxAppIds[0] : '');
}

function buildSubscribeTemplates(tenant) {
  return {
    enrollment_result: '',
    payment_result: '',
    comment_received: '',
    like_received: '',
    danmaku_received: '',
    insight_liked: '',
    insight_request_created: '',
    insight_request_approved: '',
    next_day_study_reminder: '',
    insight_created: '',
    podcast_published: '',
    activity_reminder: '',
    ...(tenant.subscribeTemplates || {})
  };
}

function buildMiniTenantConfig(tenant, slug) {
  const branding = tenant.branding || {};
  const wxAppId = pickWxAppId(tenant);
  const primaryColor = branding.primaryColor || '#4a90e2';
  const brandName = branding.brandName || tenant.name || slug;
  const iconsDir = `/assets/tenants/${slug}`;

  return {
    slug,
    brandName,
    wxAppId,
    cloudEnv: tenant.cloudEnv || tenant.wechatCloudEnv || null,
    wechatPayMchId: tenant.wechatPay?.mchId || null,
    subscribeTemplates: buildSubscribeTemplates(tenant),
    primaryColor,
    logo: branding.logo || `${iconsDir}/logo.png`,
    shareCover: branding.shareCover || DEFAULT_SHARE_COVER,
    navBar: {
      title: brandName,
      bgColor: branding.navBarBgColor || primaryColor,
      textStyle: branding.navBarTextStyle || 'white'
    },
    tabBar: {
      color: branding.tabBarColor || '#999999',
      selectedColor: branding.tabBarSelectedColor || primaryColor,
      backgroundColor: branding.tabBarBackgroundColor || '#ffffff',
      iconsDir
    },
    legalEntity: tenant.legalEntity || `${brandName} 团队`,
    contactEmail: tenant.contactEmail || null,
    apiBaseUrl: tenant.apiBaseUrl || null
  };
}

function validateGeneratedConfig(config, slug) {
  const errors = validateTenant(config);
  if (!/^wx[0-9a-f]{16}$/i.test(config.wxAppId || '')) {
    errors.push(`wxAppId 不合法: ${config.wxAppId || '(empty)'}`);
  }
  const tenantAssetDir = path.join(ROOT, 'assets', 'tenants', slug);
  if (!fs.existsSync(tenantAssetDir)) {
    errors.push(`缺少租户素材目录: ${tenantAssetDir}`);
  } else {
    const missing = ['logo.png', ...REQUIRED_TAB_ICONS]
      .filter(file => !fs.existsSync(path.join(tenantAssetDir, file)));
    if (missing.length) {
      errors.push(`缺少租户素材: ${missing.join(', ')}`);
    }
  }
  return errors;
}

function serializeConfig(config) {
  return `// ${config.brandName} —— 由 sync-tenant-config.js 从后端租户配置生成\nmodule.exports = ${JSON.stringify(config, null, 2)};\n`;
}

async function syncTenantConfig(slug, options = {}) {
  if (!/^[a-z][a-z0-9_-]*$/.test(slug || '')) {
    throw createCliError(`slug 不合法: ${slug}`);
  }

  loadEnvFile(path.join(REPO, 'backend/.env.local'));
  loadEnvFile(path.join(REPO, 'backend/.env'));

  const tenant = options.file
    ? loadTenantFromFile(options.file)
    : await loadTenantFromMongo(slug, options.mongoUri);
  if (!tenant) {
    throw createCliError('无法读取租户配置');
  }
  if (tenant.slug && tenant.slug !== slug) {
    throw createCliError(`租户 slug 不匹配: 参数=${slug}, 数据=${tenant.slug}`);
  }

  const config = buildMiniTenantConfig(tenant, slug);
  const validationErrors = validateGeneratedConfig(config, slug);
  if (validationErrors.length) {
    throw createCliError(`租户配置校验失败:\n- ${validationErrors.join('\n- ')}`);
  }

  const outPath = path.resolve(
    REPO,
    options.out || path.join('miniprogram/config/tenants', `${slug}.js`)
  );
  fs.writeFileSync(outPath, serializeConfig(config));
  return { outPath, config };
}

async function runCli(argv = process.argv) {
  try {
    const { slug, options } = parseArgs(argv);
    const result = await syncTenantConfig(slug, options);
    console.log(`✅ 已同步小程序租户配置: ${result.outPath}`);
    console.log(`   brandName: ${result.config.brandName}`);
    console.log(`   wxAppId  : ${result.config.wxAppId}`);
  } catch (error) {
    console.error(error.isCliError ? error.message : `同步失败: ${error.message || error}`);
    process.exit(error.exitCode || 1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  parseArgs,
  buildMiniTenantConfig,
  syncTenantConfig,
  runCli
};
