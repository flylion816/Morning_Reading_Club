const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const { requireMobileAdmin } = require('../controllers/mobileAdminAnalytics.controller');
const mobileAdminWorkbenchController = require('../controllers/mobileAdminWorkbench.controller');

const router = express.Router();

router.use(authMiddleware);
router.use(userTenantContext);
router.use(requireMobileAdmin);

router.get('/users', mobileAdminWorkbenchController.searchUsers);
router.get('/users/:userId', mobileAdminWorkbenchController.getUserDetail);
router.get('/activities', mobileAdminWorkbenchController.listActivities);
router.get('/activities/:activityId/registrations', mobileAdminWorkbenchController.getActivityRegistrations);

module.exports = router;
