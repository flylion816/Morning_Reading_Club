jest.mock('../../services/checkin.service.js', () => ({
  getUserDiarySummary: jest.fn(),
  getUserCheckinsWithStats: jest.fn(),
  getCheckinDetail: jest.fn()
}));

jest.mock('../../utils/formatters.js', () => ({
  getAvatarColorByUserId: jest.fn(() => '#4a90e2')
}));

jest.mock('../../utils/period-access.js', () => ({
  getPeriodAccess: jest.fn(() => Promise.resolve({ communityAccessState: 'enabled' })),
  redirectAfterCommunityDenied: jest.fn()
}));

let checkinService;

describe('checkin-records page', () => {
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
        userInfo: {
          _id: 'user_123',
          nickname: '狮子',
          avatarUrl: 'https://example.com/avatar.png'
        }
      }
    }));

    checkinService = require('../../services/checkin.service.js');
    require('../../pages/checkin-records/checkin-records.js');

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

    checkinService.getUserDiarySummary.mockReset();
    checkinService.getUserCheckinsWithStats.mockReset();
    checkinService.getCheckinDetail.mockReset();
    wx.showLoading = wx.showLoading || jest.fn();
    wx.hideLoading = wx.hideLoading || jest.fn();
    wx.navigateTo.mockClear();
    wx.showToast.mockClear();
    wx.showLoading.mockClear();
    wx.hideLoading.mockClear();
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('should load summary and preselect target period', async () => {
    checkinService.getUserDiarySummary.mockResolvedValue({
      stats: {
        diaryCount: 3,
        likeCount: 8,
        totalCheckins: 4
      },
      periods: [
        {
          periodId: 'period_a',
          title: '心流之境',
          coverEmoji: '📘',
          coverColor: '#4a90e2',
          diaryCount: 2,
          checkedDays: 3,
          currentEnrollment: 18,
          lastCheckinSection: {
            sectionId: 'section_1',
            title: '第1节',
            day: 1
          }
        }
      ]
    });

    pageInstance.setData({ periodId: 'period_a' });

    await pageInstance.loadSummary.call(pageInstance);

    expect(pageInstance.data.stats.diaryCount).toBe(3);
    expect(pageInstance.data.periodOptions).toHaveLength(2);
    expect(pageInstance.data.selectedPeriod.id).toBe('period_a');
    expect(pageInstance.data.selectedPeriodMetaLines).toContain('18人参与本期共读');
    expect(pageInstance.data.selectedPeriodMetaLines).toContain('已完成3次打卡');
    expect(pageInstance.data.selectedPeriodMetaLines).toContain('共发布2篇日记');
  });

  test('should truncate long period title for the scroll card display', async () => {
    checkinService.getUserDiarySummary.mockResolvedValue({
      stats: {
        diaryCount: 5,
        likeCount: 3,
        totalCheckins: 5
      },
      periods: [
        {
          periodId: 'period_long',
          title: '内在之光 - 七个习惯晨读营',
          coverEmoji: '⛰️',
          coverColor: '#4a90e2',
          diaryCount: 5
        }
      ]
    });

    await pageInstance.loadSummary.call(pageInstance);

    expect(pageInstance.data.periodOptions[1].title).toBe('内在之光 - 七个习惯晨读营');
    expect(pageInstance.data.periodOptions[1].displayTitle).toBe('内在之光...');
  });

  test('should map user checkins into record cards', async () => {
    checkinService.getUserCheckinsWithStats.mockResolvedValue({
      list: [
        {
          _id: 'checkin_1',
          checkinDate: '2025-07-06T03:57:21.000Z',
          note: '这是第一篇打卡日记',
          likeCount: 6,
          sectionId: {
            _id: 'section_1',
            title: '觉察日记'
          },
          periodId: {
            _id: 'period_a',
            title: '平衡之道'
          }
        }
      ],
      pagination: {
        total: 1,
        pages: 1
      }
    });

    await pageInstance.loadCheckinRecords.call(pageInstance, { reset: true });

    expect(pageInstance.data.checkinRecords).toHaveLength(1);
    expect(pageInstance.data.checkinRecords[0].courseTitle).toBe('觉察日记');
    expect(pageInstance.data.checkinRecords[0].metaLabel).toContain('平衡之道');
    expect(pageInstance.data.hasMore).toBe(false);
  });

  test('should navigate to selected period courses page from the summary banner', () => {
    pageInstance.setData({
      selectedPeriod: {
        id: 'period_a',
        title: '内在之光'
      }
    });

    pageInstance.handleSelectedPeriodTap.call(pageInstance);

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/courses/courses?periodId=period_a'
    });
  });

  test('should navigate to course detail with focused checkin', () => {
    pageInstance.handleRecordTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_1',
          sectionId: 'section_1'
        }
      }
    });

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/course-detail/course-detail?id=section_1&checkinId=checkin_1'
    });
  });

  test('should fallback to checkin detail api when sectionId is missing', async () => {
    checkinService.getCheckinDetail.mockResolvedValue({
      _id: 'checkin_2',
      sectionId: {
        _id: 'section_2'
      }
    });

    await pageInstance.handleRecordTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_2',
          sectionId: ''
        }
      }
    });

    expect(checkinService.getCheckinDetail).toHaveBeenCalledWith('checkin_2');
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/course-detail/course-detail?id=section_2&checkinId=checkin_2'
    });
  });
});
