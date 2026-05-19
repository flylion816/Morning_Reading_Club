const express = require('express');
const router = express.Router();
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { publicTenantContext, adminTenantContext } = require('../middleware/tenantContext');
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

// 小程序公开端点（无需认证，从 X-Wx-AppId 解析租户）
router.get('/', publicTenantContext, getPublicConfig);

// 管理后台端点（需要 admin 认证 + 租户上下文）
router.get('/admin', adminAuthMiddleware, adminTenantContext, getAdminConfig);
router.put('/admin/style', adminAuthMiddleware, adminTenantContext, updateAnimationStyle);
router.patch('/admin/random-styles/:style/toggle', adminAuthMiddleware, adminTenantContext, toggleRandomAnimationStyle);
router.post('/admin/messages', adminAuthMiddleware, adminTenantContext, addMessage);
router.put('/admin/messages/:id', adminAuthMiddleware, adminTenantContext, updateMessage);
router.patch('/admin/messages/:id/toggle', adminAuthMiddleware, adminTenantContext, toggleMessage);
router.delete('/admin/messages/:id', adminAuthMiddleware, adminTenantContext, deleteMessage);

module.exports = router;
