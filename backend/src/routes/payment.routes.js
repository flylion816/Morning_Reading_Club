const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  confirmPayment,
  getPaymentStatus,
  cancelPayment,
  getUserPayments,
  wechatCallback,
  mockConfirmPayment,
  getPayments
} = require('../controllers/payment.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ===== 管理员路由（必须放在最前面） =====

// 获取支付列表（管理员）
router.get('/', authMiddleware, adminMiddleware, getPayments);

// ===== 用户路由 =====

// 初始化支付（创建订单）
router.post('/', authMiddleware, initiatePayment);

// 获取用户的支付记录列表
router.get('/user/:userId?', authMiddleware, getUserPayments);

// 查询支付状态
router.get('/:paymentId', authMiddleware, getPaymentStatus);

// 确认支付
router.post('/:paymentId/confirm', authMiddleware, confirmPayment);

// 取消支付
router.post('/:paymentId/cancel', authMiddleware, cancelPayment);

// 模拟支付确认（用于开发测试）
router.post('/:paymentId/mock-confirm', authMiddleware, mockConfirmPayment);

// 微信支付回调（无需认证）
router.post('/wechat/callback', wechatCallback);

module.exports = router;
