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

const fs = require('fs');
const path = require('path');

describe('profile page', () => {
  let pageConfig;
  let pageInstance;
  let userService;
  let enrollmentService;
  let notificationService;
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
        isLogin: true
      }
    }));

    wx.navigateTo.mockClear();
    wx.reLaunch.mockClear();
    wx.showToast.mockClear();

    userService = require('../../services/user.service');
    enrollmentService = require('../../services/enrollment.service');
    notificationService = require('../../services/notification.service');
    periodAccess = require('../../utils/period-access');

    userService.getUserProfile.mockResolvedValue({
      nickname: '小狐狸',
      phone: '13812345678',
      role: 'user'
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
    periodAccess.hasPaidEnrollment.mockClear();
    periodAccess.hasPaidEnrollment.mockReturnValue(true);

    require('../../pages/profile/profile');

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

  test('should expose admin analytics entry for admin user', async () => {
    userService.getUserProfile.mockResolvedValue({
      nickname: '管理员',
      phone: '13812345678',
      role: 'admin'
    });

    await pageInstance._loadUserData.call(pageInstance);
    pageInstance.goToAdminAnalytics.call(pageInstance);

    expect(pageInstance.data.isAdmin).toBe(true);
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/admin-analytics/admin-analytics'
    });
  });

  test('should keep admin analytics hidden for normal user', async () => {
    await pageInstance._loadUserData.call(pageInstance);

    expect(pageInstance.data.isAdmin).toBe(false);
  });

  test('should redirect legacy share entry to home page', () => {
    pageInstance.onLoad.call(pageInstance, { from: 'share' });

    expect(wx.reLaunch).toHaveBeenCalledWith({
      url: '/pages/index/index?from=share'
    });
  });

  test('should not navigate to checkin records without paid access', () => {
    pageInstance.setData({ canUsePaidFeatures: false });

    pageInstance.goToMyCheckinRecords.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '完成支付后可查看打卡日记',
      icon: 'none'
    });
    expect(wx.navigateTo).not.toHaveBeenCalledWith({
      url: '/pages/checkin-records/checkin-records'
    });
  });

  test('should navigate to completion reports with paid access', () => {
    pageInstance.setData({ canUsePaidFeatures: true });

    pageInstance.goToCompletionReports.call(pageInstance);

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/completion-reports/completion-reports'
    });
  });

  test('should not navigate to completion reports without paid access', () => {
    pageInstance.setData({ canUsePaidFeatures: false });

    pageInstance.goToCompletionReports.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '完成支付后可查看实录报告',
      icon: 'none'
    });
    expect(wx.navigateTo).not.toHaveBeenCalledWith({
      url: '/pages/completion-reports/completion-reports'
    });
  });

  test('should hide completion reports entry without paid access', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../pages/profile/profile.wxml'),
      'utf8'
    );

    expect(wxml).toContain('我的实录报告');
    expect(wxml).toContain('wx:if="{{canUsePaidFeatures}}" class="settings-cell" bindtap="goToCompletionReports"');
  });
});
