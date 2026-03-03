const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
require('dotenv').config();

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
// 在 production 环境下，MYSQL_PORT 应该使用 Docker 映射端口（13306）
// 在 development 环境下，使用 localhost:3306
const getMySQLConfig = () => {
  let port = parseInt(process.env.MYSQL_PORT, 10) || 3306;

  // 如果 MYSQL_PORT 没有被正确设置，根据环境推断
  if (process.env.NODE_ENV === 'production' && port === 3306) {
    port = 13306; // Docker 映射端口
  }

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
    logger.error('❌ MySQL connection error:', error.message);
  }
}

module.exports = {
  connectMongoDB,
  mysqlPool,
  testMySQLConnection
};
