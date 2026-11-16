/**
 * 打卡可见范围：
 * - isPublic !== false（含历史数据的 undefined）：营内有权限的书友都能看
 * - isPublic === false（选「仅自己可见」）：只有作者本人能看
 */
function ownerIdOf(checkin) {
  const owner = checkin && checkin.userId;
  return String((owner && owner._id) || owner || '');
}

function canViewCheckin(checkin, viewerId) {
  if (!checkin) return false;
  if (checkin.isPublic !== false) return true;
  return !!viewerId && ownerIdOf(checkin) === String(viewerId);
}

// 查询条件：别人的私密打卡一律排除，自己的私密打卡保留。每次返回新对象，避免被调用方修改
function visibleCheckinFilter(viewerId) {
  const publicClause = { isPublic: { $ne: false } };
  if (!viewerId) return publicClause;
  return { $or: [publicClause, { userId: viewerId }] };
}

module.exports = { canViewCheckin, visibleCheckinFilter };
