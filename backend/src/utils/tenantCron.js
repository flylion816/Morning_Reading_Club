const { withSystemContext } = require('./tenantContext');
const Tenant = require('../models/Tenant');

/**
 * 对所有活跃租户依次执行 fn(tenantId)
 * 用于"按租户独立处理"的定时任务
 */
async function forEachActiveTenant(fn) {
  const tenants = await withSystemContext(null, () =>
    Tenant.find({ status: 'active' }).select('_id slug').lean()
  );
  const results = [];
  for (const t of tenants) {
    try {
      const r = await withSystemContext(t._id, () => fn(t._id, t.slug));
      results.push({ tenantId: t._id, slug: t.slug, ok: true, value: r });
    } catch (err) {
      results.push({ tenantId: t._id, slug: t.slug, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = { forEachActiveTenant };
