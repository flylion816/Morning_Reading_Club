/**
 * 测试环境全局设置
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * 连接测试数据库
 */
async function connectDB() {
  // 优先使用内存数据库
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
  }

  const mongoUri = mongoServer.getUri();

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
}

/**
 * 断开数据库连接
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * 清空数据库
 */
async function clearDB() {
  const { collections } = mongoose.connection;

  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
}

/**
 * 清空特定集合
 */
async function clearCollection(modelName) {
  const model = mongoose.model(modelName);
  await model.deleteMany({});
}

module.exports = {
  connectDB,
  disconnectDB,
  clearDB,
  clearCollection
};
