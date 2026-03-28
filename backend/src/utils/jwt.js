const jwt = require('jsonwebtoken');
require('dotenv').config();

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

// 验证Access Token
function verifyAccessToken(token) {
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-key-12345678';
    return jwt.verify(token, secret);
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
    role: user.role || 'user'
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

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens
};
