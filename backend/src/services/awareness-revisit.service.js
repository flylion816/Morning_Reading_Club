/**
 * 觉察日记：一周后的回访来信。
 *
 * 每 10 分钟扫描到期的觉察记录，向本人送一封 awareness_revisit 来信。
 * 来信只带记录 ID，笔记文字不进入通知；客户端凭 ID 单独读取「择」的文字。
 * 与慢递邮局相同：生产环境默认启用，只在 PM2 实例 0 运行，逐条切换到所属租户。
 */
const cron = require('node-cron');
const JoyNote = require('../models/JoyNote');
const logger = require('../utils/logger');
const { withSystemContext } = require('../utils/tenantContext');
const { createNotification } = require('../controllers/notification.controller');

const CRON_OPTIONS = { timezone: 'Asia/Shanghai' };
const CRON_EXPRESSION = '*/10 * * * *';
const BATCH_SIZE = 200;
// 投递中卡住超过这个时间（进程在中途退出）就退回待投递，下一轮重试
const STUCK_MS = 30 * 60 * 1000;

const TITLE = '来自一周前的自己';
const CONTENT = '一周前你坐下来看过自己，后来怎么样了？';

function setStatus(id, from, to, extra = {}) {
  const set = { 'awareness.revisit.status': to };
  Object.keys(extra).forEach(key => {
    set[`awareness.revisit.${key}`] = extra[key];
  });
  return JoyNote.updateOne({ _id: id, 'awareness.revisit.status': from }, { $set: set });
}

async function deliverOne(note, now) {
  const tenantId = note.tenantId ? String(note.tenantId) : null;
  return withSystemContext(tenantId, async () => {
    // 先条件更新抢占：重复执行或多个实例同时跑，只有一个能成功，不会重复投递
    const claimed = await JoyNote.findOneAndUpdate(
      {
        _id: note._id,
        kind: 'awareness',
        'awareness.revisit.status': 'pending',
        'awareness.revisit.dueAt': { $lte: now }
      },
      { $set: { 'awareness.revisit.status': 'delivering' } },
      { new: true }
    )
      .select('_id userId periodId')
      .lean();
    if (!claimed) return false;

    try {
      const data = { joyNoteId: String(note._id) };
      if (claimed.periodId) data.periodId = String(claimed.periodId);
      const notification = await createNotification(claimed.userId, 'awareness_revisit', TITLE, CONTENT, {
        upsertExisting: true,
        data
      });
      if (!notification) throw new Error('创建来信失败');
      const done = await setStatus(note._id, 'delivering', 'delivered', { deliveredAt: now });
      // 投递期间书友已写下「后来」（状态被置为 answered）：来信照发过，但状态保持 answered
      if (!done.modifiedCount) {
        logger.info('Awareness revisit delivered, status kept as answered by follow-up', { joyNoteId: String(note._id) });
      }
      return true;
    } catch (error) {
      // 通知没送出去：退回待投递，下一轮再试
      await setStatus(note._id, 'delivering', 'pending');
      throw error;
    }
  });
}

async function deliverDueRevisits({ now = new Date() } = {}) {
  return withSystemContext(null, async () => {
    await JoyNote.updateMany(
      {
        kind: 'awareness',
        'awareness.revisit.status': 'delivering',
        updatedAt: { $lt: new Date(now.getTime() - STUCK_MS) }
      },
      { $set: { 'awareness.revisit.status': 'pending' } }
    );

    let scanned = 0;
    let delivered = 0;
    let lastId = null;
    for (;;) {
      const query = {
        kind: 'awareness',
        'awareness.revisit.status': 'pending',
        'awareness.revisit.dueAt': { $lte: now }
      };
      if (lastId) query._id = { $gt: lastId };
      const batch = await JoyNote.find(query).sort({ _id: 1 }).limit(BATCH_SIZE).select('_id tenantId').lean();
      if (!batch.length) break;
      for (const note of batch) {
        scanned += 1;
        try {
          if (await deliverOne(note, now)) delivered += 1;
        } catch (error) {
          logger.error('Failed to deliver awareness revisit', error, { joyNoteId: String(note._id) });
        }
      }
      lastId = batch[batch.length - 1]._id;
      if (batch.length < BATCH_SIZE) break;
    }
    return { scanned, delivered };
  });
}

// ENABLE_AWARENESS_REVISIT=true 强制启用，=false 强制关闭；不设置时仅生产环境启用
function isEnabled(env = process.env) {
  if (env.ENABLE_AWARENESS_REVISIT === 'false') return false;
  if (env.ENABLE_AWARENESS_REVISIT === 'true') return true;
  return env.NODE_ENV === 'production';
}

let scheduled = false;

function start() {
  if (scheduled) return;
  const instanceId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
  if (instanceId !== '0') {
    logger.info(`Skipping awareness revisit schedule on instance ${instanceId}`);
    return;
  }
  scheduled = true;
  cron.schedule(
    CRON_EXPRESSION,
    async () => {
      try {
        const result = await deliverDueRevisits();
        if (result.delivered) logger.info('Awareness revisits delivered', result);
      } catch (error) {
        logger.error('Failed to run awareness revisit delivery', error);
      }
    },
    CRON_OPTIONS
  );
  logger.info('Awareness revisit schedule started', { cron: CRON_EXPRESSION });
}

module.exports = { start, isEnabled, deliverDueRevisits, deliverOne, TITLE, CONTENT };
