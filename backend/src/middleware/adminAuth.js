const Admin = require('../models/Admin');
const AdminSession = require('../models/AdminSession');
const { verifyAdminAccessToken, verifyAdminMaintenanceToken } = require('../utils/jwt');
const logger = require('../utils/logger');

function bearerToken(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
}

function isAdminTokenPayload(decoded) {
  return !!(
    decoded && decoded.iss === 'morning-reading' && decoded.aud === 'admin-api' &&
    decoded.tokenType === 'admin_access' && decoded.sub && decoded.sid &&
    decoded.sessionVersion >= 0 &&
    (isPlatformRole(decoded.role) || isTenantAdminRole(decoded.role))
  );
}

async function loadCurrentAdmin(decoded) {
  if (!isAdminTokenPayload(decoded)) return null;

  const [admin, session] = await Promise.all([
    Admin.findById(decoded.sub)
      .select('name email role permissions status tenantId +sessionVersion')
      .lean()
      .exec(),
    AdminSession.findOne({
      sessionId: decoded.sid,
      adminId: decoded.sub,
      sessionVersion: decoded.sessionVersion,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    }).lean().exec()
  ]);

  if (!admin || !session || admin.status !== 'active') return null;
  if ((admin.sessionVersion || 0) !== decoded.sessionVersion) return null;
  if (admin.role !== decoded.role) return null;
  const currentTenantId = admin.tenantId ? admin.tenantId.toString() : null;
  if (currentTenantId !== (decoded.tenantId || null)) return null;

  return {
    ...decoded,
    id: admin._id.toString(),
    sub: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions || [],
    tenantId: currentTenantId,
    sessionId: session.sessionId,
    sessionVersion: admin.sessionVersion || 0
  };
}

async function resolveAdmin(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const decoded = verifyAdminAccessToken(token);
  return loadCurrentAdmin(decoded);
}

async function adminAuthMiddleware(req, res, next) {
  try {
    const admin = await resolveAdmin(req);
    if (!admin) {
      return res.status(401).json({ code: 401, message: '管理员会话无效或已失效' });
    }
    req.admin = admin;
    return next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError' && error.name !== 'CastError') {
      logger.error('Admin auth lookup failed', { name: error.name });
      return res.status(503).json({ code: 503, message: '暂时无法验证管理员会话' });
    }
    return res.status(401).json({ code: 401, message: '令牌已过期或无效' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ code: 401, message: '未授权' });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ code: 403, message: '权限不足' });
    }
    return next();
  };
}

function isPlatformRole(role) {
  return role === 'platform_superadmin' || role === 'superadmin';
}

function isTenantAdminRole(role) {
  return role === 'tenant_admin' || role === 'admin' || role === 'operator';
}

function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ code: 401, message: '未授权' });
    if (isPlatformRole(req.admin.role)) return next();

    const hasPermission = permissions.some(permission => req.admin.permissions?.includes(permission));
    if (!hasPermission) return res.status(403).json({ code: 403, message: '权限不足' });
    return next();
  };
}

async function optionalAdminAuthMiddleware(req, res, next) {
  if (!bearerToken(req)) return next();
  try {
    const admin = await resolveAdmin(req);
    if (admin) req.admin = admin;
  } catch (error) {
    // Optional access never turns an invalid/expired token into an administrator identity.
  }
  return next();
}

function adminMaintenanceMiddleware(req, res, next) {
  try {
    const rawProof = req.get('x-admin-maintenance-proof');
    if (!rawProof || !req.admin) {
      return res.status(403).json({ code: 403, message: '请先完成数据库维护二次验证' });
    }
    const proof = verifyAdminMaintenanceToken(rawProof);
    const tenantId = req.admin.tenantId || null;
    if (
      proof.sub !== req.admin.id ||
      proof.sid !== req.admin.sessionId ||
      proof.sessionVersion !== req.admin.sessionVersion ||
      proof.role !== req.admin.role ||
      (proof.tenantId || null) !== tenantId
    ) {
      return res.status(403).json({ code: 403, message: '数据库维护授权已失效，请重新验证' });
    }
    return next();
  } catch (_) {
    return res.status(403).json({ code: 403, message: '数据库维护授权已过期，请重新验证' });
  }
}

function requireActiveMaintenanceTenant(req, res, next) {
  if (!req.admin || !isPlatformRole(req.admin.role)) {
    return res.status(403).json({ code: 403, message: '需要平台维护权限' });
  }
  if (!req.resolvedTenantId) {
    return res.status(400).json({ code: 400, message: '修改或删除记录前必须选择一个租户' });
  }
  return next();
}

function requireTypedRestoreConfirmation(req, res, next) {
  if (req.get('x-destructive-confirmation') !== 'RESTORE ALL DATA') {
    return res.status(400).json({ code: 400, message: '恢复前必须提交确认短语 RESTORE ALL DATA' });
  }
  return next();
}

module.exports = {
  adminAuthMiddleware,
  optionalAdminAuthMiddleware,
  requireRole,
  requirePermission,
  isPlatformRole,
  isTenantAdminRole,
  isAdminTokenPayload,
  loadCurrentAdmin,
  adminMaintenanceMiddleware,
  requireActiveMaintenanceTenant,
  requireTypedRestoreConfirmation
};
