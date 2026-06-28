/**
 * 多租户上传脚本
 * 用法: node miniprogram/scripts/upload-tenant.js <slug> [version] [desc] [--sync]
 *   或: npm run tenant:upload -- <slug>
 *   或: npm run tenant:sync-upload -- <slug>
 *
 * 依赖: miniprogram-ci（需先在项目依赖中安装）
 * 私钥: 放在 miniprogram/keys/<slug>.key.pem（不入 git）
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const USAGE = '用法: node scripts/upload-tenant.js <slug> [version] [desc] [--sync] [--api-base-url https://wx.shubai01.com/api/v1] [--email admin@example.com] [--password xxx] [--token jwt] [--file tenant.json] [--mongo-uri mongodb://...]';

function createCliError(message, exitCode = 1, extraLines = []) {
  const error = new Error(message);
  error.exitCode = exitCode;
  error.extraLines = extraLines;
  error.isCliError = true;
  return error;
}

function loadMiniProgramCi(ci) {
  if (ci) return ci;
  try {
    return require('miniprogram-ci');
  } catch (e) {
    throw createCliError('miniprogram-ci 未安装，请运行: npm install --save-dev miniprogram-ci');
  }
}

function parseArgs(argv = process.argv) {
  const args = argv.slice(2);
  const options = {};
  const positionals = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--sync') {
      options.sync = true;
    } else if (arg === '--file') {
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
    } else if (arg.startsWith('--')) {
      throw createCliError(`未知参数: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  const slug = positionals.shift();
  return {
    slug,
    options: {
      ...options,
      version: positionals[0],
      desc: positionals[1]
    }
  };
}

async function uploadTenant(slug, options = {}) {
  if (!slug) {
    throw createCliError(USAGE);
  }

  const fsImpl = options.fs || fs;
  const spawnSyncImpl = options.spawnSync || spawnSync;
  const consoleImpl = options.console || console;
  const execPath = options.execPath || process.execPath;
  const now = options.now || new Date();

  const tenantConfigPath = path.join(__dirname, '../config/tenants', `${slug}.js`);
  if (options.sync) {
    const syncArgs = [path.join(__dirname, 'sync-tenant-config.js'), slug];
    if (options.file) syncArgs.push('--file', options.file);
    if (options.mongoUri) syncArgs.push('--mongo-uri', options.mongoUri);
    if (options.apiBaseUrl) syncArgs.push('--api-base-url', options.apiBaseUrl);
    if (options.token) syncArgs.push('--token', options.token);
    if (options.email) syncArgs.push('--email', options.email);
    if (options.password) syncArgs.push('--password', options.password);
    consoleImpl.log(`\n同步租户配置: ${slug}`);
    const syncResult = spawnSyncImpl(execPath, syncArgs, { stdio: 'inherit' });
    if (syncResult.status !== 0) {
      throw createCliError(`租户配置同步失败，退出码: ${syncResult.status || 1}`, syncResult.status || 1);
    }
  }

  if (!fsImpl.existsSync(tenantConfigPath)) {
    throw createCliError(`租户配置不存在: ${tenantConfigPath}。请先运行 tenant:sync 或使用 --sync`);
  }

  delete require.cache[require.resolve(tenantConfigPath)];
  const tenant = require(tenantConfigPath);
  const version = options.version || `1.0.0-${now.toISOString().slice(0, 10)}`;
  const desc = options.desc || `${tenant.brandName} 自动上传 ${now.toLocaleString('zh-CN')}`;

  const keyPath = path.join(__dirname, '../keys', `${slug}.key.pem`);
  if (!fsImpl.existsSync(keyPath)) {
    throw createCliError(`私钥文件不存在: ${keyPath}`, 1, [
      '请从微信公众平台下载代码上传密钥并放置到该路径（不要提交到 git）'
    ]);
  }

  const ci = loadMiniProgramCi(options.ci);

  consoleImpl.log(`\n上传租户: ${tenant.brandName} (${tenant.wxAppId})`);
  consoleImpl.log(`版本: ${version}`);
  consoleImpl.log(`描述: ${desc}\n`);

  const applyResult = spawnSyncImpl(execPath, [path.join(__dirname, 'apply-tenant.js'), slug], {
    stdio: 'inherit'
  });
  if (applyResult.status !== 0) {
    throw createCliError(`租户配置应用失败，退出码: ${applyResult.status || 1}`, applyResult.status || 1);
  }

  const project = new ci.Project({
    appid: tenant.wxAppId,
    type: 'miniProgram',
    projectPath: path.join(__dirname, '../..'),
    privateKeyPath: keyPath,
    ignores: ['node_modules/**/*']
  });

  const result = await ci.upload({
    project,
    version,
    desc,
    setting: {
      es6: true,
      minify: true,
      autoPrefixWXSS: true
    },
    onProgressUpdate(task) {
      if (task._status === 'done') {
        consoleImpl.log(`✅ ${task._msg || '上传完成'}`);
      }
    }
  });

  consoleImpl.log('\n✅ 上传成功！');
  consoleImpl.log('结果:', JSON.stringify(result, null, 2));
  return result;
}

async function runCli(argv = process.argv) {
  try {
    const { slug, options } = parseArgs(argv);
    await uploadTenant(slug, options);
  } catch (err) {
    if (err.isCliError) {
      console.error(err.message);
      (err.extraLines || []).forEach(line => console.error(line));
      process.exit(err.exitCode || 1);
      return;
    }
    console.error('\n❌ 上传失败:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  parseArgs,
  uploadTenant,
  runCli
};
