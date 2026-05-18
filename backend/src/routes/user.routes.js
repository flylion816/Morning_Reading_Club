const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { userTenantContext, adminTenantContext } = require('../middleware/tenantContext');
const {
  getCurrentUser,
  updateProfile,
  getUserById,
  getUserStats,
  getUserList,
  updateUser,
  deleteUser,
  bindPhone,
  getPhoneInfo
} = require('../controllers/user.controller');

// 小程序用户路由：需要用户登录 + 用户租户上下文
router.get('/me', authMiddleware, userTenantContext, getCurrentUser);
router.put('/profile', authMiddleware, userTenantContext, updateProfile);
router.post('/bindPhone', authMiddleware, userTenantContext, bindPhone);
router.get('/phone', authMiddleware, userTenantContext, getPhoneInfo);
router.get('/:userId', authMiddleware, userTenantContext, getUserById);
router.get('/:userId/stats', authMiddleware, userTenantContext, getUserStats);

/**
 * @route   GET /api/v1/users
 * @desc    获取用户列表（管理员）
 * @access  Admin
 */
router.get('/', authMiddleware, adminMiddleware, adminTenantContext, getUserList);

/**
 * @route   PUT /api/v1/users/:userId
 * @desc    更新用户信息（管理员）
 * @access  Admin
 */
router.put('/:userId', authMiddleware, adminMiddleware, adminTenantContext, updateUser);

/**
 * @route   DELETE /api/v1/users/:userId
 * @desc    删除用户（管理员）
 * @access  Admin
 */
router.delete('/:userId', authMiddleware, adminMiddleware, adminTenantContext, deleteUser);

module.exports = router;
