/**
 * 环境配置验证器
 * 在应用启动时验证所有必需的环境变量
 */

const chalk = require('chalk');
const logger = require('./logger');

// 必需的环境变量
const REQUIRED_ENV = {
  NODE_ENV: 'development|production|staging',
  PORT: 'number',
  MONGODB_URI: 'mongodb-uri',
  JWT_SECRET: 'string',
  JWT_REFRESH_SECRET: 'string'
};

// 可选的环境变量（带默认值）
const OPTIONAL_ENV = {
  API_BASE_URL: 'http://localhost:3000',
  JWT_EXPIRES_IN: '2h',
  JWT_REFRESH_EXPIRES_IN: '30d',
  LOG_LEVEL: 'info',
  WECHAT_APPID: 'wx199d6d332344ed0a'
};

/**
 * 验证环境变量格式
 */
function validateEnvValue(key, value, expectedType) {
  if (!value) {
    return false;
  }

  switch (expectedType) {
    case 'number':
      return !Number.isNaN(parseInt(value, 10));
    case 'mongodb-uri':
      return /^mongodb(\+srv)?:\/\/.+/.test(value);
    case 'development|production|staging':
      return ['development', 'production', 'staging', 'test'].includes(value);
    case 'string':
      return typeof value === 'string' && value.length > 0;
    default:
      return true;
  }
}

/**
 * 验证所有环境变量
 */
function validateConfig() {
  // 在测试模式下跳过验证，使用默认值
  if (process.env.NODE_ENV === 'test') {
    logger.debug('跳过环境变量验证 (测试模式)');
    // 为测试模式设置必要的默认值
    process.env.PORT = process.env.PORT || '3000';
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-12345678';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-87654321';
    return true;
  }

  // Keep console output for config validation as it's startup-critical
  logger.info('\n' + chalk.cyan.bold('═══════════════════════════════════════════'));
  logger.info(chalk.cyan.bold('   环境配置验证'));
  logger.info(chalk.cyan.bold('═══════════════════════════════════════════\n'));

  let hasErrors = false;
  let checkedCount = 0;
  let successCount = 0;

  // 检查必需的环境变量
  logger.info(chalk.yellow.bold('📋 必需的环境变量:'));
  Object.entries(REQUIRED_ENV).forEach(([key, expectedType]) => {
    const value = process.env[key];
    checkedCount++;

    if (!value) {
      logger.info(`  ${chalk.red('✗')} ${chalk.red(key)}: 未设置`);
      logger.error(`Environment validation failed: ${key} is not set`);
      hasErrors = true;
    } else if (!validateEnvValue(key, value, expectedType)) {
      logger.info(`  ${chalk.red('✗')} ${chalk.red(key)}: 格式无效 (期望: ${expectedType})`);
      logger.error(`Environment validation failed: ${key} has invalid format`, { expectedType });
      hasErrors = true;
    } else {
      // 隐藏敏感信息
      const displayValue = key.includes('SECRET') ? '●●●●●●●●' : value;
      logger.info(`  ${chalk.green('✓')} ${chalk.green(key)}: ${displayValue}`);
      successCount++;
    }
  });

  // 检查可选的环境变量
  logger.info(chalk.yellow.bold('\n📋 可选的环境变量:'));
  Object.entries(OPTIONAL_ENV).forEach(([key, defaultValue]) => {
    const value = process.env[key] || defaultValue;
    checkedCount++;

    if (process.env[key]) {
      logger.info(`  ${chalk.blue('✓')} ${chalk.blue(key)}: ${value}`);
      successCount++;
    } else {
      logger.info(`  ${chalk.cyan('⚠')} ${chalk.cyan(key)}: 使用默认值 (${defaultValue})`);
      logger.info(`Using default value for ${key}`, { defaultValue });
      successCount++;
    }
  });

  logger.info('\n' + chalk.cyan.bold('═══════════════════════════════════════════\n'));

  if (hasErrors) {
    logger.info(chalk.red.bold('❌ 配置验证失败!'));
    logger.info(chalk.red('请检查以上错误的环境变量。\n'));
    logger.error('Configuration validation failed', { checkedCount, successCount });
    process.exit(1);
  }

  logger.info(chalk.green.bold(`✅ 配置验证成功! (${successCount}/${checkedCount})\n`));
  logger.info('Configuration validation passed', { checkedCount, successCount });
  return true;
}

/**
 * 获取验证后的配置
 */
function getValidatedConfig() {
  validateConfig();

  return {
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT, 10) || 3000,
      apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000'
    },
    db: {
      mongodbUri: process.env.MONGODB_URI,
      mysql: {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
        user: process.env.MYSQL_USER || 'morning_user',
        password: process.env.MYSQL_PASSWORD || 'morning123',
        database: process.env.MYSQL_DATABASE || 'morning_reading'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 26379
      }
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '2h',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    },
    wechat: {
      appId: process.env.WECHAT_APPID || 'wx199d6d332344ed0a',
      secret: process.env.WECHAT_SECRET
    },
    log: {
      level: process.env.LOG_LEVEL || 'info'
    }
  };
}

module.exports = {
  validateConfig,
  getValidatedConfig,
  REQUIRED_ENV,
  OPTIONAL_ENV
};
