const { getCurrentTenantId, shouldBypassFilter } = require('../../utils/tenantContext');

/**
 * 租户上下文缺失时的专用错误类，便于调用方区分租户隔离错误和其他运行时错误
 */
class TenantContextError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenantContextError';
  }
}

function toIdString(value) {
  if (!value) return '';
  return value.toString ? value.toString() : String(value);
}

/**
 * 从 query filter 里的 tenantId 值中提取真实 ObjectId。
 * 支持递归解包 $eq（如某些 Mongoose 插件或测试工具会生成 { $eq: { $eq: realId } }）。
 * depth 最大为 3，防止无限递归。
 * 返回 undefined 表示该 tenantId 表达式不是合法的等值约束（如 $in/$ne/$exists），
 * 调用方应拒绝此查询。
 */
function explicitTenantValue(value, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 3) return undefined;
  if (
    !value ||
    typeof value !== 'object' ||
    value._bsontype === 'ObjectId' ||
    value._bsontype === 'ObjectID'
  ) {
    return value;
  }
  if (Object.prototype.hasOwnProperty.call(value, '$eq')) {
    return explicitTenantValue(value.$eq, depth + 1);
  }
  return undefined;
}

function requireTenant(operation) {
  if (shouldBypassFilter()) return null;
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new TenantContextError(
      `[tenantPlugin] ${operation} 缺少 tenantId 上下文。HTTP 请求请检查路由中间件；脚本请显式使用 withSystemContext。`
    );
  }
  return tenantId;
}

function applyTenantToQuery(query, tenantId) {
  const filter = query.getFilter();
  if (Object.prototype.hasOwnProperty.call(filter, 'tenantId')) {
    const explicit = explicitTenantValue(filter.tenantId);
    if (!explicit || toIdString(explicit) !== toIdString(tenantId)) {
      throw new Error('[tenantPlugin] 查询条件包含非当前租户 tenantId，已拒绝');
    }
  }
  query.setQuery({ ...filter, tenantId });
}

function applyTenantToMatch(match, tenantId) {
  if (Object.prototype.hasOwnProperty.call(match, 'tenantId')) {
    const explicit = explicitTenantValue(match.tenantId);
    if (!explicit || toIdString(explicit) !== toIdString(tenantId)) {
      throw new Error('[tenantPlugin] aggregate $match 包含非当前租户 tenantId，已拒绝');
    }
  }
  match.tenantId = tenantId;
}

/**
 * 多租户隔离插件
 * 用法：在每个需要租户隔离的 Schema 上调用 schema.plugin(tenantPlugin)
 *
 * 行为：
 * 1. 所有 find/findOne/count/update/delete 自动强制为当前 ALS tenantId
 * 2. 写入（save/insertMany）时自动填充 tenantId
 * 3. shouldBypassFilter() 返回 true 时不注入（仅系统脚本、platform_superadmin 跨租户只读视图使用）
 * 4. 上下文中没有 tenantId 且非 bypass 时一律抛错，避免遗漏中间件时静默跨租户查询
 */
function tenantPlugin(schema) {
  const queryHooks = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndRemove',
    'findOneAndReplace',
    'count',
    'countDocuments',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'replaceOne'
  ];

  queryHooks.forEach((hook) => {
    schema.pre(hook, function (next) {
      try {
        if (shouldBypassFilter()) return next();
        applyTenantToQuery(this, requireTenant(hook));
        return next();
      } catch (error) {
        return next(error);
      }
    });
  });

  schema.pre('aggregate', function (next) {
    try {
      if (shouldBypassFilter()) return next();

      const tenantId = requireTenant('aggregate');
      const pipeline = this.pipeline();
      const firstStage = pipeline[0];

      if (firstStage?.$match) {
        applyTenantToMatch(firstStage.$match, tenantId);
      } else if (firstStage?.$geoNear) {
        firstStage.$geoNear.query = {
          ...(firstStage.$geoNear.query || {}),
          tenantId
        };
      } else if (firstStage?.$search || firstStage?.$vectorSearch) {
        pipeline.splice(1, 0, { $match: { tenantId } });
      } else {
        pipeline.unshift({ $match: { tenantId } });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  });

  schema.pre('save', function (next) {
    try {
      if (shouldBypassFilter()) return next();
      const tenantId = requireTenant('save');
      if (this.tenantId && toIdString(this.tenantId) !== toIdString(tenantId)) {
        return next(new Error('[tenantPlugin] save 时 tenantId 与当前上下文不一致'));
      }
      this.tenantId = this.tenantId || tenantId;
      return next();
    } catch (error) {
      return next(error);
    }
  });

  schema.pre('insertMany', function (next, docs) {
    try {
      if (shouldBypassFilter()) return next();
      const tenantId = requireTenant('insertMany');
      if (Array.isArray(docs)) {
        docs.forEach((doc) => {
          if (doc.tenantId && toIdString(doc.tenantId) !== toIdString(tenantId)) {
            throw new Error('[tenantPlugin] insertMany 中存在非当前租户数据');
          }
          doc.tenantId = doc.tenantId || tenantId;
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  });
}

module.exports = tenantPlugin;
module.exports.TenantContextError = TenantContextError;
