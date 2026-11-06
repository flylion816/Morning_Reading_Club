const crypto = require('crypto');
const AdminSession = require('../models/AdminSession');
const {
  generateAdminAccessToken,
  generateAdminRefreshToken,
  ADMIN_REFRESH_TTL_SECONDS
} = require('../utils/jwt');

const REFRESH_COOKIE = 'adminRefreshToken';
const REFRESH_PATH = '/api/v1/auth/admin';

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(24).toString('hex');
}

function digestJti(jti) {
  return crypto.createHash('sha256').update(jti).digest('hex');
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_PATH,
    maxAge: ADMIN_REFRESH_TTL_SECONDS * 1000
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, cookieOptions());
}

function clearRefreshCookie(res) {
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie(REFRESH_COOKIE, options);
}

function getRefreshCookie(req) {
  const cookieHeader = req.headers?.cookie || '';
  const prefix = `${REFRESH_COOKIE}=`;
  const pair = cookieHeader.split(';').map(item => item.trim()).find(item => item.startsWith(prefix));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(prefix.length));
  } catch (_) {
    return null;
  }
}

async function createAdminSession(admin) {
  const sessionId = randomId();
  const refreshJti = randomId();
  const expiresAt = new Date(Date.now() + ADMIN_REFRESH_TTL_SECONDS * 1000);
  await AdminSession.create({
    sessionId,
    adminId: admin._id,
    tenantId: admin.tenantId || null,
    sessionVersion: admin.sessionVersion || 0,
    refreshJtiHash: digestJti(refreshJti),
    expiresAt
  });
  return {
    sessionId,
    accessToken: generateAdminAccessToken(admin, sessionId),
    refreshToken: generateAdminRefreshToken(admin, sessionId, refreshJti)
  };
}

async function rotateAdminSession(admin, decodedRefresh) {
  const nextJti = randomId();
  const expiresAt = new Date(Date.now() + ADMIN_REFRESH_TTL_SECONDS * 1000);
  const updated = await AdminSession.findOneAndUpdate(
    {
      sessionId: decodedRefresh.sid,
      adminId: admin._id,
      sessionVersion: admin.sessionVersion || 0,
      refreshJtiHash: digestJti(decodedRefresh.jti),
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        refreshJtiHash: digestJti(nextJti),
        expiresAt,
        lastUsedAt: new Date(),
        tenantId: admin.tenantId || null
      }
    },
    { new: true }
  );
  if (!updated) return null;
  return {
    sessionId: decodedRefresh.sid,
    accessToken: generateAdminAccessToken(admin, decodedRefresh.sid),
    refreshToken: generateAdminRefreshToken(admin, decodedRefresh.sid, nextJti)
  };
}

async function revokeAdminSession(sessionId, adminId) {
  if (!sessionId || !adminId) return;
  await AdminSession.updateOne(
    { sessionId, adminId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

module.exports = {
  REFRESH_COOKIE,
  createAdminSession,
  rotateAdminSession,
  revokeAdminSession,
  digestJti,
  getRefreshCookie,
  setRefreshCookie,
  clearRefreshCookie
};
