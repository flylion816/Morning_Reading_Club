const auditService = require('../services/audit.service');
const logger = require('../utils/logger');

/**
 * 审计日志中间件 - 自动记录所有API操作
 * 需要在路由之前注册：app.use(auditLogMiddleware)
 */
const auditLogMiddleware = (req, res, next) => {
  // 保存原始的send方法
  const originalSend = res.send;
  const originalJson = res.json;

  // 存储响应信息
  res.auditInfo = {
    startTime: Date.now(),
    method: req.method,
    path: req.path,
    statusCode: null,
    responseBody: null
  };

  // 覆盖send方法
  res.send = function (data) {
    res.auditInfo.statusCode = res.statusCode;
    if (typeof data === 'object') {
      res.auditInfo.responseBody = data;
    }
    return originalSend.call(this, data);
  };

  // 覆盖json方法
  res.json = function (data) {
    res.auditInfo.statusCode = res.statusCode;
    res.auditInfo.responseBody = data;
    return originalJson.call(this, data);
  };

  // 在响应完成后记录
  res.on('finish', async () => {
    try {
      // 跳过某些不需要记录的路由
      if (shouldSkipAudit(req)) {
        return;
      }

      const actor = getAuditActor(req);
      if (!actor) {
        return;
      }

      const method = req.method;
      const path = getRequestPath(req);
      const auditInfo = res.auditInfo || {};
      const statusCode = auditInfo.statusCode || res.statusCode;

      // 只记录状态码为 200-299 的操作（成功）和某些失败的关键操作
      const shouldLog =
        (statusCode >= 200 && statusCode < 300) || // 成功
        (statusCode >= 400 && isImportantAction(method, path)); // 重要操作的失败

      if (!shouldLog) {
        return;
      }

      const actionInfo = extractActionInfo(method, path, req.body);

      // 创建审计日志
      const auditLog = {
        adminId: actor.id,
        adminName: actor.name,
        actionType: actionInfo.actionType,
        resourceType: actionInfo.resourceType,
        resourceId: actionInfo.resourceId,
        resourceName: actionInfo.resourceName,
        description: actionInfo.description,
        changes: actionInfo.changes,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        status: statusCode < 300 ? 'success' : 'failure',
        errorMessage: statusCode >= 400 ? auditInfo.responseBody?.message || '操作失败' : null
      };

      await auditService.createLog(auditLog);
    } catch (error) {
      logger.error('创建审计日志失败:', error);
      // 不影响正常的API响应
    }
  });

  next();
};

/**
 * 判断是否应该跳过记录
 */
function shouldSkipAudit(req) {
  const path = getRequestPath(req);
  const skipPaths = [
    '/api/v1/auth/login', // 登录已有专门处理
    '/api/v1/auth/admin/login', // 管理员登录已有专门处理
    '/api/v1/auth/admin/logout', // 管理员登出已有专门处理
    '/api/v1/auth/admin/refresh-token', // token续期不记录
    '/api/v1/health', // 健康检查
    '/api/v1/audit-logs', // 查看日志不记录
    '/uploads', // 文件上传
    '/api/v1/stats', // 查看统计不记录
    '/api/v1/activities' // 查看活跃度统计不记录
  ];

  return skipPaths.some(skipPath => path.startsWith(skipPath)) || req.method === 'GET';
}

/**
 * 判断是否是重要操作
 */
function isImportantAction(method, path) {
  const importantPaths = [
    '/api/v1/enrollments', // 报名
    '/api/v1/payments', // 支付
    '/api/v1/periods', // 期次
    '/api/v1/admin/periods', // 后台期次
    '/api/v1/admin/sections', // 后台课节
    '/api/v1/admin/checkins', // 后台打卡
    '/api/v1/auth/admin', // 管理员账户操作
    '/api/v1/admins', // 管理员管理
    '/api/v1/admin' // 管理员操作
  ];

  const isImportantPath = importantPaths.some(p => path.startsWith(p));
  const isModifyMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  return isImportantPath && isModifyMethod;
}

/**
 * 从请求中提取操作信息
 */
function extractActionInfo(method, path, body) {
  let actionType = 'UPDATE';
  let resourceType = 'system';
  let resourceId = null;
  let resourceName = null;
  let description = null;
  let changes = null;

  // 解析路径和方法确定操作类型
  if (method === 'POST') {
    actionType = 'CREATE';
  } else if (method === 'DELETE') {
    actionType = 'DELETE';
  } else if (method === 'PUT' || method === 'PATCH') {
    actionType = 'UPDATE';
  }

  // 提取资源类型和ID
  if (path.includes('/enrollments')) {
    resourceType = 'enrollment';
    const match = path.match(/\/enrollments\/([a-f0-9]{24})/);
    if (match) resourceId = match[1];

    if (actionType === 'CREATE') {
      description = `创建报名：${body?.periodId || ''}`;
    } else if (actionType === 'UPDATE') {
      if (path.includes('approve')) {
        actionType = 'APPROVE';
        description = '批准报名';
      } else if (path.includes('reject')) {
        actionType = 'REJECT';
        description = '拒绝报名';
        changes = { reason: { before: null, after: body?.reason } };
      } else {
        description = '更新报名信息';
      }
    }
  } else if (path.includes('/periods')) {
    resourceType = 'period';
    const match = path.match(/\/periods\/([a-f0-9]{24})/);
    if (match) resourceId = match[1];

    description =
      actionType === 'CREATE' ? '创建期次' : actionType === 'DELETE' ? '删除期次' : '更新期次';
  } else if (path.includes('/payments')) {
    resourceType = 'payment';
    const match = path.match(/\/payments\/([a-f0-9]{24})/);
    if (match) resourceId = match[1];

    if (path.includes('confirm')) {
      actionType = 'UPDATE';
      description = '确认支付';
    } else {
      description =
        actionType === 'CREATE'
          ? '创建支付订单'
          : actionType === 'DELETE'
            ? '取消支付'
            : '更新支付';
    }
  } else if (path.includes('/sections')) {
    resourceType = 'section';
    const match = path.match(/\/sections\/([a-f0-9]{24})/);
    if (match) resourceId = match[1];

    description =
      actionType === 'CREATE' ? '创建课节' : actionType === 'DELETE' ? '删除课节' : '更新课节';
  } else if (path.includes('/checkins')) {
    resourceType = 'system';
    const match = path.match(/\/checkins\/([a-f0-9]{24})/);
    if (match) resourceId = match[1];

    description = actionType === 'DELETE' ? '删除打卡记录' : '更新打卡记录';
  } else if (path.includes('/auth/admin/change-password')) {
    resourceType = 'admin';
    description = '修改管理员密码';
  } else if (path.includes('/auth/admin/change-db-access-password')) {
    resourceType = 'admin';
    description = '修改数据库访问密码';
  } else if (path.includes('/auth/admin/verify-db-access')) {
    resourceType = 'system';
    description = '验证数据库访问密码';
  } else if (path.includes('/admins') || path.includes('/admin')) {
    resourceType = 'admin';
    const match = path.match(/\/admins?\/([a-f0-9]{24})/);
    if (match) resourceId = match[1];

    description =
      actionType === 'CREATE'
        ? '添加管理员'
        : actionType === 'DELETE'
          ? '删除管理员'
          : '更新管理员信息';
  }

  return {
    actionType,
    resourceType,
    resourceId,
    resourceName,
    description: description || `${actionType} ${resourceType}`,
    changes
  };
}

function getRequestPath(req) {
  return req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
}

function getAuditActor(req) {
  const principal = req.admin || req.user;
  if (!principal) {
    return null;
  }

  const role = principal.role;
  const isAdmin = ['superadmin', 'admin', 'operator'].includes(role);
  const id = principal.id || principal._id || principal.userId;

  if (!isAdmin || !id) {
    return null;
  }

  return {
    id,
    name: principal.name || principal.email || '管理员'
  };
}

module.exports = auditLogMiddleware;
