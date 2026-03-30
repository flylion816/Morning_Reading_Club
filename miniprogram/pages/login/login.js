// 登录页面
const authService = require('../../services/auth.service');
const userService = require('../../services/user.service');
const envConfig = require('../../config/env');
const logger = require('../../utils/logger');

Page({
  data: {
    loading: false,
    agreePolicy: false, // 是否同意隐私政策和用户协议
    isDev: envConfig.currentEnv === 'dev', // 是否为开发环境
    errorMessage: '', // 错误信息
    debugInfo: '', // 调试信息（用于线上问题诊断）
    showDebugInfo: envConfig.currentEnv !== 'prod', // 是否显示调试信息（生产环境隐藏）
    apiBase: envConfig.apiBaseUrl, // API 地址（用于调试）
    testUsers: [
      { code: 'test_user_atai', label: '阿泰', openid: 'mock_user_001' },
      { code: 'test_user_liming', label: '狮子', openid: 'mock_user_002' },
      { code: 'test_user_wangwu', label: '王五', openid: 'mock_user_003' },
      { code: 'test_user_admin', label: '管理员', openid: 'mock_admin_001' }
    ],
    showPhoneBindModal: false, // 是否显示手机号绑定弹窗
    phoneBinding: false // 手机号绑定中
  },

  onLoad(options) {
    console.log('🔴🔴🔴 LOGIN.JS PAGE LOADED 🔴🔴🔴', options);
    console.log('登录页面加载', options);
    console.log('✅ 开发环境检查 isDev:', this.data.isDev);
    console.log('✅ 当前环境:', envConfig.currentEnv);
    console.log('✅ 测试用户列表:', this.data.testUsers);

    // 验证条件
    const isLogin = authService.isLogin();
    const isDev = envConfig.currentEnv === 'dev';
    console.log('🔍 isLogin:', isLogin, '| isDev:', isDev);
    console.log('🔍 条件判断: isLogin && !isDev =', isLogin && !isDev);

    // 检查是否已登录（仅在非开发环境自动跳转，开发环境保持登录页便于快速切换）
    if (authService.isLogin() && envConfig.currentEnv !== 'dev') {
      console.log('⏭️  已登录且非开发环境，跳转到profile页面');
      // 已登录,跳转到首页（profile tab）
      wx.switchTab({
        url: '/pages/profile/profile'
      });
    } else {
      console.log('✅ 停留在登录页面');
    }
  },

  /**
   * 处理隐私政策复选框变化
   */
  handlePolicyChange(e) {
    // 切换协议状态（通过点击外层 view 来实现）
    const newState = !this.data.agreePolicy;
    logger.warn('🔄 复选框点击事件触发', {
      previousState: this.data.agreePolicy,
      newState: newState,
      timestamp: new Date().toISOString()
    });
    this.setData({
      agreePolicy: newState
    });
    logger.warn('✅ agreePolicy 已更新为:', newState);
  },

  /**
   * 打开用户协议
   */
  handleOpenAgreement() {
    wx.navigateTo({
      url: '/pages/user-agreement/user-agreement'
    });
  },

  /**
   * 打开隐私政策
   */
  handleOpenPrivacy() {
    wx.navigateTo({
      url: '/pages/privacy-policy/privacy-policy'
    });
  },

  /**
   * 同意协议后微信登录
   */
  async handleWechatLoginWithAgreement() {
    // 再次确认用户已同意
    if (!this.data.agreePolicy) {
      wx.showToast({
        title: '请先同意协议',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    await this.handleWechatLogin();
  },

  /**
   * 微信一键登录（完整流程）
   */
  async handleWechatLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      console.log('开始获取用户信息...');
      this.setData({ errorMessage: '', debugInfo: '正在获取用户信息...' });

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
      this.setData({ debugInfo: '正在调用登录API: ' + envConfig.apiBaseUrl });

      // 2. 调用真实登录（开发环境会自动生成mock code）
      const loginData = await authService.wechatLogin(userInfo);

      await this.completeLogin(loginData);
    } catch (error) {
      console.error('登录失败:', error);
      this.setData({ loading: false });

      // 生成详细的错误信息
      let errorMessage = '登录失败，请稍后重试';
      let debugInfo = '';

      if (error.errMsg) {
        if (error.errMsg.includes('cancel')) {
          errorMessage = '你取消了登录';
        } else if (error.errMsg.includes('timeout')) {
          errorMessage = '请求超时，请检查网络';
          debugInfo = '错误: 网络超时 (>10秒)';
        } else if (error.errMsg.includes('fail')) {
          errorMessage = '网络连接失败';
          debugInfo = '错误: ' + error.errMsg;
        }
      }

      // 如果是 API 错误响应
      if (error.message) {
        debugInfo = 'API错误: ' + error.message;
      }

      // 记录完整错误信息
      console.error('[LOGIN_ERROR]', {
        errorMessage,
        debugInfo,
        fullError: error,
        timestamp: new Date().toISOString(),
        env: envConfig.currentEnv,
        apiBase: envConfig.apiBaseUrl
      });

      this.setData({
        errorMessage: errorMessage,
        debugInfo: debugInfo || '请联系管理员或检查网络连接'
      });

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
    this.setData({ loading: true, errorMessage: '', debugInfo: '正在登录: ' + testUser.label });

    try {
      console.log('快速登录测试账户:', testUser.label);
      this.setData({ debugInfo: '调用API: POST ' + envConfig.apiBaseUrl + '/auth/wechat/login' });

      // 调用后端登录API，使用预定义的test code
      const loginData = await authService.login(testUser.code, {
        nickname: testUser.label,
        gender: 'unknown'
      });

      console.log('测试账户登录成功:', loginData);

      await this.completeLogin(loginData);
    } catch (error) {
      console.error('快速登录失败:', error);

      let errorMessage = '快速登录失败';
      let debugInfo = '错误信息: ' + (error.message || JSON.stringify(error));

      this.setData({
        loading: false,
        errorMessage: errorMessage,
        debugInfo: debugInfo
      });

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 完成登录（更新全局状态，显示手机号绑定弹窗）
   */
  async completeLogin(loginData) {
    console.log('登录成功:', loginData);

    // 保存token和用户信息到本地存储
    const constants = require('../../config/constants');
    wx.setStorageSync(constants.STORAGE_KEYS.TOKEN, loginData.accessToken);
    wx.setStorageSync(constants.STORAGE_KEYS.REFRESH_TOKEN, loginData.refreshToken);
    wx.setStorageSync(constants.STORAGE_KEYS.USER_INFO, loginData.user);

    // 更新全局状态
    const app = getApp();
    app.globalData.isLogin = true;
    app.globalData.userInfo = loginData.user;
    app.globalData.token = loginData.accessToken;

    console.log('✅ Token已保存到本地存储:', loginData.accessToken.substring(0, 20) + '...');

    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });

    let shouldPromptPhoneBind = false;
    try {
      const phoneInfo = await userService.getPhoneInfo();
      shouldPromptPhoneBind = !(phoneInfo && phoneInfo.bound);
    } catch (error) {
      console.warn('获取手机号绑定状态失败，默认直接进入应用:', error);
    }

    setTimeout(() => {
      this.setData({
        loading: false,
        showPhoneBindModal: shouldPromptPhoneBind
      });

      if (!shouldPromptPhoneBind) {
        this.navigateToApp();
      }
    }, 1500);
  },

  /**
   * 跳转进入应用
   */
  navigateToApp() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  },

  /**
   * 处理微信授权获取手机号
   */
  async handleGetPhoneNumber(e) {
    if (!e.detail.code) {
      // 用户拒绝授权，提示可稍后绑定
      wx.showToast({
        title: '可稍后在设置中绑定',
        icon: 'none',
        duration: 2000
      });
      this.setData({ showPhoneBindModal: false });
      this.navigateToApp();
      return;
    }

    this.setData({ phoneBinding: true });

    try {
      const result = await userService.bindPhone(e.detail.code);
      console.log('手机号绑定成功:', result);

      // 更新本地存储的用户信息
      const constants = require('../../config/constants');
      const userInfo = wx.getStorageSync(constants.STORAGE_KEYS.USER_INFO);
      if (userInfo && result && result.phone) {
        userInfo.phone = result.phone;
        wx.setStorageSync(constants.STORAGE_KEYS.USER_INFO, userInfo);
        const app = getApp();
        app.globalData.userInfo = userInfo;
      }

      wx.showToast({
        title: '手机号绑定成功',
        icon: 'success',
        duration: 1500
      });

      this.setData({ showPhoneBindModal: false, phoneBinding: false });
      setTimeout(() => {
        this.navigateToApp();
      }, 1500);
    } catch (error) {
      console.error('手机号绑定失败:', error);
      wx.showToast({
        title: '绑定失败，可稍后在设置中绑定',
        icon: 'none',
        duration: 2000
      });
      this.setData({ showPhoneBindModal: false, phoneBinding: false });
      this.navigateToApp();
    }
  },

  /**
   * 跳过手机号绑定
   */
  handleSkipPhoneBind() {
    this.setData({ showPhoneBindModal: false });
    this.navigateToApp();
  },

  /**
   * 稍后登录 - 允许用户不登录就进入小程序
   * 根据微信审核要求，不能强制用户登录
   */
  handleSkipLogin() {
    console.log('用户选择稍后登录，跳过登录流程');

    // 进入首页，无需登录
    wx.switchTab({
      url: '/pages/index/index'
    });
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
