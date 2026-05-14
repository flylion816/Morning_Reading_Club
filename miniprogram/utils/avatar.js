const { getAvatarColorByUserId } = require('./formatters');

function getLastTextChar(value = '', fallback = '用') {
  const chars = Array.from(String(value || '').trim());
  return chars.length > 0 ? chars[chars.length - 1] : fallback;
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
  const fallbackName = options.fallbackName || '用户';
  const userId = String(options.userId || getUserId(user) || '');
  const displayName = options.displayName || getDisplayName(user, fallbackName);

  return {
    avatarUrl: user?.avatarUrl || '',
    avatarText: getLastTextChar(displayName, options.fallbackText || '用'),
    avatarColor: getAvatarColorByUserId(userId || displayName)
  };
}

function decorateUserAvatar(user = {}, options = {}) {
  return {
    ...user,
    ...getUserAvatarDisplay(user, options)
  };
}

module.exports = {
  decorateUserAvatar,
  getLastTextChar,
  getUserAvatarDisplay
};
