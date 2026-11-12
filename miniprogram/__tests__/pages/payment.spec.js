jest.mock('../../services/course.service', () => ({
  getPeriods: jest.fn()
}));

jest.mock('../../pages/payment/payment.service', () => ({
  initiatePayment: jest.fn(),
  confirmPayment: jest.fn()
}));

jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpSubscriptions: jest.fn(() => Promise.resolve())
}));

jest.mock('../../utils/period-access', () => ({
  getCachedEnrollmentAccess: jest.fn(() => null),
  setCachedEnrollmentAccess: jest.fn(),
  signalEnrollmentChanged: jest.fn()
}));

describe('payment page', () => {
  let pageConfig;
  let pageInstance;
  let courseService;

  const loadPage = async options => {
    await pageInstance.onLoad.call(pageInstance, options || {});
    await Promise.resolve();
    await Promise.resolve();
    return pageInstance;
  };

  beforeEach(() => {
    jest.resetModules();
    wx.clearStorageSync();
    wx.reLaunch.mockClear();
    wx.redirectTo.mockClear();
    wx.navigateTo.mockClear();
    wx.showToast.mockClear();

    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    courseService = require('../../services/course.service');
    courseService.getPeriods.mockResolvedValue([
      {
        _id: 'period_space',
        name: '心想事成',
        title: '心想事成-空间创造工作坊',
        price: 1,
        startDate: '2026-11-04T16:00:00.000Z',
        endDate: '2026-12-01T16:00:00.000Z'
      }
    ]);

    require('../../pages/payment/payment');
    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = JSON.parse(JSON.stringify({ ...this.data }));
        Object.entries(update).forEach(([path, value]) => {
          const keys = path.split('.');
          let target = this.data;
          while (keys.length > 1) {
            const key = keys.shift();
            target[key] = { ...target[key] };
            target = target[key];
          }
          target[keys[0]] = value;
        });
      }
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.Page;
  });

  test('decodes the period title and syncs period details', async () => {
    await loadPage({
      enrollmentId: 'enrollment_1',
      periodId: 'period_space',
      periodTitle: encodeURIComponent('心想事成'),
      amount: 1
    });

    expect(pageInstance.data.enrollmentData.periodTitle).toBe('心想事成-空间创造工作坊');
    expect(pageInstance.data.enrollmentData.startDate).toBe('2026-11-05');
    expect(pageInstance.data.enrollmentData.endDate).toBe('2026-12-02');
    expect(pageInstance.data.finalAmount).toBe(1);
    expect(pageInstance.data.finalAmountDisplay).toBe('0.01');
    expect(pageInstance.data.finalAmountParts).toEqual({
      currency: '¥',
      integer: '0',
      decimal: '.01'
    });
  });

  test('keeps a malformed route value as readable text', async () => {
    courseService.getPeriods.mockResolvedValue([]);
    await loadPage({
      enrollmentId: 'enrollment_1',
      periodId: 'period_space',
      periodTitle: '%E5%',
      amount: 1
    });

    expect(pageInstance.data.enrollmentData.periodTitle).toBe('%E5%');
  });

  test('clears the enrollment stack after successful payment', async () => {
    jest.useFakeTimers();
    await loadPage({
      enrollmentId: 'enrollment_1',
      periodId: 'period_space',
      periodTitle: encodeURIComponent('心想事成'),
      amount: 1
    });

    pageInstance.handlePaymentSuccess.call(pageInstance);
    expect(pageInstance.data.showPaymentResult).toBe(true);
    expect(wx.reLaunch).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1200);
    expect(wx.reLaunch).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/courses/courses?periodId=period_space&welcome=1'
    }));
    expect(wx.redirectTo).not.toHaveBeenCalled();
  });

  test('cancels automatic navigation when the payment page unloads', async () => {
    jest.useFakeTimers();
    await loadPage({
      enrollmentId: 'enrollment_1',
      periodId: 'period_space',
      periodTitle: encodeURIComponent('心想事成'),
      amount: 1
    });

    pageInstance.handlePaymentSuccess.call(pageInstance);
    pageInstance.onUnload.call(pageInstance);
    jest.advanceTimersByTime(1200);

    expect(wx.reLaunch).not.toHaveBeenCalled();
  });
});
