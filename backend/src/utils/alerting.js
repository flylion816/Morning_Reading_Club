const fs = require('fs');
const path = require('path');
const redisManager = require('./redis');
const logger = require('./logger');

/**
 * 告警引擎
 *
 * 功能：
 * - 告警规则检查和触发
 * - 告警去重（防止短时间内重复告警）
 * - 告警日志记录
 * - 支持多个告警级别 (CRITICAL, HIGH, MEDIUM, LOW)
 */

class AlertingEngine {
  constructor() {
    this.alertLog = path.join(process.cwd(), 'logs', 'alerts.log');
    this.deduplicationWindow = 5 * 60 * 1000; // 5分钟内的相同告警只触发一次
    this.deduplicationMap = new Map(); // 本地去重记录

    // 确保logs目录存在
    const logsDir = path.dirname(this.alertLog);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * 生成告警的唯一标识
   */
  // eslint-disable-next-line class-methods-use-this
  generateAlertId(alert) {
    const key = `${alert.severity}_${alert.type}_${alert.endpoint || 'global'}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * 检查告警是否应该被触发（去重逻辑）
   */
  shouldTriggerAlert(alertId) {
    const lastTime = this.deduplicationMap.get(alertId);
    const now = Date.now();

    if (!lastTime) {
      this.deduplicationMap.set(alertId, now);
      return true;
    }

    if (now - lastTime >= this.deduplicationWindow) {
      this.deduplicationMap.set(alertId, now);
      return true;
    }

    return false;
  }

  /**
   * 清理过期的去重记录
   */
  cleanupDeduplication() {
    const now = Date.now();
    // eslint-disable-next-line no-restricted-syntax
    for (const [id, time] of this.deduplicationMap.entries()) {
      if (now - time > this.deduplicationWindow * 2) {
        this.deduplicationMap.delete(id);
      }
    }
  }

  /**
   * 格式化告警消息
   */
  // eslint-disable-next-line class-methods-use-this
  formatAlertMessage(alert) {
    const timestamp = new Date().toISOString();
    const severity = alert.severity || 'UNKNOWN';
    const type = alert.type || 'UNKNOWN';
    const message = alert.message || 'No description';

    return `[${timestamp}] [${severity}] [${type}] ${message}`;
  }

  /**
   * 将告警写入日志文件
   */
  async writeAlertLog(alert) {
    try {
      const message = this.formatAlertMessage(alert);

      // 异步写入日志文件
      fs.appendFileSync(this.alertLog, `${message}\n`);

      // 使用logger同时记录
      if (alert.severity === 'CRITICAL') {
        logger.error(alert.message, new Error(alert.message), {
          type: alert.type,
          endpoint: alert.endpoint
        });
      } else if (alert.severity === 'HIGH') {
        logger.warn(alert.message, {
          type: alert.type,
          endpoint: alert.endpoint
        });
      } else {
        logger.info(alert.message, {
          type: alert.type,
          endpoint: alert.endpoint
        });
      }
    } catch (error) {
      logger.error('写入告警日志失败', error, {
        alertMessage: alert.message
      });
    }
  }

  /**
   * 存储告警到Redis
   */
  // eslint-disable-next-line class-methods-use-this
  async storeAlertToRedis(alert) {
    try {
      const alertKey = `alert:${alert.severity}:${alert.type}`;
      const alertData = JSON.stringify({
        ...alert,
        timestamp: new Date().toISOString()
      });

      // 存储到Redis列表，最多保留100条
      await redisManager.set(alertKey, alertData);
      await redisManager.expire(alertKey, 3600); // 1小时过期
    } catch (error) {
      logger.error('存储告警到Redis失败', error);
    }
  }

  /**
   * 触发告警
   */
  async trigger(alert) {
    try {
      // 检查告警是否应该被触发（去重）
      const alertId = this.generateAlertId(alert);
      if (!this.shouldTriggerAlert(alertId)) {
        logger.debug('告警被去重，不触发', {
          type: alert.type,
          severity: alert.severity
        });
        return;
      }

      // 清理过期去重记录
      this.cleanupDeduplication();

      // 写入告警日志
      await this.writeAlertLog(alert);

      // 存储到Redis
      await this.storeAlertToRedis(alert);

      // 如果是CRITICAL级别，可以在这里添加额外的处理（如发送邮件、钉钉通知等）
      if (alert.severity === 'CRITICAL') {
        logger.error('🚨 CRITICAL告警: ' + alert.message);
        // TODO: 添加邮件通知、钉钉通知等
      }
    } catch (error) {
      logger.error('触发告警失败', error, {
        alertType: alert.type
      });
    }
  }

  /**
   * 获取最近的告警记录
   */
  async getRecentAlerts(limit = 50) {
    try {
      // 从logs/alerts.log读取最后N行
      const lines = fs.readFileSync(this.alertLog, 'utf-8')
        .split('\n')
        .filter(line => line.trim() !== '')
        .slice(-limit);

      return lines;
    } catch (error) {
      logger.error('读取告警记录失败', error);
      return [];
    }
  }

  /**
   * 清空告警日志
   */
  async clearAlertLog() {
    try {
      fs.writeFileSync(this.alertLog, '');
      logger.info('告警日志已清空');
    } catch (error) {
      logger.error('清空告警日志失败', error);
    }
  }

  /**
   * 获取告警统计
   */
  async getAlertStatistics() {
    try {
      const lines = fs.readFileSync(this.alertLog, 'utf-8')
        .split('\n')
        .filter(line => line.trim() !== '');

      const stats = {
        total: lines.length,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        byType: {}
      };

      // eslint-disable-next-line no-restricted-syntax
      for (const line of lines) {
        if (line.includes('[CRITICAL]')) {
          stats.critical += 1;
        } else if (line.includes('[HIGH]')) {
          stats.high += 1;
        } else if (line.includes('[MEDIUM]')) {
          stats.medium += 1;
        } else if (line.includes('[LOW]')) {
          stats.low += 1;
        }

        // 按类型统计
        const typeMatch = line.match(/\[(.*?)\]/);
        if (typeMatch && typeMatch[2]) {
          const type = typeMatch[2];
          stats.byType[type] = (stats.byType[type] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      logger.error('获取告警统计失败', error);
      return {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        byType: {}
      };
    }
  }
}

// 导出单例
module.exports = new AlertingEngine();
