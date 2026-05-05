// 晨读营小程序 - 应用入口
const envConfig = require('./config/env');
const constants = require('./config/constants');
const logger = require('./utils/logger');
const activityService = require('./services/activity.service');

App({
  onLaunch(options) {
    try {
      logger.info('晨读营小程序启动', options);
      logger.debug('当前环境:', envConfig.currentEnv);

      // 检查登录状态
      this.checkLoginStatus();

      // 根据登录状态导航到正确的页面
      this.navigateToStartPage();

      // 获取系统信息
      this.getSystemInfo();

      // 检查更新
      this.checkUpdate();
    } catch (error) {
      console.error('❌ 应用启动失败:', error);
      logger.error('启动错误详情:', error.message, error.stack);
    }
  },

  // 根据登录状态导航到正确的起始页面
  navigateToStartPage() {
    console.log(
      '🔵🔵🔵 navigateToStartPage called, currentEnv:',
      envConfig.currentEnv
    );
    const pages = getCurrentPages();
    logger.debug(
      '当前页面栈:',
      pages.map((p) => p.route)
    );

    // 在开发环境，不自动导航（方便开发调试）
    if (envConfig.currentEnv === 'dev') {
      console.log('🔵🔵🔵 SKIP navigation in dev environment');
      logger.debug('⚙️ 开发环境，不自动导航');
      return;
    }

    // 生产环境：所有用户（无论登录状态）都导航到首页
    // 首页支持未登录用户浏览课程，只在需要时才要求登录
    // 这符合 WeChat 审核要求：用户进入后先体验功能，再选择登录
    logger.info('导航到首页（允许未登录用户浏览）');
    wx.reLaunch({
      url: '/pages/index/index',
      fail: (err) => {
        logger.error('导航到首页失败:', err);
      }
    });
  },

  onShow(options) {
    logger.info('晨读营小程序显示', options);

    // ⭐ 重新检查登录状态（防止token过期或globalData重置导致频繁跳转）
    console.log('🔄 app.onShow: 重新检查登录状态');
    this.checkLoginStatus();
    if (this.globalData.isLogin) {
      activityService.track('app_open', {
        targetType: 'app',
        metadata: {
          scene: options?.scene || null,
          path: options?.path || null
        }
      });
    }
  },

  onHide() {
    logger.debug('晨读营小程序隐藏');
  },

  onError(error) {
    logger.error('应用错误:', error);

    // 错误上报(生产环境)
    if (envConfig.currentEnv === 'prod') {
      // TODO: 接入错误监控平台
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    try {
      const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);
      const userInfo = wx.getStorageSync(constants.STORAGE_KEYS.USER_INFO);

      logger.debug('=== checkLoginStatus ===');
      logger.debug('Token存在?:', !!token);
      logger.debug('UserInfo存在?:', !!userInfo);
      logger.debug('UserInfo._id:', userInfo?._id);

      if (token && userInfo) {
        this.globalData.isLogin = true;
        this.globalData.userInfo = userInfo;
        this.globalData.token = token;
        logger.info('✅ 登录状态恢复成功，用户ID:', userInfo._id);
      } else {
        this.globalData.isLogin = false;
        logger.debug('❌ 登录状态未找到');
      }
    } catch (error) {
      logger.error('登录状态检查失败:', error);
      this.globalData.isLogin = false;
    }
  },

  // 获取系统信息
  getSystemInfo() {
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
        this.globalData.statusBarHeight = res.statusBarHeight;
        this.globalData.screenHeight = res.screenHeight;
        this.globalData.screenWidth = res.screenWidth;
        this.globalData.platform = res.platform;

        if (envConfig.enableDebug) {
          logger.debug('系统信息:', res);
        }
      }
    });
  },

  // 检查小程序更新
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();

      updateManager.onCheckForUpdate((res) => {
        if (res.hasUpdate) {
          logger.info('发现新版本');
        }
      });

      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) {
              updateManager.applyUpdate();
            }
          }
        });
      });

      updateManager.onUpdateFailed(() => {
        logger.error('新版本下载失败');
      });
    }
  },

  // 全局数据
  globalData: {
    isLogin: false,
    userInfo: null,
    token: null,
    systemInfo: null,
    statusBarHeight: 0,
    screenHeight: 0,
    screenWidth: 0,
    platform: '',
    apiBaseUrl: envConfig.apiBaseUrl,
    env: envConfig
  }
});
