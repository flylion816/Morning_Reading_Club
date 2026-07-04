/**
 * 从后端租户记录生成小程序构建租户配置。
 *
 * 用法:
 *   node miniprogram/scripts/sync-tenant-config.js <slug>
 *   node miniprogram/scripts/sync-tenant-config.js <slug> --file tenant.json
 *   node miniprogram/scripts/sync-tenant-config.js <slug> --api-base-url https://wx.shubai01.com/api/v1 --email admin@example.com --password xxx
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { createRequire } = require('module');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const DEFAULT_SHARE_COVER = '/assets/images/share-default.jpg';
const DEFAULT_API_BASE_URL = 'https://wx.shubai01.com/api/v1';
const USAGE = '用法: node miniprogram/scripts/sync-tenant-config.js <slug> [--api-base-url https://wx.shubai01.com/api/v1] [--email admin@example.com] [--password xxx] [--token jwt] [--file tenant.json] [--mongo-uri mongodb://...] [--out path]';
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
    } else if (arg === '--api-base-url') {
      if (!args[i + 1]) throw createCliError('--api-base-url 需要提供后端 API 地址');
      options.apiBaseUrl = args[i + 1];
      i += 1;
    } else if (arg === '--token') {
      if (!args[i + 1]) throw createCliError('--token 需要提供管理员 JWT');
      options.token = args[i + 1];
      i += 1;
    } else if (arg === '--email') {
      if (!args[i + 1]) throw createCliError('--email 需要提供管理员邮箱');
      options.email = args[i + 1];
      i += 1;
    } else if (arg === '--password') {
      if (!args[i + 1]) throw createCliError('--password 需要提供管理员密码');
      options.password = args[i + 1];
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

function joinUrl(baseUrl, pathname) {
  return `${String(baseUrl).replace(/\/+$/, '')}/${String(pathname).replace(/^\/+/, '')}`;
}

function requestJson(method, url, options = {}) {
  const body = options.body ? JSON.stringify(options.body) : null;
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'http:' ? http : https;
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = client.request(parsedUrl, { method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (error) {
          reject(createCliError(`后端 API 返回的不是 JSON: ${text.slice(0, 200)}`));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = data?.message || data?.error || text || `HTTP ${res.statusCode}`;
          reject(createCliError(`后端 API 请求失败 (${res.statusCode}): ${message}`));
          return;
        }
        resolve(data);
      });
    });
    req.on('error', error => reject(createCliError(`后端 API 请求失败: ${error.message}`)));
    if (body) req.write(body);
    req.end();
  });
}

function extractSuccessData(response) {
  if (response && typeof response === 'object' && 'code' in response) {
    if (response.code !== 0 && response.code !== 200) {
      throw createCliError(response.message || `后端 API 返回错误 code=${response.code}`);
    }
    return response.data;
  }
  return response;
}

async function getAdminToken(apiBaseUrl, options = {}) {
  const token = options.token || process.env.TENANT_SYNC_ADMIN_TOKEN || process.env.ADMIN_TOKEN;
  if (token) return token;

  const email = options.email || process.env.TENANT_SYNC_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const password = options.password || process.env.TENANT_SYNC_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw createCliError('缺少管理员登录信息：请提供 --token，或提供 --email/--password，或设置 TENANT_SYNC_ADMIN_EMAIL/TENANT_SYNC_ADMIN_PASSWORD');
  }

  const request = options.requestJson || requestJson;
  const response = await request('POST', joinUrl(apiBaseUrl, '/auth/admin/login'), {
    body: { email, password }
  });
  const data = extractSuccessData(response);
  const loginToken = data?.token;
  if (!loginToken) {
    throw createCliError('管理员登录成功但响应中没有 token');
  }
  return loginToken;
}

async function loadTenantFromApi(slug, options = {}) {
  const apiBaseUrl = options.apiBaseUrl ||
    process.env.TENANT_SYNC_API_BASE_URL ||
    process.env.ADMIN_API_BASE_URL ||
    process.env.VITE_API_URL ||
    DEFAULT_API_BASE_URL;
  const token = await getAdminToken(apiBaseUrl, options);
  const request = options.requestJson || requestJson;
  const response = await request('GET', joinUrl(apiBaseUrl, '/admin/tenants'), {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = extractSuccessData(response);
  const tenants = Array.isArray(data)
    ? data
    : Array.isArray(data?.tenants)
      ? data.tenants
      : Array.isArray(data?.list)
        ? data.list
        : [];
  const tenant = tenants.find(item => item.slug === slug);
  if (!tenant) {
    throw createCliError(`后端 API 中找不到租户: ${slug}`);
  }
  return tenant;
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
    wechatSIPlugin: Boolean(tenant.features?.wechatSIPlugin || tenant.plugins?.wechatSIPlugin),
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
    : options.mongoUri
      ? await loadTenantFromMongo(slug, options.mongoUri)
      : await loadTenantFromApi(slug, options);
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
  loadTenantFromApi,
  syncTenantConfig,
  runCli
};
