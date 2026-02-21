// 登录页面
const authService = require('../../services/auth.service');
const envConfig = require('../../config/env');
const logger = require('../../utils/logger');

Page({
  data: {
    loading: false,
    agreePolicy: false, // 是否同意隐私政策和用户协议
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
      duration: 2000
    });

    // 延迟跳转到首页（profile tab）
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/profile/profile'
      });
    }, 1500);
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
