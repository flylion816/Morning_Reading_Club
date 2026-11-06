#!/usr/bin/env node

/**
 * Generate deployment env files from explicitly injected environment variables.
 *
 * Usage:
 *   MONGODB_URI=... JWT_SECRET=... ... node scripts/generate-env-production.js --server
 *   MONGO_USER=... MONGO_PASSWORD=... ... node scripts/generate-env-production.js --docker
 *
 * No production secret is read from .env.config.js and no fallback secret is
 * generated. Missing required values fail before a file is written.
 */

const fs = require('fs');
const path = require('path');

function required(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be provided through the environment`);
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

const { line, composeLine } = require('./env-file');

const signingKeys = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_WS_SECRET',
  'JWT_ADMIN_SECRET',
  'JWT_ADMIN_REFRESH_SECRET'
];

function collectCommonSecrets() {
  const values = Object.fromEntries(signingKeys.map(name => [name, required(name)]));
  values.WECHAT_APPID = required('WECHAT_APPID');
  values.WECHAT_SECRET = required('WECHAT_SECRET');
  values.EXTERNAL_API_KEY_ENCRYPTION_KEY = required('EXTERNAL_API_KEY_ENCRYPTION_KEY');
  values.ADMIN_DEFAULT_PASSWORD = required('ADMIN_DEFAULT_PASSWORD');
  values.ADMIN_DB_ACCESS_PASSWORD = required('ADMIN_DB_ACCESS_PASSWORD');
  return values;
}

function generateServerEnv() {
  const common = collectCommonSecrets();
  const mongodbUri = required('MONGODB_URI');
  const mysqlUser = required('MYSQL_USER');
  const mysqlPassword = required('MYSQL_PASSWORD');
  const mysqlDatabase = required('MYSQL_DATABASE');
  const redisPassword = required('REDIS_PASSWORD');

  return [
    '# Generated from explicitly injected deployment environment variables.',
    '# Do not commit this file.',
    line('NODE_ENV', 'production'),
    line('PORT', optional('PORT', '3000')),
    line('API_BASE_URL', required('API_BASE_URL')),
    line('MONGODB_URI', mongodbUri),
    line('MYSQL_HOST', optional('MYSQL_HOST', 'localhost')),
    line('MYSQL_PORT', optional('MYSQL_PORT', '3306')),
    line('MYSQL_USER', mysqlUser),
    line('MYSQL_PASSWORD', mysqlPassword),
    line('MYSQL_DATABASE', mysqlDatabase),
    line('REDIS_HOST', optional('REDIS_HOST', 'localhost')),
    line('REDIS_PORT', optional('REDIS_PORT', '26379')),
    line('REDIS_PASSWORD', redisPassword),
    line('JWT_SECRET', common.JWT_SECRET),
    line('JWT_REFRESH_SECRET', common.JWT_REFRESH_SECRET),
    line('JWT_WS_SECRET', common.JWT_WS_SECRET),
    line('JWT_ADMIN_SECRET', common.JWT_ADMIN_SECRET),
    line('JWT_ADMIN_REFRESH_SECRET', common.JWT_ADMIN_REFRESH_SECRET),
    line('JWT_EXPIRES_IN', optional('JWT_EXPIRES_IN', '2h')),
    line('JWT_REFRESH_EXPIRES_IN', optional('JWT_REFRESH_EXPIRES_IN', '30d')),
    line('WECHAT_APPID', common.WECHAT_APPID),
    line('WECHAT_SECRET', common.WECHAT_SECRET),
    line('WECHAT_MCH_ID', optional('WECHAT_MCH_ID', '')),
    line('WECHAT_API_KEY', optional('WECHAT_API_KEY', '')),
    line('WECHAT_API_V3_KEY', optional('WECHAT_API_V3_KEY', '')),
    line('EXTERNAL_API_KEY_ENCRYPTION_KEY', common.EXTERNAL_API_KEY_ENCRYPTION_KEY),
    line('ADMIN_URL', required('ADMIN_URL')),
    line('MINIPROGRAM_URL', required('MINIPROGRAM_URL')),
    line('ADMIN_DEFAULT_PASSWORD', common.ADMIN_DEFAULT_PASSWORD),
    line('ADMIN_DB_ACCESS_PASSWORD', common.ADMIN_DB_ACCESS_PASSWORD),
    line('LOG_LEVEL', optional('LOG_LEVEL', 'info')),
    ''
  ].join('\n');
}

function generateDockerEnv() {
  const common = collectCommonSecrets();
  const mongoUser = required('MONGO_USER');
  const mongoPassword = required('MONGO_PASSWORD');
  const mysqlRootPassword = required('MYSQL_ROOT_PASSWORD');
  const mysqlUser = required('MYSQL_USER');
  const mysqlPassword = required('MYSQL_PASSWORD');
  const redisPassword = required('REDIS_PASSWORD');
  const mongoDatabase = optional('MONGO_DATABASE', 'morning_reading');

  const mongodbUri = `mongodb://${encodeURIComponent(mongoUser)}:${encodeURIComponent(mongoPassword)}@mongodb:27017/${encodeURIComponent(mongoDatabase)}?authSource=admin`;

  return [
    '# Generated from explicitly injected deployment environment variables.',
    '# Do not commit this file.',
    composeLine('MONGO_USER', mongoUser),
    composeLine('MONGO_PASSWORD', mongoPassword),
    composeLine('MONGO_DATABASE', mongoDatabase),
    composeLine('MONGO_PORT', optional('MONGO_PORT', '27017')),
    composeLine('MYSQL_ROOT_PASSWORD', mysqlRootPassword),
    composeLine('MYSQL_USER', mysqlUser),
    composeLine('MYSQL_PASSWORD', mysqlPassword),
    composeLine('MYSQL_DATABASE', optional('MYSQL_DATABASE', 'morning_reading')),
    composeLine('MYSQL_PORT', optional('MYSQL_PORT', '3306')),
    composeLine('REDIS_PASSWORD', redisPassword),
    composeLine('REDIS_PORT', optional('REDIS_PORT', '6379')),
    composeLine('NODE_ENV', optional('NODE_ENV', 'production')),
    composeLine('PORT', optional('PORT', '3000')),
    composeLine('BACKEND_PORT', optional('BACKEND_PORT', '3000')),
    composeLine('API_BASE_URL', required('API_BASE_URL')),
    composeLine('MONGODB_URI', mongodbUri),
    composeLine('JWT_SECRET', common.JWT_SECRET),
    composeLine('JWT_REFRESH_SECRET', common.JWT_REFRESH_SECRET),
    composeLine('JWT_WS_SECRET', common.JWT_WS_SECRET),
    composeLine('JWT_ADMIN_SECRET', common.JWT_ADMIN_SECRET),
    composeLine('JWT_ADMIN_REFRESH_SECRET', common.JWT_ADMIN_REFRESH_SECRET),
    composeLine('JWT_EXPIRES_IN', optional('JWT_EXPIRES_IN', '2h')),
    composeLine('JWT_REFRESH_EXPIRES_IN', optional('JWT_REFRESH_EXPIRES_IN', '30d')),
    composeLine('WECHAT_APPID', common.WECHAT_APPID),
    composeLine('WECHAT_SECRET', common.WECHAT_SECRET),
    composeLine('WECHAT_MCH_ID', optional('WECHAT_MCH_ID', '')),
    composeLine('WECHAT_API_KEY', optional('WECHAT_API_KEY', '')),
    composeLine('WECHAT_API_V3_KEY', optional('WECHAT_API_V3_KEY', '')),
    composeLine('EXTERNAL_API_KEY_ENCRYPTION_KEY', common.EXTERNAL_API_KEY_ENCRYPTION_KEY),
    composeLine('ADMIN_URL', required('ADMIN_URL')),
    composeLine('MINIPROGRAM_URL', required('MINIPROGRAM_URL')),
    composeLine('ADMIN_DEFAULT_PASSWORD', common.ADMIN_DEFAULT_PASSWORD),
    composeLine('ADMIN_DB_ACCESS_PASSWORD', common.ADMIN_DB_ACCESS_PASSWORD),
    composeLine('LOG_LEVEL', optional('LOG_LEVEL', 'info')),
    ''
  ].join('\n');
}

const args = process.argv.slice(2);
const generateServer = args.includes('--server');
const generateDocker = args.includes('--docker') || args.length === 0;

if (!generateServer && !generateDocker) {
  console.error('Usage: generate-env-production.js [--server] [--docker]');
  process.exit(2);
}

try {
  if (generateServer) {
    const outputPath = path.resolve(__dirname, '../backend/.env.production');
    fs.writeFileSync(outputPath, generateServerEnv(), { encoding: 'utf8' });
    fs.chmodSync(outputPath, 0o600);
    console.log(`Generated ${outputPath}`);
  }

  if (generateDocker) {
    const outputPath = path.resolve(__dirname, '../.env.docker');
    fs.writeFileSync(outputPath, generateDockerEnv(), { encoding: 'utf8' });
    fs.chmodSync(outputPath, 0o600);
    console.log(`Generated ${outputPath}`);
  }
} catch (error) {
  console.error(`Generation failed: ${error.message}`);
  process.exit(1);
}
