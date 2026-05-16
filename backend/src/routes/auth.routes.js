const express = require('express');

const router = express.Router();
const { wechatLogin, refreshToken, logout } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const { generateWsToken, WS_TOKEN_TTL_SECONDS } = require('../utils/jwt');
const { getCurrentTenantId } = require('../utils/tenantContext');

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

/**
 * @route   POST /api/v1/auth/ws-token
 * @desc    颁发短期 wsToken（30秒有效，一次性消费）用于 WebSocket 握手
 * @access  Private (已登录用户)
 */
router.post('/ws-token', authMiddleware, userTenantContext, (req, res) => {
  try {
    const alsTenantId = getCurrentTenantId();
    const jwtTenantId = req.user.tenantId;
    if (!alsTenantId || !jwtTenantId || alsTenantId.toString() !== jwtTenantId.toString()) {
      return res.status(403).json({ code: 403, message: '租户上下文不一致，请重新登录' });
    }
    const wsToken = generateWsToken({
      _id: req.user.userId || req.user._id,
      tenantId: jwtTenantId
    });
    res.json({
      code: 0,
      data: { wsToken, expiresIn: WS_TOKEN_TTL_SECONDS }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: '颁发 wsToken 失败' });
  }
});

module.exports = router;
