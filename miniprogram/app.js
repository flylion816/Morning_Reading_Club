// 晨读营小程序 - 应用入口
const envConfig = require('./config/env');
const constants = require('./config/constants');
const logger = require('./utils/logger');

App({
  onLaunch(options) {
    logger.info('晨读营小程序启动', options);
    logger.debug('当前环境:', envConfig.currentEnv);

    // 检查登录状态
    this.checkLoginStatus();

    // 获取系统信息
    this.getSystemInfo();

    // 检查更新
    this.checkUpdate();
  },

  onShow(options) {
    logger.info('晨读营小程序显示', options);
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
