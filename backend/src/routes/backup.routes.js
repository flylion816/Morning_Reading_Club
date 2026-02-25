/**
 * 备份管理路由
 *
 * 用途：提供 MongoDB 和 MySQL 的数据查询、统计、对比、同步接口
 * 仅管理员可访问
 */

const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backup.controller');
const { adminAuthMiddleware } = require('../middleware/adminAuth');

// 所有备份接口都需要管理员权限
router.use(adminAuthMiddleware);

// =========================================================================
// 统计接口
// =========================================================================

/**
 * 获取 MongoDB 统计信息
 * GET /api/v1/backup/mongodb/stats
 */
router.get('/mongodb/stats', backupController.getMongodbStats);

/**
 * 获取 MySQL 统计信息
 * GET /api/v1/backup/mysql/stats
 */
router.get('/mysql/stats', backupController.getMysqlStats);

/**
 * 对比 MongoDB 和 MySQL
 * GET /api/v1/backup/compare
 */
router.get('/compare', backupController.compareBackup);

/**
 * 字段级详细对比
 * GET /api/v1/backup/compare/fields?tableName=users
 */
router.get('/compare/fields', backupController.compareFieldsDetail);

// =========================================================================
// 数据查询接口
// =========================================================================

/**
 * 获取 MongoDB 某个表的数据
 * GET /api/v1/backup/mongodb/data?table=users&page=1&limit=20
 */
router.get('/mongodb/data', backupController.getMongodbTableData);

/**
 * 获取 MySQL 某个表的数据
 * GET /api/v1/backup/mysql/data?table=users&page=1&limit=20
 */
router.get('/mysql/data', backupController.getMysqlTableData);

// =========================================================================
// 同步接口
// =========================================================================

/**
 * 全量同步：从 MongoDB 同步所有数据到 MySQL
 * POST /api/v1/backup/sync/full
 */
router.post('/sync/full', backupController.fullSync);

/**
 * 差量同步：只同步不存在于 MySQL 的数据
 * POST /api/v1/backup/sync/delta
 */
router.post('/sync/delta', backupController.deltaSync);

// =========================================================================
// 恢复接口
// =========================================================================

/**
 * 全量恢复：从 MySQL 恢复所有数据到 MongoDB
 * POST /api/v1/backup/recover/full
 */
router.post('/recover/full', backupController.recoverMysqlToMongo);

module.exports = router;
