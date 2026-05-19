const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { adminTenantContext } = require('../middleware/tenantContext');

/**
 * 所有审计日志路由都需要管理员认证 + 租户上下文
 */
router.use(adminAuthMiddleware, adminTenantContext);

/**
 * 获取审计日志列表
 * GET /api/v1/audit-logs
 */
router.get('/', auditController.getLogs.bind(auditController));

/**
 * 获取操作统计
 * GET /api/v1/audit-logs/statistics
 */
router.get('/statistics', auditController.getStatistics.bind(auditController));

/**
 * 获取管理员的操作记录
 * GET /api/v1/audit-logs/admin/:adminId
 */
router.get('/admin/:adminId', auditController.getAdminLogs.bind(auditController));

/**
 * 获取资源的操作记录
 * GET /api/v1/audit-logs/resource/:resourceType/:resourceId
 */
router.get(
  '/resource/:resourceType/:resourceId',
  auditController.getResourceLogs.bind(auditController)
);

/**
 * 导出审计日志为CSV
 * GET /api/v1/audit-logs/export
 */
router.get('/export', auditController.exportLogs.bind(auditController));

/**
 * 清理过期日志（仅超级管理员）
 * POST /api/v1/audit-logs/cleanup
 */
router.post('/cleanup', auditController.cleanupExpiredLogs.bind(auditController));

module.exports = router;
