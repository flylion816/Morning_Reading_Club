/**
 * 统一日志工具
 * 支持开发/生产环境切换
 *
 * 使用方法：
 * const logger = require('./logger');
 * logger.log('普通日志', data);
 * logger.warn('警告日志', data);
 * logger.error('错误日志', data);
 */

// 是否启用日志（生产环境设置为 false）
const isDev = __wxConfig?.envVersion !== 'release'; // release 是正式版
const ENABLE_LOG = isDev || process.env.DEBUG_LOG === 'true';

const logger = {
  /**
   * 普通日志
   */
  log(...args) {
    if (ENABLE_LOG) {
      console.log('[LOG]', ...args);
    }
  },

  /**
   * 信息日志
   */
  info(...args) {
    if (ENABLE_LOG) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * 警告日志
   */
  warn(...args) {
    if (ENABLE_LOG) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * 错误日志（生产环境也会输出）
   */
  error(...args) {
    console.error('[ERROR]', ...args);
  },

  /**
   * 调试日志（仅在开发环境输出）
   */
  debug(...args) {
    if (ENABLE_LOG) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * 性能日志
   */
  time(label) {
    if (ENABLE_LOG) {
      console.time(label);
    }
  },

  timeEnd(label) {
    if (ENABLE_LOG) {
      console.timeEnd(label);
    }
  },

  /**
   * 表格输出
   */
  table(data) {
    if (ENABLE_LOG && console.table) {
      console.table(data);
    }
  },

  /**
   * 分组日志
   */
  group(label) {
    if (ENABLE_LOG && console.group) {
      console.group(label);
    }
  },

  groupEnd() {
    if (ENABLE_LOG && console.groupEnd) {
      console.groupEnd();
    }
  },

  /**
   * 清空控制台
   */
  clear() {
    if (ENABLE_LOG && console.clear) {
      console.clear();
    }
  },

  /**
   * 获取当前日志状态
   */
  getStatus() {
    return {
      enabled: ENABLE_LOG,
      isDev: isDev,
      environment: isDev ? 'development' : 'production'
    };
  }
};

module.exports = logger;
