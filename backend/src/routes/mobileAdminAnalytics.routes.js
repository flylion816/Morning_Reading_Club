const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const mobileAdminAnalyticsController = require('../controllers/mobileAdminAnalytics.controller');

router.use(authMiddleware);
router.use(userTenantContext);
router.use(mobileAdminAnalyticsController.requireMobileAdmin);

router.get('/periods', mobileAdminAnalyticsController.getPeriodOptions);
router.get('/overview', mobileAdminAnalyticsController.getOverviewAnalytics);
router.get('/activity', mobileAdminAnalyticsController.getActivityAnalytics);

module.exports = router;
