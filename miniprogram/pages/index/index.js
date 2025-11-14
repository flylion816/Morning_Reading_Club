// 首页 - 课程列表
const courseService = require('../../services/course.service');
const userService = require('../../services/user.service');
const { formatDate } = require('../../utils/formatters');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,

    // 期次列表
    periods: [],
    loading: true,
    refreshing: false,

    // Banner文案
    bannerText: '天天开心！',
    subBannerText: '在晨光中,遇见更好的自己'
  },

  onLoad(options) {
    console.log('首页加载', options);
    this.checkLoginStatus();
    this.loadPeriods();
  },

  onShow() {
    // 每次显示时检查登录状态
    this.checkLoginStatus();
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.refreshPeriods();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const app = getApp();
    const isLogin = app.globalData.isLogin;
    const userInfo = app.globalData.userInfo;

    this.setData({
      isLogin,
      userInfo
    });

    // 如果已登录,获取用户信息
    if (isLogin && !userInfo) {
      this.loadUserInfo();
    }
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      const userInfo = await userService.getUserProfile();
      const app = getApp();
      app.globalData.userInfo = userInfo;

      this.setData({
        userInfo
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  },

  /**
   * 加载期次列表
   */
  async loadPeriods() {
    this.setData({ loading: true });

    try {
      const res = await courseService.getPeriods();
      const periods = res.list || res.items || res || [];

      this.setData({
        periods,
        loading: false
      });
    } catch (error) {
      console.error('获取期次列表失败:', error);
      this.setData({
        loading: false,
        periods: []
      });

      wx.showToast({
        title: '加载失败,请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 刷新期次列表
   */
  async refreshPeriods() {
    this.setData({ refreshing: true });
    await this.loadPeriods();
    this.setData({ refreshing: false });
    wx.stopPullDownRefresh();
  },

  /**
   * 点击期次卡片
   */
  handlePeriodClick(e) {
    console.log('===== handlePeriodClick 被调用 =====');
    console.log('事件详情:', e.detail);

    // course-card 组件传递的是 course 字段
    const period = e.detail.course || {};

    if (!period || !period.id) {
      console.error('期次信息不存在，period:', period);
      return;
    }

    console.log('期次信息正常，id:', period.id, 'name:', period.name);

    // 跳转到课程列表页（显示该期的课节）
    wx.navigateTo({
      url: `/pages/courses/courses?periodId=${period.id}&name=${period.name || ''}`
    });
  },

  /**
   * 计算课程进度百分比
   */
  getProgressPercentage(completed, total) {
    if (!total || total === 0) return 0;
    return Math.round((completed / total) * 100);
  },

  /**
   * 格式化日期范围
   */
  formatDateRange(startDate, endDate) {
    if (!startDate || !endDate) return '';

    const start = formatDate(startDate, 'MM-DD');
    const end = formatDate(endDate, 'MM-DD');

    return `${start} ~ ${end}`;
  },

  /**
   * 获取课程状态文本
   */
  getCourseStatusText(status) {
    const statusMap = {
      'not_started': '未开始',
      'ongoing': '进行中',
      'completed': '已完成'
    };
    return statusMap[status] || '未知';
  },

  /**
   * 跳转到个人中心
   */
  navigateToProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '晨读营 - 在晨光中,遇见更好的自己',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share-default.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '晨读营 - 在晨光中,遇见更好的自己',
      query: '',
      imageUrl: '/assets/images/share-default.png'
    };
  }
});
