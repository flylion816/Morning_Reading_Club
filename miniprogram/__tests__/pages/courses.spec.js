jest.mock('../../services/course.service', () => ({
  getPeriodCheckins: jest.fn(),
  getPeriodSections: jest.fn(),
  getPeriodDetail: jest.fn()
}));

jest.mock('../../services/presence.service', () => ({
  getPeriodOrigins: jest.fn()
}));

jest.mock('../../utils/formatters', () => ({
  getAvatarColorByUserId: jest.fn(() => '#4a90e2')
}));

jest.mock('../../utils/period-access', () => ({
  getPeriodAccess: jest.fn()
}));

jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpSubscriptions: jest.fn(() => Promise.resolve())
}));

describe('courses page', () => {
  let pageConfig;
  let pageInstance;
  let courseService;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn((config) => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        isLogin: true
      }
    }));

    courseService = require('../../services/course.service');
    require('../../pages/courses/courses');

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

    courseService.getPeriodCheckins.mockReset();
    courseService.getPeriodSections.mockReset();
    courseService.getPeriodDetail.mockReset();
    wx.__storage = {};
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('should fold long checkin content and expand on demand', async () => {
    courseService.getPeriodCheckins.mockResolvedValue({
      list: [
        {
          _id: 'checkin_1',
          userId: {
            _id: 'user_1',
            nickname: '狮子'
          },
          sectionId: {
            _id: 'section_1',
            title: '觉察日记',
            day: 1
          },
          note: '这是很长的打卡内容'.repeat(20),
          createdAt: '2025-07-06T03:57:21.000Z'
        }
      ]
    });

    pageInstance.setData({ periodId: 'period_1' });

    await pageInstance.loadAllCheckins.call(pageInstance);

    expect(pageInstance.data.allCheckins[0].canExpandContent).toBe(true);
    expect(pageInstance.data.allCheckins[0].contentExpanded).toBe(false);

    pageInstance.toggleCheckinContent.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_1'
        }
      }
    });

    expect(pageInstance.data.allCheckins[0].contentExpanded).toBe(true);
  });

  test('should keep image-only checkins visible with image count summary', async () => {
    courseService.getPeriodCheckins.mockResolvedValue({
      list: [
        {
          _id: 'checkin_image',
          userId: {
            _id: 'user_1',
            nickname: '狮子'
          },
          sectionId: {
            _id: 'section_1',
            title: '觉察日记',
            day: 1
          },
          note: '',
          images: [
            '/uploads/tenants/fanren/checkins/a.jpg',
            '/uploads/tenants/fanren/checkins/b.jpg'
          ],
          createdAt: '2025-07-06T03:57:21.000Z'
        }
      ]
    });

    pageInstance.setData({ periodId: 'period_1' });

    await pageInstance.loadAllCheckins.call(pageInstance);

    expect(pageInstance.data.allCheckins[0].content).toBe('分享了2张图片');
    expect(pageInstance.data.allCheckins[0].imageCount).toBe(2);
  });

  test('should preserve checkin pagination state for load more', async () => {
    courseService.getPeriodCheckins
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'checkin_1',
            userId: { _id: 'user_1', nickname: '狮子' },
            sectionId: { _id: 'section_1', title: '觉察日记', day: 1 },
            note: '第一页打卡',
            createdAt: '2025-07-06T03:57:21.000Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 11,
          totalPages: 2,
          hasNext: true
        }
      })
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'checkin_2',
            userId: { _id: 'user_2', nickname: '老虎' },
            sectionId: { _id: 'section_1', title: '觉察日记', day: 1 },
            note: '第二页打卡',
            createdAt: '2025-07-07T03:57:21.000Z'
          }
        ],
        pagination: {
          page: 2,
          limit: 10,
          total: 11,
          totalPages: 2,
          hasNext: false
        }
      });

    pageInstance.setData({ periodId: 'period_1' });

    await pageInstance.loadAllCheckins.call(pageInstance);
    expect(pageInstance.data.checkinHasMore).toBe(true);
    expect(pageInstance.data.checkinTotal).toBe(11);

    await pageInstance.loadAllCheckins.call(pageInstance, true);
    expect(courseService.getPeriodCheckins).toHaveBeenLastCalledWith(
      'period_1',
      {
        page: 2,
        limit: 10
      }
    );
    expect(pageInstance.data.allCheckins).toHaveLength(2);
    expect(pageInstance.data.checkinHasMore).toBe(false);
  });

  test('should decorate sections with local reading completion state', async () => {
    wx.setStorageSync('reading_completion_records', {
      section_1: {
        sectionId: 'section_1',
        periodId: 'period_1',
        durationMs: 76000,
        completedAt: 1760000000000
      }
    });
    courseService.getPeriodSections.mockResolvedValue({
      list: [
        { _id: 'section_1', title: '第一天', day: 1 },
        { _id: 'section_2', title: '第二天', day: 2 }
      ]
    });
    courseService.getPeriodDetail.mockResolvedValue({
      title: '平衡之道',
      price: 0,
      startDate: '2026-05-01T00:00:00.000Z',
      endDate: '2026-05-21T00:00:00.000Z'
    });

    pageInstance.setData({
      periodId: 'period_1',
      communityAccessState: 'locked'
    });

    await pageInstance.loadSections.call(pageInstance);

    expect(pageInstance.data.sections[0].readingCompleted).toBe(true);
    expect(pageInstance.data.sections[0].readingDurationMs).toBe(76000);
    expect(pageInstance.data.sections[1].readingCompleted).toBe(false);
  });

  test('should load a public period for an anonymous reader without redirecting', async () => {
    global.getApp.mockReturnValue({
      globalData: {
        isLogin: false,
        userInfo: null
      }
    });
    courseService.getPeriodSections.mockResolvedValue({
      list: [{ _id: 'section_public', title: '公开课节', day: 1 }]
    });
    courseService.getPeriodDetail.mockResolvedValue({
      name: '公开阅读期次',
      readingAccess: 'open',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-07T00:00:00.000Z'
    });

    pageInstance.onLoad.call(pageInstance, { periodId: 'period_public' });
    pageInstance.onReady.call(pageInstance);
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    expect(wx.navigateBack).not.toHaveBeenCalled();
    expect(courseService.getPeriodSections).toHaveBeenCalledWith('period_public');
    expect(pageInstance.data.sections).toEqual([
      expect.objectContaining({ _id: 'section_public', title: '公开课节' })
    ]);
  });

  test('should return to the previous page when the course stack exists', () => {
    global.getCurrentPages = jest.fn(() => [{}, {}]);
    wx.navigateBack.mockClear();
    wx.switchTab.mockClear();
    pageInstance.handleBack.call(pageInstance);

    expect(wx.navigateBack).toHaveBeenCalledWith({ delta: 1 });
    expect(wx.switchTab).not.toHaveBeenCalled();
    delete global.getCurrentPages;
  });

  test('should place the custom navigation below the status bar', () => {
    pageInstance.onLoad.call(pageInstance, { periodId: 'period_1' });

    expect(pageInstance.data.statusBarHeight).toBe(47);
  });

  test('should fall back to home after payment relaunches into courses', () => {
    global.getCurrentPages = jest.fn(() => [{}]);
    wx.navigateBack.mockClear();
    wx.switchTab.mockClear();
    pageInstance.handleBack.call(pageInstance);

    expect(wx.navigateBack).not.toHaveBeenCalled();
    expect(wx.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' });
    delete global.getCurrentPages;
  });
  describe('period origins line', () => {
    let presenceService;
    beforeEach(() => {
      presenceService = require('../../services/presence.service');
      presenceService.getPeriodOrigins.mockReset();
      pageInstance.setData({ periodId: 'p1' });
    });

    test('shows members and provinces', async () => {
      presenceService.getPeriodOrigins.mockResolvedValue({ memberCount: 52, provinceCount: 11 });
      await pageInstance.loadPeriodOrigins.call(pageInstance);
      expect(pageInstance.data.originsText).toBe('本期 52 位书友，来自 11 个省市');
    });

    test('shows members only when provinceCount is null', async () => {
      presenceService.getPeriodOrigins.mockResolvedValue({ memberCount: 52, provinceCount: null });
      await pageInstance.loadPeriodOrigins.call(pageInstance);
      expect(pageInstance.data.originsText).toBe('本期 52 位书友');
    });

    test('shows nothing when the request fails', async () => {
      presenceService.getPeriodOrigins.mockRejectedValue(new Error('403'));
      await pageInstance.loadPeriodOrigins.call(pageInstance);
      expect(pageInstance.data.originsText).toBe('');
    });
  });

  test('keepsake entry navigates with periodId', () => {
    pageInstance.setData({ periodId: 'p1' });
    pageInstance.handleKeepsake.call(pageInstance);
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/keepsake/keepsake?periodId=p1' });
  });
});
