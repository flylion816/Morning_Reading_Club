const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');

const storage = new AsyncLocalStorage();

/**
 * 在异步上下文中运行函数，附加租户上下文
 * @param {Object} ctx { tenantId, bypassTenantFilter, actor }
 * @param {Function} fn 要在该上下文中运行的函数
 */
function runWithTenant(ctx, fn) {
  return storage.run(ctx, fn);
}

/**
 * 获取当前请求的租户上下文（可能为 undefined，调用方需判空）
 */
function getTenantContext() {
  return storage.getStore();
}

/**
 * 显式获取 tenantId（无上下文则返回 null）
 */
function getCurrentTenantId() {
  const ctx = storage.getStore();
  return ctx ? ctx.tenantId : null;
}

/**
 * 是否绕过租户过滤
 */
function shouldBypassFilter() {
  const ctx = storage.getStore();
  return !!(ctx && ctx.bypassTenantFilter);
}

/**
 * 系统脚本/迁移/Cron 用：手动设置租户上下文，绕过 HTTP 请求链路
 * - tenantId 有值 → 以该租户身份运行，bypassTenantFilter = false
 * - tenantId 为 null → 跨租户 bypass 模式，仅供迁移脚本、全量备份使用
 *
 * ⚠️ Services / Controllers 从本文件（utils）导入此函数，不要从 middleware 导入
 */
function withSystemContext(tenantId, fn) {
  return runWithTenant(
    {
      tenantId: tenantId ? new mongoose.Types.ObjectId(tenantId) : null,
      bypassTenantFilter: !tenantId,
      actor: { type: 'system' }
    },
    fn
  );
}

module.exports = {
  runWithTenant,
  getTenantContext,
  getCurrentTenantId,
  shouldBypassFilter,
  withSystemContext
};
