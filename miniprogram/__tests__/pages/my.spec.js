jest.mock('../../services/user.service', () => ({
  getUserProfile: jest.fn(),
  getUserStats: jest.fn()
}));

jest.mock('../../services/enrollment.service', () => ({
  getUserEnrollments: jest.fn()
}));

jest.mock('../../services/notification.service', () => ({
  getUnreadCount: jest.fn()
}));

jest.mock('../../config/constants', () => ({
  STORAGE_KEYS: {
    TOKEN: 'token',
    REFRESH_TOKEN: 'refresh_token',
    USER_INFO: 'user_info'
  }
}));

jest.mock('../../utils/period-access', () => ({
  hasPaidEnrollment: jest.fn(() => true)
}));

describe('my page', () => {
  let pageConfig;
  let pageInstance;
  let userService;
  let enrollmentService;
  let notificationService;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        isLogin: true
      }
    }));

    wx.navigateTo.mockClear();

    userService = require('../../services/user.service');
    enrollmentService = require('../../services/enrollment.service');
    notificationService = require('../../services/notification.service');

    userService.getUserProfile.mockResolvedValue({
      nickname: '小狐狸',
      phone: '13812345678'
    });
    userService.getUserStats.mockResolvedValue({
      totalCheckinDays: 12
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [{ status: 'active', periodId: 'period_1' }]
    });
    notificationService.getUnreadCount.mockResolvedValue({
      unreadCount: 6
    });

    require('../../pages/my/my');

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

  test('should load profile data without blocking on unread notifications', async () => {
    await pageInstance._loadUserData.call(pageInstance);

    expect(notificationService.getUnreadCount).not.toHaveBeenCalled();
    expect(pageInstance.data.phoneMasked).toBe('138****5678');
  });

  test('should load unread notification count separately', async () => {
    await pageInstance.loadUnreadNotificationCount.call(pageInstance);

    expect(notificationService.getUnreadCount).toHaveBeenCalled();
    expect(pageInstance.data.unreadNotificationCount).toBe(6);
  });

  test('should navigate to notifications page', () => {
    pageInstance.goToNotifications.call(pageInstance);

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/notifications/notifications'
    });
  });
});
