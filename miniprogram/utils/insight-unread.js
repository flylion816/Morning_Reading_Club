// 小凡的信是否「未读」：只对收信人自己成立。
// 已读标记是 2026-11-12 才开始记的，早于这一天的信一律当作读过，免得老信一下子全变成未读。
const UNREAD_SINCE = new Date('2026-11-12T00:00:00+08:00').getTime();

function toId(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
}

function isInsightUnread(item, currentUserId) {
  if (!item || item.readAt || !currentUserId) return false;
  const ownerId = toId(item.targetUserId) || toId(item.userId);
  if (!ownerId || ownerId !== String(currentUserId)) return false;
  const createdAt = new Date(item.createdAt || 0).getTime();
  return Number.isFinite(createdAt) && createdAt >= UNREAD_SINCE;
}

module.exports = { isInsightUnread, UNREAD_SINCE };
