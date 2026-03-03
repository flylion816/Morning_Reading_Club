#!/usr/bin/env node

/**
 * 从 .env.config.js 生成 .env.production 文件
 *
 * 用途：
 *   - 本地开发时生成 Docker 用的环境变量
 *   - 服务器部署时生成生产环境 .env.production
 *
 * 使用方法：
 *   node scripts/generate-env-production.js [--docker] [--server]
 *
 * 参数：
 *   --docker   生成用于 docker-compose 的 .env（默认）
 *   --server   生成用于服务器的 .env.production
 */

const fs = require('fs');
const path = require('path');

// 读取配置
const envConfigPath = path.resolve(__dirname, '../.env.config.js');
const config = require(envConfigPath);

// 获取生产环境配置
const prodConfig = config.envConfig.prod;
const mongoConfig = prodConfig.backend;
const mysqlConfig = prodConfig.mysql;
const redisConfig = prodConfig.redis;

console.log('📝 从 .env.config.js 生成生产环境配置...\n');
console.log('✓ 读取配置文件:', envConfigPath);
console.log('✓ 环境:', config.currentEnv.toUpperCase());
console.log('✓ Node.js 版本:', mongoConfig.nodeEnv);

/**
 * 生成 .env.production（服务器用）
 */
function generateServerEnv() {
  const envContent = `# ========================================
# 晨读营后端 - 生产环境配置
# ========================================
# ⚠️  注意：此文件包含敏感信息，请勿提交到Git
# 此文件由 scripts/generate-env-production.js 从 .env.config.js 自动生成

# 应用配置
NODE_ENV=production
PORT=3000
API_BASE_URL=https://wx.shubai01.com

# MongoDB 配置 (Docker 容器地址 127.0.0.1)
MONGODB_URI=${mongoConfig.mongodbUri}

# MySQL 配置 (Docker 映射端口)
MYSQL_HOST=localhost
MYSQL_PORT=${mysqlConfig.port}
MYSQL_USER=${mysqlConfig.user}
MYSQL_PASSWORD=${mysqlConfig.password}
MYSQL_DATABASE=${mysqlConfig.database}

# Redis 配置 (Docker 映射端口)
REDIS_HOST=localhost
REDIS_PORT=${redisConfig.port}
REDIS_PASSWORD=${redisConfig.password}

# JWT 配置
JWT_SECRET=0f405b99aefbbb7e304e0a82b2ca9db14d0cb4ed02fdecbb57192e6c330a0a06
JWT_REFRESH_SECRET=8ffd042c189499bf2c4af4fcb89d983d6b65ee050ca6e99a5a387d0443eed52c
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=30d

# 微信小程序配置
WECHAT_APPID=wx2b9a3c1d5e4195f8
WECHAT_SECRET=36b3d2538c006e63971ba4a83905eb8b

# 日志级别
LOG_LEVEL=info

# Admin 后台 URL (用于CORS配置)
ADMIN_URL=https://wx.shubai01.com

# 小程序 URL (用于CORS配置)
MINIPROGRAM_URL=https://wx.shubai01.com
`;

  return envContent;
}

/**
 * 生成 .env.docker（本地开发 docker-compose 用）
 */
function generateDockerEnv() {
  // 为了 Docker 内部通信，MongoDB 地址应该使用服务名 'mongodb'
  const mongodbUriDocker = mongoConfig.mongodbUri.replace('127.0.0.1', 'mongodb');

  const envContent = `# ========================================
# 晨读营 - Docker 环境配置
# ========================================
# 用于本地 docker-compose 启动
# 使用方法: docker-compose -f deploy/docker-compose.prod.yml --env-file .env.docker up -d

# MongoDB
MONGO_USER=admin
MONGO_PASSWORD=ProdMongodbSecure123
MONGO_PORT=27017

# MySQL
MYSQL_ROOT_PASSWORD=${mysqlConfig.rootPassword}
MYSQL_USER=${mysqlConfig.user}
MYSQL_PASSWORD=${mysqlConfig.password}
MYSQL_PORT=3306

# Redis
REDIS_PASSWORD=${redisConfig.password}
REDIS_PORT=6379

# 后端应用配置
NODE_ENV=production
PORT=3000
API_BASE_URL=http://localhost:3000
LOG_LEVEL=info

# MongoDB 连接字符串（Docker 内部使用服务名）
MONGODB_URI=${mongodbUriDocker}

# MySQL 配置
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=${mysqlConfig.database}

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379

# JWT 配置
JWT_SECRET=0f405b99aefbbb7e304e0a82b2ca9db14d0cb4ed02fdecbb57192e6c330a0a06
JWT_REFRESH_SECRET=8ffd042c189499bf2c4af4fcb89d983d6b65ee050ca6e99a5a387d0443eed52c
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=30d

# 微信小程序配置
WECHAT_APPID=wx2b9a3c1d5e4195f8
WECHAT_SECRET=36b3d2538c006e63971ba4a83905eb8b

# CORS 配置
ADMIN_URL=http://localhost:5173
MINIPROGRAM_URL=http://localhost

# 管理后台配置
VITE_API_BASE_URL=http://localhost:3000/api/v1
`;

  return envContent;
}

// 解析命令行参数
const args = process.argv.slice(2);
const generateServer = args.includes('--server');
const generateDocker = args.includes('--docker') || args.length === 0;

if (generateServer) {
  const outputPath = path.resolve(__dirname, '../backend/.env.production');
  const content = generateServerEnv();

  try {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log('\n✓ 生成完成:', outputPath);
    console.log('✓ 文件大小:', (content.length / 1024).toFixed(2), 'KB');
    console.log('\n💡 提示：此文件包含敏感信息，请勿提交到 Git');
  } catch (error) {
    console.error('❌ 生成失败:', error.message);
    process.exit(1);
  }
}

if (generateDocker) {
  const outputPath = path.resolve(__dirname, '../.env.docker');
  const content = generateDockerEnv();

  try {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log('\n✓ 生成完成:', outputPath);
    console.log('✓ 文件大小:', (content.length / 1024).toFixed(2), 'KB');
    console.log('\n💡 使用方法:');
    console.log('   docker-compose -f deploy/docker-compose.prod.yml --env-file .env.docker up -d');
  } catch (error) {
    console.error('❌ 生成失败:', error.message);
    process.exit(1);
  }
}

console.log('\n✓ 所有配置生成完成！');
