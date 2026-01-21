// 登录页面
const authService = require('../../services/auth.service');
const envConfig = require('../../config/env');

Page({
  data: {
    loading: false,
    isDev: envConfig.currentEnv === 'dev', // 是否为开发环境
    testUsers: [
      { code: 'test_user_atai', label: '阿泰', openid: 'mock_user_001' },
      { code: 'test_user_liming', label: '狮子', openid: 'mock_user_002' },
      { code: 'test_user_wangwu', label: '王五', openid: 'mock_user_003' },
      { code: 'test_user_admin', label: '管理员', openid: 'mock_admin_001' }
    ]
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
   * 微信一键登录（完整流程）
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

      // 2. 调用真实登录（开发环境会自动生成mock code）
      const loginData = await authService.wechatLogin(userInfo);

      this.completeLogin(loginData);
    } catch (error) {
      console.error('登录失败:', error);
      this.setData({ loading: false });
      let errorMessage = '登录失败，请稍后重试';
      if (error.errMsg) {
        if (error.errMsg.includes('cancel')) {
          errorMessage = '你取消了登录';
        }
      }
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 快速登录测试账户（仅开发环境）
   */
  async handleQuickLogin(e) {
    if (this.data.loading) return;

    const { testUser } = e.currentTarget.dataset;
    this.setData({ loading: true });

    try {
      console.log('快速登录测试账户:', testUser.label);

      // 调用后端登录API，使用预定义的test code
      const loginData = await authService.login(testUser.code, {
        nickname: testUser.label,
        gender: 'unknown'
      });

      console.log('测试账户登录成功:', loginData);

      this.completeLogin(loginData);
    } catch (error) {
      console.error('快速登录失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '快速登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 完成登录（更新全局状态并跳转）
   */
  completeLogin(loginData) {
    console.log('登录成功:', loginData);

    // 更新全局状态
    const app = getApp();
    app.globalData.isLogin = true;
    app.globalData.userInfo = loginData.user;
    app.globalData.token = loginData.accessToken;

    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 2000
    });

    // 延迟跳转到首页（profile tab）
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
