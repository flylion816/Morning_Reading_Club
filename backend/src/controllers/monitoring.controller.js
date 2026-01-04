const { success } = require('../utils/response');
const { getAggregatedMetrics } = require('../middleware/monitoring');
const alerting = require('../utils/alerting');
const redisManager = require('../utils/redis');
const logger = require('../utils/logger');

/**
 * 获取实时监控指标
 * GET /api/v1/monitoring/metrics
 */
async function getMetrics(req, res, next) {
  try {
    // 获取聚合指标
    const metrics = await getAggregatedMetrics();

    // 获取Redis状态
    const redisStatus = redisManager.getStatus();

    // 获取告警统计
    const alertStats = await alerting.getAlertStatistics();

    // 返回监控数据
    res.json(
      success(
        {
          metrics,
          redis: redisStatus,
          alerts: alertStats,
          timestamp: new Date().toISOString()
        },
        '获取监控指标成功'
      )
    );
  } catch (error) {
    logger.error('获取监控指标失败', error);
    next(error);
  }
}

/**
 * 获取系统健康检查
 * GET /api/v1/monitoring/health
 */
async function getHealth(req, res, next) {
  try {
    // 获取Redis状态
    const redisStatus = redisManager.getStatus();

    // 获取基本系统信息
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      redis: redisStatus,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };

    // 如果Redis连接失败，标记为降级模式
    if (!redisStatus.isConnected) {
      healthCheck.status = 'degraded';
      healthCheck.warning = 'Redis not available, using memory cache';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(
      success(healthCheck, `系统${healthCheck.status === 'healthy' ? '正常' : '降级'}`)
    );
  } catch (error) {
    logger.error('健康检查失败', error);
    next(error);
  }
}

/**
 * 获取最近的告警记录
 * GET /api/v1/monitoring/alerts
 */
async function getAlerts(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const alerts = await alerting.getRecentAlerts(limit);

    res.json(
      success(
        {
          total: alerts.length,
          alerts,
          timestamp: new Date().toISOString()
        },
        '获取告警记录成功'
      )
    );
  } catch (error) {
    logger.error('获取告警记录失败', error);
    next(error);
  }
}

/**
 * 清空告警日志
 * POST /api/v1/monitoring/alerts/clear
 */
async function clearAlerts(req, res, next) {
  try {
    await alerting.clearAlertLog();

    logger.info('告警日志已被清空', {
      userId: req.user?._id,
      timestamp: new Date().toISOString()
    });

    res.json(success(null, '告警日志已清空'));
  } catch (error) {
    logger.error('清空告警日志失败', error);
    next(error);
  }
}

/**
 * 获取监控统计信息
 * GET /api/v1/monitoring/stats
 */
async function getMonitoringStats(req, res, next) {
  try {
    const metrics = await getAggregatedMetrics();
    const alertStats = await alerting.getAlertStatistics();
    const redisStatus = redisManager.getStatus();

    const stats = {
      requests: {
        minuteTotal: metrics.minute.totalRequests,
        hourTotal: metrics.hour.totalRequests,
        minuteErrorRate: parseFloat(metrics.minute.errorRate),
        hourErrorRate: parseFloat(metrics.hour.errorRate)
      },
      alerts: alertStats,
      system: {
        redis: redisStatus,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    };

    res.json(success(stats, '获取监控统计成功'));
  } catch (error) {
    logger.error('获取监控统计失败', error);
    next(error);
  }
}

module.exports = {
  getMetrics,
  getHealth,
  getAlerts,
  clearAlerts,
  getMonitoringStats
};
