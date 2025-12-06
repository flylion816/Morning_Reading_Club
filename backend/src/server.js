const app = require('./app');
const { connectMongoDB, testMySQLConnection } = require('./config/database');
const { getSocketIoCorsOptions } = require('./config/cors');
const { validateConfig } = require('./utils/config-validator');
const logger = require('./utils/logger');
const { Server } = require('socket.io');
const WebSocketManager = require('./utils/websocket');
require('dotenv').config();

// 验证环境配置
validateConfig();

const PORT = process.env.PORT || 3000;

// 记录应用启动配置
logger.info('应用启动配置', {
  environment: process.env.NODE_ENV || 'development',
  port: PORT,
  nodeVersion: process.version,
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
        environment: process.env.NODE_ENV || 'development',
      });

      // 保留控制台输出用于本地开发
      console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📚 API Base URL: http://localhost:${PORT}/api/v1`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/v1/health`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });

    // 初始化 WebSocket (Socket.IO)
    const io = new Server(server, {
      cors: getSocketIoCorsOptions(),
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
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常', error, { type: 'uncaughtException' });
    });

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝', reason, { promise: promise.toString() });
    });
  } catch (error) {
    logger.error('服务器启动失败', error, {
      message: error.message,
      code: error.code,
    });
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  logger.info('应用接收到 SIGINT 信号，正在优雅关闭...');
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('应用接收到 SIGTERM 信号，正在优雅关闭...');
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

// 应用退出时记录
process.on('exit', (code) => {
  logger.info('应用已关闭', { exitCode: code });
});

// 启动
startServer();
