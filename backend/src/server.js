const { Server } = require('socket.io');
const path = require('path');
const app = require('./app');
const { connectMongoDB, testMySQLConnection } = require('./config/database');
const { getSocketIoCorsOptions } = require('./config/cors');
const { validateConfig } = require('./utils/config-validator');
const ConfigSyncValidator = require('./utils/config-sync-validator');
const logger = require('./utils/logger');
const WebSocketManager = require('./utils/websocket');
const redisManager = require('./utils/redis');
const { initRedisClient, startSyncListener } = require('./services/sync.service');

// 尝试加载根目录的统一环境配置
try {
  const envConfigPath = path.resolve(__dirname, '../../.env.config.js');
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const envConfig = require(envConfigPath);

  // 根据统一配置设置 NODE_ENV 和 MONGODB_URI
  process.env.NODE_ENV = process.env.NODE_ENV || envConfig.config.backend.nodeEnv;
  process.env.MONGODB_URI = process.env.MONGODB_URI || envConfig.config.backend.mongodbUri;
} catch (error) {
  logger.warn('未找到统一环境配置文件 .env.config.js，将使用 .env 文件');
}

// 先加载 .env.local（本地开发覆盖）
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// 然后加载 .env 文件（会被上面的 process.env 设置覆盖）
require('dotenv').config();

// 验证环境配置
validateConfig();

// 配置同步检查：验证前后端环境配置是否一致
ConfigSyncValidator.validateConfigSync();

const PORT = process.env.PORT || 3000;

// 记录应用启动配置
logger.info('应用启动配置', {
  environment: process.env.NODE_ENV || 'development',
  port: PORT,
  nodeVersion: process.version
});

// 启动服务器
async function startServer() {
  try {
    // 初始化Redis连接（后台异步，不阻塞启动）
    logger.info('正在连接 Redis...');
    // 异步连接 Redis，不阻塞应用启动
    redisManager
      .connect()
      .then(() => {
        logger.info('✅ Redis 连接成功');
      })
      .catch(error => {
        logger.warn('⚠️ Redis 连接失败，将使用内存缓存作为降级方案', error.message);
      });

    // 连接MongoDB
    logger.info('正在连接 MongoDB...');
    try {
      await connectMongoDB();
      logger.info('✅ MongoDB 连接成功');
    } catch (dbError) {
      logger.warn('⚠️ MongoDB 连接失败，应用将继续运行但数据库功能不可用', dbError.message);
    }

    // 测试MySQL连接
    logger.info('正在测试 MySQL 连接...');
    try {
      await testMySQLConnection();
      logger.info('✅ MySQL 连接测试通过');
    } catch (dbError) {
      logger.warn('⚠️ MySQL 连接测试失败，应用将继续运行但MySQL功能不可用', dbError.message);
    }

    // 启动HTTP服务器（先启动，不等待 Redis）
    const server = app.listen(PORT, () => {
      logger.info('服务器已启动', {
        url: `http://localhost:${PORT}`,
        apiBaseUrl: `http://localhost:${PORT}/api/v1`,
        healthCheck: `http://localhost:${PORT}/api/v1/health`,
        environment: process.env.NODE_ENV || 'development'
      });

      // 保留控制台输出用于本地开发
      logger.info(`\n🚀 Server is running on http://localhost:${PORT}`);
      logger.info(`📚 API Base URL: http://localhost:${PORT}/api/v1`);
      logger.info(`🏥 Health check: http://localhost:${PORT}/api/v1/health`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });

    // 初始化 WebSocket (Socket.IO)
    const io = new Server(server, {
      cors: getSocketIoCorsOptions()
    });

    const wsManager = new WebSocketManager(io);

    // 将 WebSocket 管理器附加到 app，以便其他模块可以访问
    app.locals.wsManager = wsManager;
    app.locals.io = io;

    logger.info('✅ WebSocket (Socket.IO) 已初始化');

    // 后台初始化 Redis（不阻塞 HTTP 服务器启动）
    logger.info('正在后台初始化 Redis 同步队列...');
    initRedisClient()
      .then(redisReady => {
        if (redisReady) {
          logger.info('✅ Redis 同步队列初始化成功');
          // 启动 MongoDB 同步监听器
          logger.info('正在启动 MongoDB→MySQL 实时同步...');
          startSyncListener();
        } else {
          logger.warn('⚠️ Redis 初始化失败，同步功能将不可用');
        }
      })
      .catch(error => {
        logger.warn('⚠️ Redis 初始化异常，同步功能将不可用', error.message);
      });

    // 设置服务器监听所有网卡
    server.on('listening', () => {
      const addr = server.address();
      logger.info('服务器监听端口', { port: addr.port });
    });

    // 处理未捕获的异常
    process.on('uncaughtException', error => {
      logger.error('未捕获的异常', error, { type: 'uncaughtException' });
    });

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝', reason, { promise: promise.toString() });
    });
  } catch (error) {
    logger.error('服务器启动失败', error, {
      message: error.message,
      code: error.code
    });
    logger.error('❌ Failed to start server:', error);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  logger.info('应用接收到 SIGINT 信号，正在优雅关闭...');
  logger.info('\n\n👋 Shutting down gracefully...');
  // 断开Redis连接
  await redisManager.disconnect();
  // eslint-disable-next-line no-process-exit
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('应用接收到 SIGTERM 信号，正在优雅关闭...');
  logger.info('\n\n👋 Shutting down gracefully...');
  // 断开Redis连接
  await redisManager.disconnect();
  // eslint-disable-next-line no-process-exit
  process.exit(0);
});

// 应用退出时记录
process.on('exit', code => {
  logger.info('应用已关闭', { exitCode: code });
});

// 启动服务器（仅在非测试环境）
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// 导出 app 供测试和其他模块使用
module.exports = app;
