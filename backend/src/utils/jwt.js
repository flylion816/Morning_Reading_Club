const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const redisManager = require('./redis');
require('dotenv').config();

const WS_TOKEN_TTL_SECONDS = 30;
const ADMIN_ACCESS_TTL = process.env.JWT_ADMIN_EXPIRES_IN || '15m';
const ADMIN_REFRESH_TTL_SECONDS = Number(process.env.JWT_ADMIN_REFRESH_TTL_SECONDS || 7 * 24 * 60 * 60);
const TOKEN_ISSUER = 'morning-reading';

function signingKey(name) {
  const key = process.env[name];
  if (typeof key !== 'string' || key.length < 32) {
    throw new Error(`Missing or weak signing key: ${name}`);
  }
  return key;
}

function sign(payload, keyName, audience, type, expiresIn) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Token payload must be an object');
  }
  return jwt.sign(
    { ...payload, tokenType: type },
    signingKey(keyName),
    { algorithm: 'HS256', issuer: TOKEN_ISSUER, audience, expiresIn }
  );
}

function verify(token, keyName, audience, type) {
  const decoded = jwt.verify(token, signingKey(keyName), {
    algorithms: ['HS256'],
    issuer: TOKEN_ISSUER,
    audience
  });
  if (decoded.tokenType !== type) throw new Error('Token purpose is invalid');
  return decoded;
}

function generateAccessToken(payload) {
  return sign(payload, 'JWT_SECRET', 'mini-program-api', 'user_access', process.env.JWT_EXPIRES_IN || '2h');
}

function generateRefreshToken(payload) {
  return sign(
    payload,
    'JWT_REFRESH_SECRET',
    'mini-program-refresh',
    'user_refresh',
    process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  );
}

function verifyAccessToken(token) {
  try {
    return verify(token, 'JWT_SECRET', 'mini-program-api', 'user_access');
  } catch (error) {
    if (error.name === 'TokenExpiredError') throw new Error('Token已过期');
    throw new Error('Token无效');
  }
}

function verifyRefreshToken(token) {
  try {
    return verify(token, 'JWT_REFRESH_SECRET', 'mini-program-refresh', 'user_refresh');
  } catch (error) {
    if (error.name === 'TokenExpiredError') throw new Error('Refresh Token已过期');
    throw new Error('Refresh Token无效');
  }
}

function generateTokens(user) {
  const payload = {
    userId: (user.id || user._id).toString(),
    openid: user.openid,
    role: user.role || 'user',
    tenantId: user.tenantId ? user.tenantId.toString() : null
  };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const decodedAccessToken = jwt.decode(accessToken) || {};

  return {
    accessToken,
    refreshToken,
    expiresIn: (decodedAccessToken.exp || 0) - (decodedAccessToken.iat || 0)
  };
}

function generateAdminAccessToken(admin, sessionId) {
  return sign(
    {
      sub: admin._id.toString(),
      sid: sessionId,
      role: admin.role,
      tenantId: admin.tenantId ? admin.tenantId.toString() : null,
      sessionVersion: admin.sessionVersion || 0
    },
    'JWT_ADMIN_SECRET',
    'admin-api',
    'admin_access',
    ADMIN_ACCESS_TTL
  );
}

function generateAdminRefreshToken(admin, sessionId, jti) {
  return sign(
    {
      sub: admin._id.toString(),
      sid: sessionId,
      jti,
      sessionVersion: admin.sessionVersion || 0
    },
    'JWT_ADMIN_REFRESH_SECRET',
    'admin-refresh',
    'admin_refresh',
    ADMIN_REFRESH_TTL_SECONDS
  );
}

function verifyAdminAccessToken(token) {
  return verify(token, 'JWT_ADMIN_SECRET', 'admin-api', 'admin_access');
}

function verifyAdminRefreshToken(token) {
  return verify(token, 'JWT_ADMIN_REFRESH_SECRET', 'admin-refresh', 'admin_refresh');
}

function generateAdminMaintenanceToken(admin, sessionId) {
  return sign(
    {
      sub: admin._id.toString(),
      sid: sessionId,
      role: admin.role,
      tenantId: admin.tenantId ? admin.tenantId.toString() : null,
      sessionVersion: admin.sessionVersion || 0
    },
    'JWT_ADMIN_SECRET',
    'admin-maintenance',
    'admin_step_up',
    '5m'
  );
}

function verifyAdminMaintenanceToken(token) {
  return verify(token, 'JWT_ADMIN_SECRET', 'admin-maintenance', 'admin_step_up');
}

/** Generate a short-lived, one-use WebSocket token for an authenticated user. */
function generateWsToken(user) {
  const jti = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  return sign(
    {
      userId: (user.id || user._id).toString(),
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      jti
    },
    'JWT_WS_SECRET',
    'websocket',
    'ws_access',
    WS_TOKEN_TTL_SECONDS
  );
}

function verifyWsToken(token) {
  return verify(token, 'JWT_WS_SECRET', 'websocket', 'ws_access');
}

async function consumeWsToken(token) {
  const decoded = verifyWsToken(token);
  if (!decoded.jti) throw new Error('ws token 缺少 jti');

  const key = `ws-token:used:${decoded.jti}`;
  const ok = await redisManager.setNxEx(key, WS_TOKEN_TTL_SECONDS, '1');
  if (!ok) throw new Error('ws token 已使用或消费记录写入失败');
  return decoded;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens,
  generateAdminAccessToken,
  generateAdminRefreshToken,
  verifyAdminAccessToken,
  verifyAdminRefreshToken,
  generateAdminMaintenanceToken,
  verifyAdminMaintenanceToken,
  ADMIN_ACCESS_TTL,
  ADMIN_REFRESH_TTL_SECONDS,
  WS_TOKEN_TTL_SECONDS,
  generateWsToken,
  verifyWsToken,
  consumeWsToken
};
