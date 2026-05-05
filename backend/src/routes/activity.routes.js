const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const activityController = require('../controllers/activity.controller');

router.post('/', authMiddleware, activityController.recordActivity);
router.get(
  '/analytics',
  authMiddleware,
  adminMiddleware,
  activityController.getActivityAnalytics
);

module.exports = router;
