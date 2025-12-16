const { error } = require('../utils/response');
const logger = require('../utils/logger');

// 全局错误处理中间件
function errorHandler(err, req, res, next) {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  // 默认500错误
  let statusCode = err.statusCode || 500;
  let message = err.message || '服务器内部错误';

  // 特定错误类型处理
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = '参数验证失败';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = '未授权';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = '无效的ID格式';
  }

  // 生产环境不暴露详细错误信息
  if (process.env.NODE_ENV === 'production') {
    message = statusCode === 500 ? '服务器内部错误' : message;
  }

  res.status(statusCode).json(
    error(statusCode, message, {
      type: err.name,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    })
  );
}

// 404处理中间件
function notFoundHandler(req, res) {
  res.status(404).json(error(404, '请求的资源不存在'));
}

module.exports = {
  errorHandler,
  notFoundHandler
};
