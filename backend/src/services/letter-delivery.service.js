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

// 送达时间：结束日东八区早上 6:00
function computeDeliverAt(period) {
  const endKey = period && period.endDate ? toDayKey(period.endDate) : null;
  if (!endKey) return null;
  return new Date(dayKeyToMs(endKey, '06:00:00'));
}

function daysBetweenKeys(fromDate, toDate) {
  const a = toDayKey(fromDate);
  const b = toDayKey(toDate);
  if (!a || !b) return 1;
  return Math.max(1, Math.round((dayKeyToMs(b) - dayKeyToMs(a)) / DAY_MS));
}

const BATCH_SIZE = 500;
const PERIOD_LOOKBACK_DAYS = 60;

async function deliverOne(letter, deliverAt, now) {
  const tenantId = letter.tenantId ? String(letter.tenantId) : null;
  return withSystemContext(tenantId, async () => {
    // 条件更新保证幂等：只有仍处于 sealed 的信才会被标记并发通知
    const result = await Letter.updateOne(
      { _id: letter._id, status: 'sealed' },
      { $set: { status: 'delivered', deliveredAt: now } }
    );
    const modified = result.modifiedCount !== undefined ? result.modifiedCount : result.nModified;
    if (!modified) return false;
    const days = daysBetweenKeys(letter.sealedAt || letter.writtenAt || now, deliverAt);
    await createNotification(letter.userId, 'letter_delivered', '有一封信到了', `${days} 天前你写给今天的自己`, {
      data: { letterId: String(letter._id), periodId: String(letter.periodId) }
    });
    return true;
  });
}

// 只扫描送达时间已到、且结束日在最近 60 天内的期次；没有结束日或已被删除的期次不会被扫到
async function deliverDueLetters({ now = new Date() } = {}) {
  return withSystemContext(null, async () => {
    const candidates = await Period.find({
      endDate: {
        $gte: new Date(now.getTime() - PERIOD_LOOKBACK_DAYS * DAY_MS),
        $lte: new Date(now.getTime() + DAY_MS)
      }
    })
      .select('_id endDate')
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

module.exports = { start, deliverDueLetters, computeWriteWindow, computeDeliverAt, daysBetweenKeys };
