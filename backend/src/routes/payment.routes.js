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
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');

// ===== 微信支付回调（无需认证，controller 内部解析租户，必须在参数化路由之前） =====
router.post('/wechat/callback', wechatCallback);

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
router.post('/:paymentId/admin-cancel', authMiddleware, userTenantContext, adminMiddleware, adminCancelPayment);

// 管理员重置为待支付
router.post(
  '/:paymentId/reset-to-pending',
  authMiddleware,
  userTenantContext,
  adminMiddleware,
  adminResetPaymentToPending
);

// 模拟支付确认（用于开发测试）
router.post('/:paymentId/mock-confirm', authMiddleware, userTenantContext, mockConfirmPayment);

module.exports = router;
