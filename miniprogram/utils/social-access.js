const { tenantStorage } = require('./storage');
const constants = require('../config/constants');

const HOME_URL = '/pages/index/index';

function redirectSocialVisitorToHome() {
  // Home is a tab page; redirectTo cannot open it directly.
  wx.switchTab({
    url: HOME_URL,
    fail: () => wx.reLaunch({ url: HOME_URL })
  });
}

function hasVerifiedSocialAccess() {
  let app = null;
  try {
    app = getApp();
  } catch (_) {
    app = null;
  }

  return !!tenantStorage.get(constants.STORAGE_KEYS.TOKEN) &&
    app?.globalData?.canUsePaidFeatures === true;
}

function guardSocialPage(page) {
  if (!hasVerifiedSocialAccess()) {
    redirectSocialVisitorToHome();
    return false;
  }

  if (page?.data?.socialAccessGranted !== true) {
    page.setData({ socialAccessGranted: true });
  }
  return true;
}

module.exports = {
  HOME_URL,
  hasVerifiedSocialAccess,
  guardSocialPage
};
