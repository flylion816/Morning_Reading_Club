const mongoose = require('mongoose');
const { runWithTenant, withSystemContext } = require('../utils/tenantContext');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');

/**
 * 用户路由的租户上下文中间件
 * 必须在 authMiddleware 之后使用
 */
async function userTenantContext(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  let {tenantId} = req.user;

  // 老 token 没有 tenantId：从数据库查用户补全（兼容旧小程序客户端）
  // 用原生 collection 绕过 tenantPlugin，避免 ALS 上下文在中间件链中传播不稳定的问题
  if (!tenantId && process.env.ENABLE_LEGACY_DEFAULT_TENANT === 'true') {
    try {
      const userId = req.user.userId || req.user._id;
      const col = mongoose.connection.db.collection('users');
      const user = await col.findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { projection: { tenantId: 1 } }
      );
      if (user && user.tenantId) {
        tenantId = user.tenantId.toString();
      }
    } catch (e) {
      logger.warn('[TENANT-MW] legacy token tenantId lookup failed', { error: e.message });
    }
  }

  if (!tenantId) {
    return res.status(403).json({ code: 403, message: '令牌缺少租户信息，请重新登录' });
  }

  logger.debug('[TENANT-MW] userTenantContext', {
    tenantId,
    userId: req.user.userId || req.user._id,
    path: req.path,
    method: req.method
  });

  runWithTenant(
    {
      tenantId: new mongoose.Types.ObjectId(tenantId),
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
async function adminTenantContext(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  try {
    const { role } = req.admin;
    const isPlatformAdmin = role === 'platform_superadmin' || role === 'superadmin';
    const activeTenantHeader = req.header('X-Active-Tenant');
    let activeTenantId = null;

    if (activeTenantHeader && mongoose.Types.ObjectId.isValid(activeTenantHeader)) {
      activeTenantId = new mongoose.Types.ObjectId(activeTenantHeader);
    } else if (activeTenantHeader) {
      // Accept a legacy tenant slug in case an older admin bundle persisted
      // the slug instead of the MongoDB ObjectId.
      const tenant = await Tenant.findOne({
        slug: String(activeTenantHeader).trim().toLowerCase(),
        status: 'active'
      }).lean();
      if (tenant?._id) activeTenantId = tenant._id;
    } else if (isPlatformAdmin && req.admin.tenantId && mongoose.Types.ObjectId.isValid(req.admin.tenantId)) {
      // Some platform accounts are also bound to a default tenant.
      activeTenantId = new mongoose.Types.ObjectId(req.admin.tenantId);
    }

    if (isPlatformAdmin && activeTenantId) {
      req.resolvedTenantId = activeTenantId;
      return runWithTenant(
        {
          tenantId: activeTenantId,
          bypassTenantFilter: false,
          actor: { type: 'admin', id: req.admin.id, role }
        },
        () => next()
      );
    }

    if (isPlatformAdmin) {
      req.resolvedTenantId = null;
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
    req.resolvedTenantId = new mongoose.Types.ObjectId(req.admin.tenantId);
    return runWithTenant(
      {
        tenantId: req.resolvedTenantId,
        bypassTenantFilter: false,
        actor: { type: 'admin', id: req.admin.id, role }
      },
      () => next()
    );
  } catch (error) {
    return next(error);
  }
}

/**
 * 公开路由的租户上下文：优先从 X-Tenant-Slug 请求头解析，兼容 X-Wx-AppId
 * 用于未登录的小程序请求（如课程列表）和外部系统公开接口。
 */
async function publicTenantContext(req, res, next) {
  try {
    const rawTenantSlug = req.header('X-Tenant-Slug');
    const tenantSlug = rawTenantSlug ? String(rawTenantSlug).trim().toLowerCase() : null;
    const explicitWxAppId = req.header('X-Wx-AppId');
    const wxAppId = explicitWxAppId
      || (!tenantSlug && process.env.ENABLE_LEGACY_DEFAULT_TENANT === 'true' ? process.env.WECHAT_APPID : null);

    if (!tenantSlug && !wxAppId) {
      return res.status(400).json({ code: 400, message: '缺少租户标识：X-Tenant-Slug 或 X-Wx-AppId 请求头' });
    }

    const tenantBySlug = tenantSlug
      ? await Tenant.findOne({ slug: tenantSlug, status: 'active' }).lean()
      : null;
    if (tenantSlug && !tenantBySlug) {
      return res.status(403).json({ code: 403, message: '未识别的租户 slug' });
    }

    const tenantByWxAppId = wxAppId ? await Tenant.findByWxAppId(wxAppId) : null;
    if (wxAppId && !tenantByWxAppId) {
      return res.status(403).json({ code: 403, message: '未识别的小程序 appId' });
    }

    if (
      tenantBySlug &&
      tenantByWxAppId &&
      tenantBySlug._id.toString() !== tenantByWxAppId._id.toString()
    ) {
      return res.status(400).json({ code: 400, message: 'X-Tenant-Slug 与 X-Wx-AppId 指向不同租户' });
    }

    const tenant = tenantBySlug || tenantByWxAppId;

    logger.debug('[TENANT-MW] publicTenantContext', {
      wxAppId,
      tenantId: tenant._id,
      tenantSlug: tenant.slug,
      path: req.path,
      method: req.method
    });

    req.resolvedTenantId = tenant._id;
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
 * - 否则：走 publicTenantContext（需要 X-Tenant-Slug 或 X-Wx-AppId）
 */
function optionalAdminOrPublicTenantContext(req, res, next) {
  if (req.admin) return adminTenantContext(req, res, next);
  // An expired admin session must trigger the dashboard's 401 refresh flow
  // instead of being mistaken for an anonymous request missing tenant headers.
  const hasPublicTenant = req.header('X-Tenant-Slug') || req.header('X-Wx-AppId');
  if (!req.user && (req.header('X-Active-Tenant') || !hasPublicTenant) &&
      /^Bearer\s+\S+/i.test(req.header('Authorization') || '')) {
    return res.status(401).json({ code: 401, message: '管理员会话已失效，请重新登录' });
  }
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
