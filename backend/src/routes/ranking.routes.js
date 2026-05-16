const express = require('express');
const router = express.Router();
const { getPeriodRanking } = require('../controllers/ranking.controller');
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');

// 获取期次排行榜
router.get('/period/:periodId', authMiddleware, userTenantContext, getPeriodRanking);

module.exports = router;
