const User = require('../models/User');
const Tenant = require('../models/Tenant');
const wechatService = require('../services/wechat.service');
const { generateTokens, verifyRefreshToken } = require('../utils/jwt');
const { success, errors } = require('../utils/response');
const { withSystemContext } = require('../utils/tenantContext');
const logger = require('../utils/logger');
const { publishSyncEvent } = require('../services/sync.service');

/**
 * 微信登录处理
 * 支持 Mock（开发环境）和真实微信授权（生产环境）的无缝切换
 *
 * 请求体：{ code: string, nickname?: string, avatar_url?: string, gender?: string, wxAppId?: string }
 */
async function wechatLogin(req, res, next) {
  try {
    const { code, nickname, avatarUrl, gender } = req.body;
    const wxAppId = req.body.wxAppId
      || req.header('X-Wx-AppId')
      || (process.env.ENABLE_LEGACY_DEFAULT_TENANT === 'true' ? process.env.WECHAT_APPID : null);

    // 参数验证
    if (!code) {
      return res.status(400).json(errors.badRequest('缺少微信授权码'));
    }
    if (!wxAppId) {
      return res.status(400).json(errors.badRequest('缺少 wxAppId'));
    }

    // 第一步：通过 wxAppId 找到租户（系统级查询，绕过租户过滤）
    const tenant = await withSystemContext(null, () => Tenant.findByWxAppId(wxAppId));
    if (!tenant) {
      return res.status(403).json(errors.forbidden(`未识别的小程序 appId: ${wxAppId}`));
    }

    // 第二步：调用微信。wxAppId 只是租户候选值，最终以 code2session 成功为准。
    let openid;
    try {
      const wechatResult = await wechatService.getOpenidFromCode(code, {
        appId: wxAppId,
        tenantId: tenant._id
      });
      openid = wechatResult.openid;
    } catch (wechatError) {
      logger.error('微信认证失败', wechatError, {
        code: `${code.substring(0, 4)}***`,
        environment: process.env.NODE_ENV
      });
      return res.status(401).json(errors.unauthorized(wechatError.message));
    }

    // 第三步：在租户上下文中查/建用户
    const user = await withSystemContext(tenant._id, async () => {
      let u = await User.findOne({ tenantId: tenant._id, openid });
      let isNewUser = false;

      if (!u) {
        logger.info('创建新用户', {
          openid,
          nickname: nickname || '晨读营用户',
          tenantId: tenant._id
        });

        u = await User.create({
          tenantId: tenant._id,
          openid,
          nickname: nickname || '晨读营用户',
          avatar: '🦁',
          avatarUrl,
          gender: gender || 'unknown',
          role: 'user',
          status: 'active',
          lastLoginAt: new Date()
        });

        publishSyncEvent({
          type: 'create',
          collection: 'users',
          documentId: u._id.toString(),
          data: u.toObject()
        });

        isNewUser = true;
      } else {
        if (u.status !== 'active') {
          return { user: u, isNewUser: false, error: u.status === 'deleted' ? '用户已被删除' : '用户已被禁用' };
        }

        u.lastLoginAt = new Date();

        if (avatarUrl) {
          u.avatarUrl = avatarUrl;
        }

        // 昵称保护机制：防止默认昵称覆盖用户自定义昵称
        const defaultNicknames = ['微信用户', '晨读营用户', '晨读营', 'wechat user'];
        const isDefaultNickname = !u.nickname || defaultNicknames.includes(u.nickname);
        const isFrontendNicknameDefault = !nickname || defaultNicknames.includes(nickname);

        if (!isFrontendNicknameDefault) {
          if (isDefaultNickname || !u.nickname) {
            u.nickname = nickname;
          }
        }

        await u.save();

        publishSyncEvent({
          type: 'update',
          collection: 'users',
          documentId: u._id.toString(),
          data: u.toObject()
        });
      }

      return { user: u, isNewUser };
    });

    // 处理用户被禁用的情况
    if (user.error) {
      return res.status(403).json(errors.forbidden(user.error));
    }

    // 第四步：生成 token（generateTokens 已经改为读 user.tenantId）
    const tokens = generateTokens(user.user);

    logger.info('用户登录成功', {
      userId: user.user._id,
      nickname: user.user.nickname,
      isNewUser: user.isNewUser,
      tenantId: tenant._id,
      environment: process.env.NODE_ENV
    });
    logger.debug('[TENANT-AUTH] token payload tenantId', {
      userTenantId: user.user.tenantId ? user.user.tenantId.toString() : null,
      tenantId: tenant._id.toString(),
      tenantSlug: tenant.slug
    });

    res.json(
      success(
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          user: {
            _id: user.user._id,
            openid: user.user.openid,
            nickname: user.user.nickname,
            avatar: user.user.avatar,
            avatarUrl: user.user.avatarUrl,
            role: user.user.role,
            status: user.user.status
          },
          isNewUser: user.isNewUser,
          needsWechatInfo: user.isNewUser,
          tenant: { _id: tenant._id, slug: tenant.slug, name: tenant.name }
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

    // 查找用户（refreshToken 是跨租户操作，需要 system context）
    const user = await withSystemContext(null, () => User.findById(decoded.userId).exec());

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
