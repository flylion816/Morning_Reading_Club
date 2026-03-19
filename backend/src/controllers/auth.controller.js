const User = require('../models/User');
const wechatService = require('../services/wechat.service');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { publishSyncEvent } = require('../services/sync.service');

/**
 * 微信登录处理
 * 支持 Mock（开发环境）和真实微信授权（生产环境）的无缝切换
 *
 * 请求体：{ code: string, nickname?: string, avatar_url?: string, gender?: string }
 */
async function wechatLogin(req, res, next) {
  try {
    const { code, nickname, avatarUrl, gender } = req.body;

    console.log('===== 后端收到微信登录请求 =====');
    console.log('收到的 code:', code);
    console.log('收到的 nickname:', nickname);
    console.log('环境:', process.env.NODE_ENV);
    console.log('================================');

    // 参数验证
    if (!code) {
      return res.status(400).json(errors.badRequest('缺少微信授权码'));
    }

    // ====== 核心改动：调用 WechatService 获取 openid ======
    let openid;
    try {
      const wechatResult = await wechatService.getOpenidFromCode(code);
      openid = wechatResult.openid;
      // sessionKey and unionid are optional and not used in current implementation
    } catch (wechatError) {
      // 微信服务错误（包括网络错误）
      logger.error('微信认证失败', wechatError, {
        code: `${code.substring(0, 4)}***`,
        environment: process.env.NODE_ENV
      });
      return res.status(401).json(errors.unauthorized(wechatError.message));
    }

    // 查找或创建用户
    let user = await User.findOne({ openid });
    let isNewUser = false;

    if (!user) {
      // 新用户：创建账户
      logger.info('创建新用户', {
        openid,
        nickname: nickname || '晨读营用户'
      });

      user = await User.create({
        openid,
        nickname: nickname || '晨读营用户',
        avatar: '🦁', // 默认头像
        avatarUrl,
        gender: gender || 'unknown',
        role: 'user',
        status: 'active',
        lastLoginAt: new Date()
      });

      // 异步同步到 MySQL
      publishSyncEvent({
        type: 'create',
        collection: 'users',
        documentId: user._id.toString(),
        data: user.toObject()
      });

      isNewUser = true;
    } else {
      // 既有用户：更新登录时间和头像信息
      user.lastLoginAt = new Date();

      // 如果提供了新头像，更新头像
      if (avatarUrl) {
        user.avatarUrl = avatarUrl;
      }

      // ⚠️ 重要修复：既有用户的昵称保护机制
      // 防止微信返回的默认昵称（如"微信用户"）覆盖自定义昵称
      // 策略：
      // 1. 如果用户当前昵称是默认值，且前端提供非默认昵称，才更新
      // 2. 如果前端提供的是默认昵称，永不覆盖（保留用户自定义的昵称）
      const defaultNicknames = ['微信用户', '晨读营用户', '晨读营', 'wechat user'];
      const isDefaultNickname = !user.nickname || defaultNicknames.includes(user.nickname);
      const isFrontendNicknameDefault = !nickname || defaultNicknames.includes(nickname);

      // 只在两种情况更新昵称：
      // A. 当前昵称是默认值，且前端提供非默认昵称
      // B. 当前昵称为空，且前端提供任何值（非空）
      if (!isFrontendNicknameDefault) {
        // 前端提供了真实昵称，使用它
        if (isDefaultNickname || !user.nickname) {
          user.nickname = nickname;
          logger.info('更新既有用户昵称', {
            userId: user._id,
            oldNickname: user.nickname,
            newNickname: nickname
          });
        }
        // 否则保留用户现有的自定义昵称，不覆盖
      } else {
        // 前端提供的是默认昵称，绝不覆盖（保护用户已有的自定义昵称）
        logger.debug('前端提供默认昵称，保护用户已有昵称', {
          userId: user._id,
          currentNickname: user.nickname,
          frontendNickname: nickname
        });
      }

      await user.save();

      // 异步同步到 MySQL
      publishSyncEvent({
        type: 'update',
        collection: 'users',
        documentId: user._id.toString(),
        data: user.toObject()
      });
    }

    // 生成JWT Token
    const tokens = generateTokens(user);

    console.log('===== 后端登录成功，返回数据 =====');
    console.log('用户ID:', user._id);
    console.log('用户昵称:', user.nickname);
    console.log('openid:', user.openid);
    console.log('accessToken:', tokens.accessToken);
    console.log('refreshToken:', tokens.refreshToken);
    console.log('isNewUser:', isNewUser);
    console.log('====================================');

    // 详细日志记录（用于监控）
    logger.info('用户登录成功', {
      userId: user._id,
      nickname: user.nickname,
      isNewUser,
      environment: process.env.NODE_ENV
    });

    // 返回响应
    res.json(
      success(
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          user: {
            _id: user._id,
            openid: user.openid,
            nickname: user.nickname,
            avatar: user.avatar,
            avatarUrl: user.avatarUrl,
            role: user.role,
            status: user.status
          },
          isNewUser, // ← 标记：是否新用户
          needsWechatInfo: isNewUser // ← 标记：是否需要用微信信息补充
        },
        '登录成功'
      )
    );
  } catch (error) {
    logger.error('登录处理异常', error, {
      stack: error.stack
    });
    next(error);
  }
}

// 刷新Token
async function refreshToken(req, res, next) {
  try {
    // 兼容前端两种字段名：refreshToken (camelCase) 和 refresh_token (snake_case)
    const token = req.body.refreshToken || req.body.refresh_token;

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

// 登出
async function logout(req, res, next) {
  try {
    // 由于使用的是无状态的 JWT，logout 主要是客户端清除本地存储
    // 服务器端只需要返回成功响应
    res.json(success(null, '登出成功'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  wechatLogin,
  refreshToken,
  logout
};
