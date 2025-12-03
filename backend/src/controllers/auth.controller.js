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

    let user;
    let isNewUser = false;

    // 开发环境：统一使用固定ID的测试用户进行测试，避免每次都创建新用户
    if (process.env.NODE_ENV === 'development') {
      // 使用固定的测试用户ID（用户昵称可能会变，但ID不变）
      // 使用"狮子"用户进行开发测试
      const testUserId = '692fe16a962d558224f4133f';
      user = await User.findById(testUserId);

      if (!user) {
        console.error('❌ 开发环境错误：测试用户不存在，请先初始化数据库');
        return res.status(500).json(errors.serverError('测试用户未初始化'));
      }

      console.log('✅ 开发环境：使用测试用户', user.nickname, '登录');
    } else {
      // 生产环境：根据code获取openid
      let mockOpenid;
      if (code === 'test_user_atai') {
        mockOpenid = 'mock_user_001';
      } else if (code === 'test_user_wangwu') {
        mockOpenid = 'mock_user_003';
      } else if (code === 'test_user_admin') {
        mockOpenid = 'mock_admin_001';
      } else {
        mockOpenid = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // 查找或创建用户
      user = await User.findOne({ openid: mockOpenid });
      isNewUser = !user;

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
    }

    // 更新最后登录时间
    if (!isNewUser) {
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
