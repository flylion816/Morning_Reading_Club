const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
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

// 所有 user 路由都需要登录 + 租户上下文
router.use(authMiddleware, userTenantContext);

/**
 * @route   GET /api/v1/users/me
 * @desc    获取当前用户信息
 * @access  Private
 */
router.get('/me', getCurrentUser);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    更新用户资料
 * @access  Private
 */
router.put('/profile', updateProfile);

/**
 * @route   POST /api/v1/users/bindPhone
 * @desc    绑定手机号
 * @access  Private
 */
router.post('/bindPhone', bindPhone);

/**
 * @route   GET /api/v1/users/phone
 * @desc    获取当前用户手机号信息
 * @access  Private
 */
router.get('/phone', getPhoneInfo);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    获取用户详情（他人主页）
 * @access  Private
 */
router.get('/:userId', getUserById);

/**
 * @route   GET /api/v1/users/:userId/stats
 * @desc    获取用户统计信息
 * @access  Private
 */
router.get('/:userId/stats', getUserStats);

/**
 * @route   GET /api/v1/users
 * @desc    获取用户列表（管理员）
 * @access  Admin
 */
router.get('/', adminMiddleware, getUserList);

/**
 * @route   PUT /api/v1/users/:userId
 * @desc    更新用户信息（管理员）
 * @access  Admin
 */
router.put('/:userId', adminMiddleware, updateUser);

/**
 * @route   DELETE /api/v1/users/:userId
 * @desc    删除用户（管理员）
 * @access  Admin
 */
router.delete('/:userId', adminMiddleware, deleteUser);

module.exports = router;
