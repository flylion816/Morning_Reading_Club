const { Server } = require('socket.io');
const path = require('path');
const app = require('./app');
const { connectMongoDB, testMySQLConnection } = require('./config/database');
const { getSocketIoCorsOptions } = require('./config/cors');
const { validateConfig } = require('./utils/config-validator');
const logger = require('./utils/logger');
const WebSocketManager = require('./utils/websocket');

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

// 然后加载 .env 文件（会被上面的 process.env 设置覆盖）
require('dotenv').config();

// 验证环境配置
validateConfig();

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
    // 连接MongoDB
    logger.info('正在连接 MongoDB...');
    await connectMongoDB();
    logger.info('✅ MongoDB 连接成功');

    // 测试MySQL连接
    logger.info('正在测试 MySQL 连接...');
    await testMySQLConnection();
    logger.info('✅ MySQL 连接测试通过');

    // 启动HTTP服务器
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
  // eslint-disable-next-line no-process-exit
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('应用接收到 SIGTERM 信号，正在优雅关闭...');
  logger.info('\n\n👋 Shutting down gracefully...');
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
