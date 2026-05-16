const redisManager = require('../utils/redis');
const logger = require('../utils/logger');
const { getCurrentTenantId } = require('../utils/tenantContext');

/**
 * 缓存 key 默认生成：带 tenant 前缀隔离
 * 无 tenantId 时返回 null 跳过缓存（不报错）
 */
function buildDefaultKey(req) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    return null;
  }
  return `cache:tenant:${tenantId}:${req.path}:${JSON.stringify(req.query)}`;
}

/**
 * 响应缓存中间件
 */
function cacheMiddleware(options = {}) {
  const {
    ttl = 300,
    keyGenerator,
    enabled = true
  } = options;

  return async (req, res, next) => {
    if (!enabled || req.method !== 'GET') {
      return next();
    }

    try {
      const cacheKey = keyGenerator
        ? keyGenerator(req)
        : buildDefaultKey(req);

      if (!cacheKey) {
        // 没有租户上下文 → 不缓存（也不报错，让请求正常通过）
        res.set('X-Cache', 'SKIP_NO_TENANT');
        return next();
      }

      const cached = await redisManager.get(cacheKey);
      if (cached) {
        logger.debug('缓存命中', { path: req.path, key: cacheKey });
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }

      res.set('X-Cache', 'MISS');

      const originalJson = res.json;
      res.json = function (data) {
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
 * 缓存失效中间件（按租户前缀删除）
 */
function cacheInvalidationMiddleware(patterns = []) {
  return async (req, res, next) => {
    const originalJson = res.json;

    res.json = function (data) {
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const tenantId = getCurrentTenantId();
        if (tenantId) {
          patterns.forEach(pattern => {
            redisManager.delByPrefix(`cache:tenant:${tenantId}:${pattern}`)
              .catch(err => logger.warn('缓存清除失败', { error: err.message }));
          });
        }
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
