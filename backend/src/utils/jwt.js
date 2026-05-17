const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const redisManager = require('./redis');
require('dotenv').config();

const WS_TOKEN_TTL_SECONDS = 30;

// 生成Access Token
function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret-key-12345678', {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h'
  });
}

// 生成Refresh Token
function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-87654321', {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  });
}

/**
 * 验证普通 access token（用于业务请求）
 * 与 verifyWsToken 的区别：
 *   - verifyAccessToken：接受普通登录 token，拒绝 ws 专用 token（kind === 'ws'）
 *   - verifyWsToken：只接受 ws 专用 token（kind === 'ws'），拒绝普通 token
 */
function verifyAccessToken(token) {
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-key-12345678';
    const decoded = jwt.verify(token, secret);
    // access token 不应有 kind 字段，或 kind !== 'ws'
    // 防止有人用短期 wsToken 代替 access token 发起业务请求
    if (decoded.kind === 'ws') throw new Error('不能用 wsToken 作为 access token');
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token已过期');
    }
    throw new Error('Token无效');
  }
}

// 验证Refresh Token
function verifyRefreshToken(token) {
  try {
    const secret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-87654321';
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh Token已过期');
    }
    throw new Error('Refresh Token无效');
  }
}

// 生成Token对
function generateTokens(user) {
  const payload = {
    userId: user.id || user._id,
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

/**
 * 生成短期 wsToken（30s TTL，一次性消费，仅用于 WebSocket 握手）
 * kind='ws' 标记防止被误用为 access token
 */
function generateWsToken(user) {
  const jti = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    {
      userId: user.id || user._id,
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      kind: 'ws',
      jti
    },
    process.env.JWT_WS_SECRET || process.env.JWT_SECRET || 'dev-secret-key-12345678',
    { expiresIn: WS_TOKEN_TTL_SECONDS }
  );
}

/**
 * 验证 wsToken：只接受 kind === 'ws' 的 token
 */
function verifyWsToken(token) {
  const secret = process.env.JWT_WS_SECRET || process.env.JWT_SECRET || 'dev-secret-key-12345678';
  const decoded = jwt.verify(token, secret);
  if (decoded.kind !== 'ws') throw new Error('非 ws token');
  return decoded;
}

/**
 * 消费 wsToken：verify + Redis 一次性消费（setNxEx）
 * 同一个 jti 只能消费一次，防止重放
 */
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
  generateWsToken,
  verifyWsToken,
  consumeWsToken,
  WS_TOKEN_TTL_SECONDS
};
