const mongoose = require('mongoose');
const ReadingPing = require('../models/ReadingPing');
const Section = require('../models/Section');
const Enrollment = require('../models/Enrollment');
const UserReadingCompletion = require('../models/UserReadingCompletion');
const Checkin = require('../models/Checkin');
const { success, errors } = require('../utils/response');
const { ensurePeriodCommunityAccess } = require('../services/community-access.service');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { toDayKey } = require('../utils/checkin-day-metrics');

const PING_THROTTLE_MS = 60 * 1000;
const READING_WINDOW_MS = 15 * 60 * 1000;
const TODAY_CACHE_MS = 30 * 1000;
const MIN_VISIBLE_COUNT = 3;
const MIN_PROVINCE_COUNT = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

const pingThrottle = new Map();
const todayCache = new Map();

function getRequestUserId(req) {
  return req.user?.id || req.user?.userId || req.user?._id;
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getDayRange(now = new Date()) {
  const start = new Date(`${toDayKey(now)}T00:00:00+08:00`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

function distinctCount(list, key = 'userId') {
  return new Set((list || []).map(item => String(item[key]))).size;
}

function hideIfFew(count) {
  return count >= MIN_VISIBLE_COUNT ? count : null;
}

function prune(map, now, ttl) {
  for (const [key, value] of map) {
    if (now - (value.at || value) > ttl) map.delete(key);
  }
}

async function reportReading(req, res) {
  try {
    const userId = getRequestUserId(req);
    const { sectionId } = req.body || {};
    if (!sectionId || !isValidId(sectionId)) {
      return res.status(400).json(errors.badRequest('缺少课程ID'));
    }

    const section = await Section.findById(sectionId).select('periodId').lean();
    if (!section) {
      return res.status(404).json(errors.notFound('课程不存在'));
    }
    const { periodId } = section;
    if (!(await ensurePeriodCommunityAccess(res, userId, periodId))) return;

    const now = Date.now();
    const key = `${getCurrentTenantId() || ''}:${userId}:${sectionId}`;
    const last = pingThrottle.get(key);
    if (last && now - last < PING_THROTTLE_MS) {
      return res.json(success({ ok: true }));
    }
    pingThrottle.set(key, now);
    if (pingThrottle.size > 5000) prune(pingThrottle, now, PING_THROTTLE_MS);

    await ReadingPing.findOneAndUpdate(
      { tenantId: getCurrentTenantId(), userId, sectionId },
      { $set: { periodId, at: new Date(now) } },
      { upsert: true }
    );
    return res.json(success({ ok: true }));
  } catch (error) {
    console.error('上报阅读状态失败:', error);
    return res.status(500).json(errors.serverError('上报阅读状态失败'));
  }
}

async function getToday(req, res) {
  try {
    const userId = getRequestUserId(req);
    const { periodId } = req.query || {};
    if (!periodId || !isValidId(periodId)) {
      return res.status(400).json(errors.badRequest('缺少期次ID'));
    }
    if (!(await ensurePeriodCommunityAccess(res, userId, periodId))) return;

    const now = Date.now();
    const cacheKey = `${getCurrentTenantId() || ''}:${periodId}`;
    const cached = todayCache.get(cacheKey);
    if (cached && now - cached.at < TODAY_CACHE_MS) {
      return res.json(success(cached.data));
    }

    const { start, end } = getDayRange(new Date(now));
    const [pings, completions, checkins] = await Promise.all([
      ReadingPing.find({ periodId, at: { $gte: new Date(now - READING_WINDOW_MS) } })
        .select('userId')
        .lean(),
      UserReadingCompletion.find({ periodId, completedAt: { $gte: start, $lt: end } })
        .select('userId')
        .lean(),
      Checkin.find({ periodId, checkinDate: { $gte: start, $lt: end } })
        .select('userId')
        .lean()
    ]);

    const data = {
      readingNow: hideIfFew(distinctCount(pings)),
      completedToday: hideIfFew(distinctCount(completions)),
      checkedInToday: hideIfFew(distinctCount(checkins))
    };
    todayCache.set(cacheKey, { at: now, data });
    if (todayCache.size > 500) prune(todayCache, now, TODAY_CACHE_MS);
    return res.json(success(data));
  } catch (error) {
    console.error('获取同行数据失败:', error);
    return res.status(500).json(errors.serverError('获取同行数据失败'));
  }
}

async function getMyRank(req, res) {
  try {
    const userId = getRequestUserId(req);
    const { sectionId, type } = req.query || {};
    if (!sectionId || !isValidId(sectionId)) {
      return res.status(400).json(errors.badRequest('缺少课程ID'));
    }
    if (type !== 'reading' && type !== 'checkin') {
      return res.status(400).json(errors.badRequest('type 只能是 reading 或 checkin'));
    }

    const section = await Section.findById(sectionId).select('periodId').lean();
    if (!section) {
      return res.status(404).json(errors.notFound('课程不存在'));
    }
    if (!(await ensurePeriodCommunityAccess(res, userId, section.periodId))) return;

    const { start, end } = getDayRange();
    const rows =
      type === 'reading'
        ? await UserReadingCompletion.find({ sectionId, completedAt: { $gte: start, $lt: end } })
            .select('userId completedAt')
            .sort({ completedAt: 1 })
            .lean()
        : await Checkin.find({ sectionId, checkinDate: { $gte: start, $lt: end } })
            .select('userId checkinDate')
            .sort({ checkinDate: 1 })
            .lean();

    const seen = [];
    const seenSet = new Set();
    rows.forEach(row => {
      const id = String(row.userId);
      if (!seenSet.has(id)) {
        seenSet.add(id);
        seen.push(id);
      }
    });
    const index = seen.indexOf(String(userId));
    return res.json(success({ rank: index >= 0 ? index + 1 : null }));
  } catch (error) {
    console.error('获取今日名次失败:', error);
    return res.status(500).json(errors.serverError('获取今日名次失败'));
  }
}

async function getPeriodOrigins(req, res) {
  try {
    const userId = getRequestUserId(req);
    const { periodId } = req.params;
    if (!periodId || !isValidId(periodId)) {
      return res.status(400).json(errors.badRequest('缺少期次ID'));
    }
    if (!(await ensurePeriodCommunityAccess(res, userId, periodId))) return;

    const enrollments = await Enrollment.find({
      periodId,
      status: { $in: ['active', 'completed'] },
      deleted: { $ne: true }
    })
      .select('province')
      .lean();

    const provinces = new Set();
    enrollments.forEach(item => {
      const province = typeof item.province === 'string' ? item.province.trim() : '';
      if (province) provinces.add(province);
    });
    return res.json(
      success({
        memberCount: enrollments.length,
        provinceCount: provinces.size >= MIN_PROVINCE_COUNT ? provinces.size : null
      })
    );
  } catch (error) {
    console.error('获取同行来处失败:', error);
    return res.status(500).json(errors.serverError('获取同行来处失败'));
  }
}

function resetCachesForTest() {
  pingThrottle.clear();
  todayCache.clear();
}

module.exports = { reportReading, getToday, getMyRank, getPeriodOrigins, resetCachesForTest };
