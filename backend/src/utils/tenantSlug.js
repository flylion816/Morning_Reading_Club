const { withSystemContext } = require('./tenantContext');
const Tenant = require('../models/Tenant');

const slugCache = new Map();  // tenantId → { slug, expiresAt }
const SLUG_TTL = 5 * 60 * 1000;

async function resolveTenantSlug(tenantId) {
  const key = tenantId.toString();
  const now = Date.now();
  const hit = slugCache.get(key);
  if (hit && hit.expiresAt > now) return hit.slug;
  const t = await withSystemContext(null, () =>
    Tenant.findById(tenantId).select('slug').lean()
  );
  if (!t) throw new Error('租户不存在');
  slugCache.set(key, { slug: t.slug, expiresAt: now + SLUG_TTL });
  return t.slug;
}

module.exports = { resolveTenantSlug };
