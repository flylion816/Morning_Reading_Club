const crypto = require('crypto');
const User = require('../models/User');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

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
        logger.error('Development environment error: test user not found', null, { testUserId });
        return res.status(500).json(errors.serverError('测试用户未初始化'));
      }

      logger.info('Development environment: using test user', {
        userId: user._id,
        nickname: user.nickname
      });
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
        // Mock openid 应该基于 code 一致生成，而不是基于时间
        // 这样同一个 code 总是返回同一个用户
        const hash = crypto.createHash('md5').update(String(code)).digest('hex');
        mockOpenid = `mock_${hash.substr(0, 16)}`;
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

    res.json(
      success(
        {
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
        },
        '登录成功'
      )
    );
  } catch (error) {
    next(error);
  }
}

// 刷新Token
async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json(errors.badRequest('缺少refreshToken'));
    }

    // 验证并解析refreshToken（这里简化处理）
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (tokenError) {
      // Token 验证失败（无效或过期）
      return res.status(401).json(errors.unauthorized(tokenError.message));
    }

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

    res.json(
      success(
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        },
        'Token刷新成功'
      )
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  wechatLogin,
  refreshToken
};
