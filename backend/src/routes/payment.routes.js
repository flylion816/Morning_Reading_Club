const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  confirmPayment,
  getPaymentStatus,
  cancelPayment,
  adminCancelPayment,
  adminResetPaymentToPending,
  getUserPayments,
  wechatCallback,
  mockConfirmPayment,
  getPayments
} = require('../controllers/payment.controller');
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { userTenantContext, adminTenantContext } = require('../middleware/tenantContext');

// ===== 微信支付回调（无需认证，controller 内部解析租户，必须在参数化路由之前） =====
router.post('/wechat/callback', wechatCallback);

// ===== 管理员路由 =====

// 获取所有支付记录列表（管理员）
router.get('/', adminAuthMiddleware, adminTenantContext, getPayments);

// ===== 用户路由 =====

// 初始化支付（创建订单）
router.post('/', authMiddleware, userTenantContext, initiatePayment);

// 获取用户的支付记录列表
router.get('/user/:userId?', authMiddleware, userTenantContext, getUserPayments);

// 查询支付状态
router.get('/:paymentId', authMiddleware, userTenantContext, getPaymentStatus);

// 确认支付
router.post('/:paymentId/confirm', authMiddleware, userTenantContext, confirmPayment);

// 取消支付
router.post('/:paymentId/cancel', authMiddleware, userTenantContext, cancelPayment);

// 管理员取消支付
router.post('/:paymentId/admin-cancel', adminAuthMiddleware, adminTenantContext, adminCancelPayment);

// 管理员重置为待支付
router.post('/:paymentId/reset-to-pending', adminAuthMiddleware, adminTenantContext, adminResetPaymentToPending);

// 模拟支付确认（仅限开发/测试环境）
if (process.env.NODE_ENV !== 'production') {
  router.post('/:paymentId/mock-confirm', authMiddleware, userTenantContext, mockConfirmPayment);
}

module.exports = router;
