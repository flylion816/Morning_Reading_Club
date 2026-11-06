const crypto = require('crypto');
const redisManager = require('../utils/redis');
const { errors } = require('../utils/response');
const logger = require('../utils/logger');
const { getCurrentTenantId } = require('../utils/tenantContext');

const testOnlyRateLimitBuckets = new Map();
const ATOMIC_RATE_LIMIT_SCRIPT = [
  'redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, ARGV[1])',
  'local count = redis.call("ZCARD", KEYS[1])',
  'if count >= tonumber(ARGV[4]) then return {0, count} end',
  'redis.call("ZADD", KEYS[1], ARGV[2], ARGV[3])',
  'redis.call("EXPIRE", KEYS[1], tonumber(ARGV[5]))',
  'return {1, count}'
].join('\n');

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
    enabled = true,
    failClosed = false
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

      let requestCount;
      let requestAllowed = true;
      if (failClosed && process.env.NODE_ENV === 'test' && (!redisManager.isConnected || !redisManager.client)) {
        const recent = (testOnlyRateLimitBuckets.get(key) || []).filter(timestamp => timestamp > windowStart);
        requestCount = recent.length;
        requestAllowed = requestCount < maxRequests;
        if (requestAllowed) recent.push(now);
        testOnlyRateLimitBuckets.set(key, recent);
      } else if (failClosed) {
        if (!redisManager.isConnected || !redisManager.client) {
          return res.status(503).json(errors.serverError('当前无法验证请求频率，请稍后重试'));
        }
        const result = await redisManager.client.eval(ATOMIC_RATE_LIMIT_SCRIPT, {
          keys: [key],
          arguments: [String(windowStart), String(now), `${now}-${crypto.randomUUID()}`, String(maxRequests), String(Math.ceil(windowMs / 1000))]
        });
        requestAllowed = Number(result[0]) === 1;
        requestCount = Number(result[1]);
      } else {
        await redisManager.zRemRangeByScore(key, 0, windowStart);
        requestCount = await redisManager.zCard(key);
      }

      if (!requestAllowed || requestCount >= maxRequests) {
        logger.warn('请求频率超限', {
          keyHash: crypto.createHash('sha256').update(key).digest('hex').slice(0, 12),
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

      if (!failClosed || !(process.env.NODE_ENV === 'test' && (!redisManager.isConnected || !redisManager.client))) {
        if (!failClosed) {
          const requestId = `${now}-${crypto.randomUUID()}`;
          await redisManager.zAdd(key, now, requestId);
          await redisManager.expire(key, Math.ceil(windowMs / 1000));
        }
      }

      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - requestCount - 1)));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));

      next();
    } catch (error) {
      logger.error('限流检查失败', { name: error.name, failClosed });
      if (failClosed) {
        return res.status(503).json(errors.serverError('当前无法验证请求频率，请稍后重试'));
      }
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
  enabled: true,
  failClosed: true
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
  enabled: true,
  failClosed: true
});

const adminLoginIpRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: req => `ratelimit:admin-login:ip:${req.ip}`,
  failClosed: true
});

const adminLoginIdentityRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  keyGenerator: req => {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    const identityHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 24);
    return `ratelimit:admin-login:identity:${req.ip}:${identityHash}`;
  },
  failClosed: true
});

const adminRefreshIpRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  keyGenerator: req => `ratelimit:admin-refresh:ip:${req.ip}`,
  failClosed: true
});

const adminMaintenanceRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 120,
  keyGenerator: req => `ratelimit:admin-maintenance:${req.admin?.id || 'unknown'}:${req.ip}`,
  failClosed: true
});

const adminUploadRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyGenerator: req => `ratelimit:admin-upload:${req.admin?.id || 'unknown'}:${req.ip}`,
  failClosed: true
});

const externalIntegrationRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyGenerator: req => {
    const tenantId = getCurrentTenantId() || 'unresolved';
    const keyId = String(req.get('x-integration-key-id') || 'unresolved').slice(0, 80);
    return `ratelimit:external:${tenantId}:${keyId}:${req.ip}`;
  },
  failClosed: true
});

// 向后兼容：保留旧的全局/用户/认证限流名
const globalRateLimit = tenantGlobalRateLimit;

module.exports = {
  resetTestRateLimitBuckets() {
    if (process.env.NODE_ENV !== 'test' && !process.env.MOCHA_TEST) throw new Error('Rate-limit reset is test-only');
    testOnlyRateLimitBuckets.clear();
  },
  rateLimitMiddleware,
  globalRateLimit,
  tenantGlobalRateLimit,
  platformGlobalRateLimit,
  userRateLimit,
  authIpRateLimit,
  authRateLimit,
  adminLoginIpRateLimit,
  adminLoginIdentityRateLimit,
  adminRefreshIpRateLimit,
  adminMaintenanceRateLimit,
  adminUploadRateLimit,
  externalIntegrationRateLimit
};
