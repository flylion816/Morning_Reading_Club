const auditService = require('../services/audit.service');
const logger = require('./logger');

/**
 * 审计日志辅助工具 - 在各个 controller 中使用
 */
class AuditHelper {
  /**
   * 记录批量批准操作
   */
  static async logBatchApprove(req, ids, resourceType = 'enrollment', description = '批量批准') {
    try {
      const log = {
        adminId: req.user.id,
        adminName: req.user.name,
        actionType: 'BATCH_UPDATE',
        resourceType,
        description,
        details: {
          batchCount: ids.length,
          resourceIds: ids
        },
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
        status: 'success'
      }

      await auditService.createLog(log)
    } catch (error) {
      logger.error('记录批量批准日志失败:', error)
    }
  }

  /**
   * 记录批量拒绝操作
   */
  static async logBatchReject(req, ids, reason = '', resourceType = 'enrollment', description = '批量拒绝') {
    try {
      const log = {
        adminId: req.user.id,
        adminName: req.user.name,
        actionType: 'BATCH_UPDATE',
        resourceType,
        description,
        details: {
          batchCount: ids.length,
          resourceIds: ids,
          reason
        },
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
        status: 'success'
      }

      await auditService.createLog(log)
    } catch (error) {
      logger.error('记录批量拒绝日志失败:', error)
    }
  }

  /**
   * 记录批量删除操作
   */
  static async logBatchDelete(req, ids, resourceType = 'enrollment', description = '批量删除') {
    try {
      const log = {
        adminId: req.user.id,
        adminName: req.user.name,
        actionType: 'BATCH_DELETE',
        resourceType,
        description,
        details: {
          batchCount: ids.length,
          resourceIds: ids
        },
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
        status: 'success'
      }

      await auditService.createLog(log)
    } catch (error) {
      logger.error('记录批量删除日志失败:', error)
    }
  }

  /**
   * 记录单个操作
   */
  static async logAction(req, actionType, resourceType, resourceId, resourceName, description, changes = null) {
    try {
      const log = {
        adminId: req.user.id,
        adminName: req.user.name,
        actionType,
        resourceType,
        resourceId,
        resourceName,
        description,
        details: {
          changes
        },
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
        status: 'success'
      }

      await auditService.createLog(log)
    } catch (error) {
      logger.error('记录操作日志失败:', error)
    }
  }

  /**
   * 记录登录操作
   */
  static async logLogin(req, adminId, adminName) {
    try {
      const log = {
        adminId,
        adminName,
        actionType: 'LOGIN',
        resourceType: 'system',
        description: '管理员登录',
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
        status: 'success'
      }

      await auditService.createLog(log)
    } catch (error) {
      logger.error('记录登录日志失败:', error)
    }
  }

  /**
   * 记录登出操作
   */
  static async logLogout(req) {
    try {
      const log = {
        adminId: req.user?.id,
        adminName: req.user?.name,
        actionType: 'LOGOUT',
        resourceType: 'system',
        description: '管理员登出',
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
        status: 'success'
      }

      await auditService.createLog(log)
    } catch (error) {
      logger.error('记录登出日志失败:', error)
    }
  }

  /**
   * 记录错误操作
   */
  static async logError(req, actionType, resourceType, errorMessage, resourceId = null) {
    try {
      const log = {
        adminId: req.user?.id,
        adminName: req.user?.name,
        actionType,
        resourceType,
        resourceId,
        description: `操作失败: ${errorMessage}`,
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
        status: 'failure',
        errorMessage
      }

      await auditService.createLog(log)
    } catch (error) {
      logger.error('记录错误日志失败:', error)
    }
  }

  /**
   * 获取客户端IP
   */
  static getClientIp(req) {
    return (
      (req.headers['x-forwarded-for'] || '').split(',')[0] ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    )
  }

  /**
   * 比较两个对象的差异，用于变更记录
   */
  static compareChanges(oldData, newData, fieldsToTrack = null) {
    const changes = {}

    // 确定要追踪的字段
    const fieldsToCheck = fieldsToTrack || Object.keys({ ...oldData, ...newData })

    fieldsToCheck.forEach(field => {
      // 忽略系统字段
      if (['_id', 'createdAt', 'updatedAt', '__v', 'password'].includes(field)) {
        return
      }

      const oldValue = oldData?.[field]
      const newValue = newData?.[field]

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[field] = {
          before: oldValue,
          after: newValue
        }
      }
    })

    return Object.keys(changes).length > 0 ? changes : null
  }
}

module.exports = AuditHelper
