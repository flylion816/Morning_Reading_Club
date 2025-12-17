const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getEnrollmentStats,
  getPaymentStats,
  getCheckinStats
} = require('../controllers/stats.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 获取仪表板统计数据（管理员）
router.get('/dashboard', authMiddleware, adminMiddleware, getDashboardStats);

// 获取报名统计数据（管理员）
router.get('/enrollments', authMiddleware, adminMiddleware, getEnrollmentStats);

// 获取支付统计数据（管理员）
router.get('/payments', authMiddleware, adminMiddleware, getPaymentStats);

// 获取打卡统计数据（用户可访问自己的数据）
router.get('/checkin', authMiddleware, getCheckinStats);

module.exports = router;
