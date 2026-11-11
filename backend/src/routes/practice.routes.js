const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const controller = require('../controllers/practice.controller');

router.use(authMiddleware, userTenantContext);

router.get('/period/:periodId/current', controller.getCurrent);
router.put('/period/:periodId/current', controller.setCurrent);
router.put('/period/:periodId/today', controller.logToday);
router.get('/period/:periodId/history', controller.getHistory);

module.exports = router;
