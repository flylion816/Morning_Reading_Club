const {
  normalizeEnrollmentTemplate,
  normalizeReadingAccess,
  buildEnrollmentPayload,
  validateEnrollmentForm,
  getEnrollmentPrice
} = require('../../utils/enrollment-template');

describe('enrollment template and reading access utilities', () => {
  test('recognizes a backend simple snapshot by built-in key and fields', () => {
    const template = normalizeEnrollmentTemplate({
      _id: 'period_simple',
      enrollmentOpen: true,
      enrollmentTemplateSnapshot: {
        templateId: 'template_simple',
        builtInKey: 'simple',
        fields: [
          { key: 'name', label: '学员姓名', required: true },
          { key: 'phone', label: '联系电话', required: true }
        ]
      }
    });

    expect(template).toMatchObject({
      id: 'template_simple',
      mode: 'simple',
      isSimple: true,
      requirePhone: true
    });
    expect(template.fields.map(field => field.id)).toEqual(['name', 'phone']);
    expect(validateEnrollmentForm({
      periodId: 'period_simple',
      name: '小明',
      phone: '13800000000'
    }, template)).toEqual({});
  });

  test('uses configured labels and does not require hidden full-form fields', () => {
    const template = normalizeEnrollmentTemplate({
      enrollmentTemplateSnapshot: {
        templateId: 'template-custom',
        preset: 'custom',
        fields: [
          { key: 'name', label: '联系人', required: true },
          { key: 'phone', label: '联系电话', required: true },
          { key: 'expectation', label: '想解决的问题', required: true }
        ]
      }
    });

    expect(template.isSimple).toBe(false);
    expect(template.fields.find(field => field.id === 'expectation').label).toBe('想解决的问题');
    expect(validateEnrollmentForm({
      periodId: 'period-custom',
      name: '小明',
      phone: '13800000000',
      expectation: '希望整理房间'
    }, template)).toEqual({});
    expect(validateEnrollmentForm({
      periodId: 'period-custom',
      name: '小明',
      phone: '13800000000'
    }, template)).toMatchObject({ expectation: '请填写想解决的问题' });
  });

  test('keeps full template fields out of a simple payload', () => {
    const period = {
      _id: 'period_simple',
      price: 0
    };
    const template = normalizeEnrollmentTemplate({
      enrollmentTemplateSnapshot: {
        templateId: 'template_simple',
        revision: 3,
        mode: 'simple',
        fields: [
          { key: 'name', label: '姓名', required: true },
          { key: 'phone', label: '手机号', required: true }
        ]
      }
    });
    const payload = buildEnrollmentPayload({
      name: '小明',
      phone: '13800000000',
      gender: 'male',
      age: '30',
      expectation: '不应提交'
    }, period, template, 'inviter_1');

    expect(payload).toEqual(expect.objectContaining({
      periodId: 'period_simple',
      name: '小明',
      phone: '13800000000',
      enrollmentTemplateId: 'template_simple',
      enrollmentTemplateVersion: 3,
      inviterId: 'inviter_1'
    }));
    expect(payload).not.toHaveProperty('gender');
    expect(payload).not.toHaveProperty('expectation');
  });

  test('normalizes public reading and fee states for the mobile pages', () => {
    expect(normalizeReadingAccess({ readingAccess: 'open', enrollmentOpen: false })).toEqual({
      mode: 'open',
      isPublic: true,
      label: '公开阅读',
      allowEnrollment: false
    });
    expect(normalizeReadingAccess({ readingAccess: 'enrolled', enrollmentOpen: true })).toEqual({
      mode: 'enrolled',
      isPublic: false,
      label: '报名后阅读',
      allowEnrollment: true
    });
    expect(getEnrollmentPrice({ price: 19900 })).toEqual({
      amountInCents: 19900,
      isFree: false,
      display: '¥199.00'
    });
    expect(getEnrollmentPrice({ price: 0 })).toEqual({
      amountInCents: 0,
      isFree: true,
      display: '免费'
    });
  });
});
