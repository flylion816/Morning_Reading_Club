const BuddyPair = require('../models/BuddyPair');
const BuddyRequest = require('../models/BuddyRequest');
const BuddyReaction = require('../models/BuddyReaction');
const BuddyInvite = require('../models/BuddyInvite');
const Enrollment = require('../models/Enrollment');
const Checkin = require('../models/Checkin');
const User = require('../models/User');
const Period = require('../models/Period');
const Insight = require('../models/Insight');
const UserReadingCompletion = require('../models/UserReadingCompletion');
const { findCommunityEnrollment } = require('./community-access.service');
const { calculatePeriodStatus } = require('./period-status.service');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { toDayKey } = require('../utils/checkin-day-metrics');
const { readTrustedMood } = require('../utils/checkin-mood');
const contentSecurity = require('./content-security.service');
const { publishSyncEvent } = require('./sync.service');

const MAX_MATCH_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const NUDGE_MESSAGES = Object.freeze({
  together: '在等你一起读',
  tomorrow: '明早一起读',
  cheer: '今天也辛苦了',
  slow: '说不急，慢慢来'
});
// 「送一句」：可以选预设短句，也可以自己写一句。
// 预设短句分四类，每类 5 种说法，每天每类换一种。第一种说法的 key 就是类别名（和最初的四句一致），其余是类别名加序号
const GIFT_CATEGORIES = Object.freeze([
  {
    id: 'here',
    lines: Object.freeze([
      '今天有你一起读，真好。',
      '知道你也在读，我就安心了。',
      '我们又读到同一天了。',
      '这一页，有你陪着读。',
      '一个人读也好，有你在更好。'
    ])
  },
  {
    id: 'reread',
    lines: Object.freeze([
      '你写的那段，我读了两遍。',
      '你写下的那句，我记住了。',
      '读你写的字，我慢了下来。',
      '你的那段话，我也有同感。',
      '谢谢你把心里话写出来。'
    ])
  },
  {
    id: 'noRush',
    lines: Object.freeze(['不用赶，我在这儿。', '今天读不完也没关系。', '慢慢读，我陪着你。', '累了就歇一歇，明天再读。', '你读多少，都算数。'])
  },
  {
    id: 'tomorrow',
    lines: Object.freeze(['明天还在老地方见。', '明早，我先到。', '明天一起，接着读。', '今天到这儿，明天见。', '睡个好觉，明早见。'])
  }
]);
const giftKeyOf = (category, index) => (index === 0 ? category.id : `${category.id}${index + 1}`);
const GIFT_MESSAGES = Object.freeze(
  Object.fromEntries(
    GIFT_CATEGORIES.flatMap(category => category.lines.map((text, index) => [giftKeyOf(category, index), text]))
  )
);
// 自己写的话在 BuddyPair.gifts 里记为这个 key，文字放在 text 里
const CUSTOM_GIFT_KEY = 'custom';
const GIFT_TEXT_MAX = 30;
// 读伴回应：对 TA 的一篇打卡回一句预设短句（不开放自由输入）
const REACTION_MESSAGES = Object.freeze({
  moved: '这句也打动我。',
  slow: '我读到了，读得很慢。',
  glad: '为你高兴。',
  thanks: '谢谢你写下来。'
});
const MAX_PENDING_INVITES = 5;
const CANDIDATE_PAGE_SIZE = 20;
const CANDIDATE_SCAN_LIMIT = 500;
// 邀请 7 天没回复就过期；婉拒的结果给邀请人留一天
const INVITE_TTL_MS = 7 * DAY_MS;
const DECLINED_VISIBLE_MS = DAY_MS;
// 名单里「最近读过」的判断窗口
const RECENT_ACTIVE_MS = 3 * DAY_MS;
const TRAIL_MAX_DAYS = 60;
const TIMELINE_MAX_ITEMS = 12;

function buddyError(kind, status, message) {
  const error = new Error(message);
  error.isBuddyError = true;
  error.kind = kind;
  error.status = status;
  return error;
}

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

// ---- 送一句：预设短句轮换、自己写的话的规范化与校验 ----
function dayNumber(dayKey) {
  return Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / DAY_MS);
}

// 今天这位用户看到的四句：每类按「日期 + 用户 id 末位」选一种说法。
// 同一个人连续两天一定不同，不同的人同一天也不一样
function giftOptionsFor(userId, dayKey) {
  const last = parseInt(String(userId || '').slice(-1), 16);
  const seed = Number.isNaN(last) ? 0 : last;
  const base = dayNumber(dayKey) + seed;
  return GIFT_CATEGORIES.map((category, categoryIndex) => {
    const size = category.lines.length;
    const index = (((base + categoryIndex * 2) % size) + size) % size;
    return { key: giftKeyOf(category, index), text: category.lines[index] };
  });
}

// 一条送出的话的文字：自己写的取 text，预设的查表；表里没有的旧 key 返回空串
function giftText(entry) {
  if (!entry) return '';
  if (entry.key === CUSTOM_GIFT_KEY) return typeof entry.text === 'string' ? entry.text : '';
  return Object.prototype.hasOwnProperty.call(GIFT_MESSAGES, entry.key) ? GIFT_MESSAGES[entry.key] : '';
}

// 自己写的话：去掉不可见字符，换行和连续空白折成一个空格
function normalizeGiftText(value) {
  return String(value)
    .replace(/\p{Cf}/gu, '') // 不可见的格式字符：零宽空格、方向控制符、BOM 等
    .replace(/\p{Cc}/gu, ' ') // 控制字符，包括换行和制表符
    .replace(/\s+/g, ' ')
    .trim();
}

// 链接和联系方式的粗筛，防广告引流；真正的把关是微信内容安全检查
const GIFT_LINK_PATTERN = /https?:\/\/|www\.|[a-z0-9-]+\.(?:com|cn|net|org|top|cc|xyz|io|me|co)\b|[a-z0-9._-]+@[a-z0-9-]+\./i;
const GIFT_CONTACT_PATTERN = /\d{6,}|(?:\d[ -]?){9,}|(?:微信|vx|v信|wx|weixin|加我|扫码|二维码|qq|扣扣)\s*[:：]?\s*[a-z0-9_-]{4,}/i;

// 送一句的输入：字符串是预设短句的 key（老接口）；对象是 { messageKey, text }，二选一
function parseGiftInput(input) {
  const source = input !== null && typeof input === 'object' ? input : { messageKey: input };
  const hasKey = source.messageKey !== undefined && source.messageKey !== null;
  const hasText = source.text !== undefined && source.text !== null;
  if (hasKey && hasText) throw buddyError('badRequest', 400, '只能选一句，或者自己写一句');
  if (hasText) {
    if (typeof source.text !== 'string') throw buddyError('badRequest', 400, '请写一句想对 TA 说的话');
    const text = normalizeGiftText(source.text);
    if (!text) throw buddyError('badRequest', 400, '先写一句想对 TA 说的话');
    if (Array.from(text).length > GIFT_TEXT_MAX) throw buddyError('badRequest', 400, `最多 ${GIFT_TEXT_MAX} 个字`);
    if (GIFT_LINK_PATTERN.test(text) || GIFT_CONTACT_PATTERN.test(text)) {
      throw buddyError('badRequest', 400, '这句话里不要放链接或联系方式');
    }
    return { text };
  }
  if (!hasKey) throw buddyError('badRequest', 400, '请选一句，或者自己写一句');
  if (typeof source.messageKey !== 'string' || !Object.prototype.hasOwnProperty.call(GIFT_MESSAGES, source.messageKey)) {
    throw buddyError('badRequest', 400, '请从给出的短句里选一句');
  }
  return { key: source.messageKey };
}

// 自己写的话先过微信内容安全检查：没通过是 400，检查服务出错或超时是 503。两种情况都不占当天的名额
async function checkCustomGift(userId, text) {
  const sender = await User.findById(userId).select('nickname openid').lean();
  try {
    await contentSecurity.checkText({ openid: sender && sender.openid, content: text });
  } catch (error) {
    if (error && error.code === contentSecurity.CONTENT_RISKY) {
      throw buddyError('badRequest', 400, '这句话暂时送不出去，换一句试试');
    }
    throw buddyError('serviceUnavailable', 503, '暂时没法送自己写的话，先选一句预设的吧');
  }
  return sender;
}

function assertPeriodId(periodId) {
  if (typeof periodId !== 'string' || !OBJECT_ID_PATTERN.test(periodId)) {
    throw buddyError('badRequest', 400, '期次参数不正确');
  }
}

const str = value => (value == null ? '' : String(value));

function isDuplicateKey(error) {
  return !!error && (error.code === 11000 || error.code === 11001);
}

function dayRange(now) {
  const dayKey = toDayKey(now);
  const start = new Date(`${dayKey}T00:00:00+08:00`);
  return { dayKey, start, end: new Date(start.getTime() + DAY_MS) };
}

async function loadPeriodContext(userId, periodId) {
  assertPeriodId(periodId);
  const enrollment = await findCommunityEnrollment(userId, periodId);
  if (!enrollment || !['paid', 'free'].includes(enrollment.paymentStatus)) {
    throw buddyError('forbidden', 403, '报名这一期之后，才能找读伴');
  }
  const period = await Period.findById(periodId).select('name title status startDate endDate').lean();
  if (!period) {
    throw buddyError('notFound', 404, '没有找到这一期');
  }
  return { ongoing: calculatePeriodStatus(period) === 'ongoing', period };
}

function findActivePair(userId, periodId) {
  return BuddyPair.findOne({ periodId, members: userId, active: true }).lean();
}

async function listBlockedUserIds(userId, periodId) {
  const ended = await BuddyPair.find({ periodId, members: userId, active: false })
    .select('members')
    .lean();
  const ids = new Set();
  (ended || []).forEach(pair =>
    (pair.members || []).forEach(m => {
      if (str(m) !== str(userId)) ids.add(str(m));
    })
  );
  return Array.from(ids);
}

async function loadTodayStatus(userIds, periodId, now) {
  const { start, end } = dayRange(now);
  const [completions, checkins] = await Promise.all([
    UserReadingCompletion.find({ userId: { $in: userIds }, periodId, completedAt: { $gte: start, $lt: end } })
      .select('userId')
      .lean(),
    Checkin.find({ userId: { $in: userIds }, periodId, checkinDate: { $gte: start, $lt: end } })
      .select('userId')
      .lean()
  ]);
  const checked = new Set((checkins || []).map(c => str(c.userId)));
  const read = new Set((completions || []).map(c => str(c.userId)));
  const result = {};
  userIds.forEach(id => {
    const key = str(id);
    result[key] = { checkedInToday: checked.has(key), readToday: read.has(key) || checked.has(key) };
  });
  return result;
}

function dayKeyDiff(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

function addDays(dayKey, n) {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function emptyState() {
  return {
    state: 'none',
    buddy: null,
    canNudge: false,
    nudgedToday: false,
    canJoin: false,
    me: { readToday: false, checkedInToday: false },
    periodName: '',
    pairedDay: 0,
    bothDone: false,
    canHighFive: false,
    highFivedToday: false,
    buddyHighFivedToday: false,
    canGift: false,
    giftSentToday: '',
    giftFromBuddy: null,
    giftOptions: [],
    buddyCheckinToday: null,
    buddyReactionToday: null,
    invitesReceived: [],
    invitesSent: [],
    discoverable: true,
    waitingCount: 0
  };
}

function periodDisplayName(period) {
  return (period && (period.name || period.title)) || '';
}

// 我收到的、我发出的邀请（只带昵称头像，不带用户 ID）。
// 超过 7 天没回复的不再显示；婉拒的结果给邀请人留一天，写成「TA 这次先不了」
async function loadInvites(userId, periodId, now = new Date()) {
  const freshSince = new Date(now.getTime() - INVITE_TTL_MS);
  const declinedSince = new Date(now.getTime() - DECLINED_VISIBLE_MS);
  const [received, sentPending, sentDeclined, me] = await Promise.all([
    BuddyInvite.find({ periodId, toUserId: userId, status: 'pending', createdAt: { $gte: freshSince } }).lean(),
    BuddyInvite.find({ periodId, fromUserId: userId, status: 'pending', createdAt: { $gte: freshSince } }).lean(),
    BuddyInvite.find({ periodId, fromUserId: userId, status: 'declined', updatedAt: { $gte: declinedSince } }).lean(),
    User.findById(userId).select('buddyHidden').lean()
  ]);
  const receivedRows = received || [];
  const sentRows = [...(sentPending || []), ...(sentDeclined || [])];
  // 一次批量取出所有相关的人，不再每条邀请各查一次
  const peopleIds = [...new Set([...receivedRows.map(i => str(i.fromUserId)), ...sentRows.map(i => str(i.toUserId))])];
  const people = peopleIds.length
    ? (await User.find({ _id: { $in: peopleIds } }).select('nickname avatar avatarUrl').lean()) || []
    : [];
  const byId = people.reduce((all, user) => ({ ...all, [str(user._id)]: user }), {});
  const describe = id => {
    const user = byId[str(id)];
    return {
      nickname: (user && user.nickname) || '书友',
      avatar: (user && user.avatar) || '',
      avatarUrl: (user && user.avatarUrl) || ''
    };
  };
  return {
    invitesReceived: receivedRows.map(item => ({ inviteId: str(item._id), ...describe(item.fromUserId) })),
    invitesSent: sentRows.map(item => ({ inviteId: str(item._id), status: item.status, ...describe(item.toUserId) })),
    discoverable: !(me && me.buddyHidden)
  };
}

// 等待中的其他书友人数：让人知道不是在空等
async function countWaiting(userId, periodId) {
  const rows = await BuddyRequest.find({ periodId, status: 'waiting', userId: { $nin: [userId] } })
    .select('_id')
    .lean();
  return (rows || []).length;
}

async function buildStateWithBuddyId(userId, periodId, ongoing, now, period) {
  const pair = await findActivePair(userId, periodId);
  if (pair && ongoing) {
    const buddyId = (pair.members || []).map(str).find(id => id !== str(userId)) || str(pair.userA === userId ? pair.userB : pair.userA);
    const [status, buddyUser] = await Promise.all([
      loadTodayStatus([userId, buddyId], periodId, now),
      User.findById(buddyId).select('nickname avatar avatarUrl').lean()
    ]);
    const { dayKey } = dayRange(now);
    const nudgedToday = (pair.nudgeLog || []).some(n => str(n.userId) === str(userId) && n.dayKey === dayKey);
    const buddyStatus = status[str(buddyId)];
    const myStatus = status[str(userId)];
    const bothDone = !!(myStatus.readToday && buddyStatus.readToday);
    const highFives = pair.highFiveLog || [];
    const highFivedToday = highFives.some(n => str(n.userId) === str(userId) && n.dayKey === dayKey);
    const buddyHighFivedToday = highFives.some(n => str(n.userId) === str(buddyId) && n.dayKey === dayKey);
    const gifts = pair.gifts || [];
    const mineGift = gifts.find(g => str(g.userId) === str(userId) && g.dayKey === dayKey);
    const buddyGift = gifts.find(g => str(g.userId) === str(buddyId) && g.dayKey === dayKey);
    const pairStartKey = pair.createdAt ? toDayKey(pair.createdAt) : dayKey;
    const { start: dayStart, end: dayEnd } = dayRange(now);
    const buddyCheckinsToday = (
      (await Checkin.find({ userId: buddyId, periodId, isPublic: true, checkinDate: { $gte: dayStart, $lt: dayEnd } })
        .select('_id sectionId')
        .lean()) || []
    ).filter(item => item && item._id);
    const reactedByMe = buddyCheckinsToday.length
      ? ((await BuddyReaction.find({ fromUserId: userId, checkinId: { $in: buddyCheckinsToday.map(item => item._id) } })
          .select('checkinId')
          .lean()) || []).map(item => str(item.checkinId))
      : [];
    const freshCheckin = buddyCheckinsToday.find(item => !reactedByMe.includes(str(item._id)));
    const reactionToMe = await BuddyReaction.findOne({ periodId, toUserId: userId, dayKey }).lean();
    const state = {
      state: 'paired',
      buddyCheckinToday: freshCheckin
        ? { checkinId: str(freshCheckin._id), sectionId: str(freshCheckin.sectionId) }
        : null,
      buddyReactionToday: reactionToMe && REACTION_MESSAGES[reactionToMe.key]
        ? { text: REACTION_MESSAGES[reactionToMe.key] }
        : null,
      periodName: periodDisplayName(period),
      pairedDay: Math.max(1, dayKeyDiff(pairStartKey, dayKey) + 1),
      bothDone,
      canHighFive: bothDone && !highFivedToday,
      highFivedToday,
      buddyHighFivedToday,
      canGift: !mineGift,
      giftSentToday: giftText(mineGift),
      giftFromBuddy: giftText(buddyGift) ? { text: giftText(buddyGift) } : null,
      giftOptions: giftOptionsFor(userId, dayKey),
      waitingCount: 0,
      buddy: {
        nickname: (buddyUser && buddyUser.nickname) || '读伴',
        avatar: (buddyUser && buddyUser.avatar) || '',
        avatarUrl: (buddyUser && buddyUser.avatarUrl) || '',
        readToday: buddyStatus.readToday,
        checkedInToday: buddyStatus.checkedInToday
      },
      canNudge: !nudgedToday && !buddyStatus.readToday && !buddyStatus.checkedInToday,
      nudgedToday,
      canJoin: false,
      me: myStatus
    };
    return { state, buddyId };
  }

  const mine = await loadTodayStatus([userId], periodId, now);
  const me = mine[str(userId)];
  const periodName = periodDisplayName(period);
  if (pair && !ongoing) return { state: { ...emptyState(), state: 'ended', me, periodName } };

  const invites = ongoing ? await loadInvites(userId, periodId, now) : { invitesReceived: [], invitesSent: [], discoverable: true };
  const waiting = ongoing && (await BuddyRequest.findOne({ periodId, userId, status: 'waiting' }).lean());
  if (waiting) {
    return { state: { ...emptyState(), ...invites, state: 'waiting', canJoin: ongoing, me, periodName, waitingCount: await countWaiting(userId, periodId) } };
  }

  const ended = await BuddyPair.findOne({ periodId, members: userId, active: false }).select('_id').lean();
  const waitingCount = ongoing ? await countWaiting(userId, periodId) : 0;
  if (ended) return { state: { ...emptyState(), ...invites, state: 'ended', canJoin: ongoing, me, periodName, waitingCount } };
  return { state: { ...emptyState(), ...invites, canJoin: ongoing, me, periodName, waitingCount } };
}

async function buildState(userId, periodId, ongoing, now, period) {
  return (await buildStateWithBuddyId(userId, periodId, ongoing, now, period)).state;
}

async function getState(userId, periodId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  return buildState(userId, periodId, ongoing, now, period);
}

function excerptText(value, max = 100) {
  const text = String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
}

function activityDays(rows, field) {
  return new Set((rows || []).map(item => toDayKey(item[field])).filter(Boolean));
}

function daysRemaining(endDate, now) {
  if (!endDate) return 0;
  const end = toDayKey(endDate);
  const today = toDayKey(now);
  if (!end || !today) return 0;
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS));
}

// 两人之间的回应（双方互相回应过的打卡）
async function loadPairReactions(periodId, userId, buddyId) {
  const rows = (await BuddyReaction.find({ periodId, fromUserId: { $in: [userId, buddyId] } }).lean()) || [];
  const pair = [str(userId), str(buddyId)];
  return rows.filter(item => pair.includes(str(item.fromUserId)) && pair.includes(str(item.toUserId)));
}

function otherMemberId(pair, userId) {
  return (pair.members || []).map(str).find(id => id !== str(userId)) || str(pair.userA === userId ? pair.userB : pair.userA);
}

async function loadActiveDays(userId, periodId) {
  const [completions, checkins] = await Promise.all([
    UserReadingCompletion.find({ userId, periodId, completedAt: { $ne: null } }).select('completedAt').lean(),
    Checkin.find({ userId, periodId }).select('checkinDate').lean()
  ]);
  return new Set([...activityDays(completions, 'completedAt'), ...activityDays(checkins, 'checkinDate')]);
}

// 期次每天一格：一起 / 只有我 / 只有 TA / 没有；结伴之前的日子记为 before
function buildTrail(period, pairStartKey, mineDays, buddyDays, todayKey) {
  const startKey = period && period.startDate ? toDayKey(period.startDate) : '';
  const endKey = period && period.endDate ? toDayKey(period.endDate) : '';
  if (!startKey || !endKey) return [];
  const total = Math.min(TRAIL_MAX_DAYS, Math.max(0, dayKeyDiff(startKey, endKey)) + 1);
  const trail = [];
  for (let i = 0; i < total; i += 1) {
    const key = addDays(startKey, i);
    const mine = mineDays.has(key);
    const buddy = buddyDays.has(key);
    let status = 'none';
    if (key < pairStartKey) status = 'before';
    else if (mine && buddy) status = 'both';
    else if (mine) status = 'me';
    else if (buddy) status = 'ta';
    trail.push({ day: i + 1, dayKey: key, status, isToday: key === todayKey, future: key > todayKey });
  }
  return trail;
}

function buildTimeline({ pair, userId, buddyName, pairStartKey, sharedList, reactions = [] }) {
  const name = buddyName || 'TA';
  const events = [];
  events.push({ type: 'paired', date: pairStartKey, at: pair.createdAt ? new Date(pair.createdAt).getTime() : 0, text: '你们成为读伴' });
  if (sharedList.length) {
    events.push({ type: 'first', date: sharedList[0], at: 0, text: '第一次在同一天读完' });
  }
  const byDay = {};
  (pair.highFiveLog || []).forEach(item => {
    const day = byDay[item.dayKey] || (byDay[item.dayKey] = { mine: false, buddy: false, at: 0 });
    if (str(item.userId) === str(userId)) day.mine = true;
    else day.buddy = true;
    day.at = Math.max(day.at, item.at ? new Date(item.at).getTime() : 0);
  });
  Object.keys(byDay).forEach(dayKey => {
    const day = byDay[dayKey];
    const text = day.mine && day.buddy ? '你们击了个掌' : day.mine ? `你向${name}击了个掌` : `${name}向你击了个掌`;
    events.push({ type: 'highfive', date: dayKey, at: day.at, text });
  });
  (pair.gifts || []).forEach(gift => {
    const text = giftText(gift);
    if (!text) return;
    const mine = str(gift.userId) === str(userId);
    events.push({
      type: 'gift',
      date: gift.dayKey,
      at: gift.at ? new Date(gift.at).getTime() : 0,
      text: mine ? `你送了${name}一句：「${text}」` : `${name}送你一句：「${text}」`
    });
  });
  reactions.forEach(item => {
    const text = REACTION_MESSAGES[item.key];
    if (!text) return;
    const mine = str(item.fromUserId) === str(userId);
    events.push({
      type: 'reaction',
      date: item.dayKey,
      at: item.createdAt ? new Date(item.createdAt).getTime() : 0,
      text: mine ? `你回应了${name}的打卡：「${text}」` : `${name}回应了你的打卡：「${text}」`
    });
  });
  return events
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.at - a.at))
    .slice(0, TIMELINE_MAX_ITEMS)
    .map(({ type, date, text }) => ({ type, date, text }));
}

async function getOverview(userId, periodId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  const pair = await findActivePair(userId, periodId);
  if (!pair || !ongoing) throw buddyError('badRequest', 400, '你现在还没有进行中的读伴');

  const buddyId = otherMemberId(pair, userId);
  const [checkins, insights, mineDays, buddyDays, buddyUser, reactions] = await Promise.all([
    Checkin.find({ userId: buddyId, periodId, isPublic: true })
      .select('_id sectionId day checkinDate note contentHtml mood')
      .sort({ checkinDate: -1 })
      .limit(5)
      .populate('sectionId', 'title day')
      .lean(),
    Insight.find({ targetUserId: buddyId, periodId, type: 'insight', status: 'completed', isPublished: true })
      .select('_id title content createdAt sectionId')
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('sectionId', 'title day')
      .lean(),
    loadActiveDays(userId, periodId),
    loadActiveDays(buddyId, periodId),
    User.findById(buddyId).select('nickname').lean(),
    loadPairReactions(periodId, userId, buddyId)
  ]);

  const todayKey = toDayKey(now);
  const pairStartKey = pair.createdAt ? toDayKey(pair.createdAt) : todayKey;
  const myReactionByCheckin = {};
  reactions.forEach(item => {
    if (str(item.fromUserId) === str(userId)) myReactionByCheckin[str(item.checkinId)] = REACTION_MESSAGES[item.key] || '';
  });
  const sharedList = [...mineDays].filter(day => buddyDays.has(day) && day >= pairStartKey).sort();
  const highFiveDays = new Set((pair.highFiveLog || []).map(item => item.dayKey));

  return {
    periodName: periodDisplayName(period),
    daysRemaining: daysRemaining(period.endDate, now),
    pairStartedAt: pair.createdAt || null,
    sharedDays: sharedList.length,
    highFiveCount: highFiveDays.size,
    giftCount: (pair.gifts || []).length,
    trail: buildTrail(period, pairStartKey, mineDays, buddyDays, todayKey),
    reactionCount: reactions.length,
    timeline: buildTimeline({ pair, userId, buddyName: buddyUser && buddyUser.nickname, pairStartKey, sharedList, reactions }),
    publicCheckins: (checkins || []).map(item => ({
      checkinId: str(item._id),
      sectionId: item.sectionId?._id ? String(item.sectionId._id) : str(item.sectionId),
      sectionTitle: item.sectionId?.title || '',
      day: item.day ?? item.sectionId?.day ?? null,
      date: item.checkinDate ? toDayKey(item.checkinDate) : '',
      excerpt: excerptText(item.contentHtml || item.note || ''),
      mood: readTrustedMood(item) || '',
      // 我回应过 TA 的这一篇吗；今天写的、还没回应的标为新
      myReaction: myReactionByCheckin[str(item._id)] || '',
      isNew: !!item.checkinDate && toDayKey(item.checkinDate) === todayKey && !myReactionByCheckin[str(item._id)]
    })),
    publicInsights: (insights || []).map(item => ({
      insightId: str(item._id),
      title: item.title || item.sectionId?.title || '小凡看见',
      date: item.createdAt ? toDayKey(item.createdAt) : '',
      excerpt: excerptText(item.content || '')
    }))
  };
}

async function releaseClaim(requestId) {
  try {
    await BuddyRequest.updateOne({ _id: requestId, status: 'matched' }, { $set: { status: 'waiting' } });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    // 本人已另有一条等待记录，旧的作废，避免留下重复等待
    await BuddyRequest.updateOne({ _id: requestId }, { $set: { status: 'cancelled' } });
  }
}

async function tryRematch(userId, periodId, tenantId, blocked) {
  const previous = await BuddyPair.find({ members: userId, periodId: { $ne: periodId } }).lean();
  for (const pair of previous || []) {
    const members = (pair.members || []).map(str);
    const votes = new Set((pair.rematchVotes || []).map(str));
    if (!members.length || !members.every(id => votes.has(id))) continue;
    const partnerId = members.find(id => id !== str(userId));
    if (!partnerId || blocked.includes(partnerId)) continue;
    const enrollment = await findCommunityEnrollment(partnerId, periodId);
    if (!enrollment || !['paid', 'free'].includes(enrollment.paymentStatus)) continue;
    if (await findActivePair(partnerId, periodId)) continue;
    try {
      await BuddyPair.create({
        tenantId,
        periodId,
        userA: partnerId,
        userB: userId,
        members: [partnerId, userId],
        active: true
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      continue;
    }
    await BuddyRequest.updateMany(
      { periodId, userId: { $in: [userId, partnerId] }, status: 'waiting' },
      { $set: { status: 'matched' } }
    );
    return true;
  }
  return false;
}

async function join(userId, periodId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中，暂时不能找读伴');

  if (await findActivePair(userId, periodId)) return buildState(userId, periodId, ongoing, now, period);

  const tenantId = getCurrentTenantId();
  const blocked = await listBlockedUserIds(userId, periodId);

  // 上一期双方都点过「下一期还做读伴」，并且对方也在这一期里：直接配成一对
  if (await tryRematch(userId, periodId, tenantId, blocked)) return buildState(userId, periodId, ongoing, now, period);

  // 先登记自己的等待，再按 _id 全序只与“更早的”等待者配对，两个人同时加入也只会有一方出手
  let mine;
  try {
    mine = await BuddyRequest.findOneAndUpdate(
      { periodId, userId, status: 'waiting' },
      { $setOnInsert: { tenantId, periodId, userId, status: 'waiting' } },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    mine = await BuddyRequest.findOne({ periodId, userId, status: 'waiting' });
  }
  if (!mine) return buildState(userId, periodId, ongoing, now, period);

  for (let attempt = 0; attempt < MAX_MATCH_ATTEMPTS; attempt += 1) {
    const other = await BuddyRequest.findOneAndUpdate(
      {
        periodId,
        status: 'waiting',
        _id: { $lt: mine._id },
        userId: { $nin: [userId, ...blocked] }
      },
      { $set: { status: 'matched' } },
      { sort: { _id: 1 }, new: true }
    );
    if (!other) break;

    const claimedMine = await BuddyRequest.findOneAndUpdate(
      { _id: mine._id, status: 'waiting' },
      { $set: { status: 'matched' } },
      { new: true }
    );
    if (!claimedMine) {
      await releaseClaim(other._id);
      break;
    }

    try {
      await BuddyPair.create({
        tenantId,
        periodId,
        userA: other.userId,
        userB: userId,
        members: [other.userId, userId],
        active: true
      });
      break;
    } catch (error) {
      if (!isDuplicateKey(error)) {
        await releaseClaim(mine._id);
        await releaseClaim(other._id);
        throw error;
      }
      if (await findActivePair(userId, periodId)) {
        // 自己其实已在别的一对里：自己的申请已用掉，不能再回到等待
        await releaseClaim(other._id);
        break;
      }
      await releaseClaim(mine._id);
      // 对方已在别的一对里，申请作废，换下一位
      await BuddyRequest.updateOne({ _id: other._id }, { $set: { status: 'cancelled' } });
    }
  }

  return buildState(userId, periodId, ongoing, now, period);
}

async function cancel(userId, periodId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  await BuddyRequest.updateMany({ periodId, userId, status: 'waiting' }, { $set: { status: 'cancelled' } });
  return buildState(userId, periodId, ongoing, now, period);
}

async function leave(userId, periodId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  await BuddyPair.findOneAndUpdate(
    { periodId, members: userId, active: true },
    { $set: { active: false, endedAt: now, endedBy: userId } }
  );
  return buildState(userId, periodId, ongoing, now, period);
}

async function nudge(userId, periodId, now = new Date(), messageKey = 'together') {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中');
  const pair = await findActivePair(userId, periodId);
  if (!pair) throw buddyError('badRequest', 400, '你现在还没有读伴');

  const { state, buddyId } = await buildStateWithBuddyId(userId, periodId, ongoing, now, period);
  if (state.buddy.readToday || state.buddy.checkedInToday) {
    throw buddyError('badRequest', 400, 'TA 今天已经读过了');
  }
  if (state.nudgedToday) throw buddyError('badRequest', 400, '今天已经拍过了');

  const { dayKey } = dayRange(now);
  const claimed = await BuddyPair.updateOne(
    {
      _id: pair._id,
      active: true,
      nudgeLog: { $not: { $elemMatch: { userId, dayKey } } }
    },
    { $push: { nudgeLog: { userId, dayKey } } }
  );
  const modified = claimed && (claimed.modifiedCount != null ? claimed.modifiedCount : claimed.nModified);
  if (!modified) throw buddyError('badRequest', 400, '今天已经拍过了');

  const sender = await User.findById(userId).select('nickname').lean();
  const safeMessageKey = Object.prototype.hasOwnProperty.call(NUDGE_MESSAGES, messageKey)
    ? messageKey
    : 'together';
  return {
    buddyUserId: buddyId,
    senderName: (sender && sender.nickname) || '你的读伴',
    nudgeText: NUDGE_MESSAGES[safeMessageKey],
    state: { ...state, canNudge: false, nudgedToday: true }
  };
}

async function highFive(userId, periodId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中');
  const pair = await findActivePair(userId, periodId);
  if (!pair) throw buddyError('badRequest', 400, '你现在还没有读伴');

  const { state, buddyId } = await buildStateWithBuddyId(userId, periodId, ongoing, now, period);
  if (!state.bothDone) throw buddyError('badRequest', 400, '要等你们都读完，才能击掌');
  if (state.highFivedToday) throw buddyError('badRequest', 400, '今天已经击过掌了');

  const { dayKey } = dayRange(now);
  const claimed = await BuddyPair.updateOne(
    { _id: pair._id, active: true, highFiveLog: { $not: { $elemMatch: { userId, dayKey } } } },
    { $push: { highFiveLog: { userId, dayKey, at: now } } }
  );
  const modified = claimed && (claimed.modifiedCount != null ? claimed.modifiedCount : claimed.nModified);
  if (!modified) throw buddyError('badRequest', 400, '今天已经击过掌了');

  const sender = await User.findById(userId).select('nickname').lean();
  return {
    buddyUserId: buddyId,
    senderName: (sender && sender.nickname) || '你的读伴',
    state: { ...state, canHighFive: false, highFivedToday: true }
  };
}

// 送一句：input 是预设短句的 key（字符串），或 { messageKey, text } 二选一（text 是自己写的话）
async function gift(userId, periodId, input, now = new Date()) {
  const choice = parseGiftInput(input);
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中');
  const pair = await findActivePair(userId, periodId);
  if (!pair) throw buddyError('badRequest', 400, '你现在还没有读伴');

  const { state, buddyId } = await buildStateWithBuddyId(userId, periodId, ongoing, now, period);
  if (!state.canGift) throw buddyError('badRequest', 400, '今天已经送过一句了');

  // 自己写的话：先过内容安全检查，再占名额。检查没通过或检查不了，都不占名额，用户可以改一句再送
  const custom = choice.text !== undefined;
  const sender = custom ? await checkCustomGift(userId, choice.text) : null;
  const entry = custom ? { key: CUSTOM_GIFT_KEY, text: choice.text } : { key: choice.key };
  const text = custom ? choice.text : GIFT_MESSAGES[choice.key];

  const { dayKey } = dayRange(now);
  const claimed = await BuddyPair.updateOne(
    { _id: pair._id, active: true, gifts: { $not: { $elemMatch: { userId, dayKey } } } },
    { $push: { gifts: { userId, dayKey, ...entry, at: now } } }
  );
  const modified = claimed && (claimed.modifiedCount != null ? claimed.modifiedCount : claimed.nModified);
  if (!modified) throw buddyError('badRequest', 400, '今天已经送过一句了');

  const senderDoc = sender || (await User.findById(userId).select('nickname').lean());
  return {
    buddyUserId: buddyId,
    senderName: (senderDoc && senderDoc.nickname) || '你的读伴',
    giftText: text,
    state: { ...state, canGift: false, giftSentToday: text }
  };
}

// 一批邀请当前的状态（来信页据此显示已同意 / 已婉拒）
async function getInviteStatuses(inviteIds, now = new Date()) {
  const ids = (inviteIds || []).map(str).filter(id => OBJECT_ID_PATTERN.test(id));
  if (!ids.length) return {};
  const rows = (await BuddyInvite.find({ _id: { $in: ids } }).select('status createdAt').lean()) || [];
  const cutoff = now.getTime() - INVITE_TTL_MS;
  return rows.reduce((all, row) => {
    const stale = row.status === 'pending' && row.createdAt && new Date(row.createdAt).getTime() < cutoff;
    return { ...all, [str(row._id)]: stale ? 'expired' : row.status };
  }, {});
}

// 这位用户在这一期的读伴（没有返回 null），供打卡列表、通知等标记「读伴」用
async function getActiveBuddyId(userId, periodId) {
  if (!userId || !periodId) return null;
  const pair = await findActivePair(userId, periodId);
  return pair ? otherMemberId(pair, userId) : null;
}

// 一批期次里所有有效读伴关系：key 为「期次:用户」，值为对方的用户 ID
async function getBuddyMap(periodIds) {
  const ids = [...new Set((periodIds || []).map(str).filter(id => OBJECT_ID_PATTERN.test(id)))];
  const map = new Map();
  if (!ids.length) return map;
  const pairs = (await BuddyPair.find({ periodId: { $in: ids }, active: true }).select('periodId members').lean()) || [];
  pairs.forEach(pair => {
    const members = (pair.members || []).map(str);
    if (members.length !== 2) return;
    map.set(`${str(pair.periodId)}:${members[0]}`, members[1]);
    map.set(`${str(pair.periodId)}:${members[1]}`, members[0]);
  });
  return map;
}

async function areBuddies(userA, userB) {
  if (!userA || !userB) return false;
  const pair = await BuddyPair.findOne({ members: { $all: [userA, userB] }, active: true }).select('_id').lean();
  return !!pair;
}

async function getCheckinReaction(checkinId) {
  if (!checkinId) return null;
  const row = await BuddyReaction.findOne({ checkinId }).lean();
  if (!row || !REACTION_MESSAGES[row.key]) return null;
  return { text: REACTION_MESSAGES[row.key], fromUserId: str(row.fromUserId) };
}

async function react(userId, periodId, checkinId, messageKey, now = new Date()) {
  if (!Object.prototype.hasOwnProperty.call(REACTION_MESSAGES, messageKey)) {
    throw buddyError('badRequest', 400, '请从给出的短句里选一句');
  }
  if (typeof checkinId !== 'string' || !OBJECT_ID_PATTERN.test(checkinId)) {
    throw buddyError('badRequest', 400, '打卡参数不正确');
  }
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中');
  const pair = await findActivePair(userId, periodId);
  if (!pair) throw buddyError('badRequest', 400, '你现在还没有读伴');
  const buddyId = otherMemberId(pair, userId);

  const checkin = await Checkin.findOne({ _id: checkinId, userId: buddyId, periodId }).select('_id sectionId isPublic').lean();
  if (!checkin || checkin.isPublic === false) throw buddyError('notFound', 404, '没有找到 TA 的这一篇打卡');

  const { dayKey } = dayRange(now);
  try {
    await BuddyReaction.create({
      tenantId: getCurrentTenantId(),
      periodId,
      checkinId,
      fromUserId: userId,
      toUserId: buddyId,
      key: messageKey,
      dayKey
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw buddyError('badRequest', 400, '这一篇已经回应过了');
    throw error;
  }

  const [sender, { state }] = await Promise.all([
    User.findById(userId).select('nickname').lean(),
    buildStateWithBuddyId(userId, periodId, ongoing, now, period)
  ]);
  return {
    buddyUserId: buddyId,
    senderName: (sender && sender.nickname) || '你的读伴',
    reactionText: REACTION_MESSAGES[messageKey],
    checkinId,
    sectionId: str(checkin.sectionId),
    state
  };
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 本期可以邀请的学员：已报名并有社群权限、还没有读伴、没有选择「不出现在名单里」、不是自己；可按昵称搜。
// 排序：最近 3 天读过的在前，再按连续读的天数，最后按昵称；分页返回
async function listCandidates(userId, periodId, { q = '', page = 1 } = {}, now = new Date()) {
  const { ongoing } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中，暂时不能邀请读伴');

  const freshSince = new Date(now.getTime() - INVITE_TTL_MS);
  const [enrollments, pairs, sent, waiting] = await Promise.all([
    Enrollment.find({
      periodId,
      status: { $in: ['active', 'completed'] },
      paymentStatus: { $in: ['paid', 'free'] },
      deleted: { $ne: true }
    })
      .select('userId')
      .lean(),
    BuddyPair.find({ periodId, active: true }).select('members').lean(),
    BuddyInvite.find({ periodId, fromUserId: userId, status: 'pending', createdAt: { $gte: freshSince } }).select('toUserId').lean(),
    BuddyRequest.find({ periodId, status: 'waiting' }).select('userId').lean()
  ]);
  const taken = new Set();
  (pairs || []).forEach(pair => (pair.members || []).forEach(id => taken.add(str(id))));
  const invited = new Set((sent || []).map(item => str(item.toUserId)));
  const waitingSet = new Set((waiting || []).map(item => str(item.userId)));
  const ids = (enrollments || []).map(item => str(item.userId)).filter(id => id && id !== str(userId) && !taken.has(id));
  if (!ids.length) return { list: [], hasMore: false };

  const query = { _id: { $in: ids }, buddyHidden: { $ne: true } };
  const keyword = String(q || '').trim().slice(0, 20);
  if (keyword) query.nickname = { $regex: escapeRegExp(keyword), $options: 'i' };
  const users =
    (await User.find(query).select('nickname avatar avatarUrl currentStreak').limit(CANDIDATE_SCAN_LIMIT).lean()) || [];
  if (!users.length) return { list: [], hasMore: false };

  // 最近 3 天读过的人
  const recent = new Set(
    (
      (await UserReadingCompletion.find({
        periodId,
        userId: { $in: users.map(user => str(user._id)) },
        completedAt: { $gte: new Date(now.getTime() - RECENT_ACTIVE_MS) }
      })
        .select('userId')
        .lean()) || []
    ).map(row => str(row.userId))
  );

  const ranked = users
    .map(user => ({
      userId: str(user._id),
      nickname: user.nickname || '书友',
      avatar: user.avatar || '',
      avatarUrl: user.avatarUrl || '',
      streak: Math.max(0, Number(user.currentStreak) || 0),
      recentlyActive: recent.has(str(user._id)),
      waiting: waitingSet.has(str(user._id)),
      invited: invited.has(str(user._id))
    }))
    .sort(
      (a, b) =>
        Number(b.recentlyActive) - Number(a.recentlyActive) ||
        b.streak - a.streak ||
        a.nickname.localeCompare(b.nickname, 'zh-Hans-CN')
    );
  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const start = (pageNumber - 1) * CANDIDATE_PAGE_SIZE;
  return { list: ranked.slice(start, start + CANDIDATE_PAGE_SIZE), hasMore: ranked.length > start + CANDIDATE_PAGE_SIZE };
}

async function invite(userId, periodId, targetUserId, now = new Date()) {
  if (typeof targetUserId !== 'string' || !OBJECT_ID_PATTERN.test(targetUserId)) {
    throw buddyError('badRequest', 400, '请先选一位书友');
  }
  if (str(targetUserId) === str(userId)) throw buddyError('badRequest', 400, '不能邀请自己');
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中，暂时不能邀请读伴');
  if (await findActivePair(userId, periodId)) {
    throw buddyError('badRequest', 400, '你现在已经有读伴了，先结束这一段再邀请别人');
  }

  const target = await findCommunityEnrollment(targetUserId, periodId);
  if (!target || !['paid', 'free'].includes(target.paymentStatus)) {
    throw buddyError('notFound', 404, '这位书友不在这一期里');
  }
  if (await findActivePair(targetUserId, periodId)) throw buddyError('badRequest', 400, 'TA 已经有读伴了');
  const targetUser = await User.findById(targetUserId).select('buddyHidden').lean();
  if (targetUser && targetUser.buddyHidden) throw buddyError('badRequest', 400, 'TA 暂时不接受读伴邀请');

  // 超过 7 天没回复的旧邀请先标为过期，不再占名额，也不挡住重新邀请
  const freshSince = new Date(now.getTime() - INVITE_TTL_MS);
  await BuddyInvite.updateMany(
    { periodId, fromUserId: userId, status: 'pending', createdAt: { $lt: freshSince } },
    { $set: { status: 'expired' } }
  );

  // 对方已经邀请过我：直接当作同意
  const reverse = await BuddyInvite.findOne({ periodId, fromUserId: targetUserId, toUserId: userId, status: 'pending', createdAt: { $gte: freshSince } }).lean();
  if (reverse) {
    const accepted = await respondInvite(userId, periodId, str(reverse._id), true, now);
    return { ...accepted, autoAccepted: true };
  }

  const pending = (await BuddyInvite.find({ periodId, fromUserId: userId, status: 'pending' }).lean()) || [];
  if (pending.some(item => str(item.toUserId) === str(targetUserId))) {
    throw buddyError('badRequest', 400, '已经邀请过 TA 了，等 TA 回复');
  }
  if (pending.length >= MAX_PENDING_INVITES) {
    throw buddyError('badRequest', 400, `同时最多邀请 ${MAX_PENDING_INVITES} 位，先等等回复吧`);
  }

  // 改走邀请后，原来的“等自动配对”登记就收掉，不再被自动配给陌生人
  await BuddyRequest.updateMany({ periodId, userId, status: 'waiting' }, { $set: { status: 'cancelled' } });

  let created;
  try {
    created = await BuddyInvite.create({
      tenantId: getCurrentTenantId(),
      periodId,
      fromUserId: userId,
      toUserId: targetUserId,
      status: 'pending'
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw buddyError('badRequest', 400, '已经邀请过 TA 了，等 TA 回复');
    throw error;
  }
  const [sender, state] = await Promise.all([
    User.findById(userId).select('nickname').lean(),
    buildState(userId, periodId, ongoing, now, period)
  ]);
  return {
    targetUserId: str(targetUserId),
    inviteId: str(created._id),
    senderName: (sender && sender.nickname) || '一位书友',
    state
  };
}

async function respondInvite(userId, periodId, inviteId, accept, now = new Date()) {
  if (typeof inviteId !== 'string' || !OBJECT_ID_PATTERN.test(inviteId)) {
    throw buddyError('badRequest', 400, '邀请参数不正确');
  }
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  const invitation = await BuddyInvite.findOne({ _id: inviteId, periodId, toUserId: userId, status: 'pending' }).lean();
  if (!invitation) throw buddyError('notFound', 404, '这条邀请已经处理过了');
  if (invitation.createdAt && new Date(invitation.createdAt).getTime() < now.getTime() - INVITE_TTL_MS) {
    await BuddyInvite.updateOne({ _id: inviteId }, { $set: { status: 'expired' } });
    throw buddyError('notFound', 404, '这条邀请已经过期了');
  }

  if (!accept) {
    await BuddyInvite.updateOne({ _id: inviteId }, { $set: { status: 'declined' } });
    return { declined: true, state: await buildState(userId, periodId, ongoing, now, period) };
  }

  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中，暂时不能结成读伴');
  const fromId = str(invitation.fromUserId);
  if (await findActivePair(userId, periodId)) {
    throw buddyError('badRequest', 400, '你现在已经有读伴了，先结束这一段再同意');
  }
  if (await findActivePair(fromId, periodId)) {
    await BuddyInvite.updateOne({ _id: inviteId }, { $set: { status: 'cancelled' } });
    throw buddyError('badRequest', 400, 'TA 已经有别的读伴了');
  }

  try {
    await BuddyPair.create({
      tenantId: getCurrentTenantId(),
      periodId,
      userA: fromId,
      userB: userId,
      members: [fromId, userId],
      active: true
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    await BuddyInvite.updateOne({ _id: inviteId }, { $set: { status: 'cancelled' } });
    throw buddyError('badRequest', 400, 'TA 已经有别的读伴了');
  }

  await BuddyInvite.updateOne({ _id: inviteId }, { $set: { status: 'accepted' } });
  // 两人都已结伴：各自其余待回复的邀请作废，等待中的随机申请也一并结束
  const both = [fromId, str(userId)];
  await BuddyInvite.updateMany({ periodId, fromUserId: { $in: both }, status: 'pending' }, { $set: { status: 'cancelled' } });
  await BuddyInvite.updateMany({ periodId, toUserId: { $in: both }, status: 'pending' }, { $set: { status: 'cancelled' } });
  await BuddyRequest.updateMany({ periodId, userId: { $in: both }, status: 'waiting' }, { $set: { status: 'matched' } });

  const [sender, state] = await Promise.all([
    User.findById(userId).select('nickname').lean(),
    buildState(userId, periodId, ongoing, now, period)
  ]);
  return { accepted: true, buddyUserId: fromId, senderName: (sender && sender.nickname) || '你的读伴', state };
}

// 是否出现在别人的读伴邀请名单里（默认出现）
async function setDiscoverable(userId, discoverable) {
  await User.updateOne({ _id: userId }, { $set: { buddyHidden: discoverable === false } });
  publishSyncEvent({
    type: 'update',
    collection: 'users',
    documentId: String(userId),
    data: { _id: userId }
  });
  return { discoverable: discoverable !== false };
}

async function cancelInvite(userId, periodId, inviteId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  await BuddyInvite.updateOne({ _id: inviteId, periodId, fromUserId: userId, status: 'pending' }, { $set: { status: 'cancelled' } });
  return buildState(userId, periodId, ongoing, now, period);
}

function pickLatestPair(pairs) {
  const list = pairs || [];
  return list.reduce((latest, pair) => {
    if (!latest) return pair;
    const a = latest.createdAt ? new Date(latest.createdAt).getTime() : 0;
    const b = pair.createdAt ? new Date(pair.createdAt).getTime() : 0;
    return b >= a ? pair : latest;
  }, null);
}

async function buildSouvenir(userId, periodId, pair, ongoing, period, now) {
  const buddyId = otherMemberId(pair, userId);
  const [mineDays, buddyDays, buddyUser] = await Promise.all([
    loadActiveDays(userId, periodId),
    loadActiveDays(buddyId, periodId),
    User.findById(buddyId).select('nickname avatar avatarUrl').lean()
  ]);
  const todayKey = toDayKey(now);
  const pairStartKey = pair.createdAt ? toDayKey(pair.createdAt) : todayKey;
  const periodEndKey = period && period.endDate ? toDayKey(period.endDate) : todayKey;
  let endKey = pair.endedAt ? toDayKey(pair.endedAt) : ongoing ? todayKey : periodEndKey;
  if (endKey > periodEndKey) endKey = periodEndKey;
  if (endKey < pairStartKey) endKey = pairStartKey;
  const sharedDays = [...mineDays].filter(day => buddyDays.has(day) && day >= pairStartKey && day <= endKey).length;
  const highFiveDays = new Set((pair.highFiveLog || []).map(item => item.dayKey));
  const reactionRows = await loadPairReactions(periodId, userId, buddyId);
  const gifts = pair.gifts || [];
  const received = gifts
    .filter(g => str(g.userId) !== str(userId) && giftText(g))
    .sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0))[0];
  const votes = new Set((pair.rematchVotes || []).map(str));
  const mine = votes.has(str(userId));
  const both = (pair.members || []).length > 0 && (pair.members || []).map(str).every(id => votes.has(id));
  return {
    periodName: periodDisplayName(period),
    ended: !pair.active || !ongoing,
    buddy: {
      nickname: (buddyUser && buddyUser.nickname) || '读伴',
      avatar: (buddyUser && buddyUser.avatar) || '',
      avatarUrl: (buddyUser && buddyUser.avatarUrl) || ''
    },
    pairStartedAt: pair.createdAt || null,
    endedAt: pair.endedAt || null,
    togetherDays: dayKeyDiff(pairStartKey, endKey) + 1,
    sharedDays,
    highFiveCount: highFiveDays.size,
    giftCount: gifts.length,
    reactionCount: reactionRows.length,
    firstGift: received ? { text: giftText(received) } : null,
    // 只告诉本人自己是否点过；对方点没点过，要双方都点了才会知道
    rematch: { mine, both },
    canRematch: !mine && !both
  };
}

async function getSouvenir(userId, periodId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  const pair = pickLatestPair(await BuddyPair.find({ periodId, members: userId }).lean());
  if (!pair) throw buddyError('badRequest', 400, '这一期你还没有读伴');
  return buildSouvenir(userId, periodId, pair, ongoing, period, now);
}

async function rematch(userId, periodId, now = new Date()) {
  const { ongoing, period } = await loadPeriodContext(userId, periodId);
  const pair = pickLatestPair(await BuddyPair.find({ periodId, members: userId }).lean());
  if (!pair) throw buddyError('badRequest', 400, '这一期你还没有读伴');
  const votes = (pair.rematchVotes || []).map(str);
  if (votes.includes(str(userId))) return buildSouvenir(userId, periodId, pair, ongoing, period, now);
  await BuddyPair.updateOne({ _id: pair._id }, { $push: { rematchVotes: userId } });
  return buildSouvenir(userId, periodId, { ...pair, rematchVotes: [...votes, userId] }, ongoing, period, now);
}

module.exports = {
  getState,
  getOverview,
  getSouvenir,
  join,
  cancel,
  leave,
  nudge,
  highFive,
  gift,
  rematch,
  react,
  listCandidates,
  invite,
  respondInvite,
  cancelInvite,
  setDiscoverable,
  getInviteStatuses,
  getActiveBuddyId,
  getBuddyMap,
  areBuddies,
  getCheckinReaction,
  NUDGE_MESSAGES,
  GIFT_MESSAGES,
  GIFT_TEXT_MAX,
  giftOptionsFor,
  REACTION_MESSAGES
};
