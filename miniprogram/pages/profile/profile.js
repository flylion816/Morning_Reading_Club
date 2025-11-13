// 个人中心页面
const userService = require('../../services/user.service');
const authService = require('../../services/auth.service');
const courseService = require('../../services/course.service');
const { formatNumber, formatDate } = require('../../utils/formatters');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,

    // 当前期次
    currentPeriod: null,

    // 统计信息
    stats: {
      current_day: 1,
      total_days: 23
    },

    // 最近的小凡看见（最多3条）
    recentInsights: [],

    // 收到的小凡看见请求列表
    insightRequests: [],

    // 加载状态
    loading: true
  },

  onLoad(options) {
    console.log('个人中心加载', options);
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示时刷新数据
    const app = getApp();
    const isLogin = app.globalData.isLogin;

    this.checkLoginStatus();

    // 直接使用app.globalData.isLogin判断，避免setData异步问题
    if (isLogin) {
      this.loadUserData();
    }
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.loadUserData().then(() => {
      wx.stopPullDownRefresh();
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
      userInfo,
      loading: false  // 设置loading为false
    });
  },

  /**
   * 加载用户数据
   */
  async loadUserData() {
    if (!this.data.isLogin) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      // 并行加载用户信息、统计信息和当前期次
      const [userInfo, stats, periods] = await Promise.all([
        userService.getUserProfile(),
        userService.getUserStats(),
        courseService.getPeriods()
      ]);

      const app = getApp();
      app.globalData.userInfo = userInfo;

      // 找到第一个进行中的期次作为当前期次
      const periodsList = periods.items || periods || [];
      const currentPeriod = periodsList.find(p => p.status === 'ongoing') || periodsList[0];

      // 计算当前期次的进度并设置封面样式
      if (currentPeriod) {
        const totalDays = currentPeriod.totalDays || 23;
        const completedDays = currentPeriod.completedDays || 0;
        currentPeriod.progress = Math.round((completedDays / totalDays) * 100);

        // 设置封面颜色和表情（如果没有的话使用默认值）
        if (!currentPeriod.coverColor) {
          currentPeriod.coverColor = '#4a90e2';
        }
        if (!currentPeriod.coverEmoji) {
          currentPeriod.coverEmoji = '🏔️';
        }
      }

      // 加载最近的小凡看见记录（最多3条）
      const recentInsights = this.loadRecentInsights();

      this.setData({
        userInfo,
        stats,
        currentPeriod,
        recentInsights,
        loading: false
      });
    } catch (error) {
      console.error('加载用户数据失败:', error);
      this.setData({ loading: false });

      wx.showToast({
        title: '加载失败,请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 加载最近的小凡看见记录
   */
  loadRecentInsights() {
    // Mock 数据 - 最多返回3条
    const mockInsights = [
      {
        id: 1,
        day: '第一天 品德成功论',
        title: '品德成功论',
        preview: '感谢你的分享，听你娓道来，我仿佛也参与了你们那场深刻的对话...'
      },
      {
        id: 2,
        day: '第二天 自律的力量',
        title: '自律的力量',
        preview: '自律正是你最大的优势！在今天的学习中，我看到了你对自律的真正理解...'
      },
      {
        id: 3,
        day: '第三天 感恩的艺术',
        title: '感恩的艺术',
        preview: '感恩之心让你与众不同！能够时刻保持感恩的心态...'
      }
    ];

    return mockInsights.slice(0, 3);
  },

  /**
   * 微信一键登录
   */
  async handleWechatLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      console.log('开始获取用户信息...');

      // 1. 必须在点击事件中同步调用getUserProfile
      const userInfo = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: (res) => {
            console.log('获取用户信息成功:', res.userInfo);
            resolve(res.userInfo);
          },
          fail: (err) => {
            console.error('获取用户信息失败:', err);
            reject(err);
          }
        });
      });

      console.log('用户信息获取完成，开始登录...');

      // 2. 使用Mock登录（因为没有后端服务器）
      const envConfig = require('../../config/env');
      let loginData;

      if (envConfig.useMock) {
        // Mock模式
        loginData = await authService.wechatLoginMock(userInfo);
      } else {
        // 生产模式
        loginData = await authService.wechatLogin(userInfo);
      }

      console.log('登录成功:', loginData);

      // 3. 更新全局状态
      const app = getApp();
      app.globalData.isLogin = true;
      app.globalData.userInfo = loginData.user;
      app.globalData.token = loginData.access_token;

      // 4. 更新页面状态
      this.setData({
        isLogin: true,
        userInfo: loginData.user,
        loading: false
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      });

      // 5. 加载用户数据
      this.loadUserData();
    } catch (error) {
      console.error('登录失败:', error);

      this.setData({ loading: false });

      // 处理用户拒绝授权的情况
      if (error.errMsg && error.errMsg.includes('getUserProfile:fail auth deny')) {
        wx.showToast({
          title: '您拒绝了授权',
          icon: 'none',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '登录失败,请重试',
          icon: 'none',
          duration: 2000
        });
      }
    }
  },

  /**
   * 返回首页
   */
  handleBackHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 点击头像
   */
  handleAvatarClick() {
    if (!this.data.isLogin) {
      this.handleLogin();
      return;
    }

    // 跳转到编辑资料页面
    wx.navigateTo({
      url: '/pages/edit-profile/edit-profile'
    });
  },

  /**
   * 处理小凡看见请求点击
   */
  handleRequestClick(e) {
    const { request } = e.currentTarget.dataset;
    console.log('查看请求详情:', request);

    wx.showModal({
      title: '授权请求',
      content: `${request.userName} 请求查看你的小凡看见`,
      confirmText: '授权',
      cancelText: '拒绝',
      success: (res) => {
        if (res.confirm) {
          this.approveRequest(request);
        } else {
          this.rejectRequest(request);
        }
      }
    });
  },

  /**
   * 授权请求
   */
  handleApproveRequest(e) {
    const { request } = e.currentTarget.dataset;
    this.approveRequest(request);
  },

  /**
   * 批准请求
   */
  async approveRequest(request) {
    try {
      // TODO: 调用API批准请求
      console.log('批准请求:', request);

      // 从列表中移除该请求
      const newRequests = this.data.insightRequests.filter(r => r.id !== request.id);
      this.setData({ insightRequests: newRequests });

      wx.showToast({
        title: '已授权',
        icon: 'success'
      });
    } catch (error) {
      console.error('授权失败:', error);
      wx.showToast({
        title: '授权失败',
        icon: 'none'
      });
    }
  },

  /**
   * 拒绝请求
   */
  async rejectRequest(request) {
    try {
      // TODO: 调用API拒绝请求
      console.log('拒绝请求:', request);

      // 从列表中移除该请求
      const newRequests = this.data.insightRequests.filter(r => r.id !== request.id);
      this.setData({ insightRequests: newRequests });

      wx.showToast({
        title: '已拒绝',
        icon: 'success'
      });
    } catch (error) {
      console.error('拒绝失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  /**
   * 点击当前期次卡片
   */
  handleCurrentPeriodClick() {
    const { currentPeriod } = this.data;
    if (!currentPeriod || !currentPeriod.id) {
      console.error('当前期次信息不存在');
      return;
    }

    // 跳转到课程列表页
    wx.navigateTo({
      url: `/pages/courses/courses?periodId=${currentPeriod.id}`
    });
  },

  /**
   * 创建打卡
   */
  handleCreateCheckin() {
    const { currentPeriod } = this.data;

    if (!currentPeriod || !currentPeriod.id) {
      wx.showToast({
        title: '暂无进行中的课程',
        icon: 'none'
      });
      return;
    }

    // 跳转到打卡页面
    wx.navigateTo({
      url: `/pages/checkin/checkin?periodId=${currentPeriod.id}`
    });
  },

  /**
   * 跳转到课程列表
   */
  navigateToCourses() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 点击小凡看见条目
   */
  handleInsightClick(e) {
    const { insight } = e.currentTarget.dataset;
    console.log('点击小凡看见:', insight);

    // TODO: 跳转到小凡看见详情页
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  /**
   * 跳转到小凡看见列表
   */
  navigateToInsights() {
    wx.navigateTo({
      url: '/pages/insights/insights'
    });
  },

  /**
   * 格式化数字
   */
  formatNumber(num) {
    return formatNumber(num);
  },

  /**
   * 格式化加入时间
   */
  formatJoinDate(date) {
    if (!date) return '';
    return '加入于 ' + formatDate(date, 'YYYY-MM-DD');
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    const { userInfo } = this.data;

    return {
      title: `${userInfo?.nickname || '我'}邀请你一起晨读`,
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
