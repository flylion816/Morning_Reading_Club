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

const slug = process.argv[2];
if (!slug) {
  console.error('用法: node scripts/upload-tenant.js <slug> [version] [desc]');
  process.exit(1);
}

const tenantConfigPath = path.join(__dirname, '../config/tenants', `${slug}.js`);
if (!fs.existsSync(tenantConfigPath)) {
  console.error(`租户配置不存在: ${tenantConfigPath}`);
  process.exit(1);
}

const tenant = require(tenantConfigPath);
const version = process.argv[3] || `1.0.0-${new Date().toISOString().slice(0, 10)}`;
const desc = process.argv[4] || `${tenant.brandName} 自动上传 ${new Date().toLocaleString('zh-CN')}`;

const keyPath = path.join(__dirname, '../keys', `${slug}.key.pem`);
if (!fs.existsSync(keyPath)) {
  console.error(`私钥文件不存在: ${keyPath}`);
  console.error('请从微信公众平台下载代码上传密钥并放置到该路径（不要提交到 git）');
  process.exit(1);
}

let ci;
try {
  ci = require('miniprogram-ci');
} catch (e) {
  console.error('miniprogram-ci 未安装，请运行: npm install -g miniprogram-ci');
  process.exit(1);
}

async function upload() {
  console.log(`\n上传租户: ${tenant.brandName} (${tenant.wxAppId})`);
  console.log(`版本: ${version}`);
  console.log(`描述: ${desc}\n`);

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
        console.log(`✅ ${task._msg || '上传完成'}`);
      }
    }
  });

  console.log('\n✅ 上传成功！');
  console.log('结果:', JSON.stringify(result, null, 2));
}

upload().catch(err => {
  console.error('\n❌ 上传失败:', err.message || err);
  process.exit(1);
});
