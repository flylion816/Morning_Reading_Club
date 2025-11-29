// 晨读营小程序 - 应用入口
const envConfig = require('./config/env');
const constants = require('./config/constants');

App({
  onLaunch(options) {
    console.log('晨读营小程序启动', options);
    console.log('当前环境:', envConfig.currentEnv);

    // 检查登录状态
    this.checkLoginStatus();

    // 获取系统信息
    this.getSystemInfo();

    // 检查更新
    this.checkUpdate();
  },

  onShow(options) {
    console.log('晨读营小程序显示', options);
  },

  onHide() {
    console.log('晨读营小程序隐藏');
  },

  onError(error) {
    console.error('应用错误:', error);

    // 错误上报(生产环境)
    if (envConfig.currentEnv === 'prod') {
      // TODO: 接入错误监控平台
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);
    const userInfo = wx.getStorageSync(constants.STORAGE_KEYS.USER_INFO);

    console.log('=== checkLoginStatus ===');
    console.log('Token存在?:', !!token);
    console.log('UserInfo存在?:', !!userInfo);
    console.log('UserInfo原始内容:', userInfo);

    if (token && userInfo) {
      // 修复：确保用户信息有 _id 字段（兼容旧数据）
      // 后端返回的数据应该有 _id，但为了安全起见还是检查一下
      if (!userInfo._id) {
        console.warn('用户信息缺少 _id，尝试从其他字段恢复...');
        // 尝试从 id（兼容旧数据）
        if (userInfo.id) {
          userInfo._id = userInfo.id;
          console.warn('已从 id 字段恢复 _id:', userInfo._id);
        }
        // 尝试从 openid（微信 openid）
        else if (userInfo.openid) {
          userInfo._id = userInfo.openid;
          console.warn('已从 openid 字段恢复 _id:', userInfo._id);
        }
        // 如果都没有，生成一个临时 _id
        else {
          userInfo._id = 'temp_' + Date.now();
          console.error('无法从现有字段恢复 _id，已生成临时 _id:', userInfo._id);
        }
      }

      console.log('最终 userInfo._id:', userInfo._id);

      this.globalData.isLogin = true;
      this.globalData.userInfo = userInfo;
      this.globalData.token = token;
    } else {
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
          console.log('系统信息:', res);
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
          console.log('发现新版本');
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
        console.error('新版本下载失败');
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
