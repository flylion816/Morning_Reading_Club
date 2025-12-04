const userService = require('../../services/user.service');

Page({
  data: {
    userId: null,
    userInfo: {},
    stats: {}
  },

  onLoad(options) {
    console.log('他人主页加载', options);
    const userId = options.userId || options.id;
    this.setData({ userId });
    this.loadUserProfile();
  },

  /**
   * 加载用户资料
   */
  async loadUserProfile() {
    if (!this.data.userId) {
      console.error('用户ID不存在');
      return;
    }

    try {
      console.log('加载用户资料，ID:', this.data.userId);

      // 调用API获取用户信息
      const userInfo = await userService.getUserById(this.data.userId);

      console.log('用户信息:', userInfo);

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
      console.error('加载用户资料失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 点击小凡看见 - 发起查看申请
   */
  handleRequestInsights() {
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
      wx.showToast({
        title: '无需向自己发起查看请求',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '查看小凡看见',
      content: `需要向 ${userInfo.nickname} 发起查看申请，对方同意后才能查看`,
      confirmText: '发起申请',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.sendInsightRequest();
        }
      }
    });
  },

  /**
   * 发送查看小凡看见的申请
   */
  async sendInsightRequest() {
    const { userId, userInfo } = this.data;

    try {
      console.log('发送小凡看见查看申请，目标用户ID:', userId);

      // 调用API创建申请
      const response = await userService.createInsightRequest(userId);

      console.log('申请响应:', response);

      wx.showToast({
        title: '申请已发送',
        icon: 'success'
      });
    } catch (error) {
      console.error('发送申请失败:', error);
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
