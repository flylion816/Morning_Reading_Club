const express = require('express');

const router = express.Router();
const { wechatLogin, refreshToken, logout } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth');

/**
 * @route   POST /api/v1/auth/wechat/login
 * @desc    微信登录（Mock版）
 * @access  Public
 */
router.post('/wechat/login', wechatLogin);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    刷新访问令牌
 * @access  Public
 */
router.post('/refresh', refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    登出
 * @access  Private
 */
router.post('/logout', authMiddleware, logout);

module.exports = router;
