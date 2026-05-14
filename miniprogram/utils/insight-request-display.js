const { getAvatarColorByUserId } = require('./formatters');
const { getLastTextChar } = require('./avatar');

function formatRelativeTime(dateString) {
  if (!dateString) return '刚刚';

  const createdTime = new Date(dateString).getTime();
  if (Number.isNaN(createdTime)) return '刚刚';

  const now = Date.now();
  const diffMs = now - createdTime;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return new Date(dateString).toLocaleDateString('zh-CN');
}

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    return value._id || value.id || null;
  }
  return value;
}

function extractInsightRequests(response) {
  if (Array.isArray(response)) {
    return response;
  }
  if (response && Array.isArray(response.data)) {
    return response.data;
  }
  if (response && Array.isArray(response.list)) {
    return response.list;
  }
  return [];
}

function buildInsightRequestDisplay(item, options = {}) {
  const direction = options.direction === 'sent' ? 'sent' : 'received';
  const isSent = direction === 'sent';
  const fromUser = item.fromUserId || {};
  const toUser = item.toUserId || {};
  const displayUser = isSent ? toUser : fromUser;
  const displayUserId = normalizeId(displayUser);
  const periodId = normalizeId(item.periodId) || normalizeId(item.insightId?.periodId);
  const insightId = normalizeId(item.insightId);
  const periodName =
    item.requestPeriodName ||
    item.periodId?.name ||
    item.periodId?.title ||
    item.insightId?.periodId?.name ||
    item.insightId?.periodId?.title ||
    '未知期次';
  const insightTitle =
    item.requestInsightTitle ||
    item.insightId?.sectionId?.title ||
    item.insightId?.title ||
    '学习反馈';
  const insightDay =
    item.requestInsightDay ||
    item.insightId?.day ||
    item.insightId?.sectionId?.day ||
    null;
  const titleHasDay = /第[一二三四五六七八九十0-9]+天/.test(insightTitle);
  const dayText = insightDay && !titleHasDay ? `第${insightDay}天` : '';
  const metaParts = [periodName];
  if (dayText) metaParts.push(dayText);
  if (insightTitle) metaParts.push(insightTitle);

  const receivedStatusMap = {
    pending: { text: '待处理', className: 'pending' },
    approved: { text: '已同意', className: 'approved' },
    rejected: { text: '已拒绝', className: 'rejected' },
    revoked: { text: '已撤销', className: 'revoked' }
  };
  const sentStatusMap = {
    ...receivedStatusMap,
    pending: { text: '等待中', className: 'pending' }
  };
  const statusMap = isSent ? sentStatusMap : receivedStatusMap;
  const statusInfo = statusMap[item.status] || statusMap.pending;
  const displayName = displayUser.nickname || displayUser.name || '用户';

  return {
    id: item._id || item.id,
    _id: item._id || item.id,
    direction,
    displayUserId,
    displayUserName: displayName,
    displayUserAvatarUrl: displayUser.avatarUrl || '',
    displayUserAvatarText: getLastTextChar(displayName, '用'),
    displayUserRoleText: isSent ? '发给' : '来自',
    avatarColor: getAvatarColorByUserId(displayUserId),
    fromUserId: normalizeId(fromUser),
    fromUserName: fromUser.nickname || fromUser.name || '用户',
    toUserId: normalizeId(toUser),
    toUserName: toUser.nickname || toUser.name || '用户',
    time: formatRelativeTime(item.createdAt || item.updatedAt),
    status: item.status,
    statusText: statusInfo.text,
    statusClass: statusInfo.className,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    periodId,
    insightId,
    requestPeriodName: periodName,
    requestInsightTitle: insightTitle,
    requestInsightDay: insightDay,
    requestDayText: dayText,
    requestMeta: metaParts.join(' · '),
    requestSummary: dayText ? `${periodName} · ${dayText}` : periodName,
    canApprove: !isSent && item.status === 'pending',
    canReject: !isSent && item.status === 'pending',
    canNavigate: !isSent || item.status === 'approved'
  };
}

module.exports = {
  buildInsightRequestDisplay,
  extractInsightRequests,
  formatRelativeTime
};
