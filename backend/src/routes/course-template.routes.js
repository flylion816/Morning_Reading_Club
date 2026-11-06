const express = require('express');
const mongoose = require('mongoose');
const CourseTemplate = require('../models/CourseTemplate');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { adminTenantContext } = require('../middleware/tenantContext');
const { success, errors } = require('../utils/response');
const { validateCourseTemplate } = require('../utils/course-template-validation');
const { defaultCourseTemplate } = require('../services/course-template.service');
const { publishSyncEvent } = require('../services/sync.service');

function syncTemplate(doc) {
  publishSyncEvent({ type: 'update', collection: 'course_templates', documentId: String(doc._id), data: doc.toObject ? doc.toObject() : doc });
}

const router = express.Router();
router.use(adminAuthMiddleware, adminTenantContext);
router.use((req, res, next) => {
  if (!req.resolvedTenantId) {
    // Platform administrators may browse the built-in template before choosing
    // a tenant. Writes still require an explicit tenant below.
    if (req.method === 'GET' && ['platform_superadmin', 'superadmin'].includes(req.admin?.role)) {
      return next();
    }
    return res.status(403).json(errors.forbidden('请先选择具体租户'));
  }
  return next();
});

router.get('/', async (req, res, next) => {
  try {
    if (!req.resolvedTenantId) {
      return res.json(success([defaultCourseTemplate()]));
    }
    const items = await CourseTemplate.find({ tenantId: req.resolvedTenantId }).sort({ createdAt: -1 }).lean();
    return res.json(success([defaultCourseTemplate(), ...items]));
  } catch (error) { return next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const error = validateCourseTemplate(req.body);
    if (error) return res.status(400).json(errors.badRequest(error));
    const doc = await CourseTemplate.create({
      tenantId: req.resolvedTenantId,
      name: req.body.name.trim(),
      modules: req.body.modules.map(module => ({ id: module.id, name: module.name.trim(), type: module.type })),
      extensions: req.body.extensions
    });
    syncTemplate(doc);
    return res.status(201).json(success(doc, '课程模板创建成功'));
  } catch (error) { return next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json(errors.notFound('模板不存在'));
    const error = validateCourseTemplate(req.body);
    if (error) return res.status(400).json(errors.badRequest(error));
    if (!Number.isSafeInteger(req.body.revision) || req.body.revision < 1) {
      return res.status(400).json(errors.badRequest('缺少有效模板版本'));
    }
    if (req.body.active !== undefined && typeof req.body.active !== 'boolean') {
      return res.status(400).json(errors.badRequest('模板状态无效'));
    }
    const updates = {
      name: req.body.name.trim(),
      modules: req.body.modules.map(module => ({ id: module.id, name: module.name.trim(), type: module.type })),
      extensions: req.body.extensions
    };
    if (req.body.active !== undefined) updates.active = req.body.active;
    const doc = await CourseTemplate.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.resolvedTenantId, revision: req.body.revision },
      { $set: updates, $inc: { revision: 1 } },
      { new: true, runValidators: true }
    ).lean();
    if (!doc) {
      const existing = await CourseTemplate.exists({ _id: req.params.id, tenantId: req.resolvedTenantId });
      if (!existing) return res.status(404).json(errors.notFound('模板不存在'));
      return res.status(409).json(errors.conflict('模板已被修改，请刷新后重试'));
    }
    syncTemplate(doc);
    return res.json(success(doc, '课程模板已保存'));
  } catch (error) { return next(error); }
});

module.exports = router;
