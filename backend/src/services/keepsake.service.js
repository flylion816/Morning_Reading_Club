/**
 * 「我的 23 天」纪念册聚合服务：一期一本册子。
 * 开营后就能翻（finished=false 表示还在进行中），结营后内容补齐。
 * 全部用 find + lean 在内存里算，只读，不新建数据表。
 */
const mongoose = require('mongoose');
const Period = require('../models/Period');
const Checkin = require('../models/Checkin');
const Comment = require('../models/Comment');
const Insight = require('../models/Insight');
const User = require('../models/User');
const UserReadingCompletion = require('../models/UserReadingCompletion');
const Section = require('../models/Section');
const logger = require('../utils/logger');
const { toDayKey, DEFAULT_TZ_OFFSET_MINUTES } = require('../utils/checkin-day-metrics');
const { readTrustedMood, MOOD_VALID_SINCE } = require('../utils/checkin-mood');

const EXCERPT_LENGTH = 80;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map();

function setCache(key, value, now) {
  const nowMs = now.getTime();
  cache.forEach((entry, k) => {
    if (entry.expiresAt <= nowMs) cache.delete(k);
  });
  cache.delete(key);
  while (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, expiresAt: nowMs + CACHE_TTL_MS });
}

function idStr(value) {
  if (!value) return '';
  return value._id ? String(value._id) : String(value);
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkinPlainText(checkin) {
  return stripTags(checkin.contentHtml || checkin.note || '');
}

function excerptOf(text, length = EXCERPT_LENGTH) {
  const chars = Array.from(String(text || ''));
  return chars.length > length ? `${chars.slice(0, length).join('')}…` : chars.join('');
}

function countWords(text) {
  return Array.from(String(text || '').replace(/\s+/g, '')).length;
}

function toHHmm(date) {
  const shifted = new Date(new Date(date).getTime() + DEFAULT_TZ_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().slice(11, 16);
}

/** 东八区自然日差：to 日 - from 日 */
function dayDiff(from, to) {
  const a = Date.parse(`${toDayKey(from)}T00:00:00Z`);
  const b = Date.parse(`${toDayKey(to)}T00:00:00Z`);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** 期次是否已到结营：状态为已结束，或今天已到最后一天 */
function resolveReadiness(period, now = new Date()) {
  const daysLeft = period.endDate ? Math.max(0, dayDiff(now, period.endDate)) : 0;
  const ready = period.status === 'completed' || (!!period.endDate && daysLeft === 0);
  return { ready, daysLeft: ready ? 0 : daysLeft };
}

/** 安全取用可能尚不存在的模型 */
function getOptionalModel(name) {
  try {
    return mongoose.models[name] || null;
  } catch (error) {
    return null;
  }
}

async function safely(label, fn, fallback) {
  try {
    const value = await fn();
    return value === undefined ? fallback : value;
  } catch (error) {
    logger.warn(`[keepsake] ${label} 聚合失败: ${error.message}`);
    return fallback;
  }
}

function pickTopCheckin(checkins, sectionMap) {
  const withText = checkins.filter(item => checkinPlainText(item));
  if (!withText.length) return null;
  const maxLikes = Math.max(...withText.map(item => item.likeCount || 0));
  let top;
  if (maxLikes > 0) {
    top = withText
      .filter(item => (item.likeCount || 0) === maxLikes)
      .sort((a, b) => new Date(a.checkinDate) - new Date(b.checkinDate))[0];
  } else {
    top = withText
      .slice()
      .sort((a, b) => checkinPlainText(b).length - checkinPlainText(a).length)[0];
  }
  const section = sectionMap[idStr(top.sectionId)];
  return {
    id: idStr(top._id),
    sectionTitle: (section && section.title) || '',
    day: top.day,
    excerpt: excerptOf(checkinPlainText(top)),
    likeCount: top.likeCount || 0
  };
}

function pickEarliest(checkins) {
  let best = null;
  checkins.forEach(item => {
    const time = new Date(item.createdAt || item.checkinDate);
    if (Number.isNaN(time.getTime())) return;
    const minutes = (time.getTime() / 60000 + DEFAULT_TZ_OFFSET_MINUTES) % 1440;
    if (!best || minutes < best.minutes) {
      best = { minutes, time: toHHmm(time), date: toDayKey(time) };
    }
  });
  return best ? { time: best.time, date: best.date } : null;
}

async function buildCompanions(userId, checkins) {
  const checkinIds = checkins.map(item => item._id);
  if (!checkinIds.length) return [];
  const me = idStr(userId);
  const counter = new Map();
  const bump = id => {
    const key = idStr(id);
    if (!key || key === me) return;
    counter.set(key, (counter.get(key) || 0) + 1);
  };

  checkins.forEach(item => (item.likes || []).forEach(like => bump(like.userId)));
  const comments = await Comment.find({ checkinId: { $in: checkinIds } })
    .select('userId replies.userId')
    .lean();
  comments.forEach(comment => {
    bump(comment.userId);
    (comment.replies || []).forEach(reply => bump(reply.userId));
  });

  const top = Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (!top.length) return [];
  const users = await User.find({ _id: { $in: top.map(([id]) => id) } })
    .select('nickname avatarUrl')
    .lean();
  const userMap = {};
  users.forEach(user => {
    userMap[idStr(user._id)] = user;
  });
  return top.map(([id, count]) => ({
    userId: id,
    nickname: (userMap[id] && userMap[id].nickname) || '书友',
    avatarUrl: (userMap[id] && userMap[id].avatarUrl) || '',
    count
  }));
}

const INSIGHT_LIMIT = 30;

/** 这一期小凡写给你的全部信，新的在前 */
async function buildInsights(userId, periodId) {
  const list = await Insight.find({
    targetUserId: userId,
    periodId,
    type: 'insight',
    status: 'completed',
    isPublished: { $ne: false }
  })
    .sort({ createdAt: -1 })
    .limit(INSIGHT_LIMIT)
    .lean();
  return list.map(item => ({
    id: idStr(item._id),
    title: item.title || '',
    date: item.createdAt ? toDayKey(item.createdAt) : '',
    excerpt: excerptOf(stripTags(item.content))
  }));
}

/** 每一天：这一期写过的打卡目录，按时间从早到晚 */
function buildDays(checkins, sectionMap) {
  return checkins
    .filter(item => item.checkinDate)
    .slice()
    .sort((a, b) => new Date(a.checkinDate) - new Date(b.checkinDate))
    .map(item => {
      const section = sectionMap[idStr(item.sectionId)];
      return {
        checkinId: idStr(item._id),
        sectionId: idStr(item.sectionId),
        date: toDayKey(item.checkinDate),
        sectionTitle: (section && section.title) || '',
        excerpt: excerptOf(checkinPlainText(item), 36)
      };
    });
}

/** 读伴：只给昵称、头像和同行天数，不给对方的用户 ID */
async function buildBuddy(userId, period, now) {
  const BuddyPair = getOptionalModel('BuddyPair');
  if (!BuddyPair) return null;
  const pair = (
    await BuddyPair.find({ periodId: period._id, members: userId }).sort({ createdAt: -1 }).limit(1).lean()
  )[0];
  if (!pair) return null;
  const me = idStr(userId);
  const partnerId = [pair.userA, pair.userB].map(idStr).find(id => id && id !== me);
  if (!partnerId) return null;
  const partner = await User.findById(partnerId).select('nickname avatarUrl').lean();
  let until = pair.endedAt || now;
  if (period.endDate && new Date(until) > new Date(period.endDate)) until = period.endDate;
  return {
    nickname: (partner && partner.nickname) || '读伴',
    avatarUrl: (partner && partner.avatarUrl) || '',
    days: pair.createdAt ? Math.max(1, dayDiff(pair.createdAt, until) + 1) : 0,
    active: pair.active !== false
  };
}

/** 实修清单：每周一件小事，记了几天、做到几天 */
async function buildPractices(userId, periodId) {
  const Practice = getOptionalModel('Practice');
  if (!Practice) return [];
  const list = await Practice.find({ userId, periodId }).sort({ weekIndex: 1 }).lean();
  return list
    .map(item => {
      const logs = Array.isArray(item.logs) ? item.logs : [];
      return {
        weekIndex: item.weekIndex,
        text: String(item.text || '').trim(),
        loggedDays: logs.length,
        doneDays: logs.filter(log => log.done === true).length
      };
    })
    .filter(item => item.text);
}

async function buildHighlights(userId, periodId) {
  const Highlight = getOptionalModel('Highlight');
  if (!Highlight) return [];
  const list = await Highlight.find({ userId, periodId }).sort({ createdAt: -1 }).limit(3).lean();
  return list
    .map(item => ({ text: String(item.text || '').trim() }))
    .filter(item => item.text);
}

async function buildLetter(userId, periodId) {
  const Letter = getOptionalModel('Letter');
  if (!Letter) return null;
  const opened = (await Letter.find({ userId, periodId, status: 'opened' }).limit(1).lean())[0];
  if (!opened) return null;
  return {
    content: String(opened.content || ''),
    sealedAt: opened.sealedAt || opened.writtenAt || null,
    reply: String(opened.reply || '')
  };
}

async function countSeenCards(userId, periodId) {
  const SeenCard = getOptionalModel('SeenCard');
  if (!SeenCard) return 0;
  return SeenCard.countDocuments({
    periodId,
    receiverId: userId,
    withdrawnAt: null
  });
}

async function computeKeepsake(userId, period, readiness, now = new Date()) {
  const periodId = period._id;
  const base = {
    period: {
      id: idStr(period._id),
      name: period.name || period.title || '',
      totalDays: period.totalDays,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status
    }
  };
  // 还没开营：没有内容可翻
  const started = !period.startDate || dayDiff(period.startDate, now) >= 0;
  if (!readiness.ready && !started) {
    return { ...base, ready: false, notStarted: true, finished: false, daysLeft: readiness.daysLeft };
  }

  const [user, checkins, completions, sections] = await Promise.all([
    safely('user', () => User.findById(userId).select('nickname').lean(), null),
    safely('checkins', () => Checkin.find({ userId, periodId }).lean(), []),
    safely('completions', () => UserReadingCompletion.find({ userId, periodId }).lean(), []),
    safely('sections', () => Section.find({ periodId }).select('title day').lean(), [])
  ]);

  const sectionMap = {};
  sections.forEach(section => {
    sectionMap[idStr(section._id)] = section;
  });

  const dayKeys = new Set();
  let totalWords = 0;
  checkins.forEach(item => {
    const key = toDayKey(item.checkinDate);
    if (key) dayKeys.add(key);
    totalWords += countWords(checkinPlainText(item));
  });

  const totalMs = completions.reduce((sum, item) => sum + (item.durationMs || 0), 0);
  const readingDays = new Set(
    completions.map(item => toDayKey(item.completedAt)).filter(Boolean)
  ).size;

  const moods = checkins
    .map(item => ({ date: toDayKey(item.checkinDate), mood: readTrustedMood(item), at: item.checkinDate }))
    .filter(item => item.mood)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .map(({ date, mood }) => ({ date, mood }));

  const [companions, insights, highlights, letter, seenCount, buddy, practices] = await Promise.all([
    safely('companions', () => buildCompanions(userId, checkins), []),
    safely('insights', () => buildInsights(userId, periodId), []),
    safely('highlights', () => buildHighlights(userId, periodId), []),
    safely('letter', () => buildLetter(userId, periodId), null),
    safely('seen', () => countSeenCards(userId, periodId), 0),
    safely('buddy', () => buildBuddy(userId, period, now), null),
    safely('practices', () => buildPractices(userId, periodId), [])
  ]);
  const insightExcerpt = insights[0]
    ? { id: insights[0].id, title: insights[0].title, excerpt: insights[0].excerpt }
    : null;

  return {
    ...base,
    ready: true,
    finished: readiness.ready,
    daysLeft: readiness.daysLeft,
    nickname: (user && user.nickname) || '',
    checkinDays: dayKeys.size,
    checkinCount: checkins.length,
    totalWords,
    readingMinutes: Math.round(totalMs / 60000),
    readingDays,
    earliestCheckin: pickEarliest(checkins),
    moods,
    topCheckin: pickTopCheckin(checkins, sectionMap),
    companions,
    insightExcerpt,
    insights,
    days: buildDays(checkins, sectionMap),
    highlights,
    letter,
    seenCount,
    buddy,
    practices
  };
}

/**
 * @returns {Promise<object|null>} 期次不存在时返回 null
 */
async function getPeriodKeepsake(userId, periodId, now = new Date()) {
  const period = await Period.findById(periodId).lean();
  if (!period) return null;
  const readiness = resolveReadiness(period, now);
  const cacheKey = `${idStr(userId)}:${idStr(periodId)}`;
  const finished = period.status === 'completed';

  if (readiness.ready && finished) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now.getTime()) return hit.value;
  }

  const value = await computeKeepsake(userId, period, readiness, now);
  if (readiness.ready && finished) {
    setCache(cacheKey, value, now);
  }
  return value;
}

function clearKeepsakeCache() {
  cache.clear();
}

module.exports = {
  getPeriodKeepsake,
  clearKeepsakeCache,
  getCacheSize: () => cache.size,
  CACHE_MAX_ENTRIES,
  resolveReadiness,
  stripTags,
  countWords,
  excerptOf,
  MOOD_VALID_SINCE
};
