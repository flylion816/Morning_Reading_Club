const { getCurrentTenantId } = require('./tenantContext');

/**
 * 校验引用对象是否同租户
 * @param {Model} model Mongoose 模型
 * @param {ObjectId} id 引用的文档 ID
 * @returns {Promise<boolean>}
 */
async function ensureSameTenant(model, id) {
  if (!id) return true;
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('[tenantValidator] 缺少 tenantId 上下文，拒绝引用校验');
  }

  const doc = await model.findById(id).select('tenantId').lean();
  if (!doc) {
    throw new Error(`[tenantValidator] 引用对象不存在: ${model.modelName}#${id}`);
  }
  if (doc.tenantId && doc.tenantId.toString() !== tenantId.toString()) {
    throw new Error(`[tenantValidator] 跨租户引用拒绝: ${model.modelName}#${id}`);
  }
  return true;
}

module.exports = { ensureSameTenant };
