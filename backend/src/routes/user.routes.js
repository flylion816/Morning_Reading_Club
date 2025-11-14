const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  getCurrentUser,
  updateProfile,
  getUserStats,
  getUserList
} = require('../controllers/user.controller');

/**
 * @route   GET /api/v1/users/me
 * @desc    获取当前用户信息
 * @access  Private
 */
router.get('/me', authMiddleware, getCurrentUser);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    更新用户资料
 * @access  Private
 */
router.put('/profile', authMiddleware, updateProfile);

/**
 * @route   GET /api/v1/users/:userId/stats
 * @desc    获取用户统计信息
 * @access  Private
 */
router.get('/:userId/stats', authMiddleware, getUserStats);

/**
 * @route   GET /api/v1/users
 * @desc    获取用户列表（管理员）
 * @access  Admin
 */
router.get('/', authMiddleware, adminMiddleware, getUserList);

module.exports = router;
