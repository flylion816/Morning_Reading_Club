const DEFAULT_TEMPLATE_ID = 'seven-habits';
const DEFAULT_TEMPLATE = Object.freeze({
  id: DEFAULT_TEMPLATE_ID,
  name: '七个习惯晨读营',
  active: true,
  builtIn: true,
  revision: 1,
  extensions: { duration: true, closingVideo: true, podcast: true },
  modules: [
    { id: 'meditation', name: '静一静', type: 'text' },
    { id: 'question', name: '问一问', type: 'text' },
    { id: 'learn', name: '学一学', type: 'text' },
    { id: 'content', name: '读一读', type: 'body' },
    { id: 'lookImage', name: '看一看', type: 'image' },
    { id: 'reflection', name: '想一想', type: 'text' },
    { id: 'action', name: '记一记', type: 'text' },
    { id: 'extract', name: '摘一摘', type: 'text' },
    { id: 'say', name: '说一说', type: 'text' }
  ]
});

function defaultCourseTemplate() {
  return { ...DEFAULT_TEMPLATE, extensions: { ...DEFAULT_TEMPLATE.extensions }, modules: DEFAULT_TEMPLATE.modules.map(module => ({ ...module })) };
}

function normalizeTemplateExtensions(extensions) {
  return { duration: extensions?.duration !== false, closingVideo: extensions?.closingVideo !== false, podcast: extensions?.podcast !== false };
}

function snapshotCourseTemplate(template) {
  return {
    templateId: String(template._id || template.id),
    name: template.name,
    revision: template.revision,
    extensions: normalizeTemplateExtensions(template.extensions),
    modules: template.modules.map(module => ({ id: module.id, name: module.name, type: module.type }))
  };
}

function validateModuleValues(snapshot, values) {
  if (!snapshot || !Array.isArray(snapshot.modules)) return '课程模板无效';
  if (!values || typeof values !== 'object' || Array.isArray(values)) return '课程模块内容无效';
  const modules = new Map(snapshot.modules.map(module => [module.id, module]));
  for (const [id, value] of Object.entries(values)) {
    const module = modules.get(id);
    if (!module || typeof value !== 'string') return '课程模块内容无效';
    const limit = module.type === 'body' ? 20000 : module.type === 'image' ? 1000 : module.type === 'shortText' ? 200 : 500;
    if (value.length > limit) return `模块“${module.name}”内容超过长度限制`;
    if (module.type === 'image' && value && !/^https?:\/\//i.test(value) && !/^\/uploads\//.test(value)) {
      return `模块“${module.name}”图片地址无效`;
    }
  }
  return null;
}

function isCustomTemplate(snapshot) {
  return !!snapshot && snapshot.templateId !== DEFAULT_TEMPLATE_ID;
}

function moduleContent(snapshot, values = {}) {
  const body = snapshot.modules.find(module => module.type === 'body');
  return body ? values[body.id] || '' : '';
}

function supportsCourseTemplate(req, snapshot) {
  return !isCustomTemplate(snapshot) || !!req.admin || req.headers?.['x-course-template-version'] === '1';
}

async function resolveCourseTemplate(id, tenantId) {
  if (id !== undefined && !tenantId) throw Object.assign(new Error('请先选择具体租户'), { statusCode: 400 });
  if (id === undefined || id === DEFAULT_TEMPLATE_ID) return snapshotCourseTemplate(defaultCourseTemplate());
  const mongoose = require('mongoose');
  if (!tenantId || !mongoose.isValidObjectId(id)) throw Object.assign(new Error('请选择有效的课程模板和租户'), { statusCode: 400 });
  const CourseTemplate = require('../models/CourseTemplate');
  const template = await CourseTemplate.findOne({ _id: id, tenantId, active: true }).lean();
  if (!template) throw Object.assign(new Error('课程模板不存在或已停用'), { statusCode: 400 });
  return snapshotCourseTemplate(template);
}

async function refreshUnlockedPeriodTemplateSnapshot(period, hasSections = false) {
  if (!period || period.courseTemplateLocked || hasSections) return false;
  const templateId = period.courseTemplateSnapshot?.templateId;
  if (!templateId) return false;
  if (!templateId || templateId === DEFAULT_TEMPLATE_ID) return false;
  const mongoose = require('mongoose');
  if (!mongoose.isValidObjectId(templateId)) return false;
  const CourseTemplate = require('../models/CourseTemplate');
  const template = await CourseTemplate.findOne({ _id: templateId, active: true }).lean();
  if (!template) return false;
  const nextSnapshot = snapshotCourseTemplate(template);
  if (JSON.stringify(period.courseTemplateSnapshot) === JSON.stringify(nextSnapshot)) return false;
  period.courseTemplateSnapshot = nextSnapshot;
  period.markModified('courseTemplateSnapshot');
  await period.save();
  return true;
}

module.exports = {
  DEFAULT_TEMPLATE_ID, defaultCourseTemplate, snapshotCourseTemplate, validateModuleValues,
  isCustomTemplate, moduleContent, supportsCourseTemplate, resolveCourseTemplate, normalizeTemplateExtensions,
  refreshUnlockedPeriodTemplateSnapshot
};
