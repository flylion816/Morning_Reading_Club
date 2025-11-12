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
    displayedCourses: [],
    loading: true,
    refreshing: false,

    // 筛选类型：'pending'待打卡 | 'all'全部
    filterType: 'pending',

    // 分页
    page: 1,
    pageSize: 10,
    hasMore: true,

    // Banner文案
    bannerText: '天天开心！',
    subBannerText: '在晨光中,遇见更好的自己'
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
    console.log('loadCourses开始执行');

    this.setData({ loading: true });

    try {
      console.log('调用courseService.getCourses');
      const res = await courseService.getCourses({
        page: this.data.page,
        limit: this.data.pageSize
      });

      console.log('获取到课程数据:', res);

      const courses = res.items || res || [];
      const hasMore = courses.length >= this.data.pageSize;

      const allCourses = this.data.page === 1 ? courses : [...this.data.courses, ...courses];

      console.log('准备设置数据，课程数量:', allCourses.length);

      this.setData({
        courses: allCourses,
        loading: false,
        hasMore
      });

      console.log('数据设置完成，开始筛选');

      // 更新显示的课程列表
      this.filterCourses();

      console.log('筛选完成');
    } catch (error) {
      console.error('获取课程列表失败:', error);
      this.setData({
        loading: false,
        courses: [],
        displayedCourses: []
      });

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
   * 根据筛选类型过滤课程
   */
  filterCourses() {
    const { courses, filterType } = this.data;
    let displayedCourses = courses;

    if (filterType === 'pending') {
      // 只显示待打卡的课程
      displayedCourses = courses.filter(course => {
        const now = Date.now();
        const startTime = new Date(course.startTime).getTime();
        const endTime = new Date(course.endTime).getTime();
        return now >= startTime && now <= endTime && !course.isCheckedIn;
      });
    }

    this.setData({ displayedCourses });
  },

  /**
   * 切换筛选类型
   */
  switchFilter(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({ filterType: type });
    this.filterCourses();
  },

  /**
   * 处理课程操作（打卡或补卡）
   */
  handleCourseAction(e) {
    const { course, action } = e.detail;

    // 检查登录状态
    if (!this.data.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
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

    if (action === 'checkin') {
      // 跳转到打卡页面
      wx.navigateTo({
        url: `/pages/checkin/checkin?courseId=${course.id}`
      });
    } else if (action === 'makeup') {
      // 跳转到课程详情页（补卡）
      wx.navigateTo({
        url: `/pages/course-detail/course-detail?id=${course.id}`
      });
    }
  },

  /**
   * 点击课程卡片
   */
  handleCourseClick(e) {
    const { course } = e.detail;

    if (!course || !course.id) {
      console.error('课程信息不存在');
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
      url: `/pages/course-detail/course-detail?id=${course.id}`
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
