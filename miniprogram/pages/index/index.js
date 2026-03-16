// 首页 - 课程列表
const courseService = require('../../services/course.service');
const enrollmentService = require('../../services/enrollment.service');
const userService = require('../../services/user.service');
const { formatDate, calculatePeriodStatus, formatDateRange } = require('../../utils/formatters');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,

    // 期次列表
    periods: [],
    periodEnrollmentStatus: {}, // 记录每个期次的报名状态
    defaultEnrollmentStatus: {
      isEnrolled: false,
      paymentStatus: null,
      enrollmentId: null
    },
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
    // 记录之前的登录状态
    const wasLoggedIn = this.data.isLogin;
    // 每次显示时检查登录状态
    this.checkLoginStatus();
    // 强制重新加载用户信息（必须从API获取最新数据，不使用缓存）
    if (this.data.isLogin) {
      console.log('🔄 已登录，强制重新加载用户信息...');
      this.loadUserInfo();

      // 如果登录状态刚变化（从未登录→已登录），重新加载期次以获取打卡统计
      if (!wasLoggedIn) {
        console.log('🔄 登录状态变化，重新加载期次列表（含打卡统计）');
        this.loadPeriods();
      } else if (this.data.periods.length > 0) {
        // 重新检查报名状态（用户可能在报名页面新增了报名或已支付）
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
      // 已登录时调用认证API（/periods/user，含打卡统计），未登录时调用公开API（/periods）
      const res = await courseService.getPeriods({}, this.data.isLogin);
      console.log('📊 [DEBUG] getPeriods 原始返回:', JSON.stringify(res).substring(0, 500));
      let periods = res.list || res.items || res || [];
      console.log('📊 [DEBUG] 期次checkedDays:', periods.map(p => p.title + ':' + p.checkedDays));

      // 为每个期次计算状态（基于日期而不是数据库status字段）
      periods = periods.map(period => {
        const startDate = period.startDate || period.startTime;
        const endDate = period.endDate || period.endTime;
        const calculatedStatus = calculatePeriodStatus(startDate, endDate);
        return {
          ...period,
          dateRange: formatDateRange(startDate, endDate), // 覆盖为 "YYYY-MM-DD 至 YYYY-MM-DD"
          calculatedStatus,
          statusText: this.getCourseStatusText(calculatedStatus)
        };
      });

      // 按结束时间倒序排列
      periods.sort((a, b) => {
        const dateA = new Date(a.endDate || 0);
        const dateB = new Date(b.endDate || 0);
        return dateB - dateA; // 倒序（最新的在前）
      });

      // 初始化所有期次的默认报名状态（避免 undefined）
      const initialStatusMap = {};
      periods.forEach(period => {
        initialStatusMap[period._id] = {
          isEnrolled: false,
          paymentStatus: null,
          enrollmentId: null
        };
      });

      this.setData({
        periods,
        periodEnrollmentStatus: initialStatusMap,
        loading: false
      });

      // 如果已登录，检查每个期次的报名状态（异步更新）
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
      // 过滤出有效的期次（必须有 _id）
      const validPeriods = periods.filter(period => {
        if (!period._id) {
          console.warn('⚠️ 发现无效期次（缺少_id）:', period);
          return false;
        }
        return true;
      });

      if (validPeriods.length === 0) {
        console.warn('⚠️ 没有有效的期次可以检查报名状态');
        return;
      }

      // 并行检查所有期次的报名状态
      const promises = validPeriods.map(period =>
        enrollmentService
          .checkEnrollment(period._id)
          .then(res => {
            // 存储完整的报名信息：包括是否报名、支付状态、报名ID等
            statusMap[period._id] = {
              isEnrolled: res.isEnrolled || false,
              paymentStatus: res.paymentStatus || null,
              enrollmentId: res.enrollmentId || null
            };

            const statusText = res.isEnrolled
              ? `已报名 (支付状态: ${res.paymentStatus || 'unknown'})`
              : '未报名';
            console.log(`期次 ${period.name} (${period._id}): ${statusText}`);

            // 详细日志：用于调试
            console.log('  └─ API返回值:', {
              isEnrolled: res.isEnrolled,
              paymentStatus: res.paymentStatus,
              enrollmentId: res.enrollmentId,
              userId: res.userId,
              periodId: res.periodId
            });
          })
          .catch(error => {
            console.error(`检查期次 ${period._id} 的报名状态失败:`, error);
            statusMap[period._id] = {
              isEnrolled: false,
              paymentStatus: null,
              enrollmentId: null
            };
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

    // ⭐ 强制检查登录状态：使用 app.globalData 和 this.data 双重检查
    const app = getApp();
    const isLogin = app.globalData.isLogin || this.data.isLogin;

    console.log('🔐 登录状态检查：');
    console.log('  app.globalData.isLogin:', app.globalData.isLogin);
    console.log('  this.data.isLogin:', this.data.isLogin);
    console.log('  最终isLogin:', isLogin);

    // 未登录：进入期次介绍页（公开页面，让用户先浏览内容）
    if (!isLogin) {
      console.log('📖 未登录，进入期次介绍页');
      wx.navigateTo({
        url: `/pages/period-detail/period-detail?periodId=${periodId}`
      });
      return;
    }

    // 已登录：根据报名状态导航
    const period = this.data.periods.find(p => p._id === periodId);
    if (!period) {
      console.error('找不到期次信息');
      return;
    }

    const enrollmentInfo = this.data.periodEnrollmentStatus[periodId] || {};
    const isEnrolled = enrollmentInfo.isEnrolled;
    const paymentStatus = enrollmentInfo.paymentStatus;
    const calculatedStatus = period.calculatedStatus;

    console.log('🔍 判断流程:', { isEnrolled, calculatedStatus, paymentStatus });

    // 【情况1】已完成且未报名，进入介绍页查看
    if (calculatedStatus === 'completed' && !isEnrolled) {
      console.log('已完成且未报名，进入介绍页');
      wx.navigateTo({
        url: `/pages/period-detail/period-detail?periodId=${periodId}`
      });
      return;
    }

    // 【情况2】未报名（且期次未完成），进入报名页面
    if (!isEnrolled) {
      console.log('未报名，进入报名页面');
      wx.navigateTo({
        url: `/pages/enrollment/enrollment?periodId=${periodId}`
      });
    }
    // 【情况3】已报名，进入课程列表
    else {
      console.log('已报名，进入课程列表，支付状态:', paymentStatus);
      wx.navigateTo({
        url: `/pages/courses/courses?periodId=${periodId}&name=${periodName || ''}`
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
      completed: '已结束'
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
      title: '邀请您加入凡人共读',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share-default.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '邀请您加入凡人共读',
      query: '',
      imageUrl: '/assets/images/share-default.png'
    };
  }
});
