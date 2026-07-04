const currentTenant = require('../config/current-tenant');

const DEFAULT_PRIMARY_COLOR = '#4a90e2';
const THEME_PRIMARY = currentTenant.primaryColor || DEFAULT_PRIMARY_COLOR;

function getThemePrimaryColor() {
  return THEME_PRIMARY;
}

function normalizeThemeColor(color) {
  return color || THEME_PRIMARY;
}

module.exports = {
  DEFAULT_PRIMARY_COLOR,
  THEME_PRIMARY,
  getThemePrimaryColor,
  normalizeThemeColor
};
