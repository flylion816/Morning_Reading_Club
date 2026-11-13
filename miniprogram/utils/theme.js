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

function parseThemeColor(color) {
  const normalized = normalizeThemeColor(color).replace('#', '');
  const fullColor = normalized.length === 3
    ? normalized.split('').map(part => part.repeat(2)).join('')
    : normalized;
  return /^([0-9a-f]{6})$/i.test(fullColor) ? fullColor : null;
}

function getThemeColorWithAlpha(color, alpha = 1) {
  const parsedColor = parseThemeColor(color);
  if (!parsedColor) return normalizeThemeColor(color);

  const safeAlpha = Math.min(Math.max(Number(alpha) || 0, 0), 1);
  const red = parseInt(parsedColor.slice(0, 2), 16);
  const green = parseInt(parsedColor.slice(2, 4), 16);
  const blue = parseInt(parsedColor.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

function darkenThemeColor(color, amount = 0.16) {
  const parsedColor = parseThemeColor(color);
  if (!parsedColor) return normalizeThemeColor(color);

  const safeAmount = Math.min(Math.max(Number(amount) || 0, 0), 1);
  const channels = [0, 2, 4].map(offset => {
    const channel = parseInt(parsedColor.slice(offset, offset + 2), 16);
    return Math.round(channel * (1 - safeAmount));
  });
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

module.exports = {
  DEFAULT_PRIMARY_COLOR,
  THEME_PRIMARY,
  WECHAT_SI_PLUGIN_ENABLED,
  getThemePrimaryColor,
  normalizeThemeColor,
  getThemeColorWithAlpha,
  darkenThemeColor
};
