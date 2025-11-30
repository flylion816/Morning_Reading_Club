const app = require('./app');
const { connectMongoDB, testMySQLConnection } = require('./config/database');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// 启动服务器
async function startServer() {
  try {
    // 连接MongoDB
    await connectMongoDB();

    // 测试MySQL连接
    await testMySQLConnection();

    // 启动HTTP服务器，绑定到所有网卡（包括局域网 IP）
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
      console.log(`📚 API Base URL: http://localhost:${PORT}/api/v1`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Accessible from local network on any IP:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

// 启动
startServer();
