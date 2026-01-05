const express = require('express');
const monitoringController = require('../controllers/monitoring.controller');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * 监控路由
 *
 * 注意：所有监控端点都需要管理员权限
 */

/**
 * GET /api/v1/monitoring/metrics
 * 获取实时监控指标
 */
router.get('/metrics', authMiddleware, monitoringController.getMetrics);

/**
 * GET /api/v1/monitoring/health
 * 系统健康检查（可能不需要认证）
 */
router.get('/health', monitoringController.getHealth);

/**
 * GET /api/v1/monitoring/alerts
 * 获取最近的告警记录
 */
router.get('/alerts', authMiddleware, monitoringController.getAlerts);

/**
 * POST /api/v1/monitoring/alerts/clear
 * 清空告警日志（需要管理员权限）
 */
router.post('/alerts/clear', authMiddleware, monitoringController.clearAlerts);

/**
 * GET /api/v1/monitoring/stats
 * 获取监控统计信息
 */
router.get('/stats', authMiddleware, monitoringController.getMonitoringStats);

module.exports = router;
