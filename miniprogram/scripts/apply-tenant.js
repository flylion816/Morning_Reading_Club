// 用法: node scripts/apply-tenant.js <slug>
// 切换当前构建租户：生成 current-tenant.js / theme.wxss，外科式改写 app.json / project.config.json
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');           // miniprogram/
const REPO = path.resolve(ROOT, '..');                // 仓库根

const slug = process.argv[2];
if (!slug) {
  console.error('用法: node scripts/apply-tenant.js <slug>\n  例: node scripts/apply-tenant.js fanren');
  process.exit(1);
}

// 1) 加载并校验租户配置（失败安全：校验不过直接退出）
const tenantPath = path.join(ROOT, 'config', 'tenants', `${slug}.js`);
if (!fs.existsSync(tenantPath)) {
  console.error(`❌ 租户配置不存在: ${tenantPath}`);
  console.error(`   可用租户: ${fs.readdirSync(path.join(ROOT, 'config', 'tenants')).filter(f => f.endsWith('.js') && !f.startsWith('_')).map(f => f.replace('.js', '')).join(', ')}`);
  process.exit(1);
}

// 清除 require 缓存，保证多次 apply 时读到最新文件
delete require.cache[tenantPath];
const cfg = require(tenantPath);

const { validateTenant } = require(path.join(ROOT, 'config', 'tenants', '_schema.js'));
const errors = validateTenant(cfg);
if (errors.length) {
  console.error(`❌ 租户 [${slug}] 配置校验失败:`);
  errors.forEach(e => console.error(`   - ${e}`));
  process.exit(1);
}

function isManagedIgnoreEntry(item, entries) {
  if (!item || !item.value || !item.type) {
    return false;
  }
  if (entries.some(entry => entry.value === item.value && entry.type === item.type)) {
    return true;
  }
  return /^(miniprogram\/)?assets\/tenants\/[^/]+$/.test(item.value) ||
    /^(miniprogram\/)?assets\/tenants\/[^/]+\/share-cover\.jpg$/.test(item.value);
}

function upsertIgnoreEntries(projectConfig, entries) {
  projectConfig.packOptions = projectConfig.packOptions || {};
  const ignore = Array.isArray(projectConfig.packOptions.ignore)
    ? projectConfig.packOptions.ignore
    : [];
  const nextIgnore = ignore.filter(item => !isManagedIgnoreEntry(item, entries));

  entries.forEach(entry => {
    nextIgnore.push(entry);
  });

  projectConfig.packOptions.ignore = nextIgnore;
  projectConfig.packOptions.include = Array.isArray(projectConfig.packOptions.include)
    ? projectConfig.packOptions.include
    : [];
}

function buildIgnoreEntries(prefix = '') {
  const tenantAssetRoot = path.join(ROOT, 'assets', 'tenants');
  const tenantDirs = fs.existsSync(tenantAssetRoot)
    ? fs.readdirSync(tenantAssetRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
    : [];
  const entries = [
    { value: `${prefix}scripts`, type: 'folder' },
    { value: `${prefix}__tests__`, type: 'folder' },
    { value: `${prefix}e2e`, type: 'folder' },
    { value: `${prefix}.omc`, type: 'folder' },
    { value: `${prefix}assets/icons/.omc`, type: 'folder' }
  ];

  tenantDirs
    .filter(tenantSlug => tenantSlug !== slug)
    .forEach(tenantSlug => {
      entries.push({ value: `${prefix}assets/tenants/${tenantSlug}`, type: 'folder' });
    });

  const currentTenantShareCover = `/assets/tenants/${slug}/share-cover.jpg`;
  if (cfg.shareCover !== currentTenantShareCover) {
    entries.push({ value: `${prefix}assets/tenants/${slug}/share-cover.jpg`, type: 'file' });
  }

  return entries;
}

// 2) 校验 TabBar 图标素材存在（必须本地文件）
const tabIconFiles = [
  'tab-home.png', 'tab-home-active.png',
  'tab-book.png', 'tab-book-active.png',
  'tab-my.png',   'tab-my-active.png'
];
const iconsDirRel = cfg.tabBar.iconsDir.replace(/^\//, '');
const iconsDir = path.join(ROOT, iconsDirRel);
const missingIcons = tabIconFiles.filter(f => !fs.existsSync(path.join(iconsDir, f)));
if (missingIcons.length) {
  console.error(`❌ 缺少 TabBar 图标素材 (${iconsDir}):`);
  missingIcons.forEach(f => console.error(`   - ${f}`));
  process.exit(1);
}

// 3) 生成 config/current-tenant.js（运行时唯一读取入口）
const currentTenantPath = path.join(ROOT, 'config', 'current-tenant.js');
fs.writeFileSync(
  currentTenantPath,
  `// ⚠️ 由 scripts/apply-tenant.js 自动生成，勿手改。提交前运行 npm run tenant:reset 还原 fanren 默认态\n// 源: config/tenants/${slug}.js\nmodule.exports = ${JSON.stringify(cfg, null, 2)};\n`
);

// 4) 生成 theme.wxss（CSS 变量；wxss 无法 require JS，必须生成文件）
const themePath = path.join(ROOT, 'theme.wxss');
fs.writeFileSync(
  themePath,
  `/* ⚠️ 由 apply-tenant.js 生成，勿手改。租户: ${slug} */\npage {\n  --theme-primary: ${cfg.primaryColor};\n  --theme-on-primary: #ffffff;\n}\n`
);

// 5) 外科式改写 app.json（仅改租户字段，完整 pages 列表等内容保留不动）
const appJsonPath = path.join(ROOT, 'app.json');
let appJson;
try {
  appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
} catch (e) {
  console.error(`❌ 解析 app.json 失败: ${e.message}`);
  process.exit(1);
}

appJson.window.navigationBarTitleText = cfg.navBar.title;
appJson.window.navigationBarBackgroundColor = cfg.navBar.bgColor;
appJson.window.navigationBarTextStyle = cfg.navBar.textStyle;

appJson.tabBar.color = cfg.tabBar.color;
appJson.tabBar.selectedColor = cfg.tabBar.selectedColor;
appJson.tabBar.backgroundColor = cfg.tabBar.backgroundColor;

// TabBar list 顺序固定: [首页, 晨读营, 我的]（全租户一致）
const iconDirNorm = iconsDirRel;
const tabMap = [
  ['tab-home', 'tab-home-active'],
  ['tab-book', 'tab-book-active'],
  ['tab-my',   'tab-my-active']
];
appJson.tabBar.list.forEach((item, i) => {
  if (tabMap[i]) {
    item.iconPath = `${iconDirNorm}/${tabMap[i][0]}.png`;
    item.selectedIconPath = `${iconDirNorm}/${tabMap[i][1]}.png`;
  }
});

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

// 6) 改写 project.config.json(+private) 的 appid，并维护上传忽略规则
for (const name of ['project.config.json', 'project.private.config.json']) {
  const p = path.join(REPO, name);
  if (!fs.existsSync(p)) continue;
  let j;
  try {
    j = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`⚠️ 解析 ${name} 失败，跳过: ${e.message}`);
    continue;
  }
  j.appid = cfg.wxAppId;
  if (name === 'project.config.json') {
    upsertIgnoreEntries(j, [
      ...buildIgnoreEntries(),
      ...buildIgnoreEntries('miniprogram/')
    ]);
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}

const miniProjectConfigPath = path.join(ROOT, 'project.config.json');
if (fs.existsSync(miniProjectConfigPath)) {
  try {
    const miniProjectConfig = JSON.parse(fs.readFileSync(miniProjectConfigPath, 'utf8'));
    upsertIgnoreEntries(miniProjectConfig, buildIgnoreEntries());
    fs.writeFileSync(miniProjectConfigPath, JSON.stringify(miniProjectConfig, null, 2) + '\n');
  } catch (e) {
    console.warn(`⚠️ 解析 miniprogram/project.config.json 失败，跳过: ${e.message}`);
  }
}

// 7) 打印摘要供人工确认
console.log(`\n✅ 已切换到租户「${cfg.brandName}」[${slug}]`);
console.log(`   appId       : ${cfg.wxAppId}`);
console.log(`   cloudEnv    : ${cfg.cloudEnv || '（未启用）'}`);
console.log(`   primaryColor: ${cfg.primaryColor}`);
console.log(`   navBar      : ${cfg.navBar.bgColor} / "${cfg.navBar.title}"`);
console.log(`   ⚠️  上传前请再次确认目标 appId 与微信后台一致\n`);
