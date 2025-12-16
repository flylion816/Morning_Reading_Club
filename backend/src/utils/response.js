/**
 * 统一响应格式
 */

// 成功响应
function success(data, message = 'success') {
  return {
    code: 0,
    message,
    data,
    timestamp: Date.now()
  };
}

// 分页响应
function successWithPagination(items, pagination, message = 'success') {
  return {
    code: 0,
    message,
    data: {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.pageSize),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.pageSize),
        hasPrev: pagination.page > 1
      }
    },
    timestamp: Date.now()
  };
}

// 错误响应
function error(code, message, details = null) {
  const response = {
    code,
    message,
    timestamp: Date.now()
  };

  if (details) {
    response.error = details;
  }

  return response;
}

// 常用错误响应
const errors = {
  badRequest: (message = '参数错误', details = null) => error(400, message, details),
  unauthorized: (message = '未授权') => error(401, message),
  forbidden: (message = '无权限访问') => error(403, message),
  notFound: (message = '资源不存在') => error(404, message),
  conflict: (message = '资源冲突') => error(409, message),
  tooManyRequests: (message = '请求过于频繁') => error(429, message),
  serverError: (message = '服务器内部错误') => error(500, message)
};

module.exports = {
  success,
  successWithPagination,
  error,
  errors
};
