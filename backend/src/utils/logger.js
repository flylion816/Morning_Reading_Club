/**
 * Winston 日志系统配置
 *
 * 提供生产级别的日志记录，包括：
 * - 日志级别：error, warn, info, debug
 * - 多个传输方式：console, file, errors
 * - 日志旋转：按日期自动分割
 * - 不同环境配置：开发、生产环境自动适应
 *
 * 使用方法：
 *   const logger = require('./utils/logger');
 *   logger.info('应用启动成功');
 *   logger.error('发生错误', { userId: '123' });
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * 日志格式定义
 */
const formats = {
  // 简洁格式（用于开发环境）
  simple: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        metaStr = ` ${JSON.stringify(meta)}`;
      }
      return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
  ),

  // 详细格式（用于生产环境）
  detailed: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss Z' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const log = {
        timestamp,
        level,
        message,
        ...meta,
      };
      return JSON.stringify(log);
    })
  ),

  // 仅文本格式（用于错误日志）
  errorFormat: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss Z' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const lines = [
        `[${timestamp}] ${level.toUpperCase()}: ${message}`,
      ];
      if (stack) {
        lines.push(`Stack: ${stack}`);
      }
      if (Object.keys(meta).length > 0) {
        lines.push(`Context: ${JSON.stringify(meta)}`);
      }
      return lines.join('\n');
    })
  ),
};

/**
 * 传输方式配置
 */
const transports = [];

// 1. 控制台输出
const consoleFormat = process.env.NODE_ENV === 'production'
  ? formats.simple
  : formats.simple;

transports.push(
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  })
);

// 2. 全部日志文件
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: formats.detailed,
    maxsize: 10485760, // 10MB
    maxFiles: 14, // 保留14天
    level: process.env.LOG_LEVEL || 'info',
  })
);

// 3. 错误日志文件
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    format: formats.errorFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 30, // 保留30天的错误日志
    level: 'error',
  })
);

// 4. 警告日志文件
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'warn.log'),
    format: formats.detailed,
    maxsize: 5242880, // 5MB
    maxFiles: 7, // 保留7天
    level: 'warn',
  })
);

/**
 * 开发环境：添加调试日志文件
 */
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'debug.log'),
      format: formats.detailed,
      maxsize: 5242880, // 5MB
      maxFiles: 3, // 保留3天
      level: 'debug',
    })
  );
}

/**
 * 创建 Logger 实例
 */
const logger = winston.createLogger({
  // 默认日志级别
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // 日志格式和传输方式
  format: formats.detailed,
  transports,
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: formats.errorFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 30,
    }),
  ],
  // 处理未处理的 Promise 拒绝
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: formats.errorFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 30,
    }),
  ],
});

/**
 * 生产环境：禁止在控制台输出 debug 级别日志
 */
if (process.env.NODE_ENV === 'production') {
  logger.transports.forEach(transport => {
    if (transport instanceof winston.transports.Console) {
      transport.level = 'info';
    }
  });
}

/**
 * 日志方法包装
 * 添加额外功能如自动记录请求ID、用户信息等
 */
const loggerWrapper = {
  /**
   * 记录信息级别日志
   */
  info: (message, meta = {}) => {
    const context = _buildContext(meta);
    logger.info(message, context);
  },

  /**
   * 记录警告级别日志
   */
  warn: (message, meta = {}) => {
    const context = _buildContext(meta);
    logger.warn(message, context);
  },

  /**
   * 记录错误级别日志
   */
  error: (message, error = null, meta = {}) => {
    const context = _buildContext(meta);
    if (error instanceof Error) {
      context.stack = error.stack;
      context.message = error.message;
    } else if (typeof error === 'object') {
      Object.assign(context, error);
    }
    logger.error(message, context);
  },

  /**
   * 记录调试级别日志
   */
  debug: (message, meta = {}) => {
    const context = _buildContext(meta);
    logger.debug(message, context);
  },

  /**
   * 记录HTTP请求
   */
  http: (method, url, statusCode, duration, userId = null) => {
    const context = {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      userId,
    };
    const message = `HTTP ${method} ${url} ${statusCode}`;
    const level = statusCode >= 400 ? 'warn' : 'info';
    logger[level](message, context);
  },

  /**
   * 记录数据库操作
   */
  database: (operation, collection, duration, success = true, meta = {}) => {
    const context = {
      operation,
      collection,
      duration: `${duration}ms`,
      success,
      ...meta,
    };
    const message = `[DB] ${operation} on ${collection}`;
    const level = success ? 'debug' : 'warn';
    logger[level](message, context);
  },

  /**
   * 记录认证事件
   */
  auth: (event, userId, meta = {}) => {
    const context = {
      event,
      userId,
      ...meta,
    };
    logger.info(`[AUTH] ${event}`, context);
  },

  /**
   * 记录业务事件
   */
  event: (eventType, description, meta = {}) => {
    const context = {
      eventType,
      ...meta,
    };
    logger.info(`[EVENT] ${eventType}: ${description}`, context);
  },

  /**
   * 获取 Winston 实例（高级使用）
   */
  getWinstonLogger: () => logger,
};

/**
 * 辅助函数：构建日志上下文
 */
function _buildContext(meta) {
  const context = { ...meta };

  // 添加进程信息
  if (!context.pid) {
    context.pid = process.pid;
  }

  // 添加内存信息
  if (!context.memory && process.env.NODE_ENV === 'production') {
    const memUsage = process.memoryUsage();
    context.memory = {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    };
  }

  return context;
}

module.exports = loggerWrapper;
