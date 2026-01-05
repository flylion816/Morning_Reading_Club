const redisManager = require('../utils/redis');
const { errors } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * API限流中间件
 *
 * 使用滑动窗口算法实现限流
 * 支持基于用户或IP的限流
 */

function rateLimitMiddleware(options = {}) {
  const {
    windowMs = 60000, // 1分钟窗口
    maxRequests = 100, // 最多100个请求
    keyGenerator = null, // 自定义限流键生成
    enabled = true
  } = options;

  return async (req, res, next) => {
    // 如果禁用限流，直接跳过
    if (!enabled) {
      return next();
    }

    try {
      // 生成限流键（基于用户或IP）
      const key = keyGenerator
        ? keyGenerator(req)
        : `ratelimit:${req.user?._id || req.ip}:${req.path}`;

      // 使用滑动窗口算法
      const now = Date.now();
      const windowStart = now - windowMs;

      // 移除过期的请求记录
      await redisManager.zRemRangeByScore(key, 0, windowStart);

      // 获取窗口内的请求数
      const requestCount = await redisManager.zCard(key);

      // 检查是否超过限流阈值
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

      // 记录本次请求到有序集合
      const requestId = `${now}-${Math.random()}`;
      await redisManager.zAdd(key, now, requestId);

      // 设置键的过期时间
      await redisManager.expire(key, Math.ceil(windowMs / 1000));

      // 在响应头中添加限流信息
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - requestCount - 1)));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));

      next();
    } catch (error) {
      // Redis失败时放行（避免阻塞正常请求）
      logger.error('限流检查失败', error, { message: error.message });
      next();
    }
  };
}

/**
 * 全局限流配置
 * 用于整个API的全局限流
 */
const globalRateLimit = rateLimitMiddleware({
  windowMs: 60000, // 1分钟
  maxRequests: 1000, // 整个API最多1000请求/分钟
  keyGenerator: (_req) => 'ratelimit:global:all',
  enabled: true
});

/**
 * 用户级别限流
 * 针对单个用户的限流
 */
const userRateLimit = rateLimitMiddleware({
  windowMs: 60000, // 1分钟
  maxRequests: 100, // 每个用户最多100请求/分钟
  keyGenerator: (req) => `ratelimit:user:${req.user?._id || req.ip}`,
  enabled: true
});

/**
 * 认证端点限流
 * 针对登录等认证端点的严格限流
 */
const authRateLimit = rateLimitMiddleware({
  windowMs: 300000, // 5分钟
  maxRequests: 5, // 每个IP最多5次尝试/5分钟
  keyGenerator: (req) => `ratelimit:auth:${req.ip}`,
  enabled: true
});

module.exports = {
  rateLimitMiddleware,
  globalRateLimit,
  userRateLimit,
  authRateLimit
};
