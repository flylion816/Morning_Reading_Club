/**
 * Auth 模块测试 Fixtures
 * 包含登录、Token、用户等测试数据
 */

const mongoose = require('mongoose');

/**
 * 微信授权相关
 */
const wechatData = {
  validCode: 'test_code_' + Date.now(),
  validOpenid: 'test_openid_' + Date.now(),
  invalidCode: 'invalid_code_' + Date.now(),
  mockOpenid: 'mock_openid_001',
  anotherOpenid: 'mock_openid_002'
};

/**
 * JWT Token 相关
 */
const tokenData = {
  validAccessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYwIiwiZXhwIjo5OTk5OTk5OTk5fQ.test_token',
  validRefreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYwIiwiZXhwIjo5OTk5OTk5OTk5LCJ0eXBlIjoicmVmcmVzaCJ9.test_refresh',
  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjB9.expired_token',
  malformedToken: 'not.a.valid.jwt.token',
  expiresIn: 3600
};

/**
 * 测试用户数据
 */
const testUsers = {
  newUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: wechatData.validOpenid,
    nickname: '新用户',
    avatar: '🦁',
    avatarUrl: 'https://example.com/avatar-new.jpg',
    gender: 'unknown',
    role: 'user',
    status: 'active',
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  existingUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_001',
    nickname: '既有用户',
    avatar: '🐯',
    avatarUrl: 'https://example.com/avatar-existing.jpg',
    gender: 'male',
    role: 'user',
    status: 'active',
    lastLoginAt: new Date('2025-01-01'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01')
  },

  disabledUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_disabled',
    nickname: '禁用用户',
    avatar: '🚫',
    role: 'user',
    status: 'inactive',
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  adminUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_admin',
    nickname: '管理员',
    avatar: '👨‍💼',
    role: 'admin',
    status: 'active',
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  userWithDefaultNickname: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_default',
    nickname: '微信用户',
    avatar: '🐶',
    role: 'user',
    status: 'active',
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

/**
 * API 请求体
 */
const requestBodies = {
  validLogin: {
    code: wechatData.validCode,
    nickname: '测试用户',
    avatarUrl: 'https://example.com/avatar.jpg',
    gender: 'male'
  },

  loginWithoutCode: {
    nickname: '测试用户'
  },

  loginWithInvalidCode: {
    code: wechatData.invalidCode
  },

  validRefreshToken: {
    refreshToken: tokenData.validRefreshToken
  },

  refreshWithoutToken: {},

  refreshWithExpiredToken: {
    refreshToken: tokenData.expiredToken
  },

  refreshWithMalformedToken: {
    refreshToken: tokenData.malformedToken
  }
};

/**
 * 预期的 API 响应
 */
const expectedResponses = {
  successLogin: {
    code: 200,
    message: '登录成功',
    data: {
      accessToken: tokenData.validAccessToken,
      refreshToken: tokenData.validRefreshToken,
      expiresIn: tokenData.expiresIn
    }
  },

  successRefresh: {
    code: 200,
    message: 'Token刷新成功',
    data: {
      accessToken: tokenData.validAccessToken,
      refreshToken: tokenData.validRefreshToken,
      expiresIn: tokenData.expiresIn
    }
  },

  successLogout: {
    code: 200,
    message: '登出成功'
  },

  errorBadRequest: {
    code: 400,
    message: '缺少微信授权码'
  },

  errorUnauthorized: {
    code: 401,
    message: '微信认证失败'
  },

  errorNotFound: {
    code: 404,
    message: '用户不存在'
  },

  errorForbidden: {
    code: 403,
    message: '用户已被禁用'
  }
};

/**
 * 微信 API 响应
 */
const wechatResponses = {
  successfulLogin: {
    openid: wechatData.validOpenid,
    sessionKey: 'test_session_key_001',
    unionid: 'test_unionid_001'
  },

  sessionKeyInvalid: {
    errcode: 40125,
    errmsg: 'invalid appid'
  },

  networkError: new Error('Network error: Connection timeout')
};

/**
 * JWT 验证返回值
 */
const jwtDecoded = {
  validDecoded: {
    userId: testUsers.existingUser._id.toString(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400
  },

  expiredDecoded: {
    userId: testUsers.existingUser._id.toString(),
    iat: Math.floor(Date.now() / 1000) - 100000,
    exp: Math.floor(Date.now() / 1000) - 1000
  }
};

/**
 * 安全测试场景
 */
const securityScenarios = {
  // Token 重用防护
  tokenReusePrevention: {
    description: '同一个 refreshToken 不应该被多次使用',
    testSteps: [
      '第一次刷新 → 返回新 Token',
      '第二次用旧 refreshToken 刷新 → 应该失败（401）'
    ]
  },

  // CSRF 防护
  csrfProtection: {
    description: '检查是否正确验证请求来源',
    testSteps: [
      '校验 Authorization header 是否完整',
      '校验 token 格式是否有效'
    ]
  },

  // SQL/NoSQL 注入防护
  injectionProtection: {
    description: '避免注入攻击',
    testSteps: [
      '测试 code 字段包含特殊字符',
      '测试 openid 字段包含 MongoDB 操作符',
      '确保参数被正确转义'
    ]
  }
};

/**
 * 边界值测试
 */
const edgeCases = {
  emptyCode: '',
  nullCode: null,
  undefinedCode: undefined,
  veryLongCode: 'a'.repeat(10000),
  specialCharCode: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  sqlInjectionCode: "'; DROP TABLE users; --",
  mongoInjectionCode: { "$ne": null },
  unicodeCode: '中文测试代码🎉'
};

module.exports = {
  wechatData,
  tokenData,
  testUsers,
  requestBodies,
  expectedResponses,
  wechatResponses,
  jwtDecoded,
  securityScenarios,
  edgeCases
};
