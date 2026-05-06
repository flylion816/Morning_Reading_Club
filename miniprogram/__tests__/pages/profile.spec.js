jest.mock('../../services/user.service.js', () => ({
  getUserProfile: jest.fn(),
  getUserStats: jest.fn()
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
  getReceivedRequests: jest.fn(),
  approveRequest: jest.fn(),
  rejectRequest: jest.fn()
}));

jest.mock('../../services/notification.service.js', () => ({
  getUnreadCount: jest.fn(() => Promise.resolve({ unreadCount: 0 }))
}));

jest.mock('../../config/constants.js', () => ({
  STORAGE_KEYS: {
    TOKEN: 'token',
    USER_INFO: 'userInfo'
  }
}));

jest.mock('../../utils/formatters.js', () => ({
  formatNumber: jest.fn(value => value),
  formatDate: jest.fn(value => value)
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

let pageConfig;
let pageInstance;
let checkinService;
let userService;
let courseService;
let enrollmentService;
let periodAccess;
let insightService;

describe('profile page', () => {
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
    wx.showTabBar = jest.fn();

    checkinService = require('../../services/checkin.service.js');
    userService = require('../../services/user.service.js');
    courseService = require('../../services/course.service.js');
    enrollmentService = require('../../services/enrollment.service.js');
    periodAccess = require('../../utils/period-access.js');
    insightService = require('../../services/insight.service.js');
    require('../../pages/profile/profile.js');

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
    insightService.getReceivedRequests.mockReset();
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('should load the latest three recent checkins for home cards', async () => {
    checkinService.getUserCheckinsWithStats.mockResolvedValue({
      list: [
        {
          _id: 'checkin_1',
          createdAt: '2026-03-29T13:11:00.000Z',
          note: '第一篇打卡',
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
          note: '第三篇打卡',
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
      dayLabel: '第1天',
      likeCount: 2
    });
    expect(cards[2].id).toBe('checkin_3');
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

    expect(pageInstance.data.currentPeriodCommunityState).toBe('locked');
    expect(pageInstance.data.canUsePaidFeatures).toBe(true);
    expect(checkinService.getUserCheckinsWithStats).toHaveBeenCalled();
    expect(insightService.getInsightsList).toHaveBeenCalledWith({ limit: 10 });
    expect(pageInstance.data.recentCheckins).toHaveLength(1);
  });
});
