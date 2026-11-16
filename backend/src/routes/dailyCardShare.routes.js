const express = require('express');
const { optionalAuthMiddleware } = require('../middleware/auth');
const { optionalUserOrPublicTenantContext } = require('../middleware/tenantContext');
const { rateLimitMiddleware } = require('../middleware/ratelimit');
const { getCurrentTenantId } = require('../utils/tenantContext');
const controller = require('../controllers/dailyCardShare.controller');

const router = express.Router();
const createLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 20,
  failClosed: true,
  keyGenerator: req => `ratelimit:daily-card:create:${getCurrentTenantId()}:${req.user?.userId || req.ip}`
});
const resolveLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 120,
  failClosed: true,
  keyGenerator: req => `ratelimit:daily-card:read:${getCurrentTenantId()}:${req.user?.userId || req.ip}`
});

router.post('/', optionalAuthMiddleware, optionalUserOrPublicTenantContext, createLimit, controller.createDailyCardShare);
router.get('/:code', optionalAuthMiddleware, optionalUserOrPublicTenantContext, resolveLimit, controller.resolveDailyCardShare);
module.exports = router;
