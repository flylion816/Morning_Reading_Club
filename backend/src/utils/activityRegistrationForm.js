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

function getAnswer(registration, fieldId) {
  return (registration.formAnswers || []).find((item) => item.fieldId === fieldId);
}

function getRegistrationId(registration) {
  return registration._id
    ? registration._id.toString()
    : (registration.registrationId || '').toString();
}

function addStatCount(option, registrationId) {
  return {
    ...option,
    count: option.count + 1,
    registrationIds: option.registrationIds.concat(registrationId)
  };
}

function normalizeStatText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getOptionLabel(field, optionId) {
  const option = (field.options || []).find((item) => item.optionId === optionId);
  return option ? option.label : '';
}

function dedupeStatEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (!entry.optionId || seen.has(entry.optionId)) return false;
    seen.add(entry.optionId);
    return true;
  });
}

function buildSelectableStatEntry(field, rawValue, fallbackLabel = '') {
  const optionId = normalizeStatText(rawValue) || normalizeStatText(fallbackLabel);
  if (!optionId) return null;
  return {
    optionId,
    label: getOptionLabel(field, optionId) || normalizeStatText(fallbackLabel) || optionId,
    value: rawValue
  };
}

function getStatEntries(answer, field) {
  if (!answer) return [];

  const type = field.type || answer.type;
  const { value } = answer;
  const valueText = normalizeStatText(answer.valueText);

  if (type === 'multi_select') {
    if (Array.isArray(value)) {
      return dedupeStatEntries(value
        .map((optionId) => buildSelectableStatEntry(field, optionId))
        .filter(Boolean));
    }
    if (!valueText) return [];
    return [{ optionId: valueText, label: valueText, value: valueText }];
  }

  if (type === 'single_select') {
    const entry = buildSelectableStatEntry(field, value, valueText);
    return entry ? [entry] : [];
  }

  if (type === 'boolean') {
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return [{ optionId: 'true', label: '是', value: true }];
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
      return [{ optionId: 'false', label: '否', value: false }];
    }
    if (valueText === '是') return [{ optionId: 'true', label: '是', value: true }];
    if (valueText === '否') return [{ optionId: 'false', label: '否', value: false }];
    if (!valueText) return [];
    return [{ optionId: valueText, label: valueText, value: valueText }];
  }

  const label = valueText || normalizeStatText(value);
  if (!label) return [];
  return [{ optionId: label, label, value: value ?? label }];
}

function collectStatFields(publicForm = {}, registrations = []) {
  const fieldMap = new Map();
  const fields = [];

  const addField = (field = {}, fallbackOrder = 0) => {
    const fieldId = normalizeStatText(field.fieldId);
    if (!fieldId) return;

    const existing = fieldMap.get(fieldId);
    if (existing) {
      if (!existing.label && field.label) existing.label = field.label;
      if ((!existing.options || existing.options.length === 0) && Array.isArray(field.options)) {
        existing.options = field.options;
      }
      return;
    }

    const statField = {
      fieldId,
      label: normalizeStatText(field.label) || fieldId,
      type: field.type || 'text',
      options: Array.isArray(field.options) ? field.options : [],
      sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : fallbackOrder
    };
    fieldMap.set(fieldId, statField);
    fields.push(statField);
  };

  (publicForm.fields || []).forEach((field, index) => addField(field, index));
  registrations.forEach((registration) => {
    const snapshotFields = registration.formSnapshot && Array.isArray(registration.formSnapshot.fields)
      ? registration.formSnapshot.fields
      : [];
    snapshotFields.forEach((field) => addField(field, fields.length));
    (registration.formAnswers || []).forEach((answer) => addField(answer, fields.length));
  });

  return fields.sort((a, b) => a.sortOrder - b.sortOrder);
}

function buildFormStats(registrationForm = {}, registrations = []) {
  const publicForm = getPublicRegistrationForm(registrationForm);
  const fields = collectStatFields(publicForm, registrations);

  return fields
    .map((field) => {
      const optionMap = new Map();
      let totalAnswered = 0;

      registrations.forEach((registration) => {
        const registrationId = getRegistrationId(registration);
        if (!registrationId) return;

        const entries = getStatEntries(getAnswer(registration, field.fieldId), field);
        if (entries.length === 0) return;

        totalAnswered += 1;
        entries.forEach((entry) => {
          if (!optionMap.has(entry.optionId)) {
            optionMap.set(entry.optionId, {
              optionId: entry.optionId,
              label: entry.label,
              value: entry.value,
              count: 0,
              registrationIds: []
            });
          }
          optionMap.set(
            entry.optionId,
            addStatCount(optionMap.get(entry.optionId), registrationId)
          );
        });
      });

      return {
        fieldId: field.fieldId,
        label: field.label,
        type: field.type,
        totalAnswered,
        options: Array.from(optionMap.values())
      };
    })
    .filter((field) => field.options.length > 0);
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
