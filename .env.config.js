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
 * - 本地开发：NODE_ENV=development（或不设置）→ currentEnv = 'dev'
 * - 线上环境：NODE_ENV=production → currentEnv = 'prod'
 *
 * ⚠️ 重要：修改此文件后需要重启所有服务才能生效
 * ✅ currentEnv 会根据 NODE_ENV 自动决定，无需手动修改
 */

// ✅ 自动根据 NODE_ENV 决定环境（最安全的方式）
const currentEnv = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

/**
 * 环境配置定义
 * 每个环境包含完整的配置信息
 */
const envConfig = {
  dev: {
    // 后端配置
    backend: {
      // 本地开发环境：使用 localhost MongoDB（开发级别密码）
      mongodbUri: 'mongodb://127.0.0.1:27017/morning_reading_db',
      nodeEnv: 'development',
      port: 3000,
    },
    // MySQL 配置（本地开发环境）
    mysql: {
      host: '127.0.0.1',
      port: 3306,
      user: 'morning_user',
      password: 'morning123',
      database: 'morning_reading',
      rootPassword: 'root-password',
    },
    // Redis 配置（本地开发环境）
    redis: {
      host: '127.0.0.1',
      port: 6379,
      password: '',
      db: 0,
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
    // 管理员账户配置（开发环境）
    adminUser: {
      email: 'admin@morningreading.com',
      defaultPassword: 'admin123456',
      dbAccessPassword: 'admin123456',
    },
  },
  prod: {
    // 后端配置
    backend: {
      // 线上环境：Docker 容器中的 MongoDB（避免 URI 中包含特殊字符，使用简化密码）
      mongodbUri: 'mongodb://admin:ProdMongodbSecure123@127.0.0.1:27017/morning_reading?authSource=admin',
      nodeEnv: 'production',
      port: 3000,
    },
    // MySQL 配置（线上 Docker 环境）
    mysql: {
      host: 'localhost',
      port: 3306,  // Docker 映射端口（统一为 3306）
      user: 'root',
      password: 'Prod_Root@Secure123!',
      database: 'morning_reading',
      rootPassword: 'Prod_Root@Secure123!',
    },
    // Redis 配置（线上 Docker 环境）
    redis: {
      host: 'localhost',
      port: 26379,
      password: 'Redis@Prod@User0816!',
      db: 0,
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
    // 管理员账户配置（生产环境 - 使用强密码）
    adminUser: {
      email: 'admin@morningreading.com',
      defaultPassword: 'Km7$Px2Qw9',
      dbAccessPassword: 'Jb3#Rl8Tn5',
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
