const mongoose = require('mongoose');
const EnrollmentTemplate = require('../models/EnrollmentTemplate');
const { success, errors } = require('../utils/response');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { publishSyncEvent } = require('../services/sync.service');
const {
  ensureBuiltInTemplates,
  validateEnrollmentTemplateInput,
  normalizeTemplateFields,
  inferTemplatePreset,
  snapshotEnrollmentTemplate
} = require('../services/enrollment-template.service');

function publicTemplate(template) {
  const data = template?.toObject ? template.toObject() : template;
  const preset = data.preset || data.builtInKey || (
    Array.isArray(data.fields) &&
    data.fields.length === 2 &&
    data.fields.some(field => field.key === 'name') &&
    data.fields.some(field => field.key === 'phone')
      ? 'simple'
      : 'custom'
  );
  return {
    ...data,
    id: String(data._id || data.id),
    builtIn: Boolean(data.isBuiltIn),
    preset,
    fields: (data.fields || []).map(field => ({ ...field }))
  };
}

async function listEnrollmentTemplates(req, res, next) {
  try {
    const builtins = await ensureBuiltInTemplates(EnrollmentTemplate);
    const custom = await EnrollmentTemplate.find({ isBuiltIn: false }).sort({ createdAt: -1 }).lean();
    return res.json(success([...builtins.map(publicTemplate), ...custom.map(publicTemplate)]));
  } catch (error) { return next(error); }
}

async function getEnrollmentTemplate(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json(errors.notFound('报名模板不存在'));
    const template = await EnrollmentTemplate.findById(req.params.id).lean();
    if (!template) return res.status(404).json(errors.notFound('报名模板不存在'));
    return res.json(success(publicTemplate(template)));
  } catch (error) { return next(error); }
}

function requireTenant(req, res) {
  const tenantId = getCurrentTenantId() || req.resolvedTenantId;
  if (!tenantId) {
    res.status(403).json(errors.forbidden('请先选择具体租户'));
    return null;
  }
  return tenantId;
}

async function createEnrollmentTemplate(req, res, next) {
  try {
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const validationError = validateEnrollmentTemplateInput(req.body);
    if (validationError) return res.status(400).json(errors.badRequest(validationError));
    const template = await EnrollmentTemplate.create({
      tenantId,
      name: req.body.name.trim(),
      description: String(req.body.description || '').trim(),
      preset: inferTemplatePreset(req.body),
      fields: normalizeTemplateFields(req.body.fields),
      isBuiltIn: false,
      builtInKey: null
    });
    publishSyncEvent({ type: 'create', collection: 'enrollment_templates', documentId: String(template._id), data: template.toObject() });
    return res.status(201).json(success(publicTemplate(template), '报名模板创建成功'));
  } catch (error) { return next(error); }
}

async function updateEnrollmentTemplate(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json(errors.notFound('报名模板不存在'));
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const current = await EnrollmentTemplate.findOne({ _id: req.params.id, tenantId });
    if (!current) return res.status(404).json(errors.notFound('报名模板不存在'));
    if (current.isBuiltIn) return res.status(400).json(errors.badRequest('内置报名模板不能直接编辑，请先复制'));
    const validationError = validateEnrollmentTemplateInput(req.body);
    if (validationError) return res.status(400).json(errors.badRequest(validationError));
    if (!Number.isSafeInteger(req.body.revision) || req.body.revision !== current.revision) {
      return res.status(409).json(errors.conflict('报名模板已被修改，请刷新后重试'));
    }
    current.name = req.body.name.trim();
    current.description = String(req.body.description || '').trim();
    current.preset = inferTemplatePreset(req.body);
    current.fields = normalizeTemplateFields(req.body.fields);
    if (req.body.active !== undefined) {
      if (typeof req.body.active !== 'boolean') return res.status(400).json(errors.badRequest('模板状态无效'));
      current.active = req.body.active;
    }
    current.revision += 1;
    await current.save();
    publishSyncEvent({ type: 'update', collection: 'enrollment_templates', documentId: String(current._id), data: current.toObject() });
    return res.json(success(publicTemplate(current), '报名模板已保存'));
  } catch (error) { return next(error); }
}

async function copyEnrollmentTemplate(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json(errors.notFound('报名模板不存在'));
    const tenantId = requireTenant(req, res);
    if (!tenantId) return;
    const source = await EnrollmentTemplate.findOne({ _id: req.params.id, tenantId });
    if (!source) return res.status(404).json(errors.notFound('报名模板不存在'));
    const template = await EnrollmentTemplate.create({
      tenantId,
      name: String(req.body.name || `${source.name} 副本`).trim(),
      description: source.description,
      preset: source.preset || 'custom',
      fields: source.fields.map(field => field.toObject ? field.toObject() : { ...field }),
      isBuiltIn: false,
      builtInKey: null
    });
    return res.status(201).json(success(publicTemplate(template), '报名模板复制成功'));
  } catch (error) { return next(error); }
}

async function previewEnrollmentTemplate(req, res, next) {
  try {
    if (req.body && Object.keys(req.body).length) {
      const validationError = validateEnrollmentTemplateInput(req.body);
      if (validationError) return res.status(400).json(errors.badRequest(validationError));
      return res.json(success(snapshotEnrollmentTemplate({ ...req.body, id: 'preview', revision: 1 })));
    }
    return getEnrollmentTemplate(req, res, next);
  } catch (error) { return next(error); }
}

module.exports = {
  listEnrollmentTemplates,
  getEnrollmentTemplate,
  createEnrollmentTemplate,
  updateEnrollmentTemplate,
  copyEnrollmentTemplate,
  previewEnrollmentTemplate
};
