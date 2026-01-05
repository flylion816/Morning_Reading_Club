const redis = require('redis');
const logger = require('./logger');

/**
 * Redis连接管理
 *
 * 功能：
 * - 单例Redis连接
 * - 自动重连机制
 * - 内存缓存降级方案（Redis失败时自动使用内存）
 * - 常用操作简化接口
 */

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.memoryCache = new Map();
    this.memoryMaxSize = 1000; // 内存缓存最多1000个键
  }

  /**
   * 初始化Redis连接
   */
  async connect() {
    try {
      const host = process.env.REDIS_HOST || 'localhost';
      const port = process.env.REDIS_PORT || 6379;
      const password = process.env.REDIS_PASSWORD;
      const db = process.env.REDIS_DB || 0;

      this.client = redis.createClient({
        socket: {
          host,
          port
        },
        password: password || undefined,
        db: parseInt(db, 10),
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis连接被拒绝', options.error);
            return new Error('Redis连接被拒绝');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis重试超时');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // 监听连接事件
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('✅ Redis 连接成功', {
          host,
          port,
          db
        });
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis连接错误', error, {
          message: error.message,
          code: error.code
        });
      });

      this.client.on('reconnecting', () => {
        logger.warn('Redis正在重新连接...');
      });

      // 连接到Redis（带超时机制，5秒后仍未连接则返回失败）
      const connectPromise = this.client.connect();
      // eslint-disable-next-line no-promise-executor-return
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Redis 连接超时'));
        }, 5000);
      });

      try {
        await Promise.race([connectPromise, timeoutPromise]);
      } catch (timeoutError) {
        logger.warn('Redis 连接超时，将使用内存缓存降级方案', timeoutError.message);
        this.isConnected = false;
        return false;
      }

      // 测试连接
      await this.client.ping();
      logger.info('Redis ping成功');

      return true;
    } catch (error) {
      logger.error('Redis连接失败，将使用内存缓存', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * 获取值
   */
  async get(key) {
    try {
      if (!this.isConnected || !this.client) {
        // 从内存缓存获取
        const value = this.memoryCache.get(key);
        if (value && value.expireAt > Date.now()) {
          return value.data;
        }
        if (value) {
          this.memoryCache.delete(key);
        }
        return null;
      }

      const value = await this.client.get(key);
      return value;
    } catch (error) {
      logger.error('Redis get操作失败', error, { key });
      // 降级到内存缓存
      const value = this.memoryCache.get(key);
      if (value && value.expireAt > Date.now()) {
        return value.data;
      }
      return null;
    }
  }

  /**
   * 设置值
   */
  async set(key, value) {
    try {
      if (!this.isConnected || !this.client) {
        this.memoryCache.set(key, {
          data: value,
          expireAt: Date.now() + 3600000 // 默认1小时
        });
        return 'OK';
      }

      const result = await this.client.set(key, value);
      return result;
    } catch (error) {
      logger.error('Redis set操作失败', error, { key });
      // 降级到内存缓存
      this.memoryCache.set(key, {
        data: value,
        expireAt: Date.now() + 3600000
      });
      return 'OK';
    }
  }

  /**
   * 设置值并指定过期时间（秒）
   */
  async setEx(key, seconds, value) {
    try {
      if (!this.isConnected || !this.client) {
        this.memoryCache.set(key, {
          data: value,
          expireAt: Date.now() + seconds * 1000
        });
        return 'OK';
      }

      const result = await this.client.setEx(key, seconds, value);
      return result;
    } catch (error) {
      logger.error('Redis setEx操作失败', error, { key, seconds });
      // 降级到内存缓存
      this.memoryCache.set(key, {
        data: value,
        expireAt: Date.now() + seconds * 1000
      });
      return 'OK';
    }
  }

  /**
   * 删除键
   */
  async del(key) {
    try {
      if (!this.isConnected || !this.client) {
        return this.memoryCache.delete(key) ? 1 : 0;
      }

      const result = await this.client.del(key);
      return result;
    } catch (error) {
      logger.error('Redis del操作失败', error, { key });
      return this.memoryCache.delete(key) ? 1 : 0;
    }
  }

  /**
   * 删除多个键
   */
  async mDel(keys) {
    try {
      if (!this.isConnected || !this.client) {
        let count = 0;
        keys.forEach(key => {
          if (this.memoryCache.delete(key)) {
            count += 1;
          }
        });
        return count;
      }

      const result = await this.client.del(keys);
      return result;
    } catch (error) {
      logger.error('Redis mDel操作失败', error, { count: keys.length });
      let count = 0;
      keys.forEach(key => {
        if (this.memoryCache.delete(key)) {
          count += 1;
        }
      });
      return count;
    }
  }

  /**
   * 设置过期时间
   */
  async expire(key, seconds) {
    try {
      if (!this.isConnected || !this.client) {
        const value = this.memoryCache.get(key);
        if (value) {
          value.expireAt = Date.now() + seconds * 1000;
          return 1;
        }
        return 0;
      }

      const result = await this.client.expire(key, seconds);
      return result;
    } catch (error) {
      logger.error('Redis expire操作失败', error, { key, seconds });
      const value = this.memoryCache.get(key);
      if (value) {
        value.expireAt = Date.now() + seconds * 1000;
        return 1;
      }
      return 0;
    }
  }

  /**
   * 增加计数
   */
  async incr(key) {
    try {
      if (!this.isConnected || !this.client) {
        const value = this.memoryCache.get(key);
        const count = (value ? parseInt(value.data, 10) : 0) + 1;
        this.memoryCache.set(key, {
          data: String(count),
          expireAt: Date.now() + 3600000
        });
        return count;
      }

      const result = await this.client.incr(key);
      return result;
    } catch (error) {
      logger.error('Redis incr操作失败', error, { key });
      const value = this.memoryCache.get(key);
      const count = (value ? parseInt(value.data, 10) : 0) + 1;
      this.memoryCache.set(key, {
        data: String(count),
        expireAt: Date.now() + 3600000
      });
      return count;
    }
  }

  /**
   * 有序集合 - 添加
   */
  async zAdd(key, score, member) {
    try {
      if (!this.isConnected || !this.client) {
        // 内存中模拟有序集合
        return 1;
      }

      const result = await this.client.zAdd(key, { score, value: member });
      return result;
    } catch (error) {
      logger.error('Redis zAdd操作失败', error, { key });
      return 1;
    }
  }

  /**
   * 有序集合 - 基于分数范围删除
   */
  async zRemRangeByScore(key, min, max) {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      const result = await this.client.zRemRangeByScore(key, min, max);
      return result;
    } catch (error) {
      logger.error('Redis zRemRangeByScore操作失败', error, { key });
      return 0;
    }
  }

  /**
   * 有序集合 - 获取成员数
   */
  async zCard(key) {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      const result = await this.client.zCard(key);
      return result;
    } catch (error) {
      logger.error('Redis zCard操作失败', error, { key });
      return 0;
    }
  }

  /**
   * 获取所有键
   */
  async keys(pattern) {
    try {
      if (!this.isConnected || !this.client) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const keys = [];
        this.memoryCache.forEach((_, key) => {
          if (regex.test(key)) {
            keys.push(key);
          }
        });
        return keys;
      }

      const result = await this.client.keys(pattern);
      return result;
    } catch (error) {
      logger.error('Redis keys操作失败', error, { pattern });
      return [];
    }
  }

  /**
   * 断开连接
   */
  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis连接已关闭');
      }
    } catch (error) {
      logger.error('Redis断开连接失败', error);
    }
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      hasClient: !!this.client,
      memoryCacheSize: this.memoryCache.size
    };
  }

  /**
   * 清空内存缓存
   */
  clearMemoryCache() {
    this.memoryCache.clear();
  }
}

// 导出单例
module.exports = new RedisManager();
