const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getEnrollmentStats,
  getPaymentStats,
  getCheckinStats
} = require('../controllers/stats.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 首先执行认证中间件（解析和验证token）
router.use(authMiddleware);

// 然后执行管理员权限检查中间件
router.use(adminMiddleware);

// 获取仪表板统计数据
router.get('/dashboard', getDashboardStats);

// 获取报名统计数据
router.get('/enrollments', getEnrollmentStats);

// 获取支付统计数据
router.get('/payments', getPaymentStats);

// 获取打卡统计数据
router.get('/checkins', getCheckinStats);

module.exports = router;
