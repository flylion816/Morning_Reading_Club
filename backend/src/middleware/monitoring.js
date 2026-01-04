const redisManager = require('../utils/redis');
const alerting = require('../utils/alerting');
const logger = require('../utils/logger');

/**
 * 性能监控中间件
 *
 * 功能：
 * - 捕获每个API请求的性能指标
 * - 聚合统计数据（响应时间、错误率、吞吐量）到Redis
 * - 自动检测异常并触发告警
 * - 内存缓存降级方案
 */

// 内存缓存用于降级存储
const memoryMetrics = {
  currentMinute: {},
  currentHour: {},
  lastAggregation: Date.now()
};

/**
 * 获取当前分钟的时间戳（用作Redis key的时间部分）
 */
function getCurrentMinuteKey() {
  const now = new Date();
  return Math.floor(now.getTime() / 60000); // 每分钟一个key
}

/**
 * 获取当前小时的时间戳
 */
function getCurrentHourKey() {
  const now = new Date();
  return Math.floor(now.getTime() / 3600000); // 每小时一个key
}

/**
 * 内存缓存降级
 */
function recordMetricsToMemory(metrics) {
  const now = new Date();
  const minuteKey = Math.floor(now.getTime() / 60000);

  if (!memoryMetrics.currentMinute[minuteKey]) {
    memoryMetrics.currentMinute[minuteKey] = {
      count: 0,
      errors: 0,
      totalDuration: 0,
      durations: [],
      slowQueries: []
    };
  }

  memoryMetrics.currentMinute[minuteKey].count += 1;
  memoryMetrics.currentMinute[minuteKey].totalDuration += metrics.duration;
  memoryMetrics.currentMinute[minuteKey].durations.push(metrics.duration);

  if (metrics.statusCode >= 400) {
    memoryMetrics.currentMinute[minuteKey].errors += 1;
  }

  if (metrics.duration > 2000) {
    memoryMetrics.currentMinute[minuteKey].slowQueries.push({
      endpoint: metrics.endpoint,
      duration: metrics.duration,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 记录请求指标到Redis/内存缓存
 */
async function recordMetrics(metrics) {
  try {
    const minuteKey = getCurrentMinuteKey();
    const hourKey = getCurrentHourKey();

    // 1. 记录请求计数
    const countKey = `metrics:count:${minuteKey}`;
    await redisManager.incr(countKey);
    await redisManager.expire(countKey, 3600); // 1小时过期

    // 2. 记录响应时间（使用有序集合）
    const latencyKey = `metrics:latency:${minuteKey}`;
    await redisManager.zAdd(latencyKey, metrics.duration, `${Date.now()}-${Math.random()}`);
    await redisManager.expire(latencyKey, 3600);

    // 3. 记录错误计数
    if (metrics.statusCode >= 400) {
      const errorKey = `metrics:errors:${minuteKey}`;
      await redisManager.incr(errorKey);
      await redisManager.expire(errorKey, 3600);
    }

    // 4. 记录慢查询（响应时间>2秒）
    if (metrics.duration > 2000) {
      const slowQueryKey = `metrics:slow_queries:${minuteKey}`;
      const slowQueryData = JSON.stringify({
        endpoint: metrics.endpoint,
        method: metrics.method,
        duration: metrics.duration,
        statusCode: metrics.statusCode,
        timestamp: new Date().toISOString()
      });
      await redisManager.zAdd(slowQueryKey, metrics.duration, slowQueryData);
      await redisManager.expire(slowQueryKey, 3600);
    }

    // 5. 更新小时级别的聚合数据
    const hourCountKey = `metrics:hour_count:${hourKey}`;
    await redisManager.incr(hourCountKey);
    await redisManager.expire(hourCountKey, 86400); // 24小时过期

    if (metrics.statusCode >= 400) {
      const hourErrorKey = `metrics:hour_errors:${hourKey}`;
      await redisManager.incr(hourErrorKey);
      await redisManager.expire(hourErrorKey, 86400);
    }
  } catch (error) {
    // Redis失败，记录到内存缓存
    logger.error('记录指标到Redis失败，使用内存缓存', error);
    recordMetricsToMemory(metrics);
  }
}

/**
 * 检查告警条件并触发告警
 */
async function checkAlerts(metrics) {
  try {
    const minuteKey = getCurrentMinuteKey();

    // 获取当前指标
    const countKey = `metrics:count:${minuteKey}`;
    const errorKey = `metrics:errors:${minuteKey}`;

    const totalCount = await redisManager.get(countKey);
    const errorCount = await redisManager.get(errorKey);

    if (!totalCount || totalCount === '0') {
      return; // 还没有足够的数据
    }

    const count = parseInt(totalCount, 10);
    const errors = parseInt(errorCount || '0', 10);

    // 计算错误率和平均响应时间
    const errorRate = count > 0 ? errors / count : 0;

    // 根据条件触发告警
    const alerts = [];

    // 检查错误率
    if (errorRate > 0.1) {
      // 错误率>10%
      alerts.push({
        severity: 'CRITICAL',
        type: 'ERROR_RATE',
        message: `API错误率达到${(errorRate * 100).toFixed(2)}% (阈值: 10%)`,
        value: errorRate,
        threshold: 0.1
      });
    } else if (errorRate > 0.05) {
      // 错误率>5%
      alerts.push({
        severity: 'HIGH',
        type: 'ERROR_RATE',
        message: `API错误率达到${(errorRate * 100).toFixed(2)}% (阈值: 5%)`,
        value: errorRate,
        threshold: 0.05
      });
    } else if (errorRate > 0.01) {
      // 错误率>1%
      alerts.push({
        severity: 'MEDIUM',
        type: 'ERROR_RATE',
        message: `API错误率达到${(errorRate * 100).toFixed(2)}% (阈值: 1%)`,
        value: errorRate,
        threshold: 0.01
      });
    }

    // 检查响应时间
    if (metrics.duration > 5000) {
      // 单个请求>5秒
      alerts.push({
        severity: 'CRITICAL',
        type: 'RESPONSE_TIME',
        endpoint: metrics.endpoint,
        message: `${metrics.endpoint} 响应时间${(metrics.duration / 1000).toFixed(2)}秒 (阈值: 5秒)`,
        value: metrics.duration,
        threshold: 5000
      });
    } else if (metrics.duration > 3000) {
      // 单个请求>3秒
      alerts.push({
        severity: 'HIGH',
        type: 'RESPONSE_TIME',
        endpoint: metrics.endpoint,
        message: `${metrics.endpoint} 响应时间${(metrics.duration / 1000).toFixed(2)}秒 (阈值: 3秒)`,
        value: metrics.duration,
        threshold: 3000
      });
    }

    // 触发所有告警
    for (const alert of alerts) {
      await alerting.trigger(alert);
    }
  } catch (error) {
    logger.error('检查告警条件失败', error);
  }
}

/**
 * 监控中间件工厂函数
 */
function monitoringMiddleware(options = {}) {
  const { enabled = true } = options;

  return (req, res, next) => {
    // 如果禁用了监控，直接跳过
    if (!enabled) {
      return next();
    }

    // 记录请求开始时间
    const startTime = Date.now();

    // 保存原始的res.json和res.send方法
    const originalJson = res.json;
    const originalSend = res.send;

    // 拦截res.json响应
    res.json = function interceptJson(data) {
      const duration = Date.now() - startTime;

      // 记录指标
      recordMetrics({
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        userId: req.user?._id || req.user?.userId,
        timestamp: new Date().toISOString()
      });

      // 检查告警
      checkAlerts({
        endpoint: req.path,
        statusCode: res.statusCode,
        duration
      });

      // 调用原始方法
      return originalJson.call(this, data);
    };

    // 拦截res.send响应
    res.send = function interceptSend(data) {
      const duration = Date.now() - startTime;

      // 记录指标
      recordMetrics({
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        userId: req.user?._id || req.user?.userId,
        timestamp: new Date().toISOString()
      });

      // 检查告警
      checkAlerts({
        endpoint: req.path,
        statusCode: res.statusCode,
        duration
      });

      // 调用原始方法
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * 获取聚合指标
 */
async function getAggregatedMetrics() {
  try {
    const minuteKey = getCurrentMinuteKey();
    const hourKey = getCurrentHourKey();

    // 获取当前分钟的指标
    const countKey = `metrics:count:${minuteKey}`;
    const errorKey = `metrics:errors:${minuteKey}`;
    const latencyKey = `metrics:latency:${minuteKey}`;

    const totalCount = await redisManager.get(countKey);
    const errorCount = await redisManager.get(errorKey);
    const latencies = await redisManager.zCard(latencyKey);

    const count = parseInt(totalCount || '0', 10);
    const errors = parseInt(errorCount || '0', 10);

    // 获取小时级数据
    const hourCountKey = `metrics:hour_count:${hourKey}`;
    const hourErrorKey = `metrics:hour_errors:${hourKey}`;

    const hourCount = await redisManager.get(hourCountKey);
    const hourErrors = await redisManager.get(hourErrorKey);

    return {
      minute: {
        totalRequests: count,
        totalErrors: errors,
        errorRate: count > 0 ? (errors / count).toFixed(4) : 0,
        latencyDataPoints: latencies,
        timestamp: new Date().toISOString()
      },
      hour: {
        totalRequests: parseInt(hourCount || '0', 10),
        totalErrors: parseInt(hourErrors || '0', 10),
        errorRate: (parseInt(hourCount || '0', 10)) > 0
          ? ((parseInt(hourErrors || '0', 10)) / (parseInt(hourCount || '0', 10))).toFixed(4)
          : 0
      }
    };
  } catch (error) {
    logger.error('获取聚合指标失败', error);
    return {
      minute: { totalRequests: 0, totalErrors: 0, errorRate: 0 },
      hour: { totalRequests: 0, totalErrors: 0, errorRate: 0 }
    };
  }
}

module.exports = {
  monitoringMiddleware,
  getAggregatedMetrics,
  recordMetrics
};
