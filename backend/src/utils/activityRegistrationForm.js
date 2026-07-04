const crypto = require('crypto');

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'phone',
  'single_select',
  'multi_select',
  'date',
  'boolean'
];

const SELECT_FIELD_TYPES = ['single_select', 'multi_select'];
const STAT_FIELD_TYPES = ['single_select', 'multi_select', 'boolean'];

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function cleanText(value, maxLength = 200) {
  const text = String(value ?? '').trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function sortFields(fields = []) {
  return [...fields].sort((a, b) => {
    const orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 0;
    const orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0;
    return orderA - orderB;
  });
}

function normalizeRegistrationFormConfig(input = {}) {
  const enabled = !!input.enabled;
  const rawFields = Array.isArray(input.fields) ? input.fields : [];

  if (!enabled) {
    return { enabled: false, fields: [] };
  }

  if (rawFields.length === 0) {
    throw createValidationError('请至少添加一个报名表单字段');
  }

  const fieldIds = new Set();
  const fields = rawFields.map((field, index) => {
    const type = cleanText(field.type, 40);
    if (!FIELD_TYPES.includes(type)) {
      throw createValidationError('报名表单字段类型无效');
    }

    const label = cleanText(field.label, 40);
    if (!label) {
      throw createValidationError('报名表单字段名称不能为空');
    }

    const fieldId = cleanText(field.fieldId, 40) || createId('f');
    if (fieldIds.has(fieldId)) {
      throw createValidationError('报名表单字段 ID 不能重复');
    }
    fieldIds.add(fieldId);

    const rawOptions = Array.isArray(field.options) ? field.options : [];
    const optionIds = new Set();
    const options = SELECT_FIELD_TYPES.includes(type)
      ? rawOptions.map((option) => {
        const optionId = cleanText(option.optionId, 40) || createId('o');
        const optionLabel = cleanText(option.label, 40);
        if (!optionLabel) {
          throw createValidationError('报名表单选项名称不能为空');
        }
        if (optionIds.has(optionId)) {
          throw createValidationError('报名表单选项 ID 不能重复');
        }
        optionIds.add(optionId);
        return { optionId, label: optionLabel };
      })
      : [];

    if (SELECT_FIELD_TYPES.includes(type) && options.length === 0) {
      throw createValidationError('单选或多选字段至少需要一个选项');
    }

    return {
      fieldId,
      label,
      type,
      required: !!field.required,
      placeholder: cleanText(field.placeholder, 80),
      options,
      includeInStats: STAT_FIELD_TYPES.includes(type) ? !!field.includeInStats : false,
      sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : index
    };
  });

  return {
    enabled: true,
    fields: sortFields(fields).map((field, index) => ({
      ...field,
      sortOrder: index
    }))
  };
}

function getPublicRegistrationForm(form = {}) {
  const enabled = !!form.enabled;
  const fields = enabled && Array.isArray(form.fields)
    ? sortFields(form.fields).map((field, index) => ({
      fieldId: field.fieldId,
      label: field.label,
      type: field.type,
      required: !!field.required,
      placeholder: field.placeholder || '',
      options: SELECT_FIELD_TYPES.includes(field.type)
        ? (field.options || []).map((option) => ({
          optionId: option.optionId,
          label: option.label
        }))
        : [],
      includeInStats: STAT_FIELD_TYPES.includes(field.type) ? !!field.includeInStats : false,
      sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : index
    }))
    : [];

  return { enabled: enabled && fields.length > 0, fields };
}

function getSubmittedValue(submittedAnswers, fieldId) {
  if (Array.isArray(submittedAnswers)) {
    const found = submittedAnswers.find((answer) => answer && answer.fieldId === fieldId);
    return found ? found.value : undefined;
  }
  if (submittedAnswers && typeof submittedAnswers === 'object') {
    return submittedAnswers[fieldId];
  }
  return undefined;
}

function assertNoUnknownFields(submittedAnswers, knownFieldIds) {
  if (!submittedAnswers || typeof submittedAnswers !== 'object') return;
  const submittedIds = Array.isArray(submittedAnswers)
    ? submittedAnswers.map((answer) => answer && answer.fieldId).filter(Boolean)
    : Object.keys(submittedAnswers);
  const unknown = submittedIds.find((fieldId) => !knownFieldIds.has(fieldId));
  if (unknown) {
    throw createValidationError('报名表单字段已更新，请刷新后重试');
  }
}

function isEmptyValue(value, type) {
  if (type === 'boolean') return value === undefined || value === null || value === '';
  if (type === 'multi_select') return !Array.isArray(value) || value.length === 0;
  return value === undefined || value === null || String(value).trim() === '';
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  throw createValidationError('是/否字段答案无效');
}

function normalizeAnswer(field, rawValue) {
  if (field.required && isEmptyValue(rawValue, field.type)) {
    throw createValidationError(`请填写${field.label}`);
  }
  if (!field.required && isEmptyValue(rawValue, field.type)) {
    return null;
  }

  const optionMap = new Map((field.options || []).map((option) => [option.optionId, option]));

  if (field.type === 'text' || field.type === 'textarea') {
    const value = cleanText(rawValue, field.type === 'textarea' ? 2000 : 200);
    return { value, valueText: value };
  }

  if (field.type === 'phone') {
    const value = cleanText(rawValue, 30);
    if (!/^1\d{10}$/.test(value)) {
      throw createValidationError(`${field.label}格式不正确`);
    }
    return { value, valueText: value };
  }

  if (field.type === 'number') {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw createValidationError(`${field.label}必须是数字`);
    }
    return { value, valueText: String(value) };
  }

  if (field.type === 'date') {
    const value = cleanText(rawValue, 30);
    if (Number.isNaN(new Date(value).getTime())) {
      throw createValidationError(`${field.label}日期无效`);
    }
    return { value, valueText: value };
  }

  if (field.type === 'boolean') {
    const value = normalizeBoolean(rawValue);
    return { value, valueText: value ? '是' : '否' };
  }

  if (field.type === 'single_select') {
    const value = cleanText(rawValue, 40);
    const option = optionMap.get(value);
    if (!option) {
      throw createValidationError(`${field.label}选项无效`);
    }
    return { value, valueText: option.label };
  }

  if (field.type === 'multi_select') {
    if (!Array.isArray(rawValue)) {
      throw createValidationError(`${field.label}选项无效`);
    }
    const value = rawValue.map((item) => cleanText(item, 40)).filter(Boolean);
    const labels = value.map((optionId) => {
      const option = optionMap.get(optionId);
      if (!option) {
        throw createValidationError(`${field.label}选项无效`);
      }
      return option.label;
    });
    return { value, valueText: labels.join('、') };
  }

  throw createValidationError('报名表单字段类型无效');
}

function normalizeFormAnswers(registrationForm = {}, submittedAnswers = {}) {
  const publicForm = getPublicRegistrationForm(registrationForm);
  if (!publicForm.enabled) {
    return {
      formSnapshot: { enabled: false, fields: [] },
      formAnswers: []
    };
  }

  const knownFieldIds = new Set(publicForm.fields.map((field) => field.fieldId));
  assertNoUnknownFields(submittedAnswers, knownFieldIds);

  const formAnswers = publicForm.fields.reduce((answers, field) => {
    const rawValue = getSubmittedValue(submittedAnswers, field.fieldId);
    const normalized = normalizeAnswer(field, rawValue);
    if (!normalized) return answers;
    answers.push({
      fieldId: field.fieldId,
      label: field.label,
      type: field.type,
      value: normalized.value,
      valueText: normalized.valueText
    });
    return answers;
  }, []);

  return {
    formSnapshot: publicForm,
    formAnswers
  };
}

function getAnswerValue(registration, fieldId) {
  const answer = (registration.formAnswers || []).find((item) => item.fieldId === fieldId);
  return answer ? answer.value : undefined;
}

function addStatCount(option, registrationId) {
  option.count += 1;
  option.registrationIds.push(registrationId);
}

function buildFormStats(registrationForm = {}, registrations = []) {
  const publicForm = getPublicRegistrationForm(registrationForm);
  if (!publicForm.enabled) return [];

  return publicForm.fields
    .filter((field) => field.includeInStats && STAT_FIELD_TYPES.includes(field.type))
    .map((field) => {
      const options = field.type === 'boolean'
        ? [
          { optionId: 'true', label: '是', count: 0, registrationIds: [] },
          { optionId: 'false', label: '否', count: 0, registrationIds: [] }
        ]
        : (field.options || []).map((option) => ({
          optionId: option.optionId,
          label: option.label,
          count: 0,
          registrationIds: []
        }));
      const optionMap = new Map(options.map((option) => [option.optionId, option]));
      let totalAnswered = 0;

      registrations.forEach((registration) => {
        const registrationId = registration._id
          ? registration._id.toString()
          : (registration.registrationId || '').toString();
        const value = getAnswerValue(registration, field.fieldId);
        if (value === undefined || value === null || value === '') return;
        totalAnswered += 1;

        if (field.type === 'multi_select' && Array.isArray(value)) {
          value.forEach((optionId) => {
            const option = optionMap.get(optionId);
            if (option) addStatCount(option, registrationId);
          });
          return;
        }

        const optionId = field.type === 'boolean' ? String(!!value) : String(value);
        const option = optionMap.get(optionId);
        if (option) addStatCount(option, registrationId);
      });

      return {
        fieldId: field.fieldId,
        label: field.label,
        type: field.type,
        totalAnswered,
        options
      };
    });
}

module.exports = {
  FIELD_TYPES,
  SELECT_FIELD_TYPES,
  STAT_FIELD_TYPES,
  normalizeRegistrationFormConfig,
  getPublicRegistrationForm,
  normalizeFormAnswers,
  buildFormStats
};
