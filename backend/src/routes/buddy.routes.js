const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const {
  getBuddyState,
  getBuddyOverview,
  joinBuddy,
  cancelBuddy,
  nudgeBuddy,
  leaveBuddy
} = require('../controllers/buddy.controller');

router.get('/period/:periodId', authMiddleware, userTenantContext, getBuddyState);
router.get('/period/:periodId/overview', authMiddleware, userTenantContext, getBuddyOverview);
router.post('/period/:periodId/join', authMiddleware, userTenantContext, joinBuddy);
router.post('/period/:periodId/cancel', authMiddleware, userTenantContext, cancelBuddy);
router.post('/period/:periodId/nudge', authMiddleware, userTenantContext, nudgeBuddy);
router.post('/period/:periodId/leave', authMiddleware, userTenantContext, leaveBuddy);

module.exports = router;
