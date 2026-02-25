/**
 * MongoDB ↔ MySQL 实时同步服务
 * 
 * 职责：
 * - 监听 MongoDB 更新事件
 * - 异步同步到 MySQL
 * - 使用事件驱动模式（EventEmitter）
 */

const EventEmitter = require('events');
const { mysqlPool } = require('../config/database');
const logger = require('../utils/logger');

// 全局事件发射器
const syncEmitter = new EventEmitter();
syncEmitter.setMaxListeners(20);

// =========================================================================
// 1. 发布同步事件
// =========================================================================
function publishSyncEvent(event) {
  try {
    const eventData = {
      type: event.type,      // 'update', 'create', 'delete'
      collection: event.collection,
      documentId: event.documentId,
      data: event.data,      // 完整的文档数据
      timestamp: Date.now()
    };

    // 异步发射事件（不阻塞主线程）
    setImmediate(() => {
      syncEmitter.emit('mongodb:update', eventData);
    });

    logger.info('Sync event queued', {
      collection: event.collection,
      type: event.type,
      documentId: event.documentId
    });
  } catch (error) {
    logger.error('Failed to publish sync event', error);
  }
}

// =========================================================================
// 2. 同步单条记录到 MySQL（核心同步逻辑）
// =========================================================================
async function syncDocumentToMySQL(collection, documentId, data) {
  try {
    const conn = await mysqlPool.getConnection();

    try {
      // 将 MongoDB 文档字段映射到 MySQL
      const mysqlData = transformDocumentForMySQL(collection, data);

      // 更新或插入
      const placeholders = Object.keys(mysqlData).map(() => '?').join(',');
      const columns = Object.keys(mysqlData).join(',');
      const updateClauses = Object.keys(mysqlData)
        .map(col => `${col}=VALUES(${col})`)
        .join(',');

      const query = `
        INSERT INTO \`${collection}\` (${columns})
        VALUES (${placeholders})
        ON DUPLICATE KEY UPDATE ${updateClauses}
      `;

      const values = Object.values(mysqlData);
      await conn.query(query, values);

      logger.info('Document synced to MySQL', {
        collection,
        documentId,
        columns: Object.keys(mysqlData)
      });

      return true;
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error(`Failed to sync ${collection}/${documentId} to MySQL`, error);
    return false;
  }
}

// =========================================================================
// 3. 将 MongoDB 文档转换为 MySQL 格式
// =========================================================================
function transformDocumentForMySQL(collection, doc) {
  const result = {
    id: doc._id.toString() // MongoDB ObjectId → 字符串
  };

  // 遍历文档字段，转换为 MySQL 列名（camelCase → snake_case）
  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id' || key === '__v') continue;

    // camelCase 转 snake_case
    const mysqlColumnName = key.replace(/([A-Z])/g, '_$1').toLowerCase();

    // 处理特殊类型
    if (typeof value === 'boolean') {
      result[mysqlColumnName] = value ? 1 : 0;
    } else if (value instanceof Date) {
      result[mysqlColumnName] = value.toISOString();
    } else if (typeof value === 'object' && value !== null) {
      // 对象存储为 JSON 字符串
      result[mysqlColumnName] = JSON.stringify(value);
    } else {
      result[mysqlColumnName] = value;
    }
  }

  return result;
}

// =========================================================================
// 4. 启动事件监听器（在服务启动时调用）
// =========================================================================
function startSyncListener() {
  // 监听 MongoDB 更新事件
  syncEmitter.on('mongodb:update', async (event) => {
    try {
      logger.info('Processing sync event', {
        collection: event.collection,
        type: event.type,
        documentId: event.documentId
      });

      // 同步到 MySQL（异步处理，不阻塞）
      const success = await syncDocumentToMySQL(
        event.collection,
        event.documentId,
        event.data
      );

      if (success) {
        logger.info('Sync completed successfully', {
          collection: event.collection,
          documentId: event.documentId
        });
      }
    } catch (error) {
      logger.error('Error processing sync event', error);
    }
  });

  logger.info('MongoDB→MySQL sync listener started (EventEmitter)');
}

module.exports = {
  publishSyncEvent,
  syncDocumentToMySQL,
  transformDocumentForMySQL,
  startSyncListener
};
