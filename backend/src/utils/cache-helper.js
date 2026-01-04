const redisManager = require('./redis');
const logger = require('./logger');

/**
 * 缓存助手工具
 *
 * 提供缓存键生成、失效等常用操作
 */

class CacheHelper {
  /**
   * 生成缓存键
   */
  static generateKey(prefix, ...args) {
    return `${prefix}:${args.join(':')}`;
  }

  /**
   * 清除匹配模式的缓存
   */
  static async clearByPattern(pattern) {
    try {
      const keys = await redisManager.keys(pattern);
      if (keys.length > 0) {
        await redisManager.mDel(keys);
        logger.info('缓存已清除', { pattern, count: keys.length });
      }
    } catch (error) {
      logger.error('清除缓存失败', error, { pattern });
    }
  }

  /**
   * 清除特定资源的缓存
   */
  static async clearResourceCache(resourceType, resourceId = null) {
    const pattern = resourceId
      ? `cache:${resourceType}:${resourceId}:*`
      : `cache:${resourceType}:*`;

    await this.clearByPattern(pattern);
  }

  /**
   * 清除所有缓存
   */
  static async clearAll() {
    try {
      const allKeys = await redisManager.keys('cache:*');
      if (allKeys.length > 0) {
        await redisManager.mDel(allKeys);
        logger.info('所有缓存已清除', { count: allKeys.length });
      }
    } catch (error) {
      logger.error('清除所有缓存失败', error);
    }
  }

  /**
   * 预热缓存（批量设置）
   */
  static async warmCache(items) {
    try {
      for (const { key, value, ttl = 3600 } of items) {
        await redisManager.setEx(key, ttl, JSON.stringify(value));
      }
      logger.info('缓存预热完成', { count: items.length });
    } catch (error) {
      logger.error('缓存预热失败', error);
    }
  }

  /**
   * 获取缓存统计
   */
  static async getStats() {
    try {
      const keys = await redisManager.keys('cache:*');
      return {
        totalKeys: keys.length,
        memory: process.memoryUsage()
      };
    } catch (error) {
      logger.error('获取缓存统计失败', error);
      return {
        totalKeys: 0,
        memory: process.memoryUsage()
      };
    }
  }
}

module.exports = CacheHelper;
