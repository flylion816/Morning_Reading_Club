// 个人中心页面
const userService = require('../../services/user.service');
const authService = require('../../services/auth.service');
const { formatNumber, formatDate } = require('../../utils/formatters');

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,

    // 统计信息
    stats: {
      total_checkins: 0,
      current_streak: 0,
      total_courses: 0,
      completion_rate: 0
    },

    // 加载状态
    loading: true,

    // 菜单列表
    menuList: [
      {
        icon: '📚',
        title: '我的课程',
        path: '/pages/my-courses/my-courses'
      },
      {
        icon: '✨',
        title: '小凡看见',
        path: '/pages/insights/insights'
      },
      {
        icon: '✅',
        title: '打卡记录',
        path: '/pages/checkin-history/checkin-history'
      },
      {
        icon: '⚙️',
        title: '设置',
        path: '/pages/settings/settings'
      }
    ]
  },

  onLoad(options) {
    console.log('个人中心加载', options);
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示时刷新数据
    this.checkLoginStatus();
    if (this.data.isLogin) {
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
      userInfo
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
      // 并行加载用户信息和统计信息
      const [userInfo, stats] = await Promise.all([
        userService.getUserProfile(),
        userService.getUserStats()
      ]);

      const app = getApp();
      app.globalData.userInfo = userInfo;

      this.setData({
        userInfo,
        stats,
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
   * 点击登录按钮
   */
  handleLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
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
   * 点击菜单项
   */
  handleMenuClick(e) {
    const { path } = e.currentTarget.dataset;

    if (!path) {
      return;
    }

    // 检查登录状态
    if (!this.data.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            this.handleLogin();
          }
        }
      });
      return;
    }

    // 跳转到对应页面
    wx.navigateTo({
      url: path
    });
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗?',
      success: (res) => {
        if (res.confirm) {
          this.doLogout();
        }
      }
    });
  },

  /**
   * 执行退出登录
   */
  async doLogout() {
    try {
      // 调用后端退出登录接口
      await authService.logout();
    } catch (error) {
      console.error('退出登录失败:', error);
    } finally {
      // 清除本地存储
      wx.removeStorageSync('token');
      wx.removeStorageSync('refreshToken');
      wx.removeStorageSync('userInfo');

      // 更新全局状态
      const app = getApp();
      app.globalData.isLogin = false;
      app.globalData.userInfo = null;
      app.globalData.token = null;

      // 更新页面状态
      this.setData({
        isLogin: false,
        userInfo: null,
        stats: {
          total_checkins: 0,
          current_streak: 0,
          total_courses: 0,
          completion_rate: 0
        }
      });

      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      });
    }
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
