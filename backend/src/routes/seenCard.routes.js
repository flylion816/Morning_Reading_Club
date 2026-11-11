const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const {
  sendSeen,
  withdrawSeen,
  getCheckinSeen,
  getSeenSummary,
  getReceivedSeen
} = require('../controllers/seenCard.controller');

// 挂载前缀：/api/v1/seen-cards
router.post('/checkins/summary', authMiddleware, userTenantContext, getSeenSummary);
router.get('/received', authMiddleware, userTenantContext, getReceivedSeen);
router.put('/checkin/:checkinId', authMiddleware, userTenantContext, sendSeen);
router.delete('/checkin/:checkinId', authMiddleware, userTenantContext, withdrawSeen);
router.get('/checkin/:checkinId', authMiddleware, userTenantContext, getCheckinSeen);

module.exports = router;
