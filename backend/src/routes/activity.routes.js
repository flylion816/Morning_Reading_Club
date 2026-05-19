const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { userTenantContext, adminTenantContext } = require('../middleware/tenantContext');
const activityController = require('../controllers/activity.controller');

router.post('/', authMiddleware, userTenantContext, activityController.recordActivity);
router.get(
  '/analytics',
  adminAuthMiddleware,
  adminTenantContext,
  activityController.getActivityAnalytics
);

module.exports = router;
