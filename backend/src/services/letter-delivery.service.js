const cron = require('node-cron');
const Letter = require('../models/Letter');
const Period = require('../models/Period');
const logger = require('../utils/logger');
const { toDayKey } = require('../utils/checkin-day-metrics');
const { withSystemContext } = require('../utils/tenantContext');
const { createNotification } = require('../controllers/notification.controller');

const DAY_MS = 24 * 60 * 60 * 1000;
const CRON_OPTIONS = { timezone: 'Asia/Shanghai' };
const CRON_EXPRESSION = '*/10 * * * *';

function dayKeyToMs(dayKey, time = '00:00:00') {
  return Date.parse(`${dayKey}T${time}+08:00`);
}

// 写信窗口：开营日前 3 天 00:00 到开营后第 7 天 23:59:59（东八区）
function computeWriteWindow(period) {
  const startKey = period && period.startDate ? toDayKey(period.startDate) : null;
  if (!startKey) return null;
  const startMs = dayKeyToMs(startKey);
  return { from: new Date(startMs - 3 * DAY_MS), to: new Date(startMs + 8 * DAY_MS - 1000) };
}

// 送达那一天：课程的最后一天（开营日 + 课程天数 - 1）。
// 期次的结束日常常比课程多留几天（比如 23 天的课，结束日设在第 25 天），所以两者取早的那个；
// 没设课程天数时按结束日。
function computeDeliverDayKey(period) {
  const endKey = period && period.endDate ? toDayKey(period.endDate) : null;
  const startKey = period && period.startDate ? toDayKey(period.startDate) : null;
  const totalDays = Number(period && period.totalDays);
  const lastCourseKey = startKey && totalDays > 0
    ? toDayKey(new Date(dayKeyToMs(startKey) + (totalDays - 1) * DAY_MS))
    : null;
  if (endKey && lastCourseKey) return lastCourseKey < endKey ? lastCourseKey : endKey;
  return endKey || lastCourseKey;
}

// 送达时间：送达那一天东八区早上 6:00
function computeDeliverAt(period) {
  const key = computeDeliverDayKey(period);
  return key ? new Date(dayKeyToMs(key, '06:00:00')) : null;
}

function daysBetweenKeys(fromDate, toDate) {
  const a = toDayKey(fromDate);
  const b = toDayKey(toDate);
  if (!a || !b) return 1;
  return Math.max(1, Math.round((dayKeyToMs(b) - dayKeyToMs(a)) / DAY_MS));
}

const BATCH_SIZE = 500;

async function deliverOne(letter, deliverAt, now) {
  const tenantId = letter.tenantId ? String(letter.tenantId) : null;
  return withSystemContext(tenantId, async () => {
    const days = daysBetweenKeys(letter.sealedAt || letter.writtenAt || now, deliverAt);
    // 先确保站内通知成功，再改变信件状态。通知失败时保留 sealed，下一轮可以重试。
    const notification = await createNotification(
      letter.userId,
      'letter_delivered',
      '有一封信到了',
      `${days} 天前你写给今天的自己`,
      {
        upsertExisting: true,
        data: { letterId: String(letter._id), periodId: String(letter.periodId) }
      }
    );
    if (!notification) return false;

    // 条件更新保证幂等：并发实例只有一个能完成状态转换；通知使用 letterId 做幂等 upsert。
    const result = await Letter.updateOne(
      { _id: letter._id, status: 'sealed' },
      { $set: { status: 'delivered', deliveredAt: now } }
    );
    const modified = result.modifiedCount !== undefined ? result.modifiedCount : result.nModified;
    if (!modified) return false;
    return true;
  });
}

// 扫描所有已到送达时间的期次，避免服务停摆超过固定回看窗口后漏送。
async function deliverDueLetters({ now = new Date() } = {}) {
  return withSystemContext(null, async () => {
    // 送达日可能早于结束日（按课程天数算），所以已经开营、设了课程天数的期次也要一起扫
    const candidates = await Period.find({
      $or: [
        { endDate: { $lte: new Date(now.getTime() + DAY_MS) } },
        { startDate: { $lte: now }, totalDays: { $gt: 0 } }
      ]
    })
      .select('_id startDate endDate totalDays')
      .lean();
    const deliverAtMap = new Map();
    candidates.forEach(p => {
      const deliverAt = computeDeliverAt(p);
      if (deliverAt && deliverAt.getTime() <= now.getTime()) deliverAtMap.set(String(p._id), deliverAt);
    });
    if (!deliverAtMap.size) return { scanned: 0, delivered: 0 };

    const periodIds = [...deliverAtMap.keys()];
    let scanned = 0;
    let delivered = 0;
    let lastId = null;
    for (;;) {
      const query = { status: 'sealed', periodId: { $in: periodIds } };
      if (lastId) query._id = { $gt: lastId };
      const batch = await Letter.find(query)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .select('_id tenantId userId periodId sealedAt writtenAt')
        .lean();
      if (!batch.length) break;
      for (const letter of batch) {
        scanned += 1;
        try {
          if (await deliverOne(letter, deliverAtMap.get(String(letter.periodId)), now)) delivered += 1;
        } catch (error) {
          logger.error('Failed to deliver letter', error, { letterId: String(letter._id) });
        }
      }
      lastId = batch[batch.length - 1]._id;
      if (batch.length < BATCH_SIZE) break;
    }
    return { scanned, delivered };
  });
}

let scheduled = false;

function start() {
  if (scheduled) return;
  const instanceId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
  if (instanceId !== '0') {
    logger.info(`Skipping letter delivery schedule on instance ${instanceId}`);
    return;
  }
  scheduled = true;
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      try {
        const result = await deliverDueLetters();
        if (result.delivered) logger.info('Letters delivered', result);
      } catch (error) {
        logger.error('Failed to run letter delivery', error);
      }
    },
    CRON_OPTIONS
  );
  logger.info('Letter delivery schedule started', { cron: CRON_EXPRESSION });
}

module.exports = { start, deliverDueLetters, computeWriteWindow, computeDeliverAt, computeDeliverDayKey, daysBetweenKeys };
