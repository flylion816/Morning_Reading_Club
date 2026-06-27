const cron = require('node-cron');
const CommunityActivity = require('../models/CommunityActivity');
const ActivityRegistration = require('../models/ActivityRegistration');
const subscribeMessageService = require('./subscribe-message.service');
const logger = require('../utils/logger');
const { resolveSubscribeSceneConfig } = require('../config/subscribe-message.config');
const { withSystemContext } = require('../utils/tenantContext');

const SCENE = 'activity_reminder';
const CRON_OPTIONS = { timezone: 'Asia/Shanghai' };

function formatStartTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function sendActivityReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 9 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 11 * 60 * 1000);

  // 跨租户查找所有符合条件的活动
  const activities = await withSystemContext(null, () =>
    CommunityActivity.find({
      status: 'published',
      reminderSent: false,
      startTime: { $gte: windowStart, $lte: windowEnd }
    })
      .select('_id tenantId title startTime')
      .lean()
      .exec()
  );

  if (!activities.length) return;

  logger.info(`activity-reminder: found ${activities.length} activities to remind`);

  const summary = { sent: 0, failed: 0, skipped: 0 };

  for (const activity of activities) {
    const tenantId = activity.tenantId ? activity.tenantId.toString() : null;

    await withSystemContext(tenantId, async () => {
      const sceneConfig = await resolveSubscribeSceneConfig(SCENE);
      if (!sceneConfig || !sceneConfig.templateId) {
        logger.warn('activity_reminder scene config missing, skipping tenant', { tenantId });
        summary.skipped += 1;
        return;
      }

      const registrations = await ActivityRegistration.find({
        activityId: activity._id,
        status: 'registered',
        reminderGranted: true
      })
        .select('userId')
        .lean()
        .exec();

      for (const reg of registrations) {
        try {
          const delivery = await subscribeMessageService.sendSceneMessage({
            scene: SCENE,
            recipientUserId: reg.userId,
            fields: {
              activityName:    activity.title,
              activityContent: '活动即将开始，请准时参加',
              startTime:       formatStartTime(activity.startTime),
              joinMethod:      '点击通知进入活动详情'
            },
            page: `${sceneConfig.page}?id=${activity._id}`,
            sourceType: 'activity_reminder',
            sourceId: `${reg.userId}:${activity._id}`,
            consumeOnSuccess: true
          });

          if (delivery.status === 'sent' || delivery.status === 'mocked') {
            summary.sent += 1;
          } else if (delivery.status === 'failed') {
            summary.failed += 1;
          } else {
            summary.skipped += 1;
          }
        } catch (err) {
          summary.failed += 1;
          logger.error('activity-reminder: send failed', err, {
            userId: reg.userId,
            activityId: activity._id
          });
        }
      }

      await CommunityActivity.findByIdAndUpdate(activity._id, { reminderSent: true });
    });
  }

  logger.info('activity-reminder: done', summary);
}

function startActivityReminderSchedule() {
  try {
    const instanceId = process.env.NODE_APP_INSTANCE;
    if (instanceId && instanceId !== '0') {
      logger.info(`Skipping activity reminder schedule on instance ${instanceId}`);
      return;
    }

    cron.schedule(
      '* * * * *',
      async () => {
        try {
          await sendActivityReminders();
        } catch (err) {
          logger.error('activity-reminder cron job failed', err);
        }
      },
      CRON_OPTIONS
    );

    logger.info('activity reminder schedule started (every minute)');
  } catch (err) {
    logger.error('Failed to start activity reminder schedule', err);
  }
}

module.exports = {
  sendActivityReminders,
  startActivityReminderSchedule,
  start: startActivityReminderSchedule
};
