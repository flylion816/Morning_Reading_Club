#!/usr/bin/env node

/**
 * 初始化超级管理员
 * 通过调用 API 端点 POST /api/v1/auth/admin/init 来创建 superadmin 账户
 *
 * 多环境支持：
 * - 开发环境：npm run init:dev  (自动使用 .env 配置)
 * - 生产环境：NODE_ENV=production npm run init:prod  (自动使用 .env.production 配置)
 *
 * 此脚本会读取当前环境的正确密码配置
 */

const path = require('path');
const http = require('http');

// ⚠️ 重要：根据 NODE_ENV 加载对应的环境文件
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production'
  ? path.join(__dirname, '../.env.production')
  : path.join(__dirname, '../.env');

require('dotenv').config({ path: envFile });

// 加载 .env.config.js 获取配置（作为备选）
let adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123456';
let dbPassword = process.env.ADMIN_DB_ACCESS_PASSWORD || 'admin123456';
let environment = process.env.NODE_ENV || 'development';

try {
  const envConfigPath = path.resolve(__dirname, '../../.env.config.js');
  const envConfig = require(envConfigPath);

  // 优先使用已加载的环境变量，只在环境变量为默认值时才使用配置文件
  if (!process.env.ADMIN_DEFAULT_PASSWORD && envConfig.config.adminUser) {
    adminPassword = envConfig.config.adminUser.defaultPassword;
  }
  if (!process.env.ADMIN_DB_ACCESS_PASSWORD && envConfig.config.adminUser) {
    dbPassword = envConfig.config.adminUser.dbAccessPassword;
  }
} catch (error) {
  // 无法加载 .env.config.js，继续使用环境变量中的值
}

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function initSuperAdmin() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('📝 初始化超级管理员');
    console.log('='.repeat(60));
    console.log(`🔗 调用 API: POST http://localhost:3000/api/v1/auth/admin/init`);
    console.log(`📍 环境: ${environment}`);
    console.log('');

    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/admin/init',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`📊 API 状态码: ${response.status}`);

    if (response.body.code === 200) {
      console.log('');
      console.log('✅ 超级管理员创建成功！');
      console.log('');
      console.log('📧 邮箱: ' + response.body.data.email);
      console.log('🔑 登录密码: ' + adminPassword);
      console.log('🔐 数据库访问密码: ' + dbPassword);
      console.log('👤 角色: superadmin');
      console.log('');
      console.log('💡 提示：使用邮箱和登录密码登录 Admin 管理后台');
      console.log('📋 数据库访问密码用于访问数据库相关功能');
      console.log('');
      console.log('='.repeat(60) + '\n');
    } else if (response.body.code === 400) {
      console.log('');
      console.log('⚠️  ' + response.body.message);
      console.log('   （可能是因为已存在管理员账号）');
      console.log('');
      console.log('💡 现有管理员信息：');
      console.log('📧 邮箱: admin@morningreading.com');
      console.log('🔑 登录密码: ' + adminPassword);
      console.log('🔐 数据库访问密码: ' + dbPassword);
      console.log('');
    } else {
      console.error('❌ API 返回错误:', response.body);
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.log('');
    console.log('💡 提示：确保后端服务已启动');
    console.log('   开发环境: npm run dev');
    console.log('   生产环境: NODE_ENV=production npm start');
    process.exit(1);
  }
}

// 执行初始化
initSuperAdmin();
