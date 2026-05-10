const cron = require('node-cron');
const Period = require('../models/Period');
const logger = require('../utils/logger');
const { getPeriodDateKeys, getShanghaiDateKey } = require('../utils/study-reminder.utils');
const { publishSyncEvent } = require('./sync.service');

const CRON_OPTIONS = { timezone: 'Asia/Shanghai' };
const STATUS_TEXT_MAP = {
  not_started: '未开始',
  ongoing: '进行中',
  completed: '已完成'
};

function calculatePeriodStatus(period, now = new Date()) {
  const todayKey = getShanghaiDateKey(now);
  const { startKey, endKey } = getPeriodDateKeys(period);

  if (!startKey || !endKey || todayKey < startKey) {
    return 'not_started';
  }
  if (todayKey > endKey) {
    return 'completed';
  }
  return 'ongoing';
}

function getPeriodStatusText(status) {
  return STATUS_TEXT_MAP[status] || '未知状态';
}

async function syncAllPeriodsStatus({ now = new Date(), emitSyncEvent = true } = {}) {
  const periods = await Period.find({}).select('_id name status startDate endDate');

  let updatedCount = 0;
  const updates = [];

  for (const period of periods) {
    const expectedStatus = calculatePeriodStatus(period, now);
    if (period.status !== expectedStatus) {
      const oldStatus = period.status;
      period.status = expectedStatus;
      await period.save();
      updatedCount += 1;
      updates.push({
        periodId: period._id.toString(),
        periodName: period.name,
        oldStatus,
        newStatus: expectedStatus
      });

      if (emitSyncEvent) {
        publishSyncEvent({
          type: 'update',
          collection: 'periods',
          documentId: period._id.toString(),
          data: period.toObject()
        });
      }
    }
  }

  return {
    totalPeriods: periods.length,
    updatedCount,
    updates
  };
}

function startPeriodStatusSchedules() {
  const instanceId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
  if (instanceId !== '0') {
    logger.info(`Skipping period status schedules on instance ${instanceId} (only instance 0 runs period status sync)`);
    return;
  }

  syncAllPeriodsStatus()
    .then(result => {
      logger.info('✅ Period status startup sync completed', result);
    })
    .catch(error => {
      logger.error('Failed to run period status startup sync', error);
    });

  cron.schedule(
    '5 0 * * *',
    async () => {
      try {
        logger.info('🔄 Period status scheduled sync triggered');
        const result = await syncAllPeriodsStatus();
        logger.info('✅ Period status scheduled sync completed', result);
      } catch (error) {
        logger.error('Failed to run scheduled period status sync', error);
      }
    },
    CRON_OPTIONS
  );

  logger.info('✅ Period status schedules started successfully', {
    cron: '5 0 * * *',
    timezone: CRON_OPTIONS.timezone
  });
}

module.exports = {
  calculatePeriodStatus,
  getPeriodStatusText,
  startPeriodStatusSchedules,
  syncAllPeriodsStatus
};
