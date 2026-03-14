const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
// 注意：dotenv.config() 应该在 server.js 中调用，而不是在这里
// 这样可以确保正确的环境文件（.env 或 .env.production）被加载

// MongoDB连接
async function connectMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ MongoDB connection error:', error.message);
    throw error; // Let calling code handle gracefully
  }
}

// MySQL连接池配置
// 使用 .env 文件中配置的端口，不要自作聪明地推断
const getMySQLConfig = () => {
  const port = parseInt(process.env.MYSQL_PORT, 10) || 3306;

  return {
    host: process.env.MYSQL_HOST,
    port: port,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
};

const mysqlPool = mysql.createPool(getMySQLConfig());

// 测试MySQL连接
async function testMySQLConnection() {
  try {
    const connection = await mysqlPool.getConnection();
    logger.info('✅ MySQL connected successfully');
    connection.release();
  } catch (error) {
    logger.error('❌ MySQL connection error:', error);
    logger.error('MySQL 错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
  }
}

module.exports = {
  connectMongoDB,
  mysqlPool,
  testMySQLConnection
};
