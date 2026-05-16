const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getEnrollmentStats,
  getPaymentStats,
  getCheckinStats
} = require('../controllers/stats.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');

// 所有 stats 路由都需要登录 + 租户上下文
router.use(authMiddleware, userTenantContext);

// 获取仪表板统计数据（管理员）
router.get('/dashboard', adminMiddleware, getDashboardStats);

// 获取报名统计数据（管理员）
router.get('/enrollments', adminMiddleware, getEnrollmentStats);

// 获取支付统计数据（管理员）
router.get('/payments', adminMiddleware, getPaymentStats);

// 获取打卡统计数据（用户可访问自己的数据）
router.get('/checkin', getCheckinStats);

module.exports = router;
