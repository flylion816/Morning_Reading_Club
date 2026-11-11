const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const {
  reportReading,
  getToday,
  getMyRank,
  getPeriodOrigins
} = require('../controllers/presence.controller');

router.post('/reading', authMiddleware, userTenantContext, reportReading);
router.get('/today', authMiddleware, userTenantContext, getToday);
router.get('/my-rank', authMiddleware, userTenantContext, getMyRank);
router.get('/period/:periodId/origins', authMiddleware, userTenantContext, getPeriodOrigins);

module.exports = router;
