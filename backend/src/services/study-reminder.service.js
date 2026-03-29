const cron = require('node-cron');
const Enrollment = require('../models/Enrollment');
const Period = require('../models/Period');
const Section = require('../models/Section');
const SubscribeMessageGrant = require('../models/SubscribeMessageGrant');
const subscribeMessageService = require('./subscribe-message.service');
const logger = require('../utils/logger');
const {
  buildScheduledStudyReminderPlan,
  formatShanghaiDateTimeLabel,
  getShanghaiDateKey,
  getShanghaiDateTime
} = require('../utils/study-reminder.utils');
const { getSubscribeSceneConfig } = require('../config/subscribe-message.config');

const SCENE = 'next_day_study_reminder';
const CRON_OPTIONS = { timezone: 'Asia/Shanghai' };
const NON_RETRYABLE_ERROR_CODES = new Set([40003, 40037, 43101, 47003]);

async function resolveLeanResult(queryOrValue) {
  if (!queryOrValue) {
    return queryOrValue;
  }

  if (typeof queryOrValue.lean === 'function') {
    const leanResult = queryOrValue.lean();
    if (leanResult && typeof leanResult.exec === 'function') {
      return leanResult.exec();
    }
    return leanResult;
  }

  if (typeof queryOrValue.exec === 'function') {
    return queryOrValue.exec();
  }

  if (typeof queryOrValue.then === 'function') {
    return queryOrValue;
  }

  return queryOrValue;
}

function isRetryableDelivery(delivery) {
  if (!delivery || delivery.status !== 'failed') {
    return false;
  }

  if (delivery.errorCode === null || delivery.errorCode === undefined || delivery.errorCode === '') {
    return true;
  }

  return !NON_RETRYABLE_ERROR_CODES.has(Number(delivery.errorCode));
}

async function clearGrantSchedule(grantId, extra = {}) {
  return SubscribeMessageGrant.findByIdAndUpdate(
    grantId,
    {
      $set: {
        availableCount: 0,
        scheduledSendDate: null,
        scheduledSendDateKey: null,
        retryAt: null,
        retryCount: 0,
        ...extra
      }
    },
    { new: true }
  );
}

async function queueRetryForGrant(grantId, retryAt, extra = {}) {
  return SubscribeMessageGrant.findByIdAndUpdate(
    grantId,
    {
      $set: {
        retryAt,
        retryCount: 1,
        ...extra
      }
    },
    { new: true }
  );
}

function buildReminderActivityName(period = {}) {
  const rawName = String(period?.name || period?.title || '凡人共读').trim();
  if (!rawName) {
    return '凡人共读晨读营';
  }

  return rawName.includes('晨读营') ? rawName : `${rawName}晨读营`;
}

function buildReminderFields({ period, section, sendDate }) {
  const dayIndex = Number(section?.day || 0);
  const sectionTitle = String(section?.title || '').trim();
  const displayStartTime = getShanghaiDateTime(getShanghaiDateKey(sendDate), 6, 0, 0);

  return {
    activityName: buildReminderActivityName(period),
    activityContent: sectionTitle || `第${dayIndex + 1}天 晨读任务`,
    startTime: formatShanghaiDateTimeLabel(displayStartTime || sendDate),
    joinMethod: '进入凡人共读小程序去学习'
  };
}

async function sendOneReminder(grant, { attemptType = 'scheduled' } = {}) {
  const sceneConfig = getSubscribeSceneConfig(SCENE);
  if (!sceneConfig) {
    return { status: 'skipped_missing_config' };
  }

  const periodId = grant.periodId || grant.context?.periodId || null;
  if (!periodId) {
    await clearGrantSchedule(grant._id);
    return { status: 'skipped_missing_period' };
  }

  const enrollment = await resolveLeanResult(Enrollment.findOne({
    userId: grant.userId,
    periodId,
    status: { $in: ['active', 'completed'] },
    paymentStatus: { $in: ['paid', 'free'] },
    deleted: { $ne: true }
  }));

  if (!enrollment) {
    await clearGrantSchedule(grant._id);
    return { status: 'skipped_ineligible' };
  }

  const period = await resolveLeanResult(Period.findById(periodId));
  if (!period) {
    await clearGrantSchedule(grant._id);
    return { status: 'skipped_missing_period' };
  }

  const sendDate = grant.scheduledSendDate || grant.retryAt || null;
  const plan = buildScheduledStudyReminderPlan({
    period,
    sendDate
  });

  if (plan.status !== 'ok') {
    await clearGrantSchedule(grant._id);
    return { status: `skipped_${plan.status}` };
  }

  const section = await Section.findOne({
    periodId: period._id,
    day: plan.dayIndex,
    isPublished: true
  })
    .select('title day')
    ;
  const resolvedSection = await resolveLeanResult(section);

  if (!resolvedSection) {
    await clearGrantSchedule(grant._id);
    return { status: 'skipped_missing_section' };
  }

  const delivery = await subscribeMessageService.sendSceneMessage({
    scene: SCENE,
    recipientUserId: grant.userId,
    fields: buildReminderFields({ period, section: resolvedSection, sendDate: plan.sendDate }),
    page: sceneConfig.page,
    sourceType: 'study_reminder',
    sourceId: `${grant.userId}:${periodId}:${plan.sendDateKey}`,
    consumeOnSuccess: true
  });

  if (delivery.status === 'sent' || delivery.status === 'mocked') {
    await clearGrantSchedule(grant._id);
    return { status: 'sent' };
  }

  if (isRetryableDelivery(delivery) && attemptType !== 'retry' && (!grant.retryCount || grant.retryCount < 1)) {
    const retryAt = getShanghaiDateTime(getShanghaiDateKey(plan.sendDate), 6, 0, 0);
    await queueRetryForGrant(grant._id, retryAt, {
      availableCount: grant.availableCount || 1,
      scheduledSendDate: grant.scheduledSendDate || plan.sendDate,
      scheduledSendDateKey: grant.scheduledSendDateKey || plan.sendDateKey,
      periodId,
      sourceAction: grant.sourceAction || grant.context?.sourceAction || null
    });
    return { status: 'retry_queued', retryAt };
  }

  await clearGrantSchedule(grant._id);
  return { status: delivery.status === 'failed' ? 'failed' : `skipped_${delivery.status}` };
}

async function sendDueNextDayStudyReminders({ attemptType = 'scheduled' } = {}) {
  const sceneConfig = getSubscribeSceneConfig(SCENE);
  if (!sceneConfig) {
    return {
      total: 0,
      sent: 0,
      failed: 0,
      skipped: 0
    };
  }

  const now = new Date();
  const grants = await SubscribeMessageGrant.find({
    scene: SCENE,
    templateId: sceneConfig.templateId,
    availableCount: { $gt: 0 },
    scheduledSendDate: { $lte: now },
    $or: [{ retryAt: null }, { retryAt: { $lte: now } }]
  })
    .sort({ scheduledSendDate: 1, createdAt: 1 })
    .lean();

  const summary = {
    total: grants.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    retryQueued: 0
  };

  for (const grant of grants) {
    try {
      const result = await sendOneReminder(grant, { attemptType });
      if (result.status === 'sent') {
        summary.sent += 1;
      } else if (result.status === 'retry_queued') {
        summary.retryQueued += 1;
      } else if (result.status === 'failed') {
        summary.failed += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failed += 1;
      logger.error('明日学习提醒发送失败', error, {
        userId: grant.userId,
        periodId: grant.periodId || grant.context?.periodId || null
      });
      if (attemptType === 'retry') {
        await clearGrantSchedule(grant._id);
      }
    }
  }

  return summary;
}

function startStudyReminderSchedules() {
  try {
    const instanceId = process.env.NODE_APP_INSTANCE;
    if (instanceId && instanceId !== '0') {
      logger.info(`Skipping study reminder schedules on instance ${instanceId} (only instance 0 runs study reminders)`);
      return;
    }

    cron.schedule(
      '45 5 * * *',
      async () => {
        try {
          logger.info('🔔 Next-day study reminder scheduled job triggered');
          await sendDueNextDayStudyReminders({ attemptType: 'scheduled' });
        } catch (error) {
          logger.error('Scheduled next-day study reminder job failed', error);
        }
      },
      CRON_OPTIONS
    );

    cron.schedule(
      '0 6 * * *',
      async () => {
        try {
          logger.info('🔔 Next-day study reminder retry job triggered');
          await sendDueNextDayStudyReminders({ attemptType: 'retry' });
        } catch (error) {
          logger.error('Scheduled next-day study reminder retry job failed', error);
        }
      },
      CRON_OPTIONS
    );

    logger.info('✅ Study reminder schedules started successfully', {
      nextDayReminder: '05:45 CST (北京时间)',
      nextDayReminderRetry: '06:00 CST (北京时间)'
    });
  } catch (error) {
    logger.error('Failed to start study reminder schedules', error);
  }
}

module.exports = {
  buildReminderFields,
  clearGrantSchedule,
  queueRetryForGrant,
  sendDueNextDayStudyReminders,
  sendOneReminder,
  startStudyReminderSchedules
};
