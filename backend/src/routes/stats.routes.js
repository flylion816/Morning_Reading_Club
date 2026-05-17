const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getEnrollmentStats,
  getPaymentStats,
  getCheckinStats
} = require('../controllers/stats.controller');
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { userTenantContext, adminTenantContext } = require('../middleware/tenantContext');

// 获取仪表板统计数据（管理员）
router.get('/dashboard', adminAuthMiddleware, adminTenantContext, getDashboardStats);

// 获取报名统计数据（管理员）
router.get('/enrollments', adminAuthMiddleware, adminTenantContext, getEnrollmentStats);

// 获取支付统计数据（管理员）
router.get('/payments', adminAuthMiddleware, adminTenantContext, getPaymentStats);

// 获取打卡统计数据（用户可访问自己的数据）
router.get('/checkin', authMiddleware, userTenantContext, getCheckinStats);

module.exports = router;
