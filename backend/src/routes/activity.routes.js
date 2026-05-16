const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const activityController = require('../controllers/activity.controller');

router.post('/', authMiddleware, userTenantContext, activityController.recordActivity);
router.get(
  '/analytics',
  authMiddleware,
  userTenantContext,
  adminMiddleware,
  activityController.getActivityAnalytics
);

module.exports = router;
