/**
 * 项目统一环境配置文件
 *
 * 在这个文件中配置单个 currentEnv 值，可以同时控制：
 * 1. 后端加载哪个环境的数据库
 * 2. 管理后台连接哪个环境的服务
 *
 * 📌 注意：小程序环境由 miniprogram/config/env.js 独立控制
 *
 * 使用方法：
 * - 本地开发：设置 currentEnv = 'dev'（后端连接 localhost 数据库）
 * - 线上环境：设置 currentEnv = 'prod'（后端连接线上数据库）
 *
 * ⚠️ 重要：修改此文件后需要重启所有服务才能生效
 */

const currentEnv = 'dev'; // 'dev' | 'prod'

/**
 * 环境配置定义
 * 每个环境包含完整的配置信息
 */
const envConfig = {
  dev: {
    // 后端配置
    backend: {
      mongodbUri: 'mongodb://admin:admin123@localhost:27017/morning_reading_db?authSource=admin',
      nodeEnv: 'development',
      port: 3000,
    },
    // 小程序配置
    miniprogram: {
      apiBaseUrl: 'http://localhost:3000/api/v1',
      wxAppId: 'wx199d6d332344ed0a',
      enableDebug: true,
      enableLog: true,
    },
    // 管理后台配置
    admin: {
      apiBaseUrl: 'http://localhost:3000/api/v1',
      enableDebug: true,
    },
  },
  prod: {
    // 后端配置
    backend: {
      mongodbUri: 'mongodb://admin:p62CWhV0Kd1Unq@127.0.0.1:27017/morning_reading?authSource=admin',
      nodeEnv: 'production',
      port: 3000,
    },
    // 小程序配置
    miniprogram: {
      apiBaseUrl: 'https://wx.shubai01.com/api/v1',
      wxAppId: 'wx2b9a3c1d5e4195f8',
      enableDebug: false,
      enableLog: false,
    },
    // 管理后台配置
    admin: {
      apiBaseUrl: 'https://wx.shubai01.com/api/v1',
      enableDebug: false,
    },
  },
};

/**
 * 验证 currentEnv 是否有效
 */
if (!envConfig[currentEnv]) {
  throw new Error(
    `Invalid currentEnv: "${currentEnv}". Valid values are: ${Object.keys(envConfig).join(', ')}`
  );
}

/**
 * 导出配置
 * 其他模块通过 require('./.env.config.js') 来使用这些配置
 */
module.exports = {
  currentEnv,
  config: envConfig[currentEnv],
  envConfig,
};
