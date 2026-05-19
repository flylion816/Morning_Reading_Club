const express = require('express');
const monitoringController = require('../controllers/monitoring.controller');
const { adminAuthMiddleware } = require('../middleware/adminAuth');

const router = express.Router();

/**
 * GET /api/v1/monitoring/health
 * 系统健康检查（无需认证）
 */
router.get('/health', monitoringController.getHealth);

/**
 * GET /api/v1/monitoring/metrics
 * 获取实时监控指标（管理员）
 */
router.get('/metrics', adminAuthMiddleware, monitoringController.getMetrics);

/**
 * GET /api/v1/monitoring/alerts
 * 获取最近的告警记录（管理员）
 */
router.get('/alerts', adminAuthMiddleware, monitoringController.getAlerts);

/**
 * POST /api/v1/monitoring/alerts/clear
 * 清空告警日志（管理员）
 */
router.post('/alerts/clear', adminAuthMiddleware, monitoringController.clearAlerts);

/**
 * GET /api/v1/monitoring/stats
 * 获取监控统计信息（管理员）
 */
router.get('/stats', adminAuthMiddleware, monitoringController.getMonitoringStats);

module.exports = router;
