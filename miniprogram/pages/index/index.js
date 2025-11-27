// 首页 - 课程列表
const courseService = require('../../services/course.service');
const enrollmentService = require('../../services/enrollment.service');
const userService = require('../../services/user.service');
const { formatDate } = require('../../utils/formatters');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,

    // 期次列表
    periods: [],
    periodEnrollmentStatus: {}, // 记录每个期次的报名状态
    loading: true,
    refreshing: false,

    // Banner文案
    bannerText: '🔥 测试改动显示 🔥',
    subBannerText: '检查代码是否生效',

    // 当天日期范围
    todayDateRange: ''
  },

  onLoad(options) {
    console.log('===== 首页onLoad开始 =====');
    console.log('首页加载', options);
    this.checkLoginStatus();
    this.loadPeriods();
    this.initTodayDateRange();
    console.log('===== 首页onLoad结束 =====');
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
   * 初始化当天日期范围
   */
  initTodayDateRange() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    const startDate = `${year}-${month}-${day} 00:00:00`;
    const endDate = `${year}-${month}-${day} 23:59:59`;

    const todayDateRange = `${startDate} - ${endDate}`;

    console.log('初始化今日任务日期范围:', todayDateRange);

    this.setData({
      todayDateRange
    });
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

      // 如果已登录，检查每个期次的报名状态
      if (this.data.isLogin) {
        this.checkEnrollmentStatus(periods);
      }
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
   * 检查期次报名状态
   */
  async checkEnrollmentStatus(periods) {
    if (!periods || periods.length === 0) return;

    const statusMap = {};

    try {
      // 并行检查所有期次的报名状态
      const promises = periods.map(period =>
        enrollmentService.checkEnrollment(period._id)
          .then(res => {
            statusMap[period._id] = res.isEnrolled || false;
            console.log(`期次 ${period.name} (${period._id}): ${res.isEnrolled ? '已报名' : '未报名'}`);
          })
          .catch(error => {
            console.error(`检查期次 ${period._id} 的报名状态失败:`, error);
            statusMap[period._id] = false;
          })
      );

      await Promise.all(promises);

      console.log('报名状态检查完成:', statusMap);
      this.setData({
        periodEnrollmentStatus: statusMap
      });
    } catch (error) {
      console.error('检查报名状态失败:', error);
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
   * 点击期次卡片 - 根据报名状态智能导航
   */
  handlePeriodClick(e) {
    const { periodId, periodName } = e.currentTarget.dataset;

    console.log('handlePeriodClick 被调用，periodId:', periodId, 'periodName:', periodName);

    if (!periodId) {
      console.error('periodId 不存在');
      return;
    }

    // 检查是否已登录
    if (!this.data.isLogin) {
      wx.showModal({
        title: '请先登录',
        content: '需要登录才能进行操作',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return;
    }

    // 检查是否已报名
    const isEnrolled = this.data.periodEnrollmentStatus[periodId];

    if (isEnrolled) {
      // 已报名，进入课程列表
      wx.navigateTo({
        url: `/pages/courses/courses?periodId=${periodId}&name=${periodName || ''}`
      });
    } else {
      // 未报名，进入报名页面
      wx.navigateTo({
        url: `/pages/enrollment/enrollment?periodId=${periodId}`
      });
    }
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
