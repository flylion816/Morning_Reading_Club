const { getCurrentTenantId } = require('./tenantContext');

/**
 * 显式 keyGenerator 调用方使用。
 * ⚠️ 此函数与 buildDefaultKey 的行为不同：
 *   - buildDefaultKey（中间件层）：无上下文时降级返回 null，让请求正常通过但不缓存。
 *     适用于"某些路由可能无租户上下文"的情形（如健康检查走同一个 cacheMiddleware）。
 *   - tenantCacheKey（route 层显式调用）：无上下文时抛错。
 *     因为路由配置了 keyGenerator 就代表这条路由一定需要缓存、一定有租户上下文；
 *     缺失说明路由中间件链路配置错误，应在开发期暴露而非静默跳过。
 */
function tenantCacheKey(suffix) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('[cache] 缺少 tenantId 上下文，无法生成缓存 key');
  return `cache:tenant:${tenantId}:${suffix}`;
}

module.exports = { tenantCacheKey };
