const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const { rateLimitMiddleware } = require('../middleware/ratelimit');
const { getCurrentTenantId } = require('../utils/tenantContext');
const {
  getBuddyState,
  getBuddyOverview,
  joinBuddy,
  cancelBuddy,
  nudgeBuddy,
  leaveBuddy,
  getBuddySouvenir,
  rematchBuddy,
  highFiveBuddy,
  giftBuddy,
  reactBuddy,
  listBuddyCandidates,
  inviteBuddy,
  respondBuddyInvite,
  cancelBuddyInvite,
  setBuddyDiscoverable
} = require('../controllers/buddy.controller');

// 自己写的话每次都要调一次微信内容安全接口，限一下频率，别让重复提交耗掉额度
const giftLimit = rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyGenerator: req =>
    `ratelimit:buddy:gift:${getCurrentTenantId()}:${req.user?.userId || req.user?._id || req.user?.id || req.ip}`
});

router.post('/settings', authMiddleware, userTenantContext, setBuddyDiscoverable);
router.get('/period/:periodId', authMiddleware, userTenantContext, getBuddyState);
router.get('/period/:periodId/overview', authMiddleware, userTenantContext, getBuddyOverview);
router.post('/period/:periodId/join', authMiddleware, userTenantContext, joinBuddy);
router.post('/period/:periodId/cancel', authMiddleware, userTenantContext, cancelBuddy);
router.post('/period/:periodId/nudge', authMiddleware, userTenantContext, nudgeBuddy);
router.post('/period/:periodId/leave', authMiddleware, userTenantContext, leaveBuddy);
router.get('/period/:periodId/souvenir', authMiddleware, userTenantContext, getBuddySouvenir);
router.post('/period/:periodId/rematch', authMiddleware, userTenantContext, rematchBuddy);
router.post('/period/:periodId/highfive', authMiddleware, userTenantContext, highFiveBuddy);
router.post('/period/:periodId/gift', authMiddleware, userTenantContext, giftLimit, giftBuddy);
router.post('/period/:periodId/react', authMiddleware, userTenantContext, reactBuddy);
router.get('/period/:periodId/candidates', authMiddleware, userTenantContext, listBuddyCandidates);
router.post('/period/:periodId/invite', authMiddleware, userTenantContext, inviteBuddy);
router.post('/period/:periodId/invites/:inviteId/respond', authMiddleware, userTenantContext, respondBuddyInvite);
router.post('/period/:periodId/invites/:inviteId/cancel', authMiddleware, userTenantContext, cancelBuddyInvite);

module.exports = router;
