const currentTenant = require('../config/current-tenant');

const DEFAULT_PRIMARY_COLOR = '#3d6fa6';
const THEME_PRIMARY = currentTenant.primaryColor || DEFAULT_PRIMARY_COLOR;
const WECHAT_SI_PLUGIN_ENABLED = currentTenant.wechatSIPlugin === true;

function getThemePrimaryColor() {
  return THEME_PRIMARY;
}

function normalizeThemeColor(color) {
  return color || THEME_PRIMARY;
}

module.exports = {
  DEFAULT_PRIMARY_COLOR,
  THEME_PRIMARY,
  WECHAT_SI_PLUGIN_ENABLED,
  getThemePrimaryColor,
  normalizeThemeColor
};
