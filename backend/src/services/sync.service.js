/**
 * MongoDB ↔ MySQL 实时同步服务（基于 Redis List）
 * 
 * 职责：
 * - 使用 Redis List 作为消息队列
 * - 异步处理同步任务
 * - 支持重试机制
 * - 确保数据一致性
 */

const redis = require('redis');
const { mysqlPool } = require('../config/database');
const logger = require('../utils/logger');

let redisClient = null;

// =========================================================================
// 1. 初始化 Redis 客户端
// =========================================================================
async function initRedisClient() {
  try {
    redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis sync queue connected');
    });

    await new Promise((resolve) => {
      redisClient.ping((err, res) => {
        if (err) {
          logger.error('Redis ping failed', err);
          redisClient = null;
          resolve();
        } else {
          logger.info('Redis ping successful');
          resolve();
        }
      });
    });

    return !!redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis client', error);
    redisClient = null;
    return false;
  }
}

// =========================================================================
// 2. 发布同步事件到 Redis 队列
// =========================================================================
function publishSyncEvent(event) {
  try {
    const eventData = {
      type: event.type,        // 'create', 'update', 'delete'
      collection: event.collection,
      documentId: event.documentId,
      data: event.data,        // 完整的文档数据
      timestamp: Date.now(),
      retries: 0               // 重试次数
    };

    if (!redisClient) {
      logger.warn('Redis client not available, skipping sync event');
      return;
    }

    // 异步推入队列（不阻塞主线程）
    setImmediate(() => {
      redisClient.lpush(
        'mongodb:sync:queue',
        JSON.stringify(eventData),
        (err) => {
          if (err) {
            logger.error('Failed to push sync event to Redis queue', err);
          } else {
            logger.info('Sync event queued', {
              collection: event.collection,
              type: event.type,
              documentId: event.documentId
            });
          }
        }
      );
    });
  } catch (error) {
    logger.error('Failed to publish sync event', error);
  }
}

// =========================================================================
// 3. 同步单条记录到 MySQL（核心同步逻辑）
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
// 4. 将 MongoDB 文档转换为 MySQL 格式
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
// 5. 启动队列消费者（持续处理同步任务）
// =========================================================================
function startSyncListener() {
  if (!redisClient) {
    logger.warn('Redis client not available, sync listener not started');
    return;
  }

  // 持续消费队列中的任务
  const processQueue = async () => {
    while (true) {
      try {
        // 从队列右端弹出任务（FIFO）
        const task = await new Promise((resolve) => {
          redisClient.rpop('mongodb:sync:queue', (err, reply) => {
            resolve(reply);
          });
        });

        if (!task) {
          // 队列为空，等待 100ms 后继续
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        try {
          const event = JSON.parse(task);

          logger.info('Processing sync event from queue', {
            collection: event.collection,
            type: event.type,
            documentId: event.documentId,
            retries: event.retries
          });

          // 同步到 MySQL
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
          } else {
            // 同步失败，重试（最多 3 次）
            if (event.retries < 3) {
              event.retries++;
              logger.warn('Sync failed, retrying', {
                collection: event.collection,
                documentId: event.documentId,
                retries: event.retries
              });
              
              // 重新推入队列
              await new Promise((resolve) => {
                redisClient.lpush(
                  'mongodb:sync:queue',
                  JSON.stringify(event),
                  () => resolve()
                );
              });
            } else {
              logger.error('Sync failed after 3 retries, giving up', {
                collection: event.collection,
                documentId: event.documentId
              });
            }
          }
        } catch (parseError) {
          logger.error('Failed to parse sync event', parseError);
        }
      } catch (error) {
        logger.error('Error in sync queue processor', error);
        // 等待后继续
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // 启动异步处理（不阻塞主线程）
  setImmediate(() => processQueue());

  logger.info('MongoDB→MySQL sync listener started (Redis List)');
}

module.exports = {
  initRedisClient,
  publishSyncEvent,
  syncDocumentToMySQL,
  transformDocumentForMySQL,
  startSyncListener
};
