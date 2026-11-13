const { getAvatarColorByUserId } = require('./formatters');

const DEFAULT_AVATAR_TEXT = '用';

function getLastTextChar(value = '', fallback = '用') {
  const chars = Array.from(String(value || '').trim());
  return chars.length > 0 ? chars[chars.length - 1] : fallback;
}

function isUsableAvatarUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  // User.avatar is an emoji/text field. Only explicit avatarUrl values can be
  // treated as image sources; these schemes cover WeChat, uploaded and local
  // preview URLs without treating an emoji as a URL.
  return /^(?:https?:\/\/|wxfile:\/\/|cloud:\/\/|data:image\/|\/)/i.test(normalized);
}

function normalizeAvatarUrl(value) {
  const normalized = String(value || '').trim();
  return isUsableAvatarUrl(normalized) ? normalized : '';
}

function getUserId(user = {}) {
  if (!user || typeof user !== 'object') return '';
  return user._id || user.id || user.userId || '';
}

function getDisplayName(user = {}, fallback = '用户') {
  if (!user || typeof user !== 'object') return fallback;
  return user.nickname || user.name || user.userName || user.displayName || fallback;
}

function getUserAvatarDisplay(user = {}, options = {}) {
  const source = user && typeof user === 'object' ? user : {};
  const fallbackName = options.fallbackName || '用户';
  const userId = String(options.userId || getUserId(source) || '');
  const displayName = options.displayName || getDisplayName(source, fallbackName);
  const avatarUrl = normalizeAvatarUrl(options.avatarUrl || source.avatarUrl);
  const avatarValue = String(source.avatar || '').trim();
  const fallbackText = options.fallbackText || DEFAULT_AVATAR_TEXT;
  const fallbackAvatarText = avatarValue && !isUsableAvatarUrl(avatarValue)
    ? avatarValue
    : getLastTextChar(displayName, fallbackText);

  return {
    userId,
    avatarUrl,
    avatarText: fallbackAvatarText || fallbackText,
    avatarColor: source.avatarColor || getAvatarColorByUserId(userId || displayName),
    hasImage: Boolean(avatarUrl)
  };
}

function decorateUserAvatar(user = {}, options = {}) {
  return {
    ...user,
    ...getUserAvatarDisplay(user, options)
  };
}

module.exports = {
  DEFAULT_AVATAR_TEXT,
  decorateUserAvatar,
  getLastTextChar,
  isUsableAvatarUrl,
  normalizeAvatarUrl,
  getUserAvatarDisplay
};
