/**
 * 统一日志工具 - Admin Vue 前端
 * 支持开发/生产环境切换
 *
 * 使用方法：
 * import logger from './logger';
 * logger.log('普通日志', data);
 * logger.warn('警告日志', data);
 * logger.error('错误日志', data);
 */

const isDev = import.meta.env.DEV;
const ENABLE_LOG = isDev || import.meta.env.VITE_DEBUG_LOG === 'true';

interface LoggerOptions {
  prefix?: string;
  color?: string;
}

const logger = {
  /**
   * 普通日志
   */
  log(message: string, data?: any, options?: LoggerOptions) {
    if (ENABLE_LOG) {
      const prefix = options?.prefix || '[LOG]';
      const color = options?.color || 'color: #0066cc';
      console.log(`%c${prefix}`, color, message, data);
    }
  },

  /**
   * 信息日志
   */
  info(message: string, data?: any, options?: LoggerOptions) {
    if (ENABLE_LOG) {
      const prefix = options?.prefix || '[INFO]';
      const color = options?.color || 'color: #0066cc';
      console.log(`%c${prefix}`, color, message, data);
    }
  },

  /**
   * 警告日志
   */
  warn(message: string, data?: any, options?: LoggerOptions) {
    if (ENABLE_LOG) {
      const prefix = options?.prefix || '[WARN]';
      const color = options?.color || 'color: #ff9900';
      console.warn(`%c${prefix}`, color, message, data);
    }
  },

  /**
   * 错误日志（生产环境也会输出）
   */
  error(message: string, error?: Error | any, options?: LoggerOptions) {
    const prefix = options?.prefix || '[ERROR]';
    const color = options?.color || 'color: #ff0000';
    console.error(`%c${prefix}`, color, message, error);
  },

  /**
   * 调试日志（仅在开发环境输出）
   */
  debug(message: string, data?: any, options?: LoggerOptions) {
    if (ENABLE_LOG) {
      const prefix = options?.prefix || '[DEBUG]';
      const color = options?.color || 'color: #00cc00';
      console.log(`%c${prefix}`, color, message, data);
    }
  },

  /**
   * 性能日志
   */
  time(label: string) {
    if (ENABLE_LOG) {
      console.time(label);
    }
  },

  timeEnd(label: string) {
    if (ENABLE_LOG) {
      console.timeEnd(label);
    }
  },

  /**
   * 表格输出
   */
  table(data: any) {
    if (ENABLE_LOG && console.table) {
      console.table(data);
    }
  },

  /**
   * 分组日志
   */
  group(label: string) {
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

export default logger;
