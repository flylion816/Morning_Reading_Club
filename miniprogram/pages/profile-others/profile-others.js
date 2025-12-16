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
   * 点击小凡看见 - 检查权限后展示内容或发起申请
   */
  async handleRequestInsights() {
    const { userId, userInfo } = this.data;
    const app = getApp();
    const currentUser = app.globalData.userInfo;

    if (!currentUser || !currentUser._id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 检查是否在点击自己的头像
    if (currentUser._id === userId) {
      // 自己的小凡看见页面
      wx.navigateTo({
        url: '/pages/insights/insights'
      });
      return;
    }

    // 检查与该用户的申请状态
    try {
      const status = await userService.checkInsightRequestStatus(userId);
      logger.debug('📋 小凡看见申请状态:', status);

      if (status && status.approved) {
        // 已批准，直接查看他人的小凡看见
        logger.debug('✅ 已获得查看权限，跳转到他人小凡看见列表');

        // 保存目标用户信息到全局变量，供 insights 页面使用
        const app = getApp();
        app.globalData.targetUserForInsights = userInfo;

        wx.navigateTo({
          url: `/pages/insights/insights?userId=${userId}&userName=${encodeURIComponent(userInfo.nickname)}`
        });
      } else if (status && status.pending) {
        // 申请中，提示用户等待
        wx.showToast({
          title: '申请已发起，请等待对方同意',
          icon: 'none'
        });
      } else {
        // 没有申请，显示发起申请对话框
        wx.showModal({
          title: '查看小凡看见',
          content: `需要向 ${userInfo.nickname} 发起查看申请，对方同意后才能查看`,
          confirmText: '发起申请',
          cancelText: '取消',
          success: res => {
            if (res.confirm) {
              this.sendInsightRequest();
            }
          }
        });
      }
    } catch (error) {
      logger.error('❌ 检查申请状态失败:', error);
      // 如果检查失败，显示发起申请对话框（fallback）
      wx.showModal({
        title: '查看小凡看见',
        content: `需要向 ${userInfo.nickname} 发起查看申请，对方同意后才能查看`,
        confirmText: '发起申请',
        cancelText: '取消',
        success: res => {
          if (res.confirm) {
            this.sendInsightRequest();
          }
        }
      });
    }
  },

  /**
   * 发送查看小凡看见的申请
   */
  async sendInsightRequest() {
    const { userId, userInfo, periodId } = this.data;

    logger.debug('📤 sendInsightRequest - 准备发送申请:', {
      userId,
      periodId,
      userInfo: userInfo.nickname
    });

    try {
      // 调用API创建申请，同时传递periodId
      logger.debug('📨 调用 userService.createInsightRequest，传递参数:', { userId, periodId });
      const response = await userService.createInsightRequest(userId, periodId);
      logger.info('✅ 申请发送成功，后端响应:', response);

      wx.showToast({
        title: '申请已发送',
        icon: 'success'
      });
    } catch (error) {
      logger.error('❌ 发送申请失败:', error);
      wx.showToast({
        title: '申请失败',
        icon: 'none'
      });
    }
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
