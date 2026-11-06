const mongoose = require('mongoose');
const { getCurrentTenantId } = require('../utils/tenantContext');

const FIELD_DEFINITIONS = Object.freeze({
  name: { key: 'name', label: '姓名', required: true, group: '基本信息' },
  phone: { key: 'phone', label: '手机号', required: true, group: '基本信息' },
  gender: { key: 'gender', label: '性别', required: false, group: '基本信息' },
  province: { key: 'province', label: '省份/城市', required: false, group: '基本信息' },
  detailedAddress: { key: 'detailedAddress', label: '详细地址', required: false, group: '基本信息' },
  age: { key: 'age', label: '年龄', required: false, group: '基本信息' },
  referrer: { key: 'referrer', label: '推荐人', required: false, group: '报名信息' },
  hasReadBook: { key: 'hasReadBook', label: '是否读过相关书籍', required: false, group: '报名信息' },
  readTimes: { key: 'readTimes', label: '阅读次数', required: false, group: '报名信息' },
  enrollReason: { key: 'enrollReason', label: '参加课程的缘起', required: false, group: '报名信息' },
  expectation: { key: 'expectation', label: '对课程的期待', required: false, group: '报名信息' },
  commitment: { key: 'commitment', label: '是否承诺全程参加', required: false, group: '确认' }
});

const BUILT_IN_DEFINITIONS = Object.freeze({
  simple: {
    name: '简洁报名',
    description: '仅收集姓名和手机号，适合免费或轻量课程。',
    preset: 'simple',
    fields: ['name', 'phone']
  },
  full: {
    name: '七个习惯完整版',
    description: '沿用七个习惯晨读营的完整报名资料。',
    preset: 'full',
    fields: [
      ['name', true], ['phone', false], ['gender', true], ['province', true],
      ['detailedAddress', false], ['age', true], ['referrer', false],
      ['hasReadBook', true], ['readTimes', false], ['enrollReason', true],
      ['expectation', true], ['commitment', true]
    ]
  }
});

function fieldFromDefinition(key, requiredOverride) {
  const definition = FIELD_DEFINITIONS[key];
  if (!definition) return null;
  return {
    ...definition,
    required: requiredOverride === undefined ? definition.required : requiredOverride,
    placeholder: ''
  };
}

function builtInTemplate(key, id = `builtin:${key}`) {
  const definition = BUILT_IN_DEFINITIONS[key];
  if (!definition) return null;
  return {
    id,
    templateId: id,
    name: definition.name,
    description: definition.description,
    preset: definition.preset,
    builtInKey: key,
    isBuiltIn: true,
    active: true,
    revision: 1,
    fields: definition.fields.map(item => {
      const [fieldKey, required] = Array.isArray(item) ? item : [item, undefined];
      return fieldFromDefinition(fieldKey, required);
    })
  };
}

function normalizeTemplateFields(fields) {
  if (!Array.isArray(fields)) return null;
  const seen = new Set();
  const normalized = [];
  for (const item of fields) {
    const key = String(item?.key || '').trim();
    if (!FIELD_DEFINITIONS[key] || seen.has(key)) return null;
    seen.add(key);
    normalized.push({
      ...fieldFromDefinition(key, item.required === undefined ? FIELD_DEFINITIONS[key].required : Boolean(item.required)),
      label: String(item.label || FIELD_DEFINITIONS[key].label).trim(),
      placeholder: String(item.placeholder || '').trim(),
      group: String(item.group || FIELD_DEFINITIONS[key].group).trim()
    });
  }
  return normalized;
}

function inferTemplatePreset(input = {}) {
  if (['simple', 'full', 'custom'].includes(String(input.preset || ''))) {
    return input.preset;
  }
  const keys = Array.isArray(input.fields)
    ? input.fields.map(field => String(field?.key || '').trim()).filter(Boolean)
    : [];
  return keys.length === 2 && keys.includes('name') && keys.includes('phone')
    ? 'simple'
    : 'custom';
}

function validateEnrollmentTemplateInput(input) {
  const name = String(input?.name || '').trim();
  if (!name) return '模板名称不能为空';
  if (!Array.isArray(input?.fields) || input.fields.length === 0) return '至少配置一个报名字段';
  if (input.fields.length > Object.keys(FIELD_DEFINITIONS).length) return '报名字段数量超出限制';
  const fields = normalizeTemplateFields(input.fields);
  if (!fields) return '报名字段配置无效或存在重复字段';
  if (!fields.some(field => field.key === 'name')) return '报名模板必须包含姓名';
  if (!fields.some(field => field.key === 'phone')) return '报名模板必须包含手机号';
  if (input.preset !== undefined && !['simple', 'full', 'custom'].includes(String(input.preset))) {
    return '报名模板类型无效';
  }
  if (input.preset === 'simple' && fields.some(field => (
    ['name', 'phone'].includes(field.key) && !field.required
  ))) {
    return '简洁报名的姓名和手机号必须为必填';
  }
  return null;
}

function snapshotEnrollmentTemplate(template) {
  if (!template) return null;
  const source = template.toObject ? template.toObject() : template;
  return {
    templateId: String(source._id || source.id || source.templateId),
    name: source.name,
    description: source.description || '',
    preset: source.preset || source.builtInKey || inferTemplatePreset(source),
    mode: source.preset || source.builtInKey || inferTemplatePreset(source),
    builtInKey: source.builtInKey || null,
    revision: Number(source.revision) || 1,
    fields: (source.fields || []).map(field => ({
      key: field.key,
      label: field.label,
      required: Boolean(field.required),
      placeholder: field.placeholder || '',
      group: field.group || '基本信息'
    }))
  };
}

function legacyEnrollmentTemplate() {
  return builtInTemplate('full', 'legacy-full');
}

function normalizeValue(key, value) {
  if (value === undefined || value === null) return undefined;
  if (['age', 'readTimes'].includes(key)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  return typeof value === 'string' ? value.trim() : value;
}

function validateEnrollmentAnswers(snapshot, body = {}) {
  const template = snapshot || legacyEnrollmentTemplate();
  const configuredKeys = new Set(template.fields.map(field => field.key));
  const values = {};
  for (const field of template.fields) {
    const value = normalizeValue(field.key, body[field.key]);
    if (field.required && (value === undefined || value === '')) {
      return { error: `缺少必填字段: ${field.key}`, field: field.key };
    }
    if (value !== undefined && value !== '') values[field.key] = value;
  }

  if (configuredKeys.has('phone') && values.phone && !/^1\d{10}$/.test(String(values.phone))) {
    return { error: '手机号格式不正确', field: 'phone' };
  }
  if (values.age !== undefined && (!Number.isInteger(values.age) || values.age < 1 || values.age > 120)) {
    return { error: '年龄必须是1至120之间的整数', field: 'age' };
  }
  if (values.readTimes !== undefined && (!Number.isInteger(values.readTimes) || values.readTimes < 0)) {
    return { error: '阅读次数必须是非负整数', field: 'readTimes' };
  }
  if (values.gender !== undefined && !['male', 'female', 'prefer_not_to_say'].includes(values.gender)) {
    return { error: '性别选项无效', field: 'gender' };
  }
  if (values.hasReadBook !== undefined && !['yes', 'no'].includes(values.hasReadBook)) {
    return { error: '是否读过相关书籍的选项无效', field: 'hasReadBook' };
  }
  if (values.commitment !== undefined && !['yes', 'no'].includes(values.commitment)) {
    // Legacy clients used free-form commitment text. Preserve that behavior as
    // a positive commitment while new templates submit yes/no explicitly.
    values.commitment = String(values.commitment).trim() ? 'yes' : values.commitment;
  }
  if (configuredKeys.has('readTimes') && values.readTimes !== undefined && values.hasReadBook !== 'yes') {
    values.readTimes = 0;
  }

  return { values, answers: values, snapshot: template };
}

async function ensureBuiltInTemplates(EnrollmentTemplate) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw Object.assign(new Error('请先选择具体租户'), { statusCode: 400 });
  const result = [];
  for (const key of ['simple', 'full']) {
    let template = await EnrollmentTemplate.findOne({ builtInKey: key });
    if (!template) {
      try {
        template = await EnrollmentTemplate.create({
          ...builtInTemplate(key),
          tenantId,
          builtInKey: key,
          preset: BUILT_IN_DEFINITIONS[key].preset,
          isBuiltIn: true,
          id: undefined
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        template = await EnrollmentTemplate.findOne({ builtInKey: key });
      }
    }
    result.push(template);
  }
  return result;
}

async function resolveEnrollmentTemplate(templateId, tenantId, EnrollmentTemplate) {
  if (!templateId) return null;
  if (!tenantId) throw Object.assign(new Error('请先选择具体租户'), { statusCode: 400 });
  if (['simple', 'full'].includes(String(templateId))) {
    await ensureBuiltInTemplates(EnrollmentTemplate);
    return snapshotEnrollmentTemplate(await EnrollmentTemplate.findOne({ builtInKey: templateId }));
  }
  if (!mongoose.isValidObjectId(templateId)) {
    throw Object.assign(new Error('报名模板 ID 无效'), { statusCode: 400 });
  }
  const template = await EnrollmentTemplate.findOne({ _id: templateId, active: true });
  if (!template) throw Object.assign(new Error('报名模板不存在或已停用'), { statusCode: 400 });
  return snapshotEnrollmentTemplate(template);
}

module.exports = {
  FIELD_DEFINITIONS,
  BUILT_IN_DEFINITIONS,
  builtInTemplate,
  ensureBuiltInTemplates,
  validateEnrollmentTemplateInput,
  normalizeTemplateFields,
  inferTemplatePreset,
  snapshotEnrollmentTemplate,
  legacyEnrollmentTemplate,
  validateEnrollmentAnswers,
  resolveEnrollmentTemplate
};
