const FULL_FIELDS = [
  { id: 'name', label: '姓名', required: true, step: 1 },
  { id: 'phone', label: '手机号', required: false, step: 1 },
  { id: 'gender', label: '性别', required: true, step: 2 },
  { id: 'province', label: '所在地区', required: true, step: 2 },
  { id: 'detailedAddress', label: '详细地址', required: false, step: 2 },
  { id: 'age', label: '年龄', required: true, step: 2 },
  { id: 'hasReadBook', label: '是否读过相关书籍', required: true, step: 2 },
  { id: 'readTimes', label: '阅读次数', required: false, step: 2 },
  { id: 'enrollReason', label: '参加课程的缘起', required: true, step: 2 },
  { id: 'expectation', label: '对课程的期待', required: true, step: 2 },
  { id: 'commitment', label: '是否承诺全程参加', required: true, step: 1 },
  { id: 'referrer', label: '推荐人', required: false, step: 2 }
];

const SIMPLE_FIELDS = [
  { id: 'name', label: '姓名', required: true, placeholder: '请输入姓名' },
  { id: 'phone', label: '手机号', required: true, placeholder: '请输入手机号' }
];

function getPeriodId(period) {
  return period && (period._id || period.id || '') || '';
}

function getRawTemplate(period = {}) {
  return period.enrollmentTemplateSnapshot ||
    period.enrollmentTemplate ||
    period.registrationTemplate ||
    period.enrollmentConfig?.template ||
    {};
}

function normalizeEnrollmentTemplate(period = {}) {
  const raw = getRawTemplate(period);
  const rawMode = raw.mode || raw.type || raw.formMode || period.enrollmentFormMode;
  const configuredFields = Array.isArray(raw.fields) ? raw.fields : [];
  const configuredKeys = configuredFields
    .map(item => item.id || item.key)
    .filter(Boolean);
  const simpleByFields = configuredKeys.length === 2
    && configuredKeys.includes('name')
    && configuredKeys.includes('phone');
  const mode = ['simple', 'basic', 'compact'].includes(
    String(rawMode || raw.preset || raw.builtInKey).toLowerCase()
  ) || simpleByFields
    ? 'simple'
    : 'full';
  const sourceFields = configuredFields.length
    ? configuredFields.map(item => ({
      id: item.id || item.key,
      label: item.label || item.id || item.key,
      required: item.required !== undefined ? !!item.required : false,
      step: item.step || (['name', 'phone', 'commitment'].includes(item.id || item.key) ? 1 : 2)
    }))
    : (mode === 'simple' ? SIMPLE_FIELDS : FULL_FIELDS);
  const fields = sourceFields.map(field => {
    const configured = configuredFields.find(item => (item.id || item.key) === field.id) || {};
    return {
      ...field,
      ...configured,
      id: field.id,
      required: configured.required !== undefined ? !!configured.required : field.required,
      label: configured.label || field.label
    };
  });

  return {
    id: raw.templateId || raw.id || period.enrollmentTemplateId || '',
    revision: raw.revision || raw.version || period.enrollmentTemplateVersion || 0,
    name: raw.name || raw.templateName || (mode === 'simple' ? '简洁报名' : '七个习惯完整版'),
    mode,
    isSimple: mode === 'simple',
    fields,
    enabled: period.enrollmentOpen !== false && period.enrollmentEnabled !== false,
    requirePhone: mode === 'simple' || fields.some(field => field.id === 'phone' && field.required)
  };
}

function normalizeReadingAccess(period = {}) {
  const raw = period.readingAccess;
  const mode = typeof raw === 'string'
    ? raw
    : raw?.mode || raw?.type || period.readingMode || period.accessMode || '';
  const normalized = String(mode).toLowerCase();
  const isPublic = ['open', 'public', 'public_reading', 'without_enrollment'].includes(normalized);
  return {
    mode: isPublic ? 'open' : 'enrolled',
    isPublic,
    label: isPublic ? '公开阅读' : '报名后阅读',
    allowEnrollment: raw && typeof raw === 'object' && raw.allowEnrollment !== undefined
      ? !!raw.allowEnrollment
      : period.enrollmentOpen !== false
  };
}

function normalizeAmountInCents(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
}

function formatAmountInYuan(value) {
  return (normalizeAmountInCents(value) / 100).toFixed(2);
}

function buildEnrollmentPayload(form = {}, period, template, inviterId = '') {
  const periodId = getPeriodId(period) || form.periodId || '';
  const payload = {
    periodId,
    name: String(form.name || '').trim(),
    phone: String(form.phone || '').trim() || undefined,
    inviterId: inviterId || undefined,
    enrollmentTemplateId: template?.id || undefined,
    enrollmentTemplateVersion: template?.revision || undefined
  };

  if (!template?.isSimple) {
    Object.assign(payload, {
      gender: form.gender,
      province: form.province,
      detailedAddress: form.detailedAddress,
      age: parseInt(form.age, 10) || undefined,
      referrer: form.referrer,
      hasReadBook: form.hasReadBook,
      readTimes: form.hasReadBook === 'yes' ? parseInt(form.readTimes, 10) || 0 : 0,
      enrollReason: form.enrollReason,
      expectation: form.expectation,
      commitment: form.commitment
    });
  }

  return payload;
}

function validateEnrollmentForm(form = {}, template = normalizeEnrollmentTemplate()) {
  const errors = {};
  if (!form.periodId) errors.periodId = '请选择报名期数';
  const fields = Array.isArray(template?.fields) && template.fields.length
    ? template.fields
    : FULL_FIELDS;
  const configured = new Map(fields.map(field => [field.id, field]));

  fields.forEach(field => {
    const value = form[field.id];
    if (field.required && (value === undefined || value === null || String(value).trim() === '')) {
      errors[field.id] = `请填写${field.label || field.id}`;
    }
  });

  if (configured.has('phone') && form.phone && !/^1\d{10}$/.test(String(form.phone).trim())) {
    errors.phone = '请输入正确的11位手机号';
  }

  if (configured.has('age') && form.age !== undefined && form.age !== '') {
    const age = parseInt(form.age, 10);
    if (isNaN(age) || age <= 10 || age > 120) {
      errors.age = '年龄必须是11-120之间的数字';
    }
  }

  if (configured.has('hasReadBook') && form.hasReadBook === 'yes' && configured.has('readTimes')) {
    if (!form.readTimes || parseInt(form.readTimes, 10) < 1) {
      errors.readTimes = '阅读次数必须是正整数';
    }
  }

  return errors;
}

function getEnrollmentPrice(period = {}) {
  const amountInCents = normalizeAmountInCents(period.price);
  return {
    amountInCents,
    isFree: amountInCents === 0,
    display: amountInCents === 0 ? '免费' : `¥${formatAmountInYuan(amountInCents)}`
  };
}

module.exports = {
  FULL_FIELDS,
  SIMPLE_FIELDS,
  getPeriodId,
  normalizeEnrollmentTemplate,
  normalizeReadingAccess,
  normalizeAmountInCents,
  formatAmountInYuan,
  buildEnrollmentPayload,
  validateEnrollmentForm,
  getEnrollmentPrice
};
