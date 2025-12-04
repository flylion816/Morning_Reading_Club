const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * 健康检查端点 - 用于负载均衡器和容器编排
 * GET /api/v1/health
 */
router.get('/health', (req, res) => {
  try {
    const mongoHealth = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';

    res.status(200).json({
      code: 200,
      message: 'Service is healthy',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        mongodb: mongoHealth,
        memory: process.memoryUsage()
      }
    });
  } catch (error) {
    res.status(503).json({
      code: 503,
      message: 'Service unavailable',
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * 详细状态检查端点 - 用于监控和诊断
 * GET /api/v1/status
 */
router.get('/status', (req, res) => {
  try {
    const mongoState = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    const status = {
      code: 200,
      service: 'morning-reading-backend',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(uptime),
        hours: Math.floor(uptime / 3600),
        days: Math.floor(uptime / 86400)
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      },
      database: {
        mongodb: {
          state: mongoState[mongoose.connection.readyState],
          connected: mongoose.connection.readyState === 1,
          host: mongoose.connection.host || 'unknown',
          port: mongoose.connection.port || 'unknown'
        }
      },
      environment: process.env.NODE_ENV || 'development'
    };

    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: 'Error retrieving status',
      error: error.message
    });
  }
});

/**
 * 就绪检查端点 - 用于 Kubernetes readiness probe
 * GET /api/v1/ready
 */
router.get('/ready', (req, res) => {
  try {
    const isReady = mongoose.connection.readyState === 1;

    if (isReady) {
      res.status(200).json({
        code: 200,
        message: 'Service is ready',
        ready: true
      });
    } else {
      res.status(503).json({
        code: 503,
        message: 'Service is not ready',
        ready: false,
        reason: 'Database not connected'
      });
    }
  } catch (error) {
    res.status(503).json({
      code: 503,
      message: 'Service is not ready',
      ready: false,
      error: error.message
    });
  }
});

/**
 * 活跃性检查端点 - 用于 Kubernetes liveness probe
 * GET /api/v1/live
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    code: 200,
    message: 'Service is alive',
    alive: true,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
