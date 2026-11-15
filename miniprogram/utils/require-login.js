const { tenantStorage } = require('./storage');
const appDialog = require('./dialog');
const constants = require('../config/constants');

/**
 * 检查是否已登录。未登录时不直接把人赶去登录页，而是说明原因并给两条路：
 * 新朋友先去落地页认识一下，老书友再去登录。
 * @returns {boolean} true = 已登录可继续操作，false = 未登录已弹出选择
 */
function requireLogin(message) {
  const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);
  if (token) return true;

  appDialog.showModal({
    title: '这里是书友们的营地',
    content: message || '点赞、评论和书友之间的互动，报名本期后就能看到。你是老书友的话，登录就好。',
    confirmText: '我是老书友',
    cancelText: '想了解一下',
    success(res) {
      if (res.confirm) {
        wx.navigateTo({ url: '/pages/login/login' });
      } else if (res.cancel) {
        wx.navigateTo({ url: '/pages/landing/landing' });
      }
    }
  });
  return false;
}

module.exports = { requireLogin };
