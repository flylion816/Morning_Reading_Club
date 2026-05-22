const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
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

// 在场人搜索：普通用户可用，只返回 nickname/avatar（必须在 /:userId 之前注册）
router.get('/search', authMiddleware, userTenantContext, async (req, res) => {
  const User = require('../models/User');
  const { success, errors } = require('../utils/response');
  try {
    const q = (req.query.search || req.query.keyword || '').trim();
    if (!q) return res.json(success({ list: [] }));
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ nickname: re })
      .select('_id nickname avatarUrl')
      .limit(20)
      .lean();
    res.json(success({ list: users }));
  } catch (err) {
    res.status(500).json(errors.serverError());
  }
});

router.get('/:userId', authMiddleware, userTenantContext, getUserById);
router.get('/:userId/stats', authMiddleware, userTenantContext, getUserStats);

/**
 * @route   GET /api/v1/users
 * @desc    获取用户列表（管理员）
 * @access  Admin
 */
router.get('/', adminAuthMiddleware, adminTenantContext, getUserList);

/**
 * @route   PUT /api/v1/users/:userId
 * @desc    更新用户信息（管理员）
 * @access  Admin
 */
router.put('/:userId', adminAuthMiddleware, adminTenantContext, updateUser);

/**
 * @route   DELETE /api/v1/users/:userId
 * @desc    删除用户（管理员）
 * @access  Admin
 */
router.delete('/:userId', adminAuthMiddleware, adminTenantContext, deleteUser);

module.exports = router;
