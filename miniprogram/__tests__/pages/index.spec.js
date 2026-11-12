jest.mock('../../services/user.service.js', () => ({
  getUserProfile: jest.fn(),
  getUserStats: jest.fn(),
  updateUserProfile: jest.fn()
}));

jest.mock('../../services/auth.service.js', () => ({
  logout: jest.fn()
}));

jest.mock('../../services/course.service.js', () => ({
  getPeriods: jest.fn(),
  getTodayTask: jest.fn(),
  getSectionDetail: jest.fn(),
  getPeriodSections: jest.fn()
}));

jest.mock('../../services/enrollment.service.js', () => ({
  getUserEnrollments: jest.fn()
}));

jest.mock('../../services/checkin.service.js', () => ({
  getUserCheckinsWithStats: jest.fn(),
  getCheckinDetail: jest.fn()
}));

jest.mock('../../services/insight.service.js', () => ({
  getInsightsList: jest.fn(),
  getSentRequests: jest.fn(),
  getUserInsightsList: jest.fn(),
  getReceivedRequests: jest.fn(),
  approveRequest: jest.fn(),
  rejectRequest: jest.fn()
}));

jest.mock('../../services/notification.service.js', () => ({
  getUnreadCount: jest.fn(() => Promise.resolve({ unreadCount: 0 }))
}));

jest.mock('../../services/activity.service.js', () => ({
  track: jest.fn(() => Promise.resolve())
}));

jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpNextDayStudyReminder: jest.fn(() => Promise.resolve())
}));

jest.mock('../../services/communityActivity.service', () => ({
  getPopup: jest.fn(),
  getList: jest.fn()
}));

jest.mock('../../services/imprint.service.js', () => ({
  list: jest.fn()
}));

jest.mock('../../services/completion-report.service', () => ({
  getMyReports: jest.fn()
}));

jest.mock('../../config/constants.js', () => ({
  STORAGE_KEYS: {
    TOKEN: 'token',
    USER_INFO: 'userInfo'
  }
}));

jest.mock('../../utils/formatters.js', () => ({
  formatNumber: jest.fn(value => value),
  formatDate: jest.fn(value => value),
  getAvatarColorByUserId: jest.fn(() => '#4a90e2'),
  getInsightTypeConfig: jest.fn(() => ({
    color: '#4a90e2',
    bgColor: '#eef4ff'
  }))
}));

jest.mock('../../utils/markdown.js', () => ({
  richContentToPlainText: jest.fn(content =>
    String(content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}));

jest.mock('../../utils/period-access.js', () => ({
  getPeriodAccess: jest.fn(() =>
    Promise.resolve({
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      paymentStatus: 'paid'
    })
  ),
  hasPaidEnrollment: jest.fn((enrollmentList = []) =>
    enrollmentList.some(item =>
      ['active', 'completed'].includes(item.status) &&
      ['paid', 'free'].includes(item.paymentStatus)
    )
  )
}));

jest.mock('../../utils/reading-completion.js', () => ({
  decorateSectionWithReadingCompletion: jest.fn(section => section)
}));

let pageConfig;
let pageInstance;
let checkinService;
let userService;
let courseService;
let enrollmentService;
let periodAccess;
let insightService;
let activityService;
let communityActivityService;
  let completionReportService;
  let imprintService;
  let subscribeAutoTopUp;
let notificationService;

describe('index page', () => {
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
          nickname: '小狐狸'
        }
      }
    }));

    wx.navigateTo.mockClear();
    wx.showToast.mockClear();
    wx.showLoading.mockClear();
    wx.hideLoading.mockClear();
    wx.navigateToMiniProgram = jest.fn();
    wx.showTabBar = jest.fn();

    checkinService = require('../../services/checkin.service.js');
    userService = require('../../services/user.service.js');
    courseService = require('../../services/course.service.js');
    enrollmentService = require('../../services/enrollment.service.js');
    periodAccess = require('../../utils/period-access.js');
    insightService = require('../../services/insight.service.js');
    activityService = require('../../services/activity.service.js');
    notificationService = require('../../services/notification.service.js');
    communityActivityService = require('../../services/communityActivity.service');
    completionReportService = require('../../services/completion-report.service');
    imprintService = require('../../services/imprint.service.js');
    subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
    require('../../pages/index/index.js');

    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update, callback) {
        this.data = {
          ...this.data,
          ...update
        };
        if (typeof callback === 'function') {
          callback();
        }
      }
    };
    pageInstance.data.currentPeriodCommunityState = 'enabled';
    pageInstance.data.canUsePaidFeatures = true;

    checkinService.getUserCheckinsWithStats.mockReset();
    checkinService.getCheckinDetail.mockReset();
    userService.getUserProfile.mockReset();
    userService.getUserStats.mockReset();
    courseService.getPeriods.mockReset();
    courseService.getTodayTask.mockReset();
    courseService.getSectionDetail.mockReset();
    courseService.getPeriodSections.mockReset();
    enrollmentService.getUserEnrollments.mockReset();
    periodAccess.getPeriodAccess.mockReset();
    periodAccess.hasPaidEnrollment.mockClear();
    insightService.getInsightsList.mockReset();
    insightService.getSentRequests.mockReset();
    insightService.getUserInsightsList.mockReset();
    insightService.getReceivedRequests.mockReset();
    activityService.track.mockClear();
    notificationService.getUnreadCount.mockReset();
    notificationService.getUnreadCount.mockResolvedValue({ unreadCount: 0 });
    communityActivityService.getPopup.mockReset();
    communityActivityService.getList.mockReset();
    completionReportService.getMyReports.mockReset();
    completionReportService.getMyReports.mockResolvedValue({ list: [] });
    imprintService.list.mockReset();
    imprintService.list.mockResolvedValue({ list: [] });
  });

  test('opens new checkin selection with the current period and today lesson', () => {
    pageInstance.setData({
      canUsePaidFeatures: true,
      currentPeriod: { _id: 'period_1' },
      todaySection: { _id: 'section_1' }
    });
    pageInstance.navigateToNewCheckin.call(pageInstance);
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/checkin/checkin?select=1&periodId=period_1&sectionId=section_1'
    });
  });

  afterEach(() => {
    if (pageInstance && pageInstance._todayCardTimer) clearTimeout(pageInstance._todayCardTimer);
    jest.useRealTimers();
    delete global.Page;
    delete global.getApp;
  });

  test('should load the latest three recent checkins for home cards', async () => {
    checkinService.getUserCheckinsWithStats.mockResolvedValue({
      list: [
        {
          _id: 'checkin_1',
          createdAt: '2026-03-29T13:11:00.000Z',
          note: '中心是因，人生是果。因缘果报，随缘消旧业，切莫造新殃。',
          likeCount: 2,
          sectionId: {
            _id: 'section_1',
            title: '第一天 品德成功论',
            day: 1
          },
          periodId: {
            _id: 'period_1',
            title: '内在之光',
            coverEmoji: '⛰️',
            coverColor: '#4a90e2'
          }
        },
        {
          _id: 'checkin_2',
          createdAt: '2026-03-28T13:11:00.000Z',
          note: '第二篇打卡',
          likeCount: 1,
          sectionId: {
            _id: 'section_2',
            title: '第二天 思维方式的力量',
            day: 2
          },
          periodId: {
            _id: 'period_1',
            title: '内在之光',
            coverEmoji: '⛰️',
            coverColor: '#4a90e2'
          }
        },
        {
          _id: 'checkin_3',
          createdAt: '2026-03-27T13:11:00.000Z',
          note: '',
          images: ['/uploads/tenants/fanren/checkins/a.jpg', '/uploads/tenants/fanren/checkins/b.jpg'],
          likeCount: 0,
          sectionId: {
            _id: 'section_3',
            title: '第三天 以原则为中心',
            day: 3
          },
          periodId: {
            _id: 'period_2',
            title: '品德之路',
            coverEmoji: '📘',
            coverColor: '#5b8def'
          }
        },
        {
          _id: 'checkin_4',
          createdAt: '2026-03-26T13:11:00.000Z',
          note: '第四篇打卡',
          likeCount: 4,
          sectionId: {
            _id: 'section_4',
            title: '第四天',
            day: 4
          },
          periodId: {
            _id: 'period_3',
            title: '平衡之道'
          }
        }
      ]
    });

    const cards = await pageInstance.loadRecentCheckins.call(pageInstance);

    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({
      id: 'checkin_1',
      sectionId: 'section_1',
      periodTitle: '内在之光',
      sectionTitle: '第一天 品德成功论',
      dayLabel: '第1课',
      preview: '中心是因，人生是果。因缘果报，随缘消旧业...',
      likeCount: 2
    });
    expect(cards[2].id).toBe('checkin_3');
    expect(cards[2].preview).toBe('分享了2张图片');
    expect(cards[2].imageCount).toBe(2);
  });

  test('should show only two upcoming activities on home page', async () => {
    communityActivityService.getList.mockResolvedValue({
      list: [
        { _id: 'activity_1', title: '活动一', type: 'chat', startTime: '2026-05-31T12:00:00.000Z' },
        { _id: 'activity_2', title: '活动二', type: 'cooking', startTime: '2026-05-30T12:00:00.000Z' },
        { _id: 'activity_3', title: '活动三', type: 'witness', startTime: '2026-05-29T12:00:00.000Z' }
      ]
    });

    await pageInstance.loadUpcomingActivities.call(pageInstance);
    await Promise.resolve();

    expect(communityActivityService.getList).toHaveBeenCalledWith({
      limit: 3,
      sort: 'desc'
    });
    expect(pageInstance.data.upcomingActivities).toHaveLength(2);
    expect(pageInstance.data.upcomingActivities.map(item => item._id)).toEqual([
      'activity_1',
      'activity_2'
    ]);
    expect(pageInstance.data.upcomingActivitiesHasMore).toBe(true);
  });

  test('should resolve my recent insight period name from a string period id', async () => {
    pageInstance._periodNameById = new Map([
      ['period_resilience', '韧性之树']
    ]);
    insightService.getInsightsList.mockResolvedValue({
      list: [
        {
          _id: 'insight_1',
          summary: '今天练习了积极主动。',
          sectionId: { _id: 'section_2', day: 2, title: '思维方式的力量' },
          periodId: 'period_resilience'
        }
      ]
    });

    const cards = await pageInstance.loadRecentInsights.call(pageInstance);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: 'insight_1',
      courseDayLabel: '第2课',
      courseTitle: '思维方式的力量',
      periodName: '韧性之树'
    });
  });

  test('should add the period snapshot to other recent insight cards', async () => {
    insightService.getSentRequests.mockResolvedValue({
      list: [
        {
          toUserId: {
            _id: 'user_other',
            nickname: '小树',
            avatarUrl: ''
          }
        }
      ]
    });
    insightService.getUserInsightsList.mockResolvedValue({
      list: [
        {
          _id: 'insight_other_1',
          summary: '看见你持续练习。',
          periodName: '内在之光',
          sectionId: { _id: 'section_3', day: 3, title: '以原则为中心' }
        }
      ]
    });

    await pageInstance.loadRecentOtherInsights.call(pageInstance);

    expect(pageInstance.data.recentOtherInsights).toHaveLength(1);
    expect(pageInstance.data.recentOtherInsights[0]).toMatchObject({
      id: 'insight_other_1',
      courseDayLabel: '第3课',
      courseTitle: '以原则为中心',
      periodName: '内在之光'
    });
  });

  test('should open checkin detail directly when sectionId exists', async () => {
    await pageInstance.handleRecentCheckinTap.call(pageInstance, {
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
    expect(checkinService.getCheckinDetail).not.toHaveBeenCalled();
  });

  test('should load current period report shortcut only when report exists', async () => {
    completionReportService.getMyReports.mockResolvedValue({
      list: [
        {
          periodId: 'period_1',
          hasReport: true,
          reportTitle: '小狐狸分享实录'
        },
        {
          periodId: 'period_2',
          hasReport: false
        }
      ]
    });

    await pageInstance.loadCurrentPeriodReport.call(pageInstance, 'period_1');

    expect(completionReportService.getMyReports).toHaveBeenCalled();
    expect(pageInstance.data.currentPeriodReport).toMatchObject({
      periodId: 'period_1',
      hasReport: true
    });
  });

  test('should navigate to completion report detail from today task shortcut', () => {
    pageInstance.setData({
      currentPeriodReport: {
        periodId: 'period_1',
        hasReport: true
      }
    });

    pageInstance.handleTodayReportBtnTap.call(pageInstance, {
      stopPropagation: jest.fn()
    });

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/completion-report-detail/completion-report-detail?periodId=period_1'
    });
  });

  test('should navigate from ended-period task empty actions', () => {
    pageInstance.setData({
      currentPeriod: {
        _id: 'period_resilience'
      },
      todayTaskEmptyState: {
        type: 'period-ended',
        periodId: 'period_resilience'
      }
    });

    pageInstance.handleTodayTaskEmptyAction.call(pageInstance, {
      stopPropagation: jest.fn(),
      currentTarget: {
        dataset: {
          action: 'courses'
        }
      }
    });

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/courses/courses?periodId=period_resilience'
    });
  });

  test('ended-period keepsake action opens the keepsake of that period', () => {
    pageInstance.setData({
      todayTaskEmptyState: { type: 'period-ended', periodId: 'period_resilience' }
    });

    pageInstance.handleTodayTaskEmptyAction.call(pageInstance, {
      stopPropagation: jest.fn(),
      currentTarget: { dataset: { action: 'keepsake' } }
    });

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/keepsake/keepsake?periodId=period_resilience'
    });
  });

  test('welcome-back line only shows after a gap and never counts the missed days', () => {
    const build = pageInstance.buildWelcomeBackText;
    const now = new Date('2026-11-12T07:00:00');
    const today = { title: '今日一课', isCheckedIn: false };

    // 昨天刚打过卡：不提示
    expect(build({ todaySection: today, recentCheckins: [{ dateKey: '2026-11-11' }], now })).toBe('');
    // 隔了三天以上：欢迎回来，不出现具体天数
    const back = build({ todaySection: today, recentCheckins: [{ dateKey: '2026-11-08' }, { dateKey: '2026-11-02' }], now });
    expect(back).toContain('回来就好');
    expect(back).not.toMatch(/\d/);
    // 今天已经打卡、或没有今日任务：不提示
    expect(build({ todaySection: { isCheckedIn: true }, recentCheckins: [{ dateKey: '2026-11-01' }], now })).toBe('');
    expect(build({ todaySection: null, recentCheckins: [{ dateKey: '2026-11-01' }], now })).toBe('');
    // 开营几天了还没打过卡：告诉他从今天开始就好
    expect(build({ todaySection: today, recentCheckins: [], totalCheckinDays: 0, periodDayIndex: 5, now })).toContain('不用补');
    // 开营头两天、或者打过卡但列表没加载出来：不提示
    expect(build({ todaySection: today, recentCheckins: [], totalCheckinDays: 0, periodDayIndex: 2, now })).toBe('');
    expect(build({ todaySection: today, recentCheckins: [], totalCheckinDays: 6, periodDayIndex: 9, now })).toBe('');
  });

  test('sky starts at the left end on first show, then moves to the position for now', () => {
    jest.useFakeTimers();
    try {
      const noon = new Date(2026, 10, 12, 12, 0);
      pageInstance.refreshSky.call(pageInstance, noon);
      expect(pageInstance.data).toMatchObject({ skyBody: 'sun', skyPhase: 'noon', skyReady: false });
      expect(pageInstance.data.skyAngle).toBeLessThan(-28);

      // 首屏还是骨架（问候区没出来）时先不动
      pageInstance.data.loading = true;
      pageInstance.data.userStats = null;
      jest.advanceTimersByTime(1000);
      expect(pageInstance.data.skyReady).toBe(false);

      // 问候区出来了，才开始往上升
      pageInstance.data.loading = false;
      jest.advanceTimersByTime(400);
      expect(pageInstance.data).toMatchObject({ skyAngle: 0, skyReady: true });

      // 再回到首页：不重播，直接挪到新位置
      pageInstance.refreshSky.call(pageInstance, new Date(2026, 10, 12, 20, 0));
      expect(pageInstance.data).toMatchObject({ skyBody: 'moon', skyPhase: 'moon-crescent', skyReady: true });
    } finally {
      jest.useRealTimers();
    }
  });

  test('tapping the home envelope plays the opening transition before entering the letter', () => {
    jest.useFakeTimers();
    try {
      wx.navigateTo = jest.fn();
      pageInstance.ensurePaidFeatureAccess = jest.fn(() => true);
      pageInstance.setData({ recentInsights: [{ id: 'insight_1', unread: true }] });
      const tap = { currentTarget: { dataset: { id: 'insight_1' } } };

      pageInstance.handleInsightClick.call(pageInstance, tap);
      expect(pageInstance.data.envOpening).toBe(true);
      expect(pageInstance.data.recentInsights[0].unread).toBe(false);
      expect(wx.navigateTo).not.toHaveBeenCalled();

      // 拆信过程中再点不会重复触发
      pageInstance.handleInsightClick.call(pageInstance, tap);
      jest.advanceTimersByTime(2900);
      expect(wx.navigateTo).toHaveBeenCalledTimes(1);
      expect(wx.navigateTo.mock.calls[0][0].url).toBe('/pages/insight-detail/insight-detail?id=insight_1');

      jest.advanceTimersByTime(800);
      expect(pageInstance.data.envOpening).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test('home letter note: write in the first days, open when delivered, gone after sealing or opening', () => {
    const build = pageInstance.buildHomeLetterNote;
    expect(build({ status: 'none', canWrite: true }, 2)).toMatchObject({ kind: 'write', cta: '去写信' });
    expect(build({ status: 'none', canWrite: true }, 0)).toMatchObject({ kind: 'write' }); // 开营前几天
    expect(build({ status: 'draft', canWrite: true }, 3)).toMatchObject({ kind: 'write', cta: '接着写' });
    expect(build({ status: 'none', canWrite: true }, 4)).toBe(null); // 第四天起只在营地角落里
    expect(build({ status: 'sealed', canWrite: false }, 2)).toBe(null);
    // 寄出当天显示「去查看」，第二天起收起来
    const sealed = { status: 'sealed', canWrite: false, daysToDeliver: 21, sealedAt: '2026-11-12T03:00:00+08:00' };
    expect(build(sealed, 1, { todayKey: '2026-11-12' })).toMatchObject({ kind: 'sealed', cta: '去查看' });
    expect(build(sealed, 2, { todayKey: '2026-11-13' })).toBe(null);
    // 后端还没返回 sealedAt 时用本机记下的寄出日期
    expect(build({ status: 'sealed', daysToDeliver: 21 }, 1, { todayKey: '2026-11-12', sealedKey: '2026-11-12' })).toMatchObject({ kind: 'sealed' });
    expect(build({ status: 'delivered', canWrite: false }, 23)).toMatchObject({ kind: 'arrived', cta: '拆开' });
    expect(build({ status: 'opened', canWrite: false }, 23)).toBe(null);
    expect(build(null, 1)).toBe(null);
  });

  test('today task is limited to the seven habits course template', () => {
    const uses = pageInstance.usesSevenHabitsCourseTemplate;
    expect(uses(null)).toBe(true);
    expect(uses({ courseTemplateSnapshot: { templateId: 'seven-habits' } })).toBe(true);
    expect(uses({ courseTemplateSnapshot: { templateId: '681f000000000000000000aa' } })).toBe(false);
  });

  test('should navigate to all periods from task empty action', () => {
    wx.switchTab = jest.fn();
    pageInstance.setData({
      todayTaskEmptyState: {
        type: 'no-enrollment'
      }
    });

    pageInstance.handleTodayTaskEmptyAction.call(pageInstance, {
      stopPropagation: jest.fn(),
      currentTarget: {
        dataset: {
          action: 'periods'
        }
      }
    });

    expect(wx.switchTab).toHaveBeenCalledWith({
      url: '/pages/periods/periods'
    });
  });

  test('should show join-period empty state for a user without enrollments', async () => {
    userService.getUserProfile.mockResolvedValue({
      _id: 'user_123',
      nickname: '小狐狸',
      signature: '初来乍到'
    });
    userService.getUserStats.mockResolvedValue({ totalCheckinDays: 0 });
    courseService.getPeriods.mockResolvedValue({
      list: [
        {
          _id: 'period_active',
          title: '韧性之树',
          name: '韧性之树',
          startDate: '2000-01-01T00:00:00.000Z',
          endDate: '2099-12-31T00:00:00.000Z',
          totalDays: 21
        }
      ]
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({ list: [] });
    courseService.getTodayTask.mockResolvedValue(null);
    periodAccess.getPeriodAccess.mockResolvedValue({
      canAccessCommunity: false,
      communityAccessState: 'locked',
      paymentStatus: null
    });

    await pageInstance.loadUserData.call(pageInstance, true);
    await new Promise(resolve => setImmediate(resolve));

    expect(courseService.getSectionDetail).not.toHaveBeenCalled();
    expect(courseService.getPeriodSections).not.toHaveBeenCalled();
    expect(pageInstance.data.currentPeriod).toBe(null);
    expect(pageInstance.data.todaySection).toBe(null);
    expect(pageInstance._periodNameById.get('period_active')).toBe('韧性之树');
    expect(pageInstance.data.todayTaskEmptyState).toMatchObject({
      type: 'no-enrollment',
      coverLabel: '未加入',
      title: '还没有加入晨读营',
      description: '加入一期晨读营后，这里会显示每天的晨读与打卡任务。',
      primaryAction: {
        text: '选择晨读营',
        type: 'periods'
      },
      secondaryActions: []
    });
  });

  test('should hide the today task board for custom course templates', async () => {
    userService.getUserProfile.mockResolvedValue({
      _id: 'user_123',
      nickname: '小狐狸'
    });
    userService.getUserStats.mockResolvedValue({ totalCheckinDays: 5 });
    courseService.getPeriods.mockResolvedValue({
      list: [
        {
          _id: 'period_custom',
          title: '空间管理',
          name: '空间管理',
          startDate: '2000-01-01T00:00:00.000Z',
          endDate: '2099-12-31T00:00:00.000Z',
          courseTemplateSnapshot: {
            templateId: '681f000000000000000000aa',
            name: '空间管理'
          }
        }
      ]
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [
        {
          periodId: 'period_custom',
          status: 'active',
          paymentStatus: 'paid'
        }
      ]
    });
    courseService.getTodayTask.mockResolvedValue({
      sectionId: 'section_custom',
      periodId: 'period_custom',
      day: 1
    });
    courseService.getSectionDetail.mockResolvedValue({
      _id: 'section_custom',
      title: '观察空间'
    });
    periodAccess.getPeriodAccess.mockResolvedValue({
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      paymentStatus: 'paid'
    });

    await pageInstance.loadUserData.call(pageInstance, true);
    await Promise.resolve();

    expect(courseService.getSectionDetail).not.toHaveBeenCalled();
    expect(courseService.getPeriodSections).not.toHaveBeenCalled();
    expect(pageInstance.data.todaySection).toBe(null);
    expect(pageInstance.data.todayTaskEmptyState).toBe(null);
    expect(pageInstance.data.homeSections.map(item => item.key)).not.toContain('todayTask');
  });

  test('should fetch checkin detail when recent card is missing sectionId', async () => {
    checkinService.getCheckinDetail.mockResolvedValue({
      _id: 'checkin_2',
      sectionId: {
        _id: 'section_2'
      }
    });

    await pageInstance.handleRecentCheckinTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_2',
          sectionId: ''
        }
      }
    });

    expect(wx.showLoading).toHaveBeenCalled();
    expect(checkinService.getCheckinDetail).toHaveBeenCalledWith('checkin_2');
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/course-detail/course-detail?id=section_2&checkinId=checkin_2'
    });
    expect(wx.hideLoading).toHaveBeenCalled();
  });

  test('should navigate to checkin records page from more card', () => {
    pageInstance.navigateToCheckinRecords.call(pageInstance);

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/checkin-records/checkin-records'
    });
  });

  test('should navigate to notifications page from home task header', () => {
    pageInstance.navigateToNotifications.call(pageInstance);

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/notifications/notifications'
    });
  });

  test('should set daypart greeting and navigation bar color on show', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 10, 6, 30));
    wx.setNavigationBarColor = jest.fn();
    pageInstance.setData = jest.fn(data => Object.assign(pageInstance.data, data));

    pageInstance.refreshDaypart.call(pageInstance);
    jest.useRealTimers();

    expect(pageInstance.data.daypart).toBe('dawn');
    expect(pageInstance.data.greeting).toBe('早安');
    expect(pageInstance.data.dateText).toBe('11月10日 周二');
    expect(wx.setNavigationBarColor).toHaveBeenCalledWith({
      frontColor: '#000000',
      backgroundColor: '#fbe3c3'
    });
  });

  describe('同行感、节气与营地角落', () => {
    // 东八区 06:00 = UTC 22:00 前一天；东八区 10:00 = UTC 02:00
    const at6 = new Date('2026-11-06T22:00:00Z');
    const at10 = new Date('2026-11-07T02:00:00Z');

    test('presence: 早间窗口内显示此刻在读', () => {
      expect(pageConfig.buildPresenceText({ readingNow: 5, completedToday: 9 }, at6)).toBe('此刻有 5 位书友也在读');
    });

    test('presence: 窗口外或 readingNow 为空时显示今天读完', () => {
      expect(pageConfig.buildPresenceText({ readingNow: 5, completedToday: 9 }, at10)).toBe('今天已有 9 位书友读完');
      expect(pageConfig.buildPresenceText({ readingNow: null, completedToday: 3 }, at6)).toBe('今天已有 3 位书友读完');
    });

    test('presence: 都为空不显示', () => {
      expect(pageConfig.buildPresenceText({ readingNow: null, completedToday: null }, at6)).toBe('');
      expect(pageConfig.buildPresenceText(null, at6)).toBe('');
    });

    test('日期行：节气当天加节气名，平常日不加', () => {
      expect(pageConfig.formatHomeDateText(new Date(2026, 10, 7))).toBe('11月7日 周六 · 立冬');
      expect(pageConfig.formatHomeDateText(new Date(2026, 10, 11))).toBe('11月11日 周三');
    });

    test('日签出处：用换算后的第几天，算不出时只用标题', () => {
      expect(pageConfig.buildDailyCardSource({ lessonNumber: 5, title: '积极主动' })).toEqual({ source: '第 5 天 · 积极主动', day: 5 });
      expect(pageConfig.buildDailyCardSource({ title: '积极主动' })).toEqual({ source: '积极主动', day: '' });
    });

    test('营地角落：慢递邮局各状态', () => {
      const t = letter => pageConfig.buildCampCornerCards({ letter }).map(c => c.title);
      expect(t({ canWrite: true, status: 'none' })).toEqual(['给结营那天的自己写封信']);
      expect(t({ canWrite: true, status: 'draft' })).toEqual(['给结营那天的自己写封信']);
      expect(t({ canWrite: false, status: 'none' })).toEqual([]);
      expect(t({ status: 'sealed', daysToDeliver: 12 })).toEqual(['信在路上，还有 12 天']);
      expect(t({ status: 'delivered' })).toEqual(['有一封信到了']);
      expect(t({ status: 'opened' })).toEqual([]);
    });

    test('营地角落：实修各状态', () => {
      const c = practice => pageConfig.buildCampCornerCards({ practice });
      expect(c({ active: false })).toEqual([]);
      expect(c({ active: true, practice: null })[0].title).toBe('给这一周定一个小行动');
      expect(c({ active: true, practice: { text: '早起喝水' }, today: { done: true } })[0]).toMatchObject({ title: '早起喝水', sub: '已记「做到了」' });
      expect(c({ active: true, practice: { text: '早起喝水' }, today: { done: false } })[0].sub).toBe('今天没有');
      expect(c({ active: true, practice: { text: '早起喝水' }, today: { done: null } })[0].sub).toBe('今天还没记');
    });

    test('营地角落：读伴各状态与整体为空', () => {
      const c = buddy => pageConfig.buildCampCornerCards({ buddy });
      expect(c({ state: 'none' })[0].title).toBe('想要一位读伴');
      expect(c({ state: 'waiting' })[0].title).toBe('正在等一位读伴');
      expect(c({ state: 'paired', buddy: { nickname: '小林', readToday: true, checkedInToday: false } })[0]).toMatchObject({
        title: '小林', paired: true, read: true, checked: false
      });
      expect(c({ state: 'ended' })).toEqual([]);
      expect(pageConfig.buildCampCornerCards({ letter: null, practice: null, buddy: null })).toEqual([]);
    });
  });

  describe('today card state', () => {
    const at = time => new Date(`2026-11-12T${time}+08:00`);
    const card = (section, enabled, time) => pageConfig.buildTodayCardState(section, enabled, at(time));

    test.each([
      ['04:59:00', 'night', 'read'],
      ['05:00:00', 'morning', 'read'],
      ['07:29:59', 'morning', 'read'],
      ['07:30:00', 'day', 'checkin'],
      ['23:59:00', 'day', 'checkin']
    ])('北京时间 %s 显示 %s 时段和 %s 主操作', (time, phase, primary) => {
      const state = card({}, true, time);
      expect(state.phase).toBe(phase);
      expect(state.primary.type).toBe(primary);
      if (primary === 'read') expect(state.showDirectCheckin).toBe(true);
      else expect(state.showReadingLink).toBe(true);
    });

    test('已读未打卡优先打卡，保留再读入口', () => {
      const state = card({ readingCompleted: true }, true, '05:30:00');
      expect(state.primary).toEqual({ type: 'checkin', text: '去打卡' });
      expect(state.readingLinkText).toBe('再读一遍');
      expect(state.showReadingLink).toBe(true);
    });

    test('已打卡优先于时段，文案不假定在小程序内读完', () => {
      for (const time of ['04:00:00', '06:00:00', '12:00:00']) {
        const state = card({ isCheckedIn: true, readingCompleted: false }, true, time);
        expect(state.primary).toEqual({ type: 'read', text: '再读一遍' });
        expect(state.message).toContain('今天已打卡');
        expect(state.showDailyCard).toBe(true);
        expect(state.showDirectCheckin).toBe(false);
      }
    });

    test('没有社群权限始终保留学习入口，不显示打卡或日签入口', () => {
      const unread = card({}, false, '12:00:00');
      expect(unread.primary.type).toBe('read');
      expect(unread.showStudy).toBe(true);
      expect(unread.showDirectCheckin).toBe(false);
      const read = card({ readingCompleted: true }, false, '12:00:00');
      expect(read.primary).toEqual({ type: 'study', text: '去学习' });
      expect(read.showDailyCard).toBe(false);
    });

    test('打卡状态取不到时不冒充已完成，保留可用入口', () => {
      const state = card({ isCheckedIn: true, checkinStateKnown: false }, true, '12:00:00');
      expect(state.checkedIn).toBe(false);
      expect(state.message).toContain('暂时没取到');
      expect(state.primary.type).toBe('read');
      expect(state.showDirectCheckin).toBe(true);
    });

    test('下一次切换使用北京时间而不是设备时区', () => {
      const state = pageConfig.getTodayCardTime(new Date('2026-11-11T23:29:00Z'));
      expect(state).toMatchObject({ dateKey: '2026-11-12', phase: 'morning' });
      expect(new Date(state.nextChangeAt).toISOString()).toBe('2026-11-11T23:30:00.000Z');
    });
  });

  test('首页停留跨过 7:30 自动切换，隐藏时清理计时器', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-11T23:29:59.900Z'));
    pageInstance._isPageVisible = true;
    pageInstance.setData({
      canAccessCurrentPeriodCommunity: true,
      todaySection: { _id: 's1', readingCompleted: false, isCheckedIn: false }
    });
    pageInstance.refreshTodayCard();
    pageInstance.scheduleTodayCardRefresh();
    expect(pageInstance.data.todayCard.primary.type).toBe('read');
    jest.advanceTimersByTime(150);
    expect(pageInstance.data.todayCard.primary.type).toBe('checkin');
    pageInstance.onHide();
    expect(pageInstance._todayCardTimer).toBeNull();
  });

  test('跨北京时间午夜先移除旧课节并刷新当天任务', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-12T15:59:59.900Z'));
    pageInstance._isPageVisible = true;
    pageInstance._todayCardDate = '2026-11-12';
    pageInstance.setData({ isLogin: true, todaySection: { _id: 'old' }, todayCard: { checkedIn: true } });
    pageInstance.loadUserData = jest.fn();
    pageInstance.scheduleTodayCardRefresh();
    jest.advanceTimersByTime(150);
    expect(pageInstance.data.todaySection).toBeNull();
    expect(pageInstance.data.todayCard).toBeNull();
    expect(pageInstance.data.todayTaskEmptyState.type).toBe('load-error');
    expect(pageInstance.loadUserData).toHaveBeenCalledTimes(1);
    pageInstance.onHide();
  });

  test('完成阅读后立即返回首页时使用本地完成状态', () => {
    const reading = require('../../utils/reading-completion');
    reading.decorateSectionWithReadingCompletion.mockImplementationOnce(section => ({ ...section, readingCompleted: true }));
    pageInstance.setData({
      canAccessCurrentPeriodCommunity: true,
      todaySection: { _id: 's1', readingCompleted: false, isCheckedIn: false }
    });
    pageInstance.refreshTodayCard(new Date('2026-11-11T22:00:00Z'));
    expect(pageInstance.data.todaySection.readingCompleted).toBe(true);
    expect(pageInstance.data.todayCard.primary.type).toBe('checkin');
  });

  test('新增或删除打卡后返回首页时绕过 30 秒数据节流', () => {
    jest.useFakeTimers();
    const app = { globalData: { checkinListDirty: true } };
    global.getApp = jest.fn(() => app);
    pageInstance._lastLoadTime = Date.now();
    pageInstance.setData({
      canAccessCurrentPeriodCommunity: true,
      todaySection: { _id: 's1', isCheckedIn: true }
    });
    pageInstance.refreshDaypart = jest.fn();
    pageInstance.loadRecentCheckins = jest.fn(() => Promise.resolve([]));
    pageInstance.checkLoginStatus = jest.fn();
    pageInstance.onShow();
    expect(pageInstance.checkLoginStatus).toHaveBeenCalledWith({ refreshUserData: true });
    expect(pageInstance.data.todaySection.checkinStateKnown).toBe(false);
    expect(pageInstance.data.todayCard.checkedIn).toBe(false);
    expect(app.globalData.checkinListDirty).toBe(false);
    pageInstance.onHide();
  });

  test('今日任务加载失败后可以重新加载', () => {
    pageInstance.loadUserData = jest.fn();
    pageInstance.handleTodayTaskEmptyAction({ currentTarget: { dataset: { action: 'retry' } } });
    expect(pageInstance.loadUserData).toHaveBeenCalledTimes(1);
  });

  test('journey line shows the streak only when currentStreak is above zero', () => {
    const markup = require('fs').readFileSync(
      require('path').join(__dirname, '../../pages/index/index.wxml'),
      'utf8'
    );
    expect(markup).toContain('<text wx:if="{{userStats.currentStreak > 0}}">连续晨读');
    expect(markup).toContain('{{userStats.totalCheckinDays || 0}}');
    expect(markup).not.toContain('item.typeConfig.color');
    expect(markup).toContain('class="insight-env"');
    expect(markup).toContain('小凡给你留了一封信');
    expect(markup).toContain('class="leaf-day"');
  });

  test('should refresh unread notification count when returning to home within data throttle window', async () => {
    pageInstance._lastLoadTime = Date.now();
    const { tenantStorage } = require('../../utils/storage');
    tenantStorage.set('token', 'token_1');
    tenantStorage.set('userInfo', {
      _id: 'user_123',
      nickname: '小狐狸'
    });
    pageInstance.setData({
      isLogin: true,
      unreadNotificationCount: 6
    });
    notificationService.getUnreadCount.mockResolvedValue({ unreadCount: 0 });

    pageInstance.onShow.call(pageInstance);
    await Promise.resolve();

    expect(notificationService.getUnreadCount).toHaveBeenCalled();
    expect(pageInstance.data.unreadNotificationCount).toBe(0);
  });

  test('should open immersive reading from the morning reading button', async () => {
    pageInstance.data.currentPeriod = {
      _id: 'period_1'
    };
    pageInstance.data.todaySection = {
      _id: 'section_today',
      periodId: 'period_1'
    };

    await pageInstance.handleJoinMeeting.call(pageInstance);

    expect(subscribeAutoTopUp.maybeAutoTopUpNextDayStudyReminder).toHaveBeenCalledWith({
      periodId: 'period_1',
      sectionId: 'section_today',
      sourcePage: 'index',
      sourceAction: 'morning_read_click'
    });

    expect(activityService.track).toHaveBeenCalledWith('meeting_enter', {
      targetType: 'immersive_reading',
      targetId: 'section_today',
      periodId: 'period_1',
      sectionId: 'section_today',
      metadata: {
        source: 'profile_today_task',
        tencentMeetingDisabled: true
      }
    });
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/reading-mode/reading-mode?id=section_today&periodId=period_1'
    });
    expect(wx.navigateToMiniProgram).not.toHaveBeenCalled();
  });

  test('should show an error when morning reading has no section id', async () => {
    pageInstance.data.currentPeriod = {
      _id: 'period_1'
    };
    pageInstance.data.todaySection = {};

    await pageInstance.handleJoinMeeting.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '课节信息不存在',
      icon: 'none'
    });
    expect(wx.navigateTo).not.toHaveBeenCalled();
    expect(activityService.track).not.toHaveBeenCalled();
  });

  test('should pass reading completion state into immersive reading', async () => {
    pageInstance.data.currentPeriod = {
      _id: 'period_1'
    };
    pageInstance.data.todaySection = {
      _id: 'section_today',
      periodId: 'period_1',
      readingCompleted: true,
      readingDurationMs: 91000,
      readingCompletedAt: '2026-05-15T08:00:00.000Z'
    };

    await pageInstance.handleJoinMeeting.call(pageInstance);

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url:
        '/pages/reading-mode/reading-mode?id=section_today&periodId=period_1' +
        '&readingCompleted=1&readingDurationMs=91000' +
        '&readingCompletedAt=2026-05-15T08%3A00%3A00.000Z'
    });
  });

  test('should show morning read prompt only inside window and once per day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 15, 5, 55));
    wx.clearStorageSync();

    pageInstance.data.isLogin = true;
    pageInstance.data.todaySection = {
      _id: 'section_today',
      periodId: 'period_1',
      readingCompleted: false
    };

    pageInstance.maybeShowMorningReadPrompt.call(pageInstance);

    expect(pageInstance.data.showMorningReadPrompt).toBe(true);

    pageInstance.data.showMorningReadPrompt = false;
    pageInstance.data.todaySection.readingCompleted = true;
    pageInstance.maybeShowMorningReadPrompt.call(pageInstance);

    expect(pageInstance.data.showMorningReadPrompt).toBe(false);

    pageInstance.data.todaySection.readingCompleted = false;
    wx.setStorageSync('morning_read_prompt_date', '2026-05-15');
    pageInstance.maybeShowMorningReadPrompt.call(pageInstance);

    expect(pageInstance.data.showMorningReadPrompt).toBe(false);
    jest.useRealTimers();
  });

  test('should handle morning read prompt primary action', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 15, 5, 55));
    wx.clearStorageSync();
    pageInstance.data.currentPeriod = {
      _id: 'period_1'
    };
    pageInstance.data.todaySection = {
      _id: 'section_today',
      periodId: 'period_1'
    };
    pageInstance.data.showMorningReadPrompt = true;

    pageInstance.handleMorningReadPromptGo.call(pageInstance);
    await Promise.resolve();
    await Promise.resolve();

    expect(wx.setStorageSync).toHaveBeenCalledWith(
      'morning_read_prompt_date',
      '2026-05-15'
    );
    expect(pageInstance.data.showMorningReadPrompt).toBe(false);
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/reading-mode/reading-mode?id=section_today&periodId=period_1'
    });
    expect(activityService.track).toHaveBeenCalledWith(
      'meeting_enter',
      {
        targetType: 'immersive_reading',
        targetId: 'section_today',
        periodId: 'period_1',
        sectionId: 'section_today',
        metadata: {
          source: 'profile_today_task',
          tencentMeetingDisabled: true
        }
      }
    );
    jest.useRealTimers();
  });

  test('should block checkin navigation when current period community is locked', async () => {
    pageInstance.data.currentPeriodCommunityState = 'locked';
    pageInstance.data.canUsePaidFeatures = false;

    await pageInstance.handleRecentCheckinTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_1',
          sectionId: 'section_1'
        }
      }
    });

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '完成支付后可查看打卡日记',
      icon: 'none'
    });
    expect(wx.navigateTo).not.toHaveBeenCalled();
  });

  test('should keep reading completion state on the home today task', async () => {
    userService.getUserProfile.mockResolvedValue({
      _id: 'user_123',
      nickname: '小狐狸',
      signature: '认真读完'
    });
    userService.getUserStats.mockResolvedValue({ totalCheckinDays: 6 });
    courseService.getPeriods.mockResolvedValue({
      list: [
        {
          _id: 'period_current',
          title: '心想事成',
          name: '心想事成',
          startDate: '2000-01-01T00:00:00.000Z',
          endDate: '2099-12-31T00:00:00.000Z',
          coverColor: '#4a90e2',
          coverEmoji: '∞'
        }
      ]
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [
        {
          _id: 'enrollment_current',
          periodId: 'period_current',
          status: 'active',
          paymentStatus: 'paid'
        }
      ]
    });
    courseService.getTodayTask.mockResolvedValue({
      sectionId: 'section_day_1',
      periodId: 'period_current',
      periodTitle: '心想事成',
      day: 1,
      checkinCount: 2,
      checkinUsers: [],
      isCheckedIn: false,
      readingCompleted: true,
      readingCompletedAt: '2026-05-15T08:00:00.000Z',
      readingDurationMs: 92000
    });
    courseService.getSectionDetail.mockResolvedValue({
      _id: 'section_day_1',
      title: '空间构想',
      readingCompleted: false
    });
    courseService.getPeriodSections.mockResolvedValue({
      list: [
        { _id: 'section_day_1', day: 1, title: '空间构想' },
        { _id: 'section_day_8', day: 8, title: '空间创造四步曲' }
      ]
    });
    periodAccess.getPeriodAccess.mockResolvedValue({
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      paymentStatus: 'paid'
    });
    checkinService.getUserCheckinsWithStats.mockResolvedValue({ list: [] });
    insightService.getInsightsList.mockResolvedValue({ list: [] });
    insightService.getReceivedRequests.mockResolvedValue([]);

    await pageInstance.loadUserData.call(pageInstance, true);

    expect(pageInstance.data.todaySection).toMatchObject({
      _id: 'section_day_1',
      day: 1,
      dayDisplay: '第 01 课',
      readingCompleted: true,
      readingCompletedAt: '2026-05-15T08:00:00.000Z',
      readingDurationMs: 92000
    });
  });

  test('should keep paid homepage sections visible when current period is unpaid', async () => {
    userService.getUserProfile.mockResolvedValue({
      _id: 'user_123',
      nickname: '小狐狸',
      signature: '呼噜呼噜'
    });
    userService.getUserStats.mockResolvedValue({ totalCheckinDays: 5 });
    courseService.getPeriods.mockResolvedValue({
      list: [
        {
          _id: 'period_current',
          title: '秩序之锚',
          name: '秩序之锚',
          startDate: '2026-05-01T00:00:00.000Z',
          endDate: '2026-05-31T00:00:00.000Z',
          coverColor: '#4a90e2',
          coverEmoji: '∞'
        },
        {
          _id: 'period_paid',
          title: '内在之光',
          name: '内在之光',
          startDate: '2026-03-01T00:00:00.000Z',
          endDate: '2026-03-31T00:00:00.000Z'
        }
      ]
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [
        {
          _id: 'enrollment_current',
          periodId: 'period_current',
          status: 'active',
          paymentStatus: 'pending'
        },
        {
          _id: 'enrollment_paid',
          periodId: 'period_paid',
          status: 'completed',
          paymentStatus: 'paid'
        }
      ]
    });
    courseService.getTodayTask.mockResolvedValue({
      sectionId: 'section_today',
      periodId: 'period_current',
      periodTitle: '秩序之锚',
      day: 6,
      checkinCount: 0,
      checkinUsers: [],
      isCheckedIn: false
    });
    courseService.getSectionDetail.mockResolvedValue({
      _id: 'section_today',
      title: '开营词'
    });
    periodAccess.getPeriodAccess.mockResolvedValue({
      canAccessCommunity: false,
      communityAccessState: 'locked',
      paymentStatus: 'pending'
    });
    checkinService.getUserCheckinsWithStats.mockResolvedValue({
      list: [
        {
          _id: 'checkin_paid',
          createdAt: '2026-03-29T13:11:00.000Z',
          note: '历史打卡',
          sectionId: { _id: 'section_paid', title: '第二天', day: 2 },
          periodId: { _id: 'period_paid', title: '内在之光' }
        }
      ]
    });
    insightService.getInsightsList.mockResolvedValue({ list: [] });
    insightService.getReceivedRequests.mockResolvedValue([]);

    await pageInstance.loadUserData.call(pageInstance, true);
    await new Promise(resolve => setImmediate(resolve));

    expect(pageInstance.data.currentPeriodCommunityState).toBe('locked');
    expect(pageInstance.data.canUsePaidFeatures).toBe(true);
    expect(checkinService.getUserCheckinsWithStats).toHaveBeenCalled();
    expect(insightService.getInsightsList).toHaveBeenCalledWith({ limit: 100 });
    expect(pageInstance.data.recentCheckins).toHaveLength(1);
  });

  test('should show ended-period empty state after the current period has ended', async () => {
    userService.getUserProfile.mockResolvedValue({
      _id: 'user_123',
      nickname: '小狐狸',
      signature: '结营复盘'
    });
    userService.getUserStats.mockResolvedValue({ totalCheckinDays: 21 });
    courseService.getPeriods.mockResolvedValue({
      list: [
        {
          _id: 'period_resilience',
          title: '韧性之树',
          name: '韧性之树',
          startDate: '2000-01-01T00:00:00.000Z',
          endDate: '2000-01-21T00:00:00.000Z',
          totalDays: 21,
          coverColor: '#4a90e2',
          coverEmoji: '🌳'
        }
      ]
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [
        {
          _id: 'enrollment_resilience',
          periodId: 'period_resilience',
          status: 'completed',
          paymentStatus: 'paid'
        }
      ]
    });
    courseService.getTodayTask.mockResolvedValue(null);
    courseService.getPeriodSections.mockResolvedValue({
      list: [
        {
          _id: 'section_day_1',
          id: 'section_day_1',
          day: 1,
          title: '第一天 品德成功论',
          isCheckedIn: false
        },
        {
          _id: 'section_day_21',
          id: 'section_day_21',
          day: 21,
          title: '结营词',
          isCheckedIn: true
        }
      ]
    });
    periodAccess.getPeriodAccess.mockResolvedValue({
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      paymentStatus: 'paid'
    });
    checkinService.getUserCheckinsWithStats.mockResolvedValue({ list: [] });
    insightService.getInsightsList.mockResolvedValue({ list: [] });
    insightService.getReceivedRequests.mockResolvedValue([]);
    completionReportService.getMyReports.mockResolvedValue({
      list: [
        {
          periodId: 'period_resilience',
          hasReport: true,
          reportTitle: '韧性之树结营实录'
        }
      ]
    });

    await pageInstance.loadUserData.call(pageInstance, true);
    await new Promise(resolve => setImmediate(resolve));

    expect(courseService.getPeriodSections).not.toHaveBeenCalled();
    expect(pageInstance.data.todaySection).toBe(null);
    expect(pageInstance.data.todayTaskEmptyState).toMatchObject({
      type: 'period-ended',
      title: '韧性之树读完了',
      periodId: 'period_resilience',
      primaryAction: {
        text: '翻开纪念册',
        type: 'keepsake'
      },
      secondaryActions: [
        { text: '看结营实录', type: 'report' },
        { text: '回看课程', type: 'courses' }
      ]
    });
    expect(pageInstance.data.currentPeriodReport).toMatchObject({
      periodId: 'period_resilience',
      hasReport: true
    });
  });

  test('should ignore stale first-day today task after the period has ended', async () => {
    userService.getUserProfile.mockResolvedValue({
      _id: 'user_123',
      nickname: '小狐狸',
      signature: '结营复盘'
    });
    userService.getUserStats.mockResolvedValue({ totalCheckinDays: 21 });
    courseService.getPeriods.mockResolvedValue({
      list: [
        {
          _id: 'period_resilience',
          title: '韧性之树',
          name: '韧性之树',
          startDate: '2000-01-01T00:00:00.000Z',
          endDate: '2000-01-21T00:00:00.000Z',
          totalDays: 21
        }
      ]
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [
        {
          _id: 'enrollment_resilience',
          periodId: 'period_resilience',
          status: 'completed',
          paymentStatus: 'paid'
        }
      ]
    });
    courseService.getTodayTask.mockResolvedValue({
      sectionId: 'section_day_1',
      periodId: 'period_resilience',
      periodTitle: '韧性之树',
      day: 1,
      checkinCount: 5,
      checkinUsers: [],
      isCheckedIn: false
    });
    courseService.getSectionDetail.mockResolvedValue({
      _id: 'section_day_1',
      title: '第一天 品德成功论'
    });
    courseService.getPeriodSections.mockResolvedValue({
      list: [
        {
          _id: 'section_day_1',
          id: 'section_day_1',
          day: 1,
          title: '第一天 品德成功论',
          isCheckedIn: false
        },
        {
          _id: 'section_day_21',
          id: 'section_day_21',
          day: 21,
          title: '结营词',
          isCheckedIn: true
        }
      ]
    });
    periodAccess.getPeriodAccess.mockResolvedValue({
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      paymentStatus: 'paid'
    });
    checkinService.getUserCheckinsWithStats.mockResolvedValue({ list: [] });
    insightService.getInsightsList.mockResolvedValue({ list: [] });
    insightService.getReceivedRequests.mockResolvedValue([]);

    await pageInstance.loadUserData.call(pageInstance, true);
    await new Promise(resolve => setImmediate(resolve));

    expect(courseService.getSectionDetail).not.toHaveBeenCalled();
    expect(courseService.getPeriodSections).not.toHaveBeenCalled();
    expect(pageInstance.data.todaySection).toBe(null);
    expect(pageInstance.data.todayTaskEmptyState).toMatchObject({
      type: 'period-ended',
      title: '韧性之树读完了',
      periodId: 'period_resilience',
      primaryAction: { text: '翻开纪念册', type: 'keepsake' },
      secondaryActions: [{ text: '回看课程', type: 'courses' }]
    });
  });

  test('should hide completion report shortcut before the final period day', async () => {
    userService.getUserProfile.mockResolvedValue({
      _id: 'user_123',
      nickname: '小狐狸',
      signature: '今日精进'
    });
    userService.getUserStats.mockResolvedValue({ totalCheckinDays: 1 });
    courseService.getPeriods.mockResolvedValue({
      list: [
        {
          _id: 'period_active',
          title: '韧性之树',
          name: '韧性之树',
          startDate: '2000-01-01T00:00:00.000Z',
          endDate: '2099-12-31T00:00:00.000Z',
          totalDays: 21
        }
      ]
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [
        {
          _id: 'enrollment_active',
          periodId: 'period_active',
          status: 'active',
          paymentStatus: 'paid'
        }
      ]
    });
    courseService.getTodayTask.mockResolvedValue({
      sectionId: 'section_day_1',
      periodId: 'period_active',
      periodTitle: '韧性之树',
      day: 1,
      checkinCount: 5,
      checkinUsers: [],
      isCheckedIn: false
    });
    courseService.getSectionDetail.mockResolvedValue({
      _id: 'section_day_1',
      id: 'section_day_1',
      day: 1,
      title: '第一天 品德成功论'
    });
    periodAccess.getPeriodAccess.mockResolvedValue({
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      paymentStatus: 'paid'
    });
    checkinService.getUserCheckinsWithStats.mockResolvedValue({ list: [] });
    insightService.getInsightsList.mockResolvedValue({ list: [] });
    insightService.getReceivedRequests.mockResolvedValue([]);
    completionReportService.getMyReports.mockResolvedValue({
      list: [
        {
          periodId: 'period_active',
          hasReport: true,
          reportTitle: '提前上传的实录'
        }
      ]
    });

    await pageInstance.loadUserData.call(pageInstance, true);
    await Promise.resolve();
    await Promise.resolve();

    expect(pageInstance.data.todaySection).toMatchObject({
      _id: 'section_day_1',
      day: 1,
      canShowReportShortcut: false
    });
    expect(completionReportService.getMyReports).not.toHaveBeenCalled();
    expect(pageInstance.data.currentPeriodReport).toBe(null);
  });

  test('should omit hidden home sections from configured homepage order', async () => {
    wx.request.mockImplementationOnce((options) => {
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          data: {
            sections: [
              { key: 'recentActivities', hidden: false },
              { key: 'todayTask', hidden: true },
              'zaichang',
              { key: 'myCheckins', hidden: true },
              'xiaofanInsights',
              'insightRequests'
            ]
          }
        }
      });
    });
    userService.getUserProfile.mockResolvedValue({
      _id: 'user_123',
      nickname: '小狐狸',
      signature: '呼噜呼噜'
    });
    userService.getUserStats.mockResolvedValue({ totalCheckinDays: 5 });
    courseService.getPeriods.mockResolvedValue({
      list: [
        {
          _id: 'period_current',
          title: '秩序之锚',
          name: '秩序之锚',
          startDate: '2026-05-01T00:00:00.000Z',
          endDate: '2026-05-31T00:00:00.000Z'
        }
      ]
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [
        {
          _id: 'enrollment_current',
          periodId: 'period_current',
          status: 'active',
          paymentStatus: 'paid'
        }
      ]
    });
    courseService.getTodayTask.mockResolvedValue(null);
    periodAccess.getPeriodAccess.mockResolvedValue({
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      paymentStatus: 'paid'
    });
    checkinService.getUserCheckinsWithStats.mockResolvedValue({ list: [] });
    insightService.getInsightsList.mockResolvedValue({ list: [] });
    insightService.getReceivedRequests.mockResolvedValue([]);

    await pageInstance.loadUserData.call(pageInstance, true);

    expect(pageInstance.data.homeSections.map(item => item.key)).toEqual([
      'recentActivities',
      'zaichang',
      'xiaofanInsights',
      'insightRequests'
    ]);
  });
  describe('首页昵称编辑真实流程', () => {
    beforeEach(() => {
      pageInstance.data.userInfo = { _id: 'user_123', nickname: '狮子', avatar: '🦁', avatarUrl: '', signature: '原签名' };
      pageInstance.openEditProfile();
      pageInstance.prepareAvatarUrlForSave = jest.fn(async url => url);
      pageInstance.loadUserData = jest.fn();
      userService.updateUserProfile.mockReset();
    });

    test('重名失败保留原资料，改回原名不再发请求', async () => {
      pageInstance.data.editForm.nickname = '林娜';
      userService.updateUserProfile.mockRejectedValue({ code: 409, message: '该昵称已被使用，请修改后再保存' });
      await pageInstance.saveUserProfile();
      expect(pageInstance.data.nicknameError).toBe('该昵称已被使用，请修改后再保存');
      expect(pageInstance.data.profileSaveHint).toContain('狮子');
      expect(pageInstance.data.showEditProfile).toBe(true);
      expect(pageInstance.data.userInfo.nickname).toBe('狮子');
      expect(pageInstance.data.editForm.nickname).toBe('林娜');
      pageInstance.onNicknameInput({ detail: { value: '狮子' } });
      expect(pageInstance.data.nicknameError).toBe('');
      // 本测试的 setData mock 不处理点路径，显式同步输入。
      pageInstance.data.editForm.nickname = '狮子';
      await pageInstance.saveUserProfile();
      expect(userService.updateUserProfile).toHaveBeenCalledTimes(1);
      expect(wx.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: '个人信息未修改，无需保存' }));
      expect(pageInstance.data.showEditProfile).toBe(false);
    });

    test.each(['signature', 'avatarUrl'])('原昵称不变时仍保存 %s 修改', async field => {
      pageInstance.data.editForm[field] = '新的内容';
      userService.updateUserProfile.mockResolvedValue({ _id: 'user_123', nickname: '狮子' });
      await pageInstance.saveUserProfile();
      expect(userService.updateUserProfile).toHaveBeenCalledWith(expect.objectContaining({ nickname: '狮子', [field]: '新的内容' }));
      expect(pageInstance.data.showEditProfile).toBe(false);
    });

    test('真实 HTTP 错误结构也保留 message', async () => {
      pageInstance.data.editForm.nickname = '林娜';
      userService.updateUserProfile.mockRejectedValue({ statusCode: 409, data: { code: 409, message: '昵称被占用' } });
      await pageInstance.saveUserProfile();
      expect(pageInstance.data.nicknameError).toBe('昵称被占用');
    });

    test('网络错误不标记为昵称冲突', async () => {
      pageInstance.data.editForm.nickname = '新名字';
      userService.updateUserProfile.mockRejectedValue({ errMsg: 'request:fail' });
      await pageInstance.saveUserProfile();
      expect(pageInstance.data.nicknameError).toBe('');
      expect(pageInstance.data.showEditProfile).toBe(true);
      expect(wx.showToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: '没保存上，稍后再试试' }));
    });
  });

});
