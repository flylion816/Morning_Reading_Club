#!/usr/bin/env node
/**
 * 多租户上传脚本
 * 用法: node miniprogram/scripts/upload-tenant.js <slug> [version] [desc]
 *   或: npm run tenant:upload -- <slug>
 *
 * 依赖: miniprogram-ci（需先 npm install -g miniprogram-ci 或在 devDependencies 中安装）
 * 私钥: 放在 miniprogram/keys/<slug>.key.pem（不入 git）
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const USAGE = '用法: node scripts/upload-tenant.js <slug> [version] [desc]';

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
    throw createCliError('miniprogram-ci 未安装，请运行: npm install -g miniprogram-ci');
  }
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
  if (!fsImpl.existsSync(tenantConfigPath)) {
    throw createCliError(`租户配置不存在: ${tenantConfigPath}`);
  }

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
    await uploadTenant(argv[2], {
      version: argv[3],
      desc: argv[4]
    });
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
  uploadTenant,
  runCli
};
