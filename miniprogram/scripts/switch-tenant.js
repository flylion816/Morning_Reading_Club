#!/usr/bin/env node

// Interactive wrapper around apply-tenant.js.
// Press Enter to use the default tenant, or pass/input a tenant slug.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const MINI_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MINI_ROOT, '..');
const TENANTS_DIR = path.join(MINI_ROOT, 'config', 'tenants');
const DEFAULT_SLUG = process.env.DEFAULT_TENANT_SLUG || 'fanren';

function listTenantSlugs() {
  return fs.readdirSync(TENANTS_DIR)
    .filter(file => file.endsWith('.js') && !file.startsWith('_'))
    .map(file => file.replace(/\.js$/, ''))
    .sort();
}

function loadTenant(slug) {
  const tenantPath = path.join(TENANTS_DIR, `${slug}.js`);
  delete require.cache[require.resolve(tenantPath)];
  return require(tenantPath);
}

function loadCurrentTenant() {
  try {
    const currentTenantPath = path.join(MINI_ROOT, 'config', 'current-tenant.js');
    delete require.cache[require.resolve(currentTenantPath)];
    return require(currentTenantPath);
  } catch (error) {
    return null;
  }
}

function formatTenant(slug) {
  try {
    const tenant = loadTenant(slug);
    return `${slug} (${tenant.brandName || tenant.wxAppId || '未命名'})`;
  } catch (error) {
    return slug;
  }
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function resolveSlug() {
  const cliSlug = (process.argv[2] || '').trim();
  if (cliSlug) {
    return cliSlug;
  }

  const currentTenant = loadCurrentTenant();
  const currentText = currentTenant
    ? `${currentTenant.slug} (${currentTenant.brandName || currentTenant.wxAppId || '未命名'})`
    : '未生成';

  console.log(`当前租户: ${currentText}`);
  console.log(`可用租户: ${listTenantSlugs().map(formatTenant).join(', ')}`);

  const input = await ask(`请输入租户 slug，直接回车使用默认 ${DEFAULT_SLUG}: `);
  return (input || DEFAULT_SLUG).trim() || DEFAULT_SLUG;
}

async function main() {
  const availableSlugs = listTenantSlugs();
  const slug = await resolveSlug();

  if (!availableSlugs.includes(slug)) {
    console.error(`\n租户 slug 不存在: ${slug}`);
    console.error(`可用租户: ${availableSlugs.join(', ')}`);
    process.exit(1);
  }

  const targetTenant = loadTenant(slug);
  console.log(`\n准备切换到: ${slug} (${targetTenant.brandName || targetTenant.wxAppId || '未命名'})`);

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'apply-tenant.js'), slug],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit'
    }
  );

  if (result.error) {
    console.error(`切换失败: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  const projectConfig = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'project.config.json'), 'utf8'));
  const currentTenant = loadCurrentTenant();

  console.log('当前构建态确认:');
  console.log(`  project.config.json appid: ${projectConfig.appid}`);
  console.log(`  current-tenant       : ${currentTenant.slug} / ${currentTenant.brandName}`);
  console.log(`  wxAppId              : ${currentTenant.wxAppId}`);
  console.log(`  primaryColor         : ${currentTenant.primaryColor}`);
}

main().catch(error => {
  console.error(`切换失败: ${error.message}`);
  process.exit(1);
});
