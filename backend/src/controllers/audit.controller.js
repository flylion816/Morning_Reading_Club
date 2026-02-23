const auditService = require('../services/audit.service');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 审计日志控制器
 */
class AuditController {
  /**
   * 获取审计日志列表
   * GET /api/v1/audit-logs
   */
  // eslint-disable-next-line class-methods-use-this
  async getLogs(req, res) {
    try {
      const {
        page = 1,
        pageSize = 20,
        adminId,
        actionType,
        resourceType,
        startDate,
        endDate,
        status
      } = req.query;

      const query = {};
      if (adminId) query.adminId = adminId;
      if (actionType) query.actionType = actionType;
      if (resourceType) query.resourceType = resourceType;
      if (status) query.status = status;
      if (startDate || endDate) {
        query.startDate = startDate;
        query.endDate = endDate;
      }

      const result = await auditService.getLogs(query, parseInt(page, 10), parseInt(pageSize, 10));
      res.json(success(result, '获取审计日志成功'));
    } catch (error) {
      logger.error('获取审计日志失败:', error);
      res.status(500).json(errors.internalError('获取审计日志失败'));
    }
  }

  /**
   * 获取管理员的操作记录
   * GET /api/v1/audit-logs/admin/:adminId
   */
  // eslint-disable-next-line class-methods-use-this
  async getAdminLogs(req, res) {
    try {
      const { adminId } = req.params;
      const { page = 1, pageSize = 20 } = req.query;

      const result = await auditService.getAdminLogs(
        adminId,
        parseInt(page, 10),
        parseInt(pageSize, 10)
      );
      res.json(success(result, '获取管理员操作记录成功'));
    } catch (error) {
      logger.error('获取管理员操作记录失败:', error);
      res.status(500).json(errors.internalError('获取管理员操作记录失败'));
    }
  }

  /**
   * 获取资源的操作记录
   * GET /api/v1/audit-logs/resource/:resourceType/:resourceId
   */
  // eslint-disable-next-line class-methods-use-this
  async getResourceLogs(req, res) {
    try {
      const { resourceType, resourceId } = req.params;
      const { page = 1, pageSize = 20 } = req.query;

      const result = await auditService.getResourceLogs(
        resourceType,
        resourceId,
        parseInt(page, 10),
        parseInt(pageSize, 10)
      );
      res.json(success(result, '获取资源操作记录成功'));
    } catch (error) {
      logger.error('获取资源操作记录失败:', error);
      res.status(500).json(errors.internalError('获取资源操作记录失败'));
    }
  }

  /**
   * 获取操作统计
   * GET /api/v1/audit-logs/statistics
   */
  // eslint-disable-next-line class-methods-use-this
  async getStatistics(req, res) {
    try {
      const stats = await auditService.getStatistics();
      res.json(success(stats, '获取操作统计成功'));
    } catch (error) {
      logger.error('获取操作统计失败:', error);
      res.status(500).json(errors.internalError('获取操作统计失败'));
    }
  }

  /**
   * 导出审计日志
   * GET /api/v1/audit-logs/export
   */
  // eslint-disable-next-line class-methods-use-this
  async exportLogs(req, res) {
    try {
      const { adminId, actionType, resourceType, startDate, endDate, status } = req.query;

      const query = {};
      if (adminId) query.adminId = adminId;
      if (actionType) query.actionType = actionType;
      if (resourceType) query.resourceType = resourceType;
      if (status) query.status = status;
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const csv = await auditService.exportLogsToCSV(query);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
      res.send(`\ufeff${csv}`); // BOM标记以确保Excel正确显示中文
    } catch (error) {
      logger.error('导出审计日志失败:', error);
      res.status(500).json(errors.internalError('导出审计日志失败'));
    }
  }

  /**
   * 清理过期日志
   * POST /api/v1/audit-logs/cleanup
   */
  // eslint-disable-next-line class-methods-use-this
  async cleanupExpiredLogs(req, res) {
    try {
      // 检查是否是超级管理员
      if (req.user.role !== 'superadmin') {
        return res.status(403).json(errors.forbidden('只有超级管理员可以清理日志'));
      }

      const result = await auditService.cleanupExpiredLogs();

      // 记录清理操作
      await auditService.createLog({
        adminId: req.user.id,
        adminName: req.user.name,
        actionType: 'DELETE',
        resourceType: 'system',
        description: `清理过期审计日志，删除${result.deletedCount}条`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json(success({ deletedCount: result.deletedCount }, '清理过期日志成功'));
    } catch (error) {
      logger.error('清理过期日志失败:', error);
      res.status(500).json(errors.internalError('清理过期日志失败'));
    }
  }
}

module.exports = new AuditController();
