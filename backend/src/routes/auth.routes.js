const express = require('express');
const router = express.Router();
const { wechatLogin, refreshToken } = require('../controllers/auth.controller');

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

module.exports = router;
