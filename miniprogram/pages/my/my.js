// 我的页面
const userService = require('../../services/user.service');
const enrollmentService = require('../../services/enrollment.service');
const notificationServiceModule = require('../../services/notification.service');
const constants = require('../../config/constants');
const { hasPaidEnrollment, clearEnrollmentCache } = require('../../utils/period-access');

const notificationService = notificationServiceModule.default || notificationServiceModule;

Page({
  data: {
    userInfo: null,
    stats: {
      totalCheckinDays: 0
    },
    isLogin: false,
    phoneMasked: '',
    hasPhone: false,
    canUsePaidFeatures: false,
    unreadNotificationCount: 0,
    loading: false
  },

  onShow() {
    const app = getApp();
    const isLogin = app.globalData.isLogin;
    this.setData({
      isLogin,
      unreadNotificationCount: isLogin ? this.data.unreadNotificationCount : 0
    });
    if (isLogin) {
      this._loadUserData();
      this.loadUnreadNotificationCount();
    }
  },

  async _loadUserData() {
    this.setData({ loading: true });
    try {
      const [userInfo, stats, userEnrollments] = await Promise.all([
        userService.getUserProfile(),
        userService.getUserStats(),
        enrollmentService.getUserEnrollments({ limit: 100 }).catch(() => ({ list: [] }))
      ]);

      // 处理手机号脱敏
      const phone = userInfo.phone || '';
      const hasPhone = !!phone;
      const phoneMasked = hasPhone
        ? phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
        : '';
      const enrollmentList = userEnrollments.list || userEnrollments || [];
      const canUsePaidFeatures = hasPaidEnrollment(enrollmentList);

      this.setData({
        userInfo,
        stats: stats || { totalCheckinDays: 0 },
        hasPhone,
        phoneMasked,
        canUsePaidFeatures
      });
    } catch (err) {
      console.error('加载用户数据失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadUnreadNotificationCount() {
    try {
      const unreadResponse = await notificationService.getUnreadCount();
      this.setData({
        unreadNotificationCount: unreadResponse?.unreadCount || 0
      });
    } catch (error) {
      console.error('加载通知未读数失败', error);
    }
  },

  // 获取/换绑手机号
  async handleGetPhoneNumber(e) {
    if (!this.data.canUsePaidFeatures) {
      wx.showToast({ title: '完成支付后可绑定手机号', icon: 'none' });
      return;
    }

    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      return;
    }
    const code = e.detail.code;
    if (!code) {
      wx.showToast({ title: '获取手机号失败', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '绑定中...' });
      await userService.bindPhone(code);
      wx.hideLoading();
      wx.showToast({ title: '绑定成功', icon: 'success' });
      this._loadUserData();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '绑定失败', icon: 'none' });
    }
  },

  goToNotificationSettings() {
    if (!this.data.canUsePaidFeatures) {
      wx.showToast({ title: '完成支付后可管理提醒', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/notification-settings/notification-settings' });
  },

  goToNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  goToMyCheckinRecords() {
    wx.navigateTo({ url: '/pages/checkin-records/checkin-records' });
  },

  goToEditProfile() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' });
  },

  goToPrivacy() {
    wx.navigateTo({ url: '/pages/privacy-policy/privacy-policy' });
  },

  goToAgreement() {
    wx.navigateTo({ url: '/pages/user-agreement/user-agreement' });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync(constants.STORAGE_KEYS.TOKEN);
        wx.removeStorageSync(constants.STORAGE_KEYS.REFRESH_TOKEN);
        wx.removeStorageSync(constants.STORAGE_KEYS.USER_INFO);
        const app = getApp();
        const previousUserKey =
          app.globalData.userInfo?._id || app.globalData.userInfo?.id || '';
        clearEnrollmentCache(null, previousUserKey);
        app.globalData.isLogin = false;
        app.globalData.userInfo = null;
        app.globalData.token = null;
        app.globalData._enrollmentChanged = false;
        app.globalData._enrollmentCheckedAt = 0;
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  }
});
