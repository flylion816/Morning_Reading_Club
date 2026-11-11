const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const { getPeriodKeepsake } = require('../controllers/keepsake.controller');

router.get('/period/:periodId', authMiddleware, userTenantContext, getPeriodKeepsake);

module.exports = router;
