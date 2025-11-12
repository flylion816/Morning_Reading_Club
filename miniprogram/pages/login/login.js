// 登录页面
const authService = require('../../services/auth.service');

Page({
  data: {
    loading: false
  },

  onLoad(options) {
    console.log('登录页面加载', options);

    // 检查是否已登录
    if (authService.isLogin()) {
      // 已登录,跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  /**
   * 微信一键登录
   */
  async handleWechatLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      // 执行微信登录
      const loginData = await authService.wechatLogin();

      // 更新全局状态
      const app = getApp();
      app.globalData.isLogin = true;
      app.globalData.userInfo = loginData.user;
      app.globalData.token = loginData.access_token;

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      });

      // 延迟跳转
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }, 1500);
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
  }
});
