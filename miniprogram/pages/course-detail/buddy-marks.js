/**
 * 读伴标记：读伴关系对营里公开，打卡作者的读伴给 TA 点赞、评论时，排在最前并带「读伴」标记。
 * 都是纯函数，不依赖页面。
 */

// 读伴回应的预设短句（key 与后端 REACTION_MESSAGES 一致，不开放自由输入）
const REACTION_OPTIONS = [
  { key: 'moved', text: '这句也打动我。' },
  { key: 'slow', text: '我读到了，读得很慢。' },
  { key: 'glad', text: '为你高兴。' },
  { key: 'thanks', text: '谢谢你写下来。' }
];

const sameId = (a, b) => !!a && !!b && String(a) === String(b);

// 点赞头像：读伴排第一并带 isBuddy，其余保持原有顺序
function markBuddyAvatars(avatars, buddyUserId) {
  const list = Array.isArray(avatars) ? avatars : [];
  if (!buddyUserId) return list;
  const marked = list.map(item => ({ ...item, isBuddy: sameId(item && item.userId, buddyUserId) }));
  return [...marked.filter(item => item.isBuddy), ...marked.filter(item => !item.isBuddy)];
}

// 评论：读伴的评论置顶并带 isBuddy，其余保持原有顺序
function markBuddyReplies(replies, buddyUserId) {
  const list = Array.isArray(replies) ? replies : [];
  if (!buddyUserId) return list;
  const marked = list.map(item => ({ ...item, isBuddy: sameId(item && item.userId, buddyUserId) }));
  return [...marked.filter(item => item.isBuddy), ...marked.filter(item => !item.isBuddy)];
}

// 我是这篇打卡作者的读伴
function isMyBuddyCheckin({ buddyUserId, authorId }, currentUserId) {
  return sameId(buddyUserId, currentUserId) && !sameId(authorId, currentUserId);
}

// 能回应：我是作者的读伴，且这一篇还没有读伴回应
function canReactToCheckin({ buddyUserId, authorId, buddyReaction }, currentUserId) {
  return isMyBuddyCheckin({ buddyUserId, authorId }, currentUserId) && !buddyReaction;
}

module.exports = {
  REACTION_OPTIONS,
  markBuddyAvatars,
  markBuddyReplies,
  isMyBuddyCheckin,
  canReactToCheckin
};
