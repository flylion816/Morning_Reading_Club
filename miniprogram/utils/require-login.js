const { tenantStorage } = require('./storage');
const constants = require('../config/constants');

/**
 * 检查是否已登录。未登录时弹出引导弹窗，用户主动选择是否去登录。
 * @returns {boolean} true = 已登录可继续操作，false = 未登录已弹窗
 */
function requireLogin(message) {
  const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);
  if (token) return true;

  wx.showModal({
    title: '登录后才能互动',
    content: message || '登录后可以点赞、评论、参与互动',
    confirmText: '去登录',
    cancelText: '取消',
    success(res) {
      if (res.confirm) {
        wx.navigateTo({ url: '/pages/login/login' });
      }
    }
  });
  return false;
}

module.exports = { requireLogin };
