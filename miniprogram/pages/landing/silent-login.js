/**
 * 静默登录：访客在某个动作（比如留言）发生时才登录，不出现登录页。
 * 已登录则直接返回；并发调用共用同一次登录。
 */
const authService = require('../../services/auth.service');
const { tenantStorage } = require('../../utils/storage');
const constants = require('../../config/constants');

const DEFAULT_WECHAT_USER_INFO = {
  nickName: '微信用户',
  avatarUrl: '',
  gender: 0
};

let pendingLogin = null;

function hasToken() {
  return Boolean(tenantStorage.get(constants.STORAGE_KEYS.TOKEN));
}

async function ensureLoggedIn() {
  if (hasToken()) return false;
  if (!pendingLogin) {
    pendingLogin = authService
      .wechatLogin(DEFAULT_WECHAT_USER_INFO)
      .then(loginData => {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.isLogin = true;
          app.globalData.userInfo = loginData.user;
          app.globalData.token = loginData.accessToken || loginData.access_token;
        }
        return true;
      })
      .finally(() => {
        pendingLogin = null;
      });
  }
  return pendingLogin;
}

module.exports = { ensureLoggedIn, hasToken };
