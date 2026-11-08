jest.mock('../../services/enrollment.service', () => ({
  getPeriods: jest.fn(),
  submitEnrollment: jest.fn()
}));

jest.mock('../../utils/formatters', () => ({
  calculatePeriodStatus: jest.fn(() => 'ongoing')
}));

jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpSubscriptions: jest.fn(() => Promise.resolve())
}));

describe('enrollment page template flow', () => {
  let pageConfig;
  let pageInstance;
  let enrollmentService;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    enrollmentService = require('../../services/enrollment.service');
    require('../../pages/enrollment/enrollment');
    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = { ...this.data, ...update };
      }
    };
    enrollmentService.getPeriods.mockReset();
    wx.showToast.mockClear();
    wx.navigateTo.mockClear();
  });

  afterEach(() => {
    delete global.Page;
  });

  test('loads the simple template snapshot and keeps the two-field form visible', async () => {
    enrollmentService.getPeriods.mockResolvedValue([
      {
        _id: 'period_space',
        name: '空间管理第一期',
        coverColor: '#5b7f4a',
        enrollmentOpen: true,
        price: 0,
        startDate: '2099-11-01T00:00:00.000Z',
        endDate: '2099-11-07T00:00:00.000Z',
        enrollmentTemplateSnapshot: {
          templateId: 'template_space',
          builtInKey: 'simple',
          fields: [
            { key: 'name', label: '联系人', required: true },
            { key: 'phone', label: '联系电话', required: true }
          ]
        }
      }
    ]);

    await pageInstance.loadPeriods.call(pageInstance);

    expect(pageInstance.data.isSimpleForm).toBe(true);
    expect(pageInstance.data.fieldVisibility.name).toBe(true);
    expect(pageInstance.data.fieldVisibility.gender).toBeUndefined();
    expect(pageInstance.data.fieldLabels).toMatchObject({
      name: '联系人',
      phone: '联系电话'
    });
    expect(pageInstance.data.enrollmentFeeText).toBe('免费');

    pageInstance.setData({
      form: {
        ...pageInstance.data.form,
        name: '小明',
        phone: '13800000000'
      }
    });
    expect(pageInstance.validateForm.call(pageInstance)).toBe(true);
  });

  test('custom multi-step template does not require hidden commitment', async () => {
    enrollmentService.getPeriods.mockResolvedValue([
      {
        _id: 'period_space_creation',
        name: '心想事成',
        title: '心想事成-空间创造工作坊',
        enrollmentOpen: true,
        price: 1,
        startDate: '2099-11-01T00:00:00.000Z',
        endDate: '2099-11-07T00:00:00.000Z',
        enrollmentTemplateSnapshot: {
          templateId: 'template_space_creation',
          name: '空间创造报名',
          preset: 'full',
          mode: 'full',
          fields: [
            { key: 'name', label: '姓名', required: true },
            { key: 'phone', label: '手机号', required: true },
            { key: 'expectation', label: '课程期待', required: true }
          ]
        }
      }
    ]);

    await pageInstance.loadPeriods.call(pageInstance);
    expect(pageInstance.data.fieldVisibility).toEqual({
      name: true,
      phone: true,
      expectation: true
    });
    expect(pageInstance.data.fieldRequired.commitment).toBeUndefined();

    pageInstance.setData({
      form: {
        ...pageInstance.data.form,
        name: '测试学员',
        phone: '13800000000'
      }
    });

    pageInstance.goNextStep.call(pageInstance);
    expect(wx.showToast).not.toHaveBeenCalled();
    expect(pageInstance.data.currentStep).toBe(2);
    expect(pageInstance.data.errors).toEqual({});

    pageInstance.setData({
      form: {
        ...pageInstance.data.form,
        expectation: '让空间更有秩序'
      }
    });
    pageInstance.goNextStep.call(pageInstance);
    expect(wx.showToast).not.toHaveBeenCalled();
    expect(pageInstance.data.currentStep).toBe(3);
    expect(pageInstance.validateForm.call(pageInstance)).toBe(true);
  });

  test('switches the selected period to its own full template and price', async () => {
    const periods = [
      {
        _id: 'period_simple',
        name: '空间管理',
        enrollmentOpen: true,
        price: 0,
        enrollmentTemplateSnapshot: {
          templateId: 'simple',
          mode: 'simple',
          fields: [
            { key: 'name', label: '姓名', required: true },
            { key: 'phone', label: '手机号', required: true }
          ]
        }
      },
      {
        _id: 'period_full',
        name: '七个习惯',
        coverColor: 'javascript:alert(1)',
        enrollmentOpen: true,
        price: 19900,
        enrollmentTemplateSnapshot: {
          templateId: 'full',
          mode: 'full',
          fields: [
            { key: 'name', label: '姓名', required: true },
            { key: 'phone', label: '手机号', required: false },
            { key: 'gender', label: '性别', required: true },
            { key: 'age', label: '年龄', required: true }
          ]
        }
      }
    ];
    enrollmentService.getPeriods.mockResolvedValue(periods);

    await pageInstance.loadPeriods.call(pageInstance);
    pageInstance.handlePeriodChange.call(pageInstance, { detail: { value: '1' } });

    expect(pageInstance.data.periodId).toBe('period_full');
    expect(pageInstance.data.isSimpleForm).toBe(false);
    expect(pageInstance.data.enrollmentTemplate.id).toBe('full');
    expect(pageInstance.data.enrollmentFeeText).toBe('¥199.00');
    expect(pageInstance.data.fieldVisibility.gender).toBe(true);
  });
});
