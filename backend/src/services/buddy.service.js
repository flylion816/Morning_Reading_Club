const BuddyPair = require('../models/BuddyPair');
const BuddyRequest = require('../models/BuddyRequest');
const Checkin = require('../models/Checkin');
const User = require('../models/User');
const Period = require('../models/Period');
const UserReadingCompletion = require('../models/UserReadingCompletion');
const { findCommunityEnrollment } = require('./community-access.service');
const { calculatePeriodStatus } = require('./period-status.service');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { toDayKey } = require('../utils/checkin-day-metrics');

const MAX_MATCH_ATTEMPTS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function buddyError(kind, status, message) {
  const error = new Error(message);
  error.isBuddyError = true;
  error.kind = kind;
  error.status = status;
  return error;
}

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

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
  const period = await Period.findById(periodId).select('status startDate endDate').lean();
  if (!period) {
    throw buddyError('notFound', 404, '没有找到这一期');
  }
  return { ongoing: calculatePeriodStatus(period) === 'ongoing' };
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

function emptyState() {
  return {
    state: 'none',
    buddy: null,
    canNudge: false,
    nudgedToday: false,
    canJoin: false,
    me: { readToday: false, checkedInToday: false }
  };
}

async function buildStateWithBuddyId(userId, periodId, ongoing, now) {
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
    const state = {
      state: 'paired',
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
      me: status[str(userId)]
    };
    return { state, buddyId };
  }

  const mine = await loadTodayStatus([userId], periodId, now);
  const me = mine[str(userId)];
  if (pair && !ongoing) return { state: { ...emptyState(), state: 'ended', me } };

  const waiting = ongoing && (await BuddyRequest.findOne({ periodId, userId, status: 'waiting' }).lean());
  if (waiting) return { state: { ...emptyState(), state: 'waiting', me } };

  const ended = await BuddyPair.findOne({ periodId, members: userId, active: false }).select('_id').lean();
  if (ended) return { state: { ...emptyState(), state: 'ended', canJoin: ongoing, me } };
  return { state: { ...emptyState(), canJoin: ongoing, me } };
}

async function buildState(userId, periodId, ongoing, now) {
  return (await buildStateWithBuddyId(userId, periodId, ongoing, now)).state;
}

async function getState(userId, periodId, now = new Date()) {
  const { ongoing } = await loadPeriodContext(userId, periodId);
  return buildState(userId, periodId, ongoing, now);
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

async function join(userId, periodId, now = new Date()) {
  const { ongoing } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中，暂时不能找读伴');

  if (await findActivePair(userId, periodId)) return buildState(userId, periodId, ongoing, now);

  const tenantId = getCurrentTenantId();
  const blocked = await listBlockedUserIds(userId, periodId);

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
  if (!mine) return buildState(userId, periodId, ongoing, now);

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

  return buildState(userId, periodId, ongoing, now);
}

async function cancel(userId, periodId, now = new Date()) {
  const { ongoing } = await loadPeriodContext(userId, periodId);
  await BuddyRequest.updateMany({ periodId, userId, status: 'waiting' }, { $set: { status: 'cancelled' } });
  return buildState(userId, periodId, ongoing, now);
}

async function leave(userId, periodId, now = new Date()) {
  const { ongoing } = await loadPeriodContext(userId, periodId);
  await BuddyPair.findOneAndUpdate(
    { periodId, members: userId, active: true },
    { $set: { active: false, endedAt: now, endedBy: userId } }
  );
  return buildState(userId, periodId, ongoing, now);
}

async function nudge(userId, periodId, now = new Date()) {
  const { ongoing } = await loadPeriodContext(userId, periodId);
  if (!ongoing) throw buddyError('badRequest', 400, '这一期不在进行中');
  const pair = await findActivePair(userId, periodId);
  if (!pair) throw buddyError('badRequest', 400, '你现在还没有读伴');

  const { state, buddyId } = await buildStateWithBuddyId(userId, periodId, ongoing, now);
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
  return {
    buddyUserId: buddyId,
    senderName: (sender && sender.nickname) || '你的读伴',
    state: { ...state, canNudge: false, nudgedToday: true }
  };
}

module.exports = { getState, join, cancel, leave, nudge };
