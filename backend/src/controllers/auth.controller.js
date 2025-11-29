const User = require('../models/User');
const { generateTokens } = require('../utils/jwt');
const { success, errors } = require('../utils/response');

// Mock微信登录
async function wechatLogin(req, res, next) {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json(errors.badRequest('缺少code参数'));
    }

    // Mock: 根据code获取固定的openid，以便测试时使用已有用户
    // 特殊code映射到已存在的用户
    let mockOpenid;
    if (code === 'test_user_atai') {
      // 阿泰的openid（在init-mongodb.js中创建）
      mockOpenid = 'mock_user_001';
    } else if (code === 'test_user_wangwu') {
      // 王五的openid
      mockOpenid = 'mock_user_003';
    } else if (code === 'test_user_admin') {
      // 管理员的openid
      mockOpenid = 'mock_admin_001';
    } else {
      // 其他code生成新的openid
      mockOpenid = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 查找或创建用户
    let user = await User.findOne({ openid: mockOpenid });
    const isNewUser = !user;

    if (!user) {
      // 创建新用户
      user = await User.create({
        openid: mockOpenid,
        nickname: '微信用户',
        avatar: '🦁',
        role: 'user',
        status: 'active'
      });
    } else {
      // 更新最后登录时间
      user.lastLoginAt = new Date();
      await user.save();
    }

    // 生成Token
    const tokens = generateTokens(user);

    res.json(success({
      ...tokens,
      user: {
        _id: user._id,
        openid: user.openid,
        nickname: user.nickname,
        avatar: user.avatar,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        isNewUser
      }
    }, '登录成功'));
  } catch (error) {
    next(error);
  }
}

// 刷新Token
async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json(errors.badRequest('缺少refreshToken'));
    }

    // 验证并解析refreshToken（这里简化处理）
    const { verifyRefreshToken } = require('../utils/jwt');
    const decoded = verifyRefreshToken(refreshToken);

    // 查找用户
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    if (user.status !== 'active') {
      return res.status(403).json(errors.forbidden('用户已被禁用'));
    }

    // 生成新Token
    const tokens = generateTokens(user);

    res.json(success({
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn
    }, 'Token刷新成功'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  wechatLogin,
  refreshToken
};
