// 首页 - 课程列表
const courseService = require('../../services/course.service');
const enrollmentService = require('../../services/enrollment.service');
const userService = require('../../services/user.service');
const { formatDate, calculatePeriodStatus } = require('../../utils/formatters');

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

    // Banner文本
    bannerText: '☀️ 天天开心！',
    bannerSubtext: '在晨光中,遇见更好的自己'
  },

  onLoad(options) {
    console.log('===== 首页onLoad开始 =====');
    console.log('首页加载', options);
    this.checkLoginStatus();
    this.loadPeriods();
    console.log('===== 首页onLoad结束 =====');
  },

  onShow() {
    console.log('📱 首页onShow被触发');
    // 每次显示时检查登录状态
    this.checkLoginStatus();
    // 强制重新加载用户信息（必须从API获取最新数据，不使用缓存）
    if (this.data.isLogin) {
      console.log('🔄 已登录，强制重新加载用户信息...');
      this.loadUserInfo();
      // 重新检查报名状态（用户可能在报名页面新增了报名）
      if (this.data.periods.length > 0) {
        this.checkEnrollmentStatus(this.data.periods);
      }
    } else {
      console.log('❌ 未登录');
    }
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
      console.log('📥 开始加载用户信息...');
      const userInfo = await userService.getUserProfile();
      console.log('✅ 获取用户信息成功:', userInfo);

      const app = getApp();
      app.globalData.userInfo = userInfo;

      this.setData({
        userInfo
      });

      console.log('📝 页面 userInfo 已更新为:', this.data.userInfo);
    } catch (error) {
      console.error('❌ 获取用户信息失败:', error);
    }
  },

  /**
   * 加载期次列表
   */
  async loadPeriods() {
    this.setData({ loading: true });

    try {
      const res = await courseService.getPeriods();
      let periods = res.list || res.items || res || [];

      // 为每个期次计算状态（基于日期而不是数据库status字段）
      periods = periods.map(period => ({
        ...period,
        calculatedStatus: calculatePeriodStatus(period.startDate, period.endDate)
      }));

      // 按结束时间倒序排列
      periods.sort((a, b) => {
        const dateA = new Date(a.endDate || 0);
        const dateB = new Date(b.endDate || 0);
        return dateB - dateA; // 倒序（最新的在前）
      });

      this.setData({
        periods,
        loading: false
      });

      // 如果已登录，检查每个期次的报名状态
      if (this.data.isLogin) {
        console.log('首页加载期次后，检查报名状态');
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
        enrollmentService
          .checkEnrollment(period._id)
          .then(res => {
            statusMap[period._id] = res.isEnrolled || false;
            console.log(
              `期次 ${period.name} (${period._id}): ${res.isEnrolled ? '已报名' : '未报名'}`
            );
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
    console.log('====== handlePeriodClick 被调用 ======');
    console.log('e.currentTarget.dataset:', e.currentTarget.dataset);

    const { periodId, periodName } = e.currentTarget.dataset;

    console.log('提取的数据：');
    console.log('  periodId:', periodId, typeof periodId);
    console.log('  periodName:', periodName, typeof periodName);

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
        success: res => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return;
    }

    // 获取该期次的信息
    const period = this.data.periods.find(p => p._id === periodId);
    if (!period) {
      console.error('找不到期次信息');
      return;
    }

    // 检查是否已报名
    const isEnrolled = this.data.periodEnrollmentStatus[periodId];
    console.log('isEnrolled:', isEnrolled);

    // 获取计算后的期次状态（基于日期）
    const calculatedStatus = period.calculatedStatus;
    console.log('calculatedStatus:', calculatedStatus);
    console.log('检查条件：calculatedStatus === "completed"?', calculatedStatus === 'completed');
    console.log('检查条件：!isEnrolled?', !isEnrolled);

    // 如果已完成且未报名，显示提示
    if (calculatedStatus === 'completed' && !isEnrolled) {
      console.log('✅ 触发：已完成且未报名，显示提示');
      wx.showToast({
        title: '该期晨读营已结束！',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (isEnrolled) {
      // 已报名，进入课程列表
      console.log('已报名，进入课程列表');
      wx.navigateTo({
        url: `/pages/courses/courses?periodId=${periodId}&name=${periodName || ''}`
      });
    } else {
      // 未报名，进入报名页面
      console.log('未报名，进入报名页面');
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
      not_started: '未开始',
      ongoing: '进行中',
      completed: '已完成'
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
