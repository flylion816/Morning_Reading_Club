const { runWithTenant, withSystemContext } = require('../utils/tenantContext');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');

/**
 * 用户路由的租户上下文中间件
 * 必须在 authMiddleware 之后使用
 */
function userTenantContext(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }
  if (!req.user.tenantId) {
    return res.status(403).json({ code: 403, message: '令牌缺少租户信息，请重新登录' });
  }

  logger.debug('[TENANT-MW] userTenantContext', {
    tenantId: req.user.tenantId,
    userId: req.user.userId || req.user._id,
    path: req.path,
    method: req.method
  });

  runWithTenant(
    {
      tenantId: new mongoose.Types.ObjectId(req.user.tenantId),
      bypassTenantFilter: false,
      actor: { type: 'user', id: req.user.userId || req.user._id }
    },
    () => next()
  );
}

/**
 * 管理后台的租户上下文中间件
 * 必须在 adminAuthMiddleware 之后使用
 *
 * 规则：
 * - 普通 admin / tenant_admin / operator：用 admin.tenantId
 * - platform_superadmin：
 *   - 若请求头 X-Active-Tenant 存在且合法：作用于该租户
 *   - 否则：bypassTenantFilter = true（看全平台）
 */
function adminTenantContext(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  const role = req.admin.role;

  if (role === 'platform_superadmin' || role === 'superadmin') {
    const activeTenantHeader = req.header('X-Active-Tenant');
    if (activeTenantHeader && mongoose.Types.ObjectId.isValid(activeTenantHeader)) {
      return runWithTenant(
        {
          tenantId: new mongoose.Types.ObjectId(activeTenantHeader),
          bypassTenantFilter: false,
          actor: { type: 'admin', id: req.admin.id, role }
        },
        () => next()
      );
    }
    return runWithTenant(
      {
        tenantId: null,
        bypassTenantFilter: true,
        actor: { type: 'admin', id: req.admin.id, role }
      },
      () => next()
    );
  }

  if (!req.admin.tenantId) {
    return res.status(403).json({ code: 403, message: '管理员未绑定租户，请联系平台管理员' });
  }
  runWithTenant(
    {
      tenantId: new mongoose.Types.ObjectId(req.admin.tenantId),
      bypassTenantFilter: false,
      actor: { type: 'admin', id: req.admin.id, role }
    },
    () => next()
  );
}

/**
 * 公开路由的租户上下文：从 X-Wx-AppId 请求头解析
 * 用于未登录的小程序请求（如课程列表）
 */
async function publicTenantContext(req, res, next) {
  try {
    const wxAppId = req.header('X-Wx-AppId')
      || (process.env.ENABLE_LEGACY_DEFAULT_TENANT === 'true' ? process.env.WECHAT_APPID : null);
    if (!wxAppId) {
      return res.status(400).json({ code: 400, message: '缺少 X-Wx-AppId 请求头' });
    }
    const tenant = await Tenant.findByWxAppId(wxAppId);
    if (!tenant) {
      return res.status(403).json({ code: 403, message: '未识别的小程序 appId' });
    }

    logger.debug('[TENANT-MW] publicTenantContext', {
      wxAppId,
      tenantId: tenant._id,
      tenantSlug: tenant.slug,
      path: req.path,
      method: req.method
    });

    runWithTenant(
      {
        tenantId: tenant._id,
        bypassTenantFilter: false,
        actor: { type: 'anonymous' }
      },
      () => next()
    );
  } catch (error) {
    next(error);
  }
}

function optionalUserOrPublicTenantContext(req, res, next) {
  if (req.user) return userTenantContext(req, res, next);
  return publicTenantContext(req, res, next);
}

/**
 * 兼容管理后台和小程序的租户上下文
 * - 若请求已经过 adminAuthMiddleware（req.admin 存在）：走 adminTenantContext
 * - 否则：走 publicTenantContext（需要 X-Wx-AppId）
 */
function optionalAdminOrPublicTenantContext(req, res, next) {
  if (req.admin) return adminTenantContext(req, res, next);
  return publicTenantContext(req, res, next);
}

module.exports = {
  userTenantContext,
  adminTenantContext,
  withSystemContext,
  publicTenantContext,
  optionalUserOrPublicTenantContext,
  optionalAdminOrPublicTenantContext
};
