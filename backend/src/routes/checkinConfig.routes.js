const express = require('express');
const router = express.Router();
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const {
  getPublicConfig,
  getAdminConfig,
  updateAnimationStyle,
  toggleRandomAnimationStyle,
  addMessage,
  updateMessage,
  toggleMessage,
  deleteMessage
} = require('../controllers/checkinConfig.controller');

// 小程序公开端点（无需认证）
router.get('/', getPublicConfig);

// 管理后台端点（需要 admin 认证）
router.get('/admin', adminAuthMiddleware, getAdminConfig);
router.put('/admin/style', adminAuthMiddleware, updateAnimationStyle);
router.patch('/admin/random-styles/:style/toggle', adminAuthMiddleware, toggleRandomAnimationStyle);
router.post('/admin/messages', adminAuthMiddleware, addMessage);
router.put('/admin/messages/:id', adminAuthMiddleware, updateMessage);
router.patch('/admin/messages/:id/toggle', adminAuthMiddleware, toggleMessage);
router.delete('/admin/messages/:id', adminAuthMiddleware, deleteMessage);

module.exports = router;
