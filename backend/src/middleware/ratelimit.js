const redisManager = require('../utils/redis');
const { errors } = require('../utils/response');
const logger = require('../utils/logger');
const { getCurrentTenantId } = require('../utils/tenantContext');

/**
 * API限流中间件
 *
 * 使用滑动窗口算法实现限流
 * 支持基于用户或IP的限流
 */

function rateLimitMiddleware(options = {}) {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = null,
    enabled = true
  } = options;

  return async (req, res, next) => {
    if (!enabled) {
      return next();
    }

    try {
      const key = keyGenerator
        ? keyGenerator(req)
        : `ratelimit:${req.user?._id || req.ip}:${req.path}`;

      const now = Date.now();
      const windowStart = now - windowMs;

      await redisManager.zRemRangeByScore(key, 0, windowStart);
      const requestCount = await redisManager.zCard(key);

      if (requestCount >= maxRequests) {
        logger.warn('请求频率超限', {
          key,
          current: requestCount,
          limit: maxRequests,
          userId: req.user?._id,
          path: req.path
        });

        return res.status(429).json(
          errors.tooManyRequests(
            `请求过于频繁，请稍后再试。限制: ${maxRequests}个请求/${Math.ceil(windowMs / 1000)}秒`
          )
        );
      }

      const requestId = `${now}-${Math.random()}`;
      await redisManager.zAdd(key, now, requestId);
      await redisManager.expire(key, Math.ceil(windowMs / 1000));

      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - requestCount - 1)));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));

      next();
    } catch (error) {
      logger.error('限流检查失败', error, { message: error.message });
      next();
    }
  };
}

// 全局限流：拆成"每租户配额"和"全平台兜底"双层
const tenantGlobalRateLimit = rateLimitMiddleware({
  windowMs: 60000,
  maxRequests: 1000,
  keyGenerator: (req) => {
    const tenantId = getCurrentTenantId();
    return tenantId ? `ratelimit:tenant:${tenantId}:all` : `ratelimit:global:all`;
  },
  enabled: true
});

const platformGlobalRateLimit = rateLimitMiddleware({
  windowMs: 60000,
  maxRequests: 5000,
  keyGenerator: (_req) => 'ratelimit:platform:all',
  enabled: true
});

// 用户限流：必须带 tenantId
const userRateLimit = rateLimitMiddleware({
  windowMs: 60000,
  maxRequests: 100,
  keyGenerator: (req) => {
    const tenantId = getCurrentTenantId();
    const subject = req.user?._id || req.ip;
    return tenantId
      ? `ratelimit:tenant:${tenantId}:user:${subject}`
      : `ratelimit:anonymous:${subject}`;
  },
  enabled: true
});

// 认证端点第一层：纯 IP 兜底
const authIpRateLimit = rateLimitMiddleware({
  windowMs: 300000,
  maxRequests: 20,
  keyGenerator: (req) => `ratelimit:auth:ip:${req.ip}`,
  enabled: true
});

// 认证端点第二层：wxAppId + IP 细粒度
const authRateLimit = rateLimitMiddleware({
  windowMs: 300000,
  maxRequests: 5,
  keyGenerator: (req) => {
    const wxAppId = req.body?.wxAppId
      || req.header('X-Wx-AppId')
      || (process.env.ENABLE_LEGACY_DEFAULT_TENANT === 'true' ? process.env.WECHAT_APPID : null)
      || 'unknown';
    return `ratelimit:auth:${wxAppId}:${req.ip}`;
  },
  enabled: true
});

// 向后兼容：保留旧的全局/用户/认证限流名
const globalRateLimit = tenantGlobalRateLimit;

module.exports = {
  rateLimitMiddleware,
  globalRateLimit,
  tenantGlobalRateLimit,
  platformGlobalRateLimit,
  userRateLimit,
  authIpRateLimit,
  authRateLimit
};
