jest.mock('../../services/checkin.service', () => ({
  submitCheckin: jest.fn()
}));

jest.mock('../../services/course.service', () => ({
  getCourseDetail: jest.fn(),
  getPeriods: jest.fn()
}));

jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpSubscriptions: jest.fn(() => Promise.resolve())
}));

jest.mock('../../utils/period-access', () => ({
  getPeriodAccess: jest.fn(() => Promise.resolve({ communityAccessState: 'enabled' })),
  extractId: jest.fn(value => value || ''),
  redirectAfterCommunityDenied: jest.fn()
}));

describe('checkin page', () => {
  let pageConfig;
  let pageInstance;
  let checkinService;
  let courseService;
  let periodAccess;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        userInfo: {
          id: 'user_1',
          nickname: '狮子'
        },
        currentPeriod: {
          _id: 'period_1'
        },
        periods: []
      }
    }));

    checkinService = require('../../services/checkin.service');
    courseService = require('../../services/course.service');
    periodAccess = require('../../utils/period-access');
    require('../../pages/checkin/checkin');

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

    checkinService.submitCheckin.mockReset();
    courseService.getCourseDetail.mockReset();
    periodAccess.getPeriodAccess.mockClear();
    periodAccess.redirectAfterCommunityDenied.mockClear();
    courseService.getCourseDetail.mockResolvedValue({
      _id: 'section_1',
      periodId: 'period_1',
      title: '第一课'
    });
    wx.showToast.mockClear();
    wx.showLoading.mockClear();
    wx.hideLoading.mockClear();
    wx.navigateBack.mockClear();
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('should clamp diary input to 3000 characters', () => {
    pageInstance.handleInput.call(pageInstance, {
      detail: {
        value: 'x'.repeat(3200)
      }
    });

    expect(pageInstance.data.diaryContent).toHaveLength(3000);
    expect(pageInstance.data.maxDiaryLength).toBe(3000);
  });

  test('should block submit when diary exceeds 3000 characters', async () => {
    pageInstance.setData({
      accessChecked: true,
      diaryContent: 'x'.repeat(3001)
    });

    await pageInstance.handleSubmit.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '打卡内容不能超过3000字',
      icon: 'none'
    });
    expect(checkinService.submitCheckin).not.toHaveBeenCalled();
  });

  test('should not reveal checkin form when period access is denied', async () => {
    periodAccess.getPeriodAccess.mockResolvedValue({
      communityAccessState: 'locked'
    });

    await pageInstance.onLoad.call(pageInstance, {
      sectionId: 'section_1',
      periodId: 'period_1'
    });

    expect(pageInstance.data.accessChecked).toBe(false);
    expect(periodAccess.redirectAfterCommunityDenied).toHaveBeenCalledWith(
      '/pages/course-detail/course-detail?id=section_1'
    );
  });
});
