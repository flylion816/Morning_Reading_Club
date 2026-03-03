/**
 * Middleware 测试 Fixtures
 * 包含认证、授权等中间件的测试数据
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

/**
 * JWT Token 生成和数据
 */
const generateTestToken = (options = {}) => {
  const defaultPayload = {
    userId: options.userId || new mongoose.Types.ObjectId().toString(),
    role: options.role || 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (options.expiresIn || 3600)
  };

  const secretKey = 'test_secret_key_for_jwt';
  return jwt.sign(defaultPayload, secretKey);
};

const tokenData = {
  // 有效的未过期 Token
  validToken: generateTestToken(),
  validAdminToken: generateTestToken({ role: 'admin' }),
  validSuperadminToken: generateTestToken({ role: 'superadmin' }),

  // 过期的 Token（exp已经过去）
  expiredToken: generateTestToken({ expiresIn: -3600 }),

  // Token 格式错误
  malformedToken: 'not.a.jwt.token',
  truncatedToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYwIiwiZXhwIjo5OTk5OTk5OTk5fQ',
  invalidSignatureToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjYwIiwiZXhwIjo5OTk5OTk5OTk5fQ.invalid_signature',

  // Token 边界情况
  veryLongToken: generateTestToken().repeat(100),
  specialCharToken: 'Bearer token!@#$%^&*()',

  // Token 續期相关
  almostExpiredToken: generateTestToken({ expiresIn: 600 }), // 10 分钟后过期
  tokenAboutToExpire: generateTestToken({ expiresIn: 1200 }), // 20 分钟后过期
};

/**
 * Authorization Header 相关
 */
const authorizationHeaders = {
  // 有效的 Header 格式
  validBearer: (token = tokenData.validToken) => `Bearer ${token}`,
  validAdminBearer: () => `Bearer ${tokenData.validAdminToken}`,
  validSuperadminBearer: () => `Bearer ${tokenData.validSuperadminToken}`,

  // 无效的 Header 格式
  missingBearer: (token = tokenData.validToken) => token, // 缺少 "Bearer " 前缀
  wrongScheme: () => `Basic ${Buffer.from('user:pass').toString('base64')}`,
  emptyBearer: () => 'Bearer ',
  extraSpaces: (token = tokenData.validToken) => `Bearer  ${token}`, // 多个空格
  lowercaseBearer: (token = tokenData.validToken) => `bearer ${token}`, // 小写 bearer

  // 特殊情况
  tokenWithoutSpace: (token = tokenData.validToken) => `Bearer${token}`,
  multipleTokens: (token1 = tokenData.validToken, token2 = tokenData.expiredToken) =>
    `Bearer ${token1} Bearer ${token2}`,
};

/**
 * Request Mock 对象
 */
const createMockRequest = (options = {}) => {
  return {
    headers: options.headers || {},
    user: options.user || null,
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    get: function(headerName) {
      return this.headers[headerName.toLowerCase()];
    }
  };
};

/**
 * Response Mock 对象
 */
const createMockResponse = () => {
  const res = {
    statusCode: 200,
    _headers: {},
    _jsonData: null,

    status: function(code) {
      this.statusCode = code;
      return this;
    },

    json: function(data) {
      this._jsonData = data;
      return this;
    },

    setHeader: function(name, value) {
      this._headers[name] = value;
      return this;
    },

    getHeader: function(name) {
      return this._headers[name];
    }
  };

  return res;
};

/**
 * 测试用户数据
 */
const testUsers = {
  regularUser: {
    userId: new mongoose.Types.ObjectId().toString(),
    role: 'user',
    openid: 'test_openid_user',
    nickname: '普通用户'
  },

  adminUser: {
    userId: new mongoose.Types.ObjectId().toString(),
    role: 'admin',
    openid: 'test_openid_admin',
    nickname: '管理员'
  },

  superadminUser: {
    userId: new mongoose.Types.ObjectId().toString(),
    role: 'superadmin',
    openid: 'test_openid_superadmin',
    nickname: '超级管理员'
  },

  disabledUser: {
    userId: new mongoose.Types.ObjectId().toString(),
    role: 'user',
    status: 'inactive',
    openid: 'test_openid_disabled',
    nickname: '禁用用户'
  }
};

/**
 * Decoded JWT 数据（模拟 verifyAccessToken 返回值）
 */
const decodedJwt = {
  validDecoded: {
    userId: testUsers.regularUser.userId,
    role: 'user',
    openid: testUsers.regularUser.openid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  },

  adminDecoded: {
    userId: testUsers.adminUser.userId,
    role: 'admin',
    openid: testUsers.adminUser.openid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  },

  superadminDecoded: {
    userId: testUsers.superadminUser.userId,
    role: 'superadmin',
    openid: testUsers.superadminUser.openid,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  },

  expiredDecoded: {
    userId: testUsers.regularUser.userId,
    role: 'user',
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600 // 已过期
  },

  almostExpiredDecoded: {
    userId: testUsers.regularUser.userId,
    role: 'user',
    iat: Math.floor(Date.now() / 1000) - 3000,
    exp: Math.floor(Date.now() / 1000) + 600 // 10 分钟后过期
  }
};

/**
 * 错误响应模板
 */
const errorResponses = {
  unauthorized: {
    code: 401,
    message: '未提供认证令牌'
  },

  invalidToken: {
    code: 401,
    message: 'Token验证失败'
  },

  expiredToken: {
    code: 401,
    message: 'Token已过期'
  },

  forbidden: {
    code: 403,
    message: '需要管理员权限'
  },

  notAdmin: {
    code: 403,
    message: '需要管理员权限'
  }
};

/**
 * 中间件测试场景
 */
const middlewareScenarios = {
  // 有效认证场景
  validAuth: {
    name: '有效的认证令牌',
    request: () => createMockRequest({
      headers: { authorization: authorizationHeaders.validBearer() }
    }),
    expected: {
      userSet: true,
      nextCalled: true,
      statusCode: undefined
    }
  },

  // 缺失认证场景
  missingAuth: {
    name: '缺失认证令牌',
    request: () => createMockRequest(),
    expected: {
      userSet: false,
      nextCalled: false,
      statusCode: 401
    }
  },

  // 无效格式场景
  invalidFormat: {
    name: '无效的 Authorization header 格式',
    request: () => createMockRequest({
      headers: { authorization: authorizationHeaders.wrongScheme() }
    }),
    expected: {
      userSet: false,
      nextCalled: false,
      statusCode: 401
    }
  },

  // 过期 Token 场景
  expiredToken: {
    name: '过期的认证令牌',
    request: () => createMockRequest({
      headers: { authorization: authorizationHeaders.validBearer(tokenData.expiredToken) }
    }),
    expected: {
      userSet: false,
      nextCalled: false,
      statusCode: 401
    }
  },

  // 管理员认证场景
  adminAuth: {
    name: '管理员认证',
    request: () => createMockRequest({
      headers: { authorization: authorizationHeaders.validAdminBearer() },
      user: decodedJwt.adminDecoded
    }),
    expected: {
      userSet: true,
      nextCalled: true,
      statusCode: undefined
    }
  },

  // 非管理员访问管理员端点场景
  userAccessAdminEndpoint: {
    name: '普通用户访问管理员端点',
    request: () => createMockRequest({
      user: decodedJwt.validDecoded
    }),
    expected: {
      statusCode: 403
    }
  }
};

/**
 * Token 重放攻击防护相关数据
 */
const tokenReplayData = {
  originalToken: generateTestToken(),
  reusedRefreshToken: null, // 标记为已使用的 refresh token

  // 检测重放的场景
  firstUseTimestamp: Date.now(),
  secondUseTimestamp: Date.now() + 1000, // 1 秒后再次使用

  // 标记为黑名单的 token
  blacklistedTokens: new Set(),

  // Token 版本控制（用于失效所有旧 token）
  tokenVersion: 1
};

/**
 * 边界值测试数据
 */
const boundaryValues = {
  veryLongToken: 'Bearer ' + 'a'.repeat(100000),
  emptyToken: 'Bearer ',
  nullToken: null,
  undefinedToken: undefined,
  spacesOnlyToken: 'Bearer    ',
  tokenWithNewlines: 'Bearer token\nwith\nnewlines',
  tokenWithTabs: 'Bearer token\twith\ttabs',
  binaryToken: 'Bearer ' + Buffer.from('binary data').toString('base64'),
  unicodeToken: 'Bearer 中文token😀',
  sqlInjectionToken: "Bearer '; DROP TABLE users; --",
  mongoInjectionToken: "Bearer {\"$ne\": null}"
};

/**
 * 导出所有 fixtures
 */
module.exports = {
  generateTestToken,
  tokenData,
  authorizationHeaders,
  createMockRequest,
  createMockResponse,
  testUsers,
  decodedJwt,
  errorResponses,
  middlewareScenarios,
  tokenReplayData,
  boundaryValues
};
