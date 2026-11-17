/**
 * 「来信」页：把一条条系统通知整理成「谁想到了你」。
 * 纯函数，输入是页面里已经 decorate 过的通知（带 senderName、senderAvatar 等），输出按天分组的卡片。
 *
 * 规则：
 * - 以人为主：有发送人的显示头像，系统类消息用印章字
 * - 同一篇打卡、同一天的点赞合并成一条；评论不合并，每句话单独看
 * - 读伴（data.fromBuddy 或读伴类通知）用暖色卡片，同一篇打卡上读伴的点赞、评论、回应合并成一条
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const BUDDY_TYPES = ['buddy_nudge', 'buddy_highfive', 'buddy_gift', 'buddy_checkin', 'buddy_reaction', 'buddy_invite', 'buddy_invite_accepted', 'buddy_ended'];
// 读伴一天里的小动静（轻拍、击掌、送一句、写打卡）：同一位读伴同一天合并成一条
const BUDDY_DAY_TYPES = ['buddy_nudge', 'buddy_highfive', 'buddy_gift', 'buddy_checkin'];
const NEEDS_REPLY_TYPES = ['request_created', 'comment_received', 'awareness_revisit', 'companion_note_reply'];

const dataOf = n => (n && n.data) || {};
const nameOf = n => (n && n.senderName) || '一位书友';
const titleOf = n => dataOf(n).sectionTitle || '';

function isBuddyNotification(n) {
  return BUDDY_TYPES.includes(n.type) || dataOf(n).fromBuddy === true;
}

function parseQuoted(content) {
  const match = /「([^」]*)」/.exec(content || '');
  return match ? match[1] : '';
}

// 通知标题形如「你的读伴轻拍了你一下 · 连接之力」，期次名在最后
function periodFromTitle(title) {
  const text = String(title || '');
  const index = text.indexOf(' · ');
  return index >= 0 ? text.slice(index + 3) : '';
}

function dayKeyOf(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayLabel(value, now = new Date()) {
  const key = dayKeyOf(value);
  if (!key) return '更早';
  if (key === dayKeyOf(now)) return '今天';
  if (key === dayKeyOf(new Date(now.getTime() - DAY_MS))) return '昨天';
  return '更早';
}

function personAvatar(n) {
  return {
    userId: n.senderUserId || '',
    url: n.senderAvatar || '',
    text: n.senderAvatarText || n.senderInitial || '',
    color: n.senderAvatarColor || ''
  };
}

// 单条通知 → 卡片
function describe(n) {
  const name = nameOf(n);
  const data = dataOf(n);
  const buddy = isBuddyNotification(n);
  const base = {
    badge: '',
    sealChar: '',
    lead: '',
    rest: '',
    quote: '',
    period: buddy ? periodFromTitle(n.title) : '',
    warm: buddy || n.type === 'awareness_revisit',
    needsReply: n.type === 'buddy_invite' ? !['accepted', 'declined', 'cancelled', 'expired', 'gone'].includes(dataOf(n).inviteStatus) : n.type === 'request_created' ? ['pending', undefined, ''].includes(n.requestStatus) : NEEDS_REPLY_TYPES.includes(n.type),
    avatars: []
  };
  const person = (badge, rest, quote = '') => ({
    ...base,
    badge: buddy ? '伴' : badge,
    lead: buddy ? `你的读伴 ${name}` : name,
    rest,
    quote,
    avatars: [personAvatar(n)]
  });
  const seal = (sealChar, text) => ({ ...base, sealChar, lead: '', rest: text });

  switch (n.type) {
    case 'like_received':
      return person('赞', data.commentId ? ' 给你的评论点了赞' : ` 给你的${titleOf(n) ? `《${titleOf(n)}》` : '打卡'}点了赞`);
    case 'comment_received':
      return person('评', n.title === '有书友回复了你' ? ' 回复了你的评论' : ' 在你的打卡下留了一句', data.commentPreview || '');
    case 'request_created':
      return person('请', ' 想读读你的小凡看见', n.requestLesson || '');
    case 'request_approved':
    case 'admin_approved':
      return person('请', ' 同意了你的申请，可以读 TA 的小凡看见了');
    case 'request_rejected':
    case 'admin_rejected':
      return person('请', ' 这次没有同意你的申请');
    case 'permission_revoked':
      return person('请', ' 收回了你读 TA 小凡看见的权限');
    case 'seen_received':
      return person('见', ' 看见了你');
    case 'insight_liked': {
      // 旧点赞通知的正文中也带了标题，接口无法补全时仍可展示。
      const match = /为你的「([^」]*)」点了赞/.exec(String(n.content || ''));
      const legacyTitle = match ? match[1] : '';
      const label = data.insightLabel || (legacyTitle !== '小凡看见' ? legacyTitle : '');
      return person('赞', ' 给你的小凡看见点了赞', label ? `对应：${label}` : '');
    }
    case 'danmaku_received':
      return person('评', ' 给你的小凡看见留了一句', data.insightLabel ? `对应：${data.insightLabel}` : '');
    case 'buddy_nudge': {
      const said = String(n.content || '');
      const quote = said.startsWith(name) ? said.slice(name.length).replace(/^说/, '') : said;
      return person('伴', ' 轻拍了你', quote);
    }
    case 'buddy_highfive':
      return person('伴', ' 和你击了个掌');
    case 'buddy_gift':
      return person('伴', ' 送了你一句话', parseQuoted(n.content));
    case 'buddy_reaction':
      return person('伴', ' 回应了你的打卡', parseQuoted(n.content));
    case 'buddy_invite':
      // 邀请时还不是读伴，只写名字
      return { ...person('伴', ' 邀请你做读伴'), lead: name };
    case 'buddy_invite_accepted':
      return person('伴', ' 同意了你的邀请，你们成为读伴了');
    case 'buddy_ended':
      return seal('伴', '你们的这段读伴结束了，想的话可以再认识一位');
    case 'buddy_checkin':
      return person('伴', titleOf(n) ? ` 写下了「${titleOf(n)}」的打卡` : ' 写下了今天的打卡');
    case 'insight_created':
      return seal('凡', titleOf(n) ? `小凡读了你的《${titleOf(n)}》，写下了看见` : n.content || '小凡为你写下了看见');
    case 'newcomer_shared':
      return seal('享', '你分享的日签，有一位书友想来了，接待书友会和 TA 联系');
    case 'letter_delivered':
      return seal('信', '你写给今天的那封信，到了');
    case 'awareness_revisit':
      // 来自一周前的自己：来信本身不带笔记文字，「择」由页面凭记录 ID 单独读取
      return { ...seal('觉', '来自一周前的自己：你想试试的那件事，后来怎么样了？'), warm: true };
    case 'companion_note_reply':
      return person('札', ' 回复了你的手札回响', data.commentPreview || (data.companionNoteTitle ? `《${data.companionNoteTitle}》` : ''));
    case 'companion_note_comment': {
      const title = data.companionNoteTitle ? `《${data.companionNoteTitle}》` : '你的陪伴手札';
      const count = Number(data.commentCount || data.count || 1) || 1;
      return seal('札', `${title}今天有 ${count} 条新回响`);
    }
    case 'enrollment_result':
    case 'payment_result':
      return seal('营', n.content || n.title || '');
    default:
      return n.senderName ? person('', ' 给你来了一条消息', n.content || '') : seal('信', n.content || n.title || '');
  }
}

function uniqueByUser(avatars) {
  const seen = new Set();
  return avatars.filter(item => {
    const key = item.userId || item.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function joinNames(names, total) {
  const head = names.slice(0, 2).join('、');
  return total > 2 ? `${head} 等 ${total} 位书友` : head;
}

/**
 * @param {Array} notifications 已 decorate 的通知，按时间倒序
 * @param {Date} now
 * @returns {Array<{label: string, items: Array}>}
 */
function buildFeed(notifications = [], now = new Date()) {
  const entries = []; // 合并之后的卡片，保持第一次出现的位置
  const mergeIndex = {};

  (notifications || []).forEach(n => {
    if (!n) return;
    const id = String(n._id || n.id || n.notificationIdValue || '');
    const data = dataOf(n);
    const checkinId = data.checkinId ? String(data.checkinId) : '';
    const day = dayKeyOf(n.createdAt);
    const buddy = isBuddyNotification(n);

    // 读伴在同一篇打卡上的点赞、评论、回应：合并成一条
    const buddyOnCheckin =
      checkinId && ((buddy && ['like_received', 'comment_received'].includes(n.type)) || n.type === 'buddy_reaction');
    // 同一篇打卡、同一天、不同书友的点赞：合并成一条（评论的赞不合并）
    const plainLike = n.type === 'like_received' && !buddy && !data.commentId && checkinId;
    const buddyDay = BUDDY_DAY_TYPES.includes(n.type) && (n.senderUserId || n.senderName);
    const key = buddyOnCheckin
      ? `buddy:${checkinId}:${day}`
      : buddyDay
        ? `buddyday:${n.senderUserId || n.senderName}:${day}`
        : plainLike
          ? `like:${checkinId}:${day}`
          : '';

    if (key && mergeIndex[key] !== undefined) {
      const entry = entries[mergeIndex[key]];
      entry.members.push(n);
      entry.ids.push(id);
      return;
    }
    const entry = { key: key || `n:${id}`, kind: key.split(':')[0] || 'single', ids: [id], members: [n], first: n };
    if (key) mergeIndex[key] = entries.length;
    entries.push(entry);
  });

  const cards = entries.map(entry => {
    const first = entry.first;
    let card = describe(first);

    if (entry.kind === 'like' && entry.members.length > 1) {
      const names = [...new Set(entry.members.map(nameOf))];
      card = {
        ...card,
        lead: joinNames(names, names.length),
        avatars: uniqueByUser(entry.members.map(personAvatar)).slice(0, 2)
      };
    }

    if (entry.kind === 'buddy') {
      const types = entry.members.map(m => m.type);
      const actions = [];
      if (types.includes('like_received')) actions.push('点了赞');
      if (types.includes('buddy_reaction')) actions.push('回应了一句');
      if (types.includes('comment_received')) actions.push('留了一句');
      const reaction = entry.members.find(m => m.type === 'buddy_reaction');
      const comment = entry.members.find(m => m.type === 'comment_received');
      card = {
        ...card,
        warm: true,
        badge: '伴',
        lead: `你的读伴 ${nameOf(first)}`,
        rest: ` 读了你的打卡，${actions[0]}${actions.slice(1).map(a => `，还${a}`).join('')}`,
        quote: (reaction && parseQuoted(reaction.content)) || (comment && dataOf(comment).commentPreview) || '',
        period: card.period || periodFromTitle((reaction || first).title),
        needsReply: types.includes('comment_received'),
        avatars: [personAvatar(first)]
      };
    }

    if (entry.kind === 'buddyday' && entry.members.length > 1) {
      const phrases = { buddy_nudge: '轻拍了你', buddy_highfive: '和你击了个掌', buddy_gift: '送了你一句话', buddy_checkin: '写下了今天的打卡' };
      const types = [...new Set(entry.members.map(m => m.type))];
      const gift = entry.members.find(m => m.type === 'buddy_gift');
      const nudge = entry.members.find(m => m.type === 'buddy_nudge');
      card = {
        ...card,
        warm: true,
        badge: '伴',
        lead: `你的读伴 ${nameOf(first)}`,
        rest: ` 今天${types.map(t => phrases[t]).join('，')}`,
        quote: (gift && parseQuoted(gift.content)) || (nudge ? describe(nudge).quote : ''),
        avatars: [personAvatar(first)]
      };
    }

    const unread = entry.members.some(m => !m.isRead);
    const request = first.type === 'request_created'
      ? { requestId: String(first.requestIdValue || ''), status: ['approved', 'rejected', 'revoked', 'gone'].includes(first.requestStatus) ? first.requestStatus : 'pending' }
      : null;

    return {
      ...card,
      key: entry.key,
      id: entry.ids[0],
      ids: entry.ids,
      unread,
      isRead: !unread,
      time: first.formattedTime || '',
      actionText: first.type === 'request_created' ? '' : first.actionText || '',
      target: first.resolvedTargetPage || '',
      periodId: first.periodIdValue || '',
      type: first.type,
      count: entry.members.length,
      day: dayLabel(first.createdAt, now),
      request,
      // 觉察回访：可以直接写一句后来，或者先不写
      revisit: first.type === 'awareness_revisit' && dataOf(first).joyNoteId
        ? { noteId: String(dataOf(first).joyNoteId) }
        : null,
      // 读伴邀请：可以直接在来信里同意 / 婉拒
      invite: first.type === 'buddy_invite' && dataOf(first).inviteId
        ? {
            inviteId: String(dataOf(first).inviteId),
            periodId: String(dataOf(first).periodId || first.periodIdValue || ''),
            status: ['accepted', 'declined', 'cancelled', 'expired', 'gone'].includes(dataOf(first).inviteStatus) ? dataOf(first).inviteStatus : 'pending'
          }
        : null
    };
  });

  const groups = [];
  cards.forEach(card => {
    let group = groups[groups.length - 1];
    if (!group || group.label !== card.day) {
      group = { label: card.day, items: [] };
      groups.push(group);
    }
    group.items.push(card);
  });
  return groups;
}

// 页面顶部那句话：今天有几位书友想到了你，还有几件事在等你回应
function summarizeFeed(groups = []) {
  const items = groups.reduce((all, group) => all.concat(group.items), []);
  const unreadPeople = uniqueByUser(
    items
      .filter(item => item.unread && item.avatars.length > 0)
      .reduce((all, item) => all.concat(item.avatars), [])
  );
  const unreadCount = items.filter(item => item.unread).length;
  const replyCount = items.filter(item => item.needsReply && item.unread).length;

  let headline = '这会儿很安静';
  let sub = '没有新来信，先读一会儿书吧';
  if (unreadPeople.length > 0) {
    headline = `今天有 ${unreadPeople.length} 位书友想到了你`;
    sub = replyCount > 0 ? `还有 ${replyCount} 件事在等你回应` : '读一读他们写给你的话';
  } else if (unreadCount > 0) {
    headline = `有 ${unreadCount} 条新消息`;
    sub = replyCount > 0 ? `还有 ${replyCount} 件事在等你回应` : '';
  }
  return { headline, sub, avatars: unreadPeople.slice(0, 3), unreadCount, replyCount };
}

module.exports = { buildFeed, summarizeFeed, dayLabel, parseQuoted, periodFromTitle, isBuddyNotification };
