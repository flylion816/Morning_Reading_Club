// 首页 - 课程列表
const courseService = require('../../services/course.service');
const userService = require('../../services/user.service');
const { formatDate } = require('../../utils/formatters');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,

    // 课程列表
    courses: [],
    loading: true,
    refreshing: false,

    // 分页
    page: 1,
    pageSize: 10,
    hasMore: true,

    // Banner文案
    bannerText: '🌟 不比别人,只比昨天',
    subBannerText: '🌄 在晨光中,遇见更好的自己'
  },

  onLoad(options) {
    console.log('首页加载', options);
    this.checkLoginStatus();
    this.loadCourses();
  },

  onShow() {
    // 每次显示时检查登录状态
    this.checkLoginStatus();
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.refreshCourses();
  },

  onReachBottom() {
    console.log('触底加载更多');
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
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
   * 加载课程列表
   */
  async loadCourses() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const res = await courseService.getCourses({
        page: this.data.page,
        limit: this.data.pageSize
      });

      const courses = res.items || res;
      const hasMore = courses.length >= this.data.pageSize;

      this.setData({
        courses: this.data.page === 1 ? courses : [...this.data.courses, ...courses],
        loading: false,
        hasMore
      });
    } catch (error) {
      console.error('获取课程列表失败:', error);
      this.setData({ loading: false });

      wx.showToast({
        title: '加载失败,请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 刷新课程列表
   */
  async refreshCourses() {
    this.setData({
      page: 1,
      refreshing: true
    });

    await this.loadCourses();

    this.setData({ refreshing: false });
    wx.stopPullDownRefresh();
  },

  /**
   * 加载更多课程
   */
  loadMore() {
    this.setData({
      page: this.data.page + 1
    });
    this.loadCourses();
  },

  /**
   * 点击课程卡片
   */
  handleCourseClick(e) {
    const { courseId } = e.currentTarget.dataset;

    if (!courseId) {
      console.error('课程ID不存在');
      return;
    }

    // 检查登录状态
    if (!this.data.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后查看课程详情',
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

    // 跳转到课程详情
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${courseId}`
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
