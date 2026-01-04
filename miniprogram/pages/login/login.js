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
      // 已登录,跳转到首页（profile tab）
      wx.switchTab({
        url: '/pages/profile/profile'
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
      console.log('开始获取用户信息...');

      // 1. 必须在点击事件中同步调用getUserProfile
      const userInfo = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: res => {
            console.log('获取用户信息成功:', res.userInfo);
            resolve(res.userInfo);
          },
          fail: err => {
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
      app.globalData.token = loginData.accessToken;

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      });

      // 4. 延迟跳转到首页（profile tab）
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/profile/profile'
        });
      }, 1500);
    } catch (error) {
      console.error('登录失败:', error);

      this.setData({ loading: false });

      // 根据错误类型显示友好的提示信息
      let errorMessage = '登录失败，请稍后重试';

      if (error.errMsg) {
        // 处理微信客户端错误
        if (error.errMsg.includes('getUserProfile:fail auth deny')) {
          errorMessage = '您拒绝了用户信息授权';
        } else if (error.errMsg.includes('getUserProfile:fail')) {
          errorMessage = '获取用户信息失败，请检查网络';
        }
      } else if (error.message) {
        // 处理来自后端的错误消息
        const msg = error.message;
        if (msg.includes('code无效') || msg.includes('已过期')) {
          errorMessage = '授权码已过期，请重新登录';
        } else if (msg.includes('频繁')) {
          errorMessage = '请求过于频繁，请稍后再试';
        } else if (msg.includes('使用')) {
          errorMessage = '授权码已被使用，请重新登录';
        } else if (msg.includes('异常')) {
          errorMessage = '微信服务异常，请稍后重试';
        } else {
          errorMessage = msg; // 使用后端返回的具体错误信息
        }
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });
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
