const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
require('dotenv').config();

// MongoDB连接
async function connectMongoDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// MySQL连接池
const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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
