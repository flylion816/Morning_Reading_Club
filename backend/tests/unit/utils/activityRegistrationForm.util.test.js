const { expect } = require('chai');

const {
  normalizeRegistrationFormConfig,
  getPublicRegistrationForm,
  normalizeFormAnswers,
  buildFormStats
} = require('../../../src/utils/activityRegistrationForm');

describe('activityRegistrationForm util', () => {
  const formInput = {
    enabled: true,
    fields: [
      {
        fieldId: 'city',
        label: '所在城市',
        type: 'single_select',
        required: true,
        includeInStats: true,
        sortOrder: 1,
        options: [
          { optionId: 'sh', label: '上海' },
          { optionId: 'hz', label: '杭州' }
        ]
      },
      {
        fieldId: 'friends',
        label: '是否带朋友',
        type: 'boolean',
        required: false,
        includeInStats: true,
        sortOrder: 2
      },
      {
        fieldId: 'note',
        label: '备注',
        type: 'textarea',
        required: false,
        includeInStats: true,
        sortOrder: 3
      }
    ]
  };

  it('normalizes enabled config and disables stats for text fields', () => {
    const form = normalizeRegistrationFormConfig(formInput);

    expect(form.enabled).to.equal(true);
    expect(form.fields[0].fieldId).to.equal('city');
    expect(form.fields[2].includeInStats).to.equal(false);
  });

  it('rejects select fields without options', () => {
    expect(() => normalizeRegistrationFormConfig({
      enabled: true,
      fields: [{ fieldId: 'city', label: '城市', type: 'single_select', options: [] }]
    })).to.throw('单选或多选字段至少需要一个选项');
  });

  it('normalizes submitted answers and stores display text', () => {
    const form = getPublicRegistrationForm(formInput);
    const result = normalizeFormAnswers(form, {
      city: 'sh',
      friends: true,
      note: '靠窗座位'
    });

    expect(result.formSnapshot.enabled).to.equal(true);
    expect(result.formAnswers).to.deep.include({
      fieldId: 'city',
      label: '所在城市',
      type: 'single_select',
      value: 'sh',
      valueText: '上海'
    });
    expect(result.formAnswers.find((answer) => answer.fieldId === 'friends').valueText).to.equal('是');
  });

  it('rejects missing required answers and unknown field ids', () => {
    const form = getPublicRegistrationForm(formInput);

    expect(() => normalizeFormAnswers(form, { friends: true })).to.throw('请填写所在城市');
    expect(() => normalizeFormAnswers(form, { city: 'sh', stale: 'x' })).to.throw('报名表单字段已更新');
  });

  it('builds stats from submitted values for every answered field', () => {
    const form = getPublicRegistrationForm(formInput);
    const stats = buildFormStats(form, [
      {
        _id: 'reg_1',
        formAnswers: [
          { fieldId: 'city', type: 'single_select', value: 'sh', valueText: '上海' },
          { fieldId: 'friends', type: 'boolean', value: true, valueText: '是' },
          { fieldId: 'note', type: 'textarea', value: '靠窗座位', valueText: '靠窗座位' }
        ]
      },
      {
        _id: 'reg_2',
        formAnswers: [
          { fieldId: 'city', type: 'single_select', value: 'hz', valueText: '杭州' },
          { fieldId: 'friends', type: 'boolean', value: false, valueText: '否' },
          { fieldId: 'note', type: 'textarea', value: '靠窗座位', valueText: '靠窗座位' }
        ]
      }
    ]);

    expect(stats).to.have.length(3);
    expect(stats[0].options.find((option) => option.optionId === 'sh').count).to.equal(1);
    expect(stats[1].options.find((option) => option.optionId === 'true').registrationIds).to.deep.equal(['reg_1']);
    expect(stats[2].options.find((option) => option.label === '靠窗座位').count).to.equal(2);
  });
});
