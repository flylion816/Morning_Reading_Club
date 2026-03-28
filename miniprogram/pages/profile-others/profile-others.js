const userService = require('../../services/user.service');
const logger = require('../../utils/logger');

Page({
  data: {
    userId: null,
    periodId: null,
    userInfo: {},
    stats: {}
  },

  onLoad(options) {
    const userId = options.userId || options.id;
    const periodId = options.periodId || null;
    logger.debug('🔍 profile-others.onLoad - 接收到的参数:', {
      userId,
      periodId,
      allOptions: options
    });
    this.setData({ userId, periodId });
    this.loadUserProfile();
  },

  /**
   * 加载用户资料
   */
  async loadUserProfile() {
    if (!this.data.userId) {
      logger.error('用户ID不存在');
      return;
    }

    try {
      logger.debug('加载用户资料，ID:', this.data.userId);

      // 调用API获取用户信息
      const userInfo = await userService.getUserById(this.data.userId);

      logger.debug('用户信息:', userInfo);

      this.setData({
        userInfo: {
          _id: userInfo._id,
          nickname: userInfo.nickname,
          avatarUrl: userInfo.avatarUrl,
          avatar: userInfo.avatar,
          signature: userInfo.signature,
          totalCheckinDays: userInfo.totalCheckinDays || 0,
          totalCompletedPeriods: userInfo.totalCompletedPeriods || 0
        },
        stats: {
          totalCheckinDays: userInfo.totalCheckinDays || 0,
          totalCompletedPeriods: userInfo.totalCompletedPeriods || 0
        }
      });
    } catch (error) {
      logger.error('加载用户资料失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 点击小凡看见 - 直接跳转到 insights 列表页（权限检查在列表页完成）
   */
  handleViewInsights() {
    const { userId, userInfo } = this.data;
    const app = getApp();

    // 保存目标用户信息到全局变量，供 insights 页面使用
    app.globalData.targetUserForInsights = userInfo;

    wx.navigateTo({
      url: `/pages/insights/insights?userId=${userId}&userName=${encodeURIComponent(userInfo.nickname || '用户')}`
    });
  },

  /**
   * 点击小凡看见 - 检查权限后展示内容或发起申请（保留备用）
   */
  async handleRequestInsights() {
    logger.warn('handleRequestInsights 已切换为列表内逐条申请流程');
    this.handleViewInsights();
  },

  /**
   * 发送查看小凡看见的申请
   */
  async sendInsightRequest() {
    logger.warn('sendInsightRequest 已废弃，改为在锁定条目上逐条申请');
    this.handleViewInsights();
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;

    return date.toLocaleDateString();
  },

  /**
   * 返回
   */
  handleBack() {
    wx.navigateBack();
  }
});
