const mongoose = require('mongoose');
const Practice = require('../models/Practice');
const Period = require('../models/Period');
const Section = require('../models/Section');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { ensurePeriodCommunityAccess } = require('../services/community-access.service');
const { toDayKey } = require('../utils/checkin-day-metrics');

const MAX_TEXT_LENGTH = 30;
const MAX_NOTE_LENGTH = 60;
const MAX_SUGGESTION_LENGTH = 40;
const MAX_SUGGESTIONS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function getRequestUserId(req) {
  return req.user?.id || req.user?.userId || req.user?._id;
}

function dayIndex(dayKey) {
  return Math.round(Date.parse(`${dayKey}T00:00:00Z`) / DAY_MS);
}

function addDays(dayKey, n) {
  return new Date((dayIndex(dayKey) + n) * DAY_MS).toISOString().slice(0, 10);
}

/** 按期次计算“今天”处于第几周；未开始或已结束返回 null */
function resolveWeek(period, now = new Date()) {
  const startKey = toDayKey(period.startDate);
  const endKey = toDayKey(period.endDate);
  const todayKey = toDayKey(now);
  if (!startKey || !endKey || !todayKey) return null;
  const offset = dayIndex(todayKey) - dayIndex(startKey);
  if (offset < 0 || todayKey > endKey) return null;
  const weekIndex = Math.floor(offset / 7) + 1;
  const from = addDays(startKey, (weekIndex - 1) * 7);
  const to = addDays(from, 6);
  const todayDay = offset + 1;
  return { weekIndex, todayKey, todayDay, weekRange: { from, to: to > endKey ? endKey : to }, startKey };
}

function stripTags(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(text) {
  const clean = stripTags(text);
  if (!clean) return '';
  const match = clean.match(/^[^。！？!?；;\n]+/);
  const sentence = (match ? match[0] : clean).trim();
  return sentence.length > MAX_SUGGESTION_LENGTH ? sentence.slice(0, MAX_SUGGESTION_LENGTH) : sentence;
}

async function buildSuggestions(periodId, weekIndex, todayDay) {
  try {
    const fromDay = weekIndex === 1 ? 0 : (weekIndex - 1) * 7 + 1;
    const toDay = Math.min(weekIndex * 7, todayDay);
    const sections = await Section.find({
      periodId,
      isPublished: true,
      day: { $gte: fromDay, $lte: toDay }
    })
      .select('day action')
      .sort({ day: 1 })
      .lean();
    const seen = new Set();
    const result = [];
    for (const section of sections || []) {
      const sentence = firstSentence(section.action);
      if (!sentence || seen.has(sentence)) continue;
      seen.add(sentence);
      result.push(sentence);
      if (result.length >= MAX_SUGGESTIONS) break;
    }
    return result;
  } catch (error) {
    logger.warn('获取实修建议失败', error.message);
    return [];
  }
}

function buildWeekLogs(practice, weekRange) {
  const map = new Map((practice?.logs || []).map(log => [log.date, log]));
  const logs = [];
  for (let key = weekRange.from; key <= weekRange.to; key = addDays(key, 1)) {
    const log = map.get(key);
    if (log) logs.push({ date: key, done: !!log.done, note: log.note || '' });
  }
  return logs;
}

async function loadContext(req, res) {
  const userId = getRequestUserId(req);
  const { periodId } = req.params;
  if (!userId) {
    res.status(401).json(errors.unauthorized('请先登录'));
    return null;
  }
  if (!mongoose.Types.ObjectId.isValid(periodId)) {
    res.status(400).json(errors.badRequest('期次参数不正确'));
    return null;
  }
  if (!(await ensurePeriodCommunityAccess(res, userId, periodId))) return null;
  const period = await Period.findById(periodId).select('startDate endDate').lean();
  if (!period) {
    res.status(404).json(errors.notFound('期次不存在'));
    return null;
  }
  return { userId, periodId, period };
}

async function getCurrent(req, res) {
  try {
    const ctx = await loadContext(req, res);
    if (!ctx) return;
    const week = resolveWeek(ctx.period);
    if (!week) return res.json(success({ active: false }));

    const practice = await Practice.findOne({
      userId: ctx.userId,
      periodId: ctx.periodId,
      weekIndex: week.weekIndex
    }).lean();
    const logs = buildWeekLogs(practice, week.weekRange);
    const todayLog = logs.find(log => log.date === week.todayKey);
    const suggestions = practice ? [] : await buildSuggestions(ctx.periodId, week.weekIndex, week.todayDay);

    return res.json(
      success({
        active: true,
        weekIndex: week.weekIndex,
        weekRange: week.weekRange,
        practice: practice ? { id: String(practice._id), text: practice.text } : null,
        today: {
          date: week.todayKey,
          done: todayLog ? todayLog.done : null,
          note: todayLog ? todayLog.note : ''
        },
        logs,
        suggestions
      })
    );
  } catch (error) {
    logger.error('获取本周实修失败', error);
    return res.status(500).json(errors.serverError('获取本周实修失败'));
  }
}

async function setCurrent(req, res) {
  try {
    const ctx = await loadContext(req, res);
    if (!ctx) return;
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json(errors.badRequest('请写下这一周的行动'));
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json(errors.badRequest(`行动请控制在${MAX_TEXT_LENGTH}字以内`));
    }
    const week = resolveWeek(ctx.period);
    if (!week) return res.status(400).json(errors.badRequest('当前不在期次进行中'));

    let practice = await Practice.findOne({
      userId: ctx.userId,
      periodId: ctx.periodId,
      weekIndex: week.weekIndex
    });
    if (practice) {
      practice.text = text;
      await practice.save();
    } else {
      try {
        practice = await Practice.create({
          userId: ctx.userId,
          periodId: ctx.periodId,
          weekIndex: week.weekIndex,
          text,
          logs: []
        });
      } catch (createError) {
        if (!createError || createError.code !== 11000) throw createError;
        // 并发首次设定：另一请求已创建，重读后更新
        practice = await Practice.findOne({
          userId: ctx.userId,
          periodId: ctx.periodId,
          weekIndex: week.weekIndex
        });
        if (!practice) throw createError;
        practice.text = text;
        await practice.save();
      }
    }
    return res.json(success({ id: String(practice._id), text: practice.text, weekIndex: week.weekIndex }));
  } catch (error) {
    logger.error('设定本周实修失败', error);
    return res.status(500).json(errors.serverError('保存失败，请稍后再试'));
  }
}

async function logToday(req, res) {
  try {
    const ctx = await loadContext(req, res);
    if (!ctx) return;
    const { done, note } = req.body || {};
    if (typeof done !== 'boolean') return res.status(400).json(errors.badRequest('请选择今天的情况'));
    const cleanNote = typeof note === 'string' ? note.trim() : '';
    if (cleanNote.length > MAX_NOTE_LENGTH) {
      return res.status(400).json(errors.badRequest(`补一句话请控制在${MAX_NOTE_LENGTH}字以内`));
    }
    const week = resolveWeek(ctx.period);
    if (!week) return res.status(400).json(errors.badRequest('当前不在期次进行中'));

    const practice = await Practice.findOne({
      userId: ctx.userId,
      periodId: ctx.periodId,
      weekIndex: week.weekIndex
    });
    if (!practice) return res.status(400).json(errors.badRequest('先给这一周定一个行动吧'));

    const existing = practice.logs.find(log => log.date === week.todayKey);
    if (existing) {
      existing.done = done;
      existing.note = cleanNote;
    } else {
      practice.logs.push({ date: week.todayKey, done, note: cleanNote });
    }
    await practice.save();
    return res.json(success({ date: week.todayKey, done, note: cleanNote }));
  } catch (error) {
    logger.error('记录今日实修失败', error);
    return res.status(500).json(errors.serverError('保存失败，请稍后再试'));
  }
}

async function getHistory(req, res) {
  try {
    const ctx = await loadContext(req, res);
    if (!ctx) return;
    const practices = await Practice.find({ userId: ctx.userId, periodId: ctx.periodId })
      .sort({ weekIndex: -1 })
      .lean();
    const startKey = toDayKey(ctx.period.startDate);
    const weeks = practices.map(item => {
      const from = addDays(startKey, (item.weekIndex - 1) * 7);
      return {
        weekIndex: item.weekIndex,
        weekRange: { from, to: addDays(from, 6) },
        practice: { id: String(item._id), text: item.text },
        logs: (item.logs || [])
          .slice()
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .map(log => ({ date: log.date, done: !!log.done, note: log.note || '' }))
      };
    });
    return res.json(success({ weeks }));
  } catch (error) {
    logger.error('获取实修往周失败', error);
    return res.status(500).json(errors.serverError('获取失败，请稍后再试'));
  }
}

module.exports = { getCurrent, setCurrent, logToday, getHistory, resolveWeek, firstSentence };
