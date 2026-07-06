jest.mock('../../services/course.service', () => ({
  getPeriods: jest.fn()
}));

jest.mock('../../services/enrollment.service', () => ({
  checkEnrollment: jest.fn()
}));

jest.mock('../../services/user.service', () => ({
  getUserProfile: jest.fn()
}));

jest.mock('../../utils/formatters', () => ({
  formatDate: jest.fn(value => value),
  formatDateRange: jest.fn(() => '2026-07-01 至 2026-07-23'),
  calculatePeriodStatus: jest.fn(() => 'ongoing')
}));

jest.mock('../../utils/period-access', () => ({
  getCachedEnrollmentAccess: jest.fn(() => null),
  setCachedEnrollmentAccess: jest.fn(),
  isFreshOptimisticEnrollmentAccess: jest.fn(() => false),
  isPaidStatus: jest.fn(() => false)
}));

jest.mock('../../utils/brand', () => ({
  getBrandName: jest.fn(() => '若星生活家'),
  getDefaultShareTitle: jest.fn(() => '若星生活家')
}));

describe('periods page', () => {
  let pageConfig;
  let pageInstance;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });

    global.getApp = jest.fn(() => ({
      globalData: {
        isLogin: true,
        userInfo: {
          _id: 'user_1',
          nickname: '小狐狸'
        }
      }
    }));

    wx.navigateTo.mockClear();
    wx.showToast.mockClear();

    require('../../pages/periods/periods');

    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('should ignore repeated period taps while navigation is pending', async () => {
    wx.navigateTo.mockImplementation(() => {});

    pageInstance.setData({
      periods: [
        {
          _id: 'period_1',
          name: '平衡之道',
          calculatedStatus: 'ongoing',
          enrollmentOpen: true
        }
      ],
      periodEnrollmentStatus: {
        period_1: {
          isEnrolled: true,
          paymentStatus: 'paid',
          _confirmed: true
        }
      }
    });

    const event = {
      currentTarget: {
        dataset: {
          periodId: 'period_1',
          periodName: '平衡之道'
        }
      }
    };

    await pageInstance.handlePeriodClick.call(pageInstance, event);
    await pageInstance.handlePeriodClick.call(pageInstance, event);

    expect(wx.navigateTo).toHaveBeenCalledTimes(1);
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/courses/courses?periodId=period_1&name=平衡之道'
    }));
    expect(pageInstance.data.navigatingPeriodId).toBe('period_1');
  });

  test('should start loading periods on page load', () => {
    const loadSpy = jest.spyOn(pageInstance, 'loadPeriods').mockImplementation(() => {});

    pageInstance.onLoad.call(pageInstance, {});

    expect(loadSpy).toHaveBeenCalledTimes(1);
  });
});
