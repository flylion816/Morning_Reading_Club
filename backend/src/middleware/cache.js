const redisManager = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * 响应缓存中间件
 *
 * 功能：
 * - 缓存GET请求的响应
 * - 自定义TTL和缓存键生成
 * - Redis失败时自动降级
 */

function cacheMiddleware(options = {}) {
  const {
    ttl = 300, // 默认5分钟
    keyGenerator, // 自定义缓存键生成函数
    enabled = true
  } = options;

  return async (req, res, next) => {
    // 如果禁用或不是GET请求，直接跳过
    if (!enabled || req.method !== 'GET') {
      return next();
    }

    try {
      // 生成缓存键
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : `cache:${req.path}:${JSON.stringify(req.query)}`;

      // 尝试从缓存获取
      const cached = await redisManager.get(cacheKey);
      if (cached) {
        logger.debug('缓存命中', { path: req.path, key: cacheKey });
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      res.set('X-Cache', 'MISS');

      // 拦截res.json方法
      const originalJson = res.json;
      res.json = function (data) {
        // 保存到缓存（异步，不等待）
        redisManager.setEx(cacheKey, ttl, JSON.stringify(data))
          .catch(err => logger.warn('缓存写入失败', { error: err.message }));

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.warn('缓存中间件执行失败', { error: error.message });
      next();
    }
  };
}

/**
 * 缓存失效中间件
 * 用于POST/PUT/DELETE请求时清除相关缓存
 */
function cacheInvalidationMiddleware(patterns = []) {
  return async (req, res, next) => {
    // 保存原始的res.json方法
    const originalJson = res.json;

    res.json = function (data) {
      // 对于修改操作（POST/PUT/DELETE），清除相关缓存
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        // 清除匹配的缓存键
        patterns.forEach(pattern => {
          redisManager.mDel(
            [`cache:${pattern}:*`].map(p => {
              // 简单的模式匹配
              return p.replace(/\*/g, '.*');
            })
          ).catch(err => logger.warn('缓存清除失败', { error: err.message }));
        });

        logger.debug('缓存已失效', {
          method: req.method,
          path: req.path,
          patterns
        });
      }

      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = {
  cacheMiddleware,
  cacheInvalidationMiddleware
};
