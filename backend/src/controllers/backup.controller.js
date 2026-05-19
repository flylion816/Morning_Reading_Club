/**
 * 备份管理 Controller
 *
 * 职责：
 * - 提供 MongoDB 和 MySQL 数据查询、统计、对比接口
 * - 支持全量/差量同步
 * - 用于管理后台的备份信息展示
 */

const User = require('../models/User');
const Admin = require('../models/Admin');
const Period = require('../models/Period');
const Section = require('../models/Section');
const Checkin = require('../models/Checkin');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const Insight = require('../models/Insight');
const InsightRequest = require('../models/InsightRequest');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { mysqlPool } = require('../config/database');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { withSystemContext, getCurrentTenantId, shouldBypassFilter } = require('../utils/tenantContext');
const mysqlBackupService = require('../services/mysql-backup.service');
const { publishSyncEvent } = require('../services/sync.service');
const {
  buildSyncReferenceContext,
  filterDocumentsForMysqlSync
} = require('../services/mongo-mysql-sync-filter.service');

// 所有 MongoDB 模型清单
const MODELS = {
  users: User,
  admins: Admin,
  periods: Period,
  sections: Section,
  checkins: Checkin,
  enrollments: Enrollment,
  payments: Payment,
  insights: Insight,
  insight_requests: InsightRequest,
  comments: Comment,
  notifications: Notification
};

// =========================================================================
// 智能字段比较函数（用于处理布尔值、日期等特殊类型）
// =========================================================================
function intelligentCompare(mongoVal, mysqlVal) {
  // 处理 null/undefined
  if ((mongoVal === null || mongoVal === undefined) && (mysqlVal === null || mysqlVal === undefined)) {
    return true;
  }

  // 处理布尔值和 0/1 的对应关系
  if (typeof mongoVal === 'boolean' && typeof mysqlVal === 'number') {
    return (mongoVal === true && mysqlVal === 1) || (mongoVal === false && mysqlVal === 0);
  }
  if (typeof mongoVal === 'number' && typeof mysqlVal === 'boolean') {
    return (mongoVal === 1 && mysqlVal === true) || (mongoVal === 0 && mysqlVal === false);
  }

  // 处理日期时间精度差异（MongoDB 毫秒级字符串，MySQL 返回 Date 对象，四舍五入到秒）
  const mongoDate = mongoVal instanceof Date ? mongoVal : (typeof mongoVal === 'string' ? new Date(mongoVal) : null);
  const mysqlDate = mysqlVal instanceof Date ? mysqlVal : (typeof mysqlVal === 'string' ? new Date(mysqlVal) : null);
  if (mongoDate && mysqlDate && !Number.isNaN(mongoDate.getTime()) && !Number.isNaN(mysqlDate.getTime())) {
    // MySQL DATETIME 四舍五入到秒，允许 ±1 秒误差
    if (Math.abs(mongoDate.getTime() - mysqlDate.getTime()) <= 1000) {
      return true;
    }
    // MySQL DATE 列只存日期，返回当天 00:00:00 本地时间 — 比较本地 YYYY-MM-DD
    const toLocalDateStr = d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    if (toLocalDateStr(mongoDate) === toLocalDateStr(mysqlDate)) {
      return true;
    }
  }

  // 处理数字与字符串数字的比较（如 MySQL DECIMAL 返回 "1.00" vs MongoDB number 1）
  const mongoNum = Number(mongoVal);
  const mysqlNum = Number(mysqlVal);
  if (!Number.isNaN(mongoNum) && !Number.isNaN(mysqlNum) && mongoNum === mysqlNum) {
    return true;
  }

  // 普通字符串比较
  const mongoStr = String(mongoVal || '').substring(0, 50);
  const mysqlStr = String(mysqlVal || '').substring(0, 50);
  return mongoStr === mysqlStr;
}

// =========================================================================
// 1. 获取 MongoDB 统计信息（所有表）
// =========================================================================
async function getMongodbStats(req, res, next) {
  try {
    const stats = {};
    const bypass = shouldBypassFilter();
    const tenantId = getCurrentTenantId();

    for (const [name, model] of Object.entries(MODELS)) {
      if (bypass) {
        await withSystemContext(null, async () => {
          stats[name] = await model.countDocuments();
        });
      } else {
        stats[name] = await model.countDocuments({ tenantId });
      }
    }

    logger.info('MongoDB statistics fetched', { tables: Object.keys(stats).length });
    res.json(success(stats, '✅ MongoDB 统计信息'));
  } catch (error) {
    logger.error('Failed to fetch MongoDB stats', error);
    res.status(500).json(errors.serverError('获取 MongoDB 统计失败'));
  }
}

// =========================================================================
// 2. 获取 MySQL 统计信息（所有表）
// =========================================================================
async function getMysqlStats(req, res) {
  try {
    let conn;
    const stats = {};
    const bypass = shouldBypassFilter();
    const tenantId = getCurrentTenantId();

    const tables = [
      'users', 'admins', 'periods', 'sections', 'checkins', 'enrollments',
      'payments', 'insights', 'insight_likes', 'insight_requests',
      'insight_request_audit_logs', 'comments', 'comment_replies', 'notifications'
    ];

    try {
      conn = await mysqlPool.getConnection();
      logger.info('✅ MySQL connection established');

      for (const table of tables) {
        try {
          let result;
          if (bypass || !tenantId) {
            [result] = await conn.query(`SELECT COUNT(*) as count FROM ${table}`);
          } else {
            [result] = await conn.query(`SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = ?`, [tenantId.toString()]);
          }
          stats[table] = result[0].count;
        } catch (tableError) {
          logger.warn(`Table ${table} does not exist or cannot be queried`, tableError.message);
          stats[table] = 0;
        }
      }
    } catch (connError) {
      logger.error('❌ MySQL connection error:', {
        message: connError.message,
        code: connError.code,
        errno: connError.errno,
        sqlState: connError.sqlState
      });
      throw connError;
    } finally {
      if (conn) {
        conn.release();
        logger.info('MySQL connection released');
      }
    }

    logger.info('MySQL statistics fetched', { tables: tables.length });
    res.json(success(stats, '✅ MySQL 统计信息'));
  } catch (error) {
    logger.error('Failed to fetch MySQL stats', error);
    res.status(500).json(errors.serverError('获取 MySQL 统计失败'));
  }
}

// =========================================================================
// 3. 对比 MongoDB 和 MySQL（统计 + 字段级一致性）
// =========================================================================
/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue */
async function compareBackup(req, res) {
  try {
    const mongoStats = {};
    const mysqlStats = {};
    const comparison = {};
    const bypass = shouldBypassFilter();
    const tenantId = getCurrentTenantId();

    // 按租户（或全量 bypass）统计 MongoDB
    if (bypass) {
      await withSystemContext(null, async () => {
        for (const [name, model] of Object.entries(MODELS)) {
          mongoStats[name] = await model.countDocuments();
        }
      });
    } else {
      for (const [name, model] of Object.entries(MODELS)) {
        mongoStats[name] = await model.countDocuments({ tenantId });
      }
    }

    // 获取 MySQL 统计
    const conn = await mysqlPool.getConnection();
    try {
      const tables = [
        'users', 'admins', 'periods', 'sections', 'checkins', 'enrollments',
        'payments', 'insights', 'insight_requests', 'comments', 'notifications'
      ];
      const tid = tenantId ? tenantId.toString() : null;

      for (const table of tables) {
        try {
          let result;
          if (bypass || !tid) {
            [result] = await conn.query(`SELECT COUNT(*) as count FROM ${table}`);
          } else {
            [result] = await conn.query(`SELECT COUNT(*) as count FROM ${table} WHERE tenant_id = ?`, [tid]);
          }
          mysqlStats[table] = result[0].count;
        } catch (tableError) {
          logger.warn(`Table ${table} does not exist or cannot be queried`, tableError.message);
          mysqlStats[table] = 0;
        }
      }

      // 计算字段级一致性统计（仅当两个库的记录数相同时）
      for (const table of tables) {
        const mongoCount = mongoStats[table] || 0;
        const mysqlCount = mysqlStats[table] || 0;

        if (mongoCount === 0 && mysqlCount === 0) {
          comparison[table] = {
            mongodb: 0,
            mysql: 0,
            difference: 0,
            recordsMatch: true,
            totalRecords: 0,
            matchedRecords: 0,
            mismatchedRecords: 0,
            matchPercentage: 0,
            consistency: '➖ 无数据'
          };
          continue;
        }

        if (mongoCount !== mysqlCount) {
          comparison[table] = {
            mongodb: mongoCount,
            mysql: mysqlCount,
            difference: mongoCount - mysqlCount,
            recordsMatch: false,
            totalRecords: mongoCount,
            matchedRecords: 0,
            mismatchedRecords: mongoCount,
            matchPercentage: 0,
            consistency: '⚠️ 记录数不一致'
          };
          continue;
        }

        // 记录数相同，计算字段级一致性
        try {
          const model = MODELS[table];
          if (!model) continue;

          let mongoData = [];
          if (bypass) {
            await withSystemContext(null, async () => {
              if (table === 'admins') {
                mongoData = await model.find().select('+password').lean();
              } else {
                mongoData = await model.find().lean();
              }
            });
          } else {
            if (table === 'admins') {
              mongoData = await model.find({ tenantId }).select('+password').lean();
            } else {
              mongoData = await model.find({ tenantId }).lean();
            }
          }

          let mysqlData;
          if (bypass || !tid) {
            [mysqlData] = await conn.query(`SELECT * FROM \`${table}\``);
          } else {
            [mysqlData] = await conn.query(`SELECT * FROM \`${table}\` WHERE tenant_id = ?`, [tid]);
          }

          let totalFields = 0;
          let matchedFields = 0;

          // 为每条 MongoDB 记录找到对应的 MySQL 记录并比较所有字段
          for (const mongoRecord of mongoData) {
            const mysqlRecord = mysqlData.find(
              r => r.id === mongoRecord._id.toString()
            );

            if (!mysqlRecord) continue;

            // 统计每条记录的所有字段
            for (const field of Object.keys(mongoRecord)) {
              // _id 已通过 id 匹配；__v 无对应列；updatedAt 由 MySQL ON UPDATE 自动更新
              if (field === '__v' || field === '_id' || field === 'updatedAt') continue;

              const mongoVal = mongoRecord[field];
              const mysqlFieldName = field.replace(/([A-Z])/g, '_$1').toLowerCase();
              const mysqlVal = mysqlRecord[mysqlFieldName];

              totalFields++;
              if (intelligentCompare(mongoVal, mysqlVal)) {
                matchedFields++;
              }
            }
          }

          const mismatchedFields = totalFields - matchedFields;
          const matchPercentage = totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;

          comparison[table] = {
            mongodb: mongoCount,
            mysql: mysqlCount,
            difference: 0,
            recordsMatch: true,
            totalRecords: mongoCount,
            matchedRecords: matchedFields,
            mismatchedRecords: mismatchedFields,
            matchPercentage,
            consistency: matchPercentage === 100 ? '✅ 完全一致' : `⚠️ ${matchPercentage}% 一致`
          };
        } catch (fieldError) {
          logger.warn(`Failed to calculate field consistency for ${table}`, fieldError.message);
          comparison[table] = {
            mongodb: mongoCount,
            mysql: mysqlCount,
            difference: 0,
            recordsMatch: true,
            totalRecords: mongoCount,
            matchedRecords: 0,
            mismatchedRecords: 0,
            matchPercentage: 0,
            consistency: '❓ 无法计算'
          };
        }
      }
    } finally {
      conn.release();
    }

    // 计算总体统计
    const totalMongo = Object.values(mongoStats).reduce((a, b) => a + b, 0);
    const totalMysql = Object.values(mysqlStats).reduce((a, b) => a + b, 0);
    const totalMatchPercentage = Object.values(comparison).length > 0
      ? Math.round(Object.values(comparison).reduce((sum, c) => sum + (c.matchPercentage || 0), 0) / Object.values(comparison).length)
      : 0;

    logger.info('Backup comparison completed', {
      totalMongo,
      totalMysql,
      averageMatchPercentage: totalMatchPercentage
    });

    res.json(success({
      comparison,
      summary: {
        totalMongo,
        totalMysql,
        totalDifference: totalMongo - totalMysql,
        averageMatchPercentage: totalMatchPercentage,
        fullyConsistentTables: Object.values(comparison).filter(c => c.matchPercentage === 100).length,
        partiallyConsistentTables: Object.values(comparison).filter(c => c.matchPercentage > 0 && c.matchPercentage < 100).length,
        inconsistentTables: Object.values(comparison).filter(c => c.matchPercentage === 0).length
      }
    }, '📊 备份对比结果'));
  } catch (error) {
    logger.error('Failed to compare backup', error);
    res.status(500).json(errors.serverError('备份对比失败'));
  }
}
/* eslint-enable no-restricted-syntax, no-await-in-loop, no-continue */

// =========================================================================
// 4. 获取某个表的 MongoDB 数据（分页）
// =========================================================================
async function getMongodbTableData(req, res, next) {
  try {
    const { table, page = 1, limit = 20 } = req.query;

    if (!MODELS[table]) {
      return res.status(400).json(errors.badRequest(`无效的表名: ${table}`));
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const model = MODELS[table];
    const bypass = shouldBypassFilter();
    const tenantId = getCurrentTenantId();
    const filter = bypass ? {} : { tenantId };

    let data, total;
    if (bypass) {
      await withSystemContext(null, async () => {
        [data, total] = await Promise.all([
          model.find(filter).skip(skip).limit(parseInt(limit, 10)).lean(),
          model.countDocuments(filter)
        ]);
      });
    } else {
      [data, total] = await Promise.all([
        model.find(filter).skip(skip).limit(parseInt(limit, 10)).lean(),
        model.countDocuments(filter)
      ]);
    }

    res.json(success({
      table,
      data,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    }, `✅ MongoDB 表 ${table} 数据`));
  } catch (error) {
    logger.error('Failed to fetch MongoDB table data', error);
    res.status(500).json(errors.serverError('获取 MongoDB 表数据失败'));
  }
}

// =========================================================================
// 5. 获取某个表的 MySQL 数据（分页）
// =========================================================================
async function getMysqlTableData(req, res) {
  try {
    const { table, page = 1, limit = 20 } = req.query;

    const validTables = [
      'users', 'admins', 'periods', 'sections', 'checkins', 'enrollments',
      'payments', 'insights', 'insight_likes', 'insight_requests',
      'insight_request_audit_logs', 'comments', 'comment_replies', 'notifications'
    ];

    if (!validTables.includes(table)) {
      return res.status(400).json(errors.badRequest(`无效的表名: ${table}`));
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const bypass = shouldBypassFilter();
    const tenantId = getCurrentTenantId();
    const conn = await mysqlPool.getConnection();

    try {
      let data = [];
      let total = 0;

      try {
        let queryData, countResult;
        if (bypass || !tenantId) {
          [queryData] = await conn.query(
            `SELECT * FROM ${table} LIMIT ? OFFSET ?`,
            [parseInt(limit, 10), skip]
          );
          [[countResult]] = await conn.query(`SELECT COUNT(*) as total FROM ${table}`);
        } else {
          const tid = tenantId.toString();
          [queryData] = await conn.query(
            `SELECT * FROM ${table} WHERE tenant_id = ? LIMIT ? OFFSET ?`,
            [tid, parseInt(limit, 10), skip]
          );
          [[countResult]] = await conn.query(
            `SELECT COUNT(*) as total FROM ${table} WHERE tenant_id = ?`,
            [tid]
          );
        }

        data = queryData;
        total = countResult.total;
      } catch (tableError) {
        logger.warn(`Table ${table} does not exist or cannot be queried`, tableError.message);
      }

      res.json(success({
        table,
        data,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: total > 0 ? Math.ceil(total / parseInt(limit, 10)) : 0
        }
      }, `✅ MySQL 表 ${table} 数据`));
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error('Failed to fetch MySQL table data', error);
    res.status(500).json(errors.serverError('获取 MySQL 表数据失败'));
  }
}

// =========================================================================
// 6. 全量同步：从 MongoDB 同步所有数据到 MySQL
// =========================================================================
async function fullSync(req, res, next) {
  try {
    const syncResults = {};
    const skippedResults = {};
    const skippedDetails = {};
    let totalSynced = 0;

    logger.info('Starting full sync from MongoDB to MySQL');

    // 全量同步需要跨租户读取所有数据，使用 bypass 模式
    await withSystemContext(null, async () => {
      const syncContext = await buildSyncReferenceContext();

      // 同步 Users
      const users = await User.find({});
      for (const user of users) {
        await mysqlBackupService.syncUser(user);
        totalSynced++;
      }
      syncResults.users = users.length;

      // 同步 Admins
      const admins = await Admin.find({}).select('+password');
      for (const admin of admins) {
        await mysqlBackupService.syncAdmin(admin);
        totalSynced++;
      }
      syncResults.admins = admins.length;

      // 同步 Periods
      const periods = await Period.find({});
      for (const period of periods) {
        await mysqlBackupService.syncPeriod(period);
        totalSynced++;
      }
      syncResults.periods = periods.length;

      // 同步 Sections
      const sections = await Section.find({});
      const sectionBatch = filterDocumentsForMysqlSync('sections', sections, syncContext);
      for (const section of sectionBatch.syncableDocs) {
        await mysqlBackupService.syncSection(section);
        totalSynced++;
      }
      syncResults.sections = sectionBatch.syncableDocs.length;
      skippedResults.sections = sectionBatch.skippedDocs.length;
      if (sectionBatch.skippedDocs.length) skippedDetails.sections = sectionBatch.skippedDocs;

      // 同步 Checkins
      const checkins = await Checkin.find({});
      const checkinBatch = filterDocumentsForMysqlSync('checkins', checkins, syncContext);
      for (const checkin of checkinBatch.syncableDocs) {
        await mysqlBackupService.syncCheckin(checkin);
        totalSynced++;
      }
      syncResults.checkins = checkinBatch.syncableDocs.length;
      skippedResults.checkins = checkinBatch.skippedDocs.length;
      if (checkinBatch.skippedDocs.length) skippedDetails.checkins = checkinBatch.skippedDocs;

      // 同步 Enrollments
      const enrollments = await Enrollment.find({});
      const enrollmentBatch = filterDocumentsForMysqlSync('enrollments', enrollments, syncContext);
      for (const enrollment of enrollmentBatch.syncableDocs) {
        await mysqlBackupService.syncEnrollment(enrollment);
        totalSynced++;
      }
      syncResults.enrollments = enrollmentBatch.syncableDocs.length;
      skippedResults.enrollments = enrollmentBatch.skippedDocs.length;
      if (enrollmentBatch.skippedDocs.length) skippedDetails.enrollments = enrollmentBatch.skippedDocs;

      // 同步 Payments
      const payments = await Payment.find({});
      const paymentBatch = filterDocumentsForMysqlSync('payments', payments, syncContext);
      for (const payment of paymentBatch.syncableDocs) {
        await mysqlBackupService.syncPayment(payment);
        totalSynced++;
      }
      syncResults.payments = paymentBatch.syncableDocs.length;
      skippedResults.payments = paymentBatch.skippedDocs.length;
      if (paymentBatch.skippedDocs.length) skippedDetails.payments = paymentBatch.skippedDocs;

      // 同步 Insights
      const insights = await Insight.find({});
      const insightBatch = filterDocumentsForMysqlSync('insights', insights, syncContext);
      for (const insight of insightBatch.syncableDocs) {
        await mysqlBackupService.syncInsight(insight);
        totalSynced++;
      }
      syncResults.insights = insightBatch.syncableDocs.length;
      skippedResults.insights = insightBatch.skippedDocs.length;
      if (insightBatch.skippedDocs.length) skippedDetails.insights = insightBatch.skippedDocs;

      // 同步 InsightRequests
      const requests = await InsightRequest.find({});
      const requestBatch = filterDocumentsForMysqlSync('insight_requests', requests, syncContext);
      for (const insightRequest of requestBatch.syncableDocs) {
        await mysqlBackupService.syncInsightRequest(insightRequest);
        totalSynced++;
      }
      syncResults.insight_requests = requestBatch.syncableDocs.length;
      skippedResults.insight_requests = requestBatch.skippedDocs.length;
      if (requestBatch.skippedDocs.length) skippedDetails.insight_requests = requestBatch.skippedDocs;

      // 同步 Comments
      const comments = await Comment.find({});
      const commentBatch = filterDocumentsForMysqlSync('comments', comments, syncContext);
      for (const comment of commentBatch.syncableDocs) {
        await mysqlBackupService.syncComment(comment);
        totalSynced++;
      }
      syncResults.comments = commentBatch.syncableDocs.length;
      skippedResults.comments = commentBatch.skippedDocs.length;
      if (commentBatch.skippedDocs.length) skippedDetails.comments = commentBatch.skippedDocs;

      // 同步 Notifications
      const notifications = await Notification.find({});
      const notificationBatch = filterDocumentsForMysqlSync(
        'notifications',
        notifications,
        syncContext
      );
      for (const notification of notificationBatch.syncableDocs) {
        await mysqlBackupService.syncNotification(notification);
        totalSynced++;
      }
      syncResults.notifications = notificationBatch.syncableDocs.length;
      skippedResults.notifications = notificationBatch.skippedDocs.length;
      if (notificationBatch.skippedDocs.length) skippedDetails.notifications = notificationBatch.skippedDocs;
    });

    logger.info('Full sync completed', {
      totalSynced,
      tables: Object.keys(syncResults).length,
      skippedResults
    });

    res.json(success({
      syncResults,
      skippedResults,
      skippedDetails,
      totalSynced,
      message: '✅ 全量同步完成'
    }, '全量同步结果'));
  } catch (error) {
    logger.error('Full sync failed', error);
    res.status(500).json(errors.serverError('全量同步失败'));
  }
}

// =========================================================================
// 7. 差量同步：只同步不一致的数据
// =========================================================================
async function deltaSync(req, res, next) {
  try {
    const conn = await mysqlPool.getConnection();
    const syncResults = {};
    let totalSynced = 0;

    logger.info('Starting delta sync from MongoDB to MySQL');

    // 获取 MySQL 中所有的 ID
    const mysqlIds = {};
    const tables = [
      { name: 'users', mongoModel: User, mongoField: '_id' },
      { name: 'admins', mongoModel: Admin, mongoField: '_id' },
      { name: 'checkins', mongoModel: Checkin, mongoField: '_id' },
      { name: 'enrollments', mongoModel: Enrollment, mongoField: '_id' },
      { name: 'payments', mongoModel: Payment, mongoField: '_id' },
      { name: 'insights', mongoModel: Insight, mongoField: '_id' },
      { name: 'comments', mongoModel: Comment, mongoField: '_id' },
      { name: 'notifications', mongoModel: Notification, mongoField: '_id' }
    ];

    try {
      for (const table of tables) {
        try {
          const [rows] = await conn.query(`SELECT id FROM ${table.name}`);
          mysqlIds[table.name] = new Set(rows.map(r => r.id));
        } catch (e) {
          mysqlIds[table.name] = new Set();
        }
      }

      // 同步不在 MySQL 中的数据
      for (const table of tables) {
        const mongoData = await table.mongoModel.find({});
        for (const doc of mongoData) {
          const docId = doc._id.toString();
          if (!mysqlIds[table.name].has(docId)) {
            // 数据在 MongoDB 但不在 MySQL，同步它
            const syncFunctionName = `sync${table.name.charAt(0).toUpperCase()}${table.name.slice(1)}`;
            const syncFunction = mysqlBackupService[syncFunctionName];
            if (syncFunction) {
              await syncFunction(doc);
              totalSynced++;
            }
          }
        }
        syncResults[table.name] = mongoData.length - mysqlIds[table.name].size;
      }
    } finally {
      conn.release();
    }

    logger.info('Delta sync completed', { totalSynced });

    res.json(success({
      syncResults,
      totalSynced,
      message: '✅ 差量同步完成'
    }, '差量同步结果'));
  } catch (error) {
    logger.error('Delta sync failed', error);
    res.status(500).json(errors.serverError('差量同步失败'));
  }
}

// =========================================================================
// 8. 全量恢复：从 MySQL 恢复所有数据到 MongoDB
// =========================================================================
/* eslint-disable no-restricted-syntax, no-await-in-loop, no-loop-func */
async function recoverMysqlToMongo(req, res) {
  try {
    const conn = await mysqlPool.getConnection();
    const recoverResults = {};

    logger.info('Starting full recovery from MySQL to MongoDB');

    // 定义表到模型的映射关系
    const tableModelMapping = {
      users: User,
      admins: Admin,
      periods: Period,
      sections: Section,
      checkins: Checkin,
      enrollments: Enrollment,
      payments: Payment,
      insights: Insight,
      insight_requests: InsightRequest,
      comments: Comment,
      notifications: Notification
    };

    try {
      let totalRecovered = 0;

      // 处理每个表
      for (const [tableName, model] of Object.entries(tableModelMapping)) {
        try {
          // 从 MySQL 获取数据
          const [rows] = await conn.query(
            `SELECT raw_json FROM ${tableName} WHERE raw_json IS NOT NULL`
          );

          let recovered = 0;

          // 批量恢复（每批20条）
          const batchSize = 20;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const batchPromises = batch.map(row => {
              try {
                // 解析 JSON
                const doc = JSON.parse(row.raw_json);

                // 用 replaceOne 和 upsert 写回 MongoDB
                return model.replaceOne(
                  { _id: doc._id },
                  doc,
                  { upsert: true }
                ).then(() => true);
              } catch (parseError) {
                logger.warn(`Failed to parse raw_json for ${tableName}`, parseError.message);
                return false;
              }
            });

            const results = await Promise.all(batchPromises);
            recovered += results.filter(r => r).length;
          }

          recoverResults[tableName] = recovered;
          totalRecovered += recovered;
          logger.info(`Recovered ${tableName}`, { count: recovered });
        } catch (tableError) {
          logger.error(`Failed to recover table ${tableName}`, tableError);
          recoverResults[tableName] = 0;
        }
      }

      logger.info('Full recovery completed', { totalRecovered, tables: Object.keys(recoverResults).length });

      res.json(success({
        recoverResults,
        totalRecovered,
        message: '✅ 全量恢复完成'
      }, '全量恢复结果'));
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error('Full recovery failed', error);
    res.status(500).json(errors.serverError('全量恢复失败'));
  }
}
/* eslint-enable no-restricted-syntax, no-await-in-loop, no-loop-func */

// =========================================================================
// 9. 字段级数据对比（细粒度验证）
// =========================================================================
async function compareFieldsDetail(req, res) {
  try {
    const { tableName } = req.query;

    if (!tableName) {
      return res.status(400).json(errors.badRequest('请指定表名'));
    }

    if (!MODELS[tableName]) {
      return res.status(400).json(errors.badRequest('表名无效'));
    }

    const conn = await mysqlPool.getConnection();

    try {
      const model = MODELS[tableName];
      const bypass = shouldBypassFilter();
      const tenantId = getCurrentTenantId();
      const tid = tenantId ? tenantId.toString() : null;
      let mongoData = [];

      // 获取 MongoDB 数据
      if (bypass) {
        await withSystemContext(null, async () => {
          if (tableName === 'admins') {
            mongoData = await model.find().select('+password').lean();
          } else {
            mongoData = await model.find().lean();
          }
        });
      } else {
        if (tableName === 'admins') {
          mongoData = await model.find({ tenantId }).select('+password').lean();
        } else {
          mongoData = await model.find({ tenantId }).lean();
        }
      }

      // 获取 MySQL 数据
      let mysqlData;
      if (bypass || !tid) {
        [mysqlData] = await conn.query(`SELECT * FROM \`${tableName}\``);
      } else {
        [mysqlData] = await conn.query(`SELECT * FROM \`${tableName}\` WHERE tenant_id = ?`, [tid]);
      }

      // 逐条对比
      const details = mongoData.map((mongoRecord) => {
        const mysqlRecord = mysqlData.find(
          r => r.id === mongoRecord._id.toString()
        );

        const fieldComparison = {};
        let allMatch = true;

        if (!mysqlRecord) {
          return {
            id: mongoRecord._id.toString(),
            status: '❌ MySQL 中不存在',
            allMatch: false,
            fields: {}
          };
        }

        // 比对所有字段
        Object.keys(mongoRecord).forEach((field) => {
          // _id 已通过 id 匹配；__v 无对应列；updatedAt 由 MySQL ON UPDATE 自动更新
          if (field === '__v' || field === '_id' || field === 'updatedAt') return;

          const mongoValue = mongoRecord[field];
          const mysqlFieldName = field.replace(/([A-Z])/g, '_$1').toLowerCase();
          const mysqlValue = mysqlRecord[mysqlFieldName];

          const matches = intelligentCompare(mongoValue, mysqlValue);

          if (!matches) {
            allMatch = false;
          }

          fieldComparison[field] = {
            mongodb: mongoValue,
            mysql: mysqlValue,
            matches
          };
        });

        return {
          id: mongoRecord._id.toString().substring(0, 8),
          status: allMatch ? '✅ 完全匹配' : '⚠️ 字段不匹配',
          allMatch,
          fieldCount: Object.keys(fieldComparison).length,
          matchedFields: Object.values(fieldComparison).filter(f => f.matches).length,
          fields: fieldComparison
        };
      });

      // 统计
      const summary = {
        tableName,
        totalRecords: mongoData.length,
        matchedRecords: details.filter(d => d.allMatch).length,
        mismatchedRecords: details.filter(d => !d.allMatch).length,
        details: details.slice(0, 20) // 仅返回前20条详情，避免数据过大
      };

      res.json(success(summary, '字段级对比完成'));
    } finally {
      conn.release();
    }
  } catch (error) {
    logger.error('Field comparison failed', error);
    res.status(500).json(errors.serverError('字段对比失败'));
  }
}

// =========================================================================
// 6. MongoDB 单条记录 CRUD 操作
// =========================================================================

/**
 * 更新 MongoDB 单条记录
 * PUT /api/v1/backup/mongodb/record
 * Body: { table, id, data }
 */
async function updateMongodbRecord(req, res) {
  try {
    const { table, id, data } = req.body;
    if (!table || !id || !data) {
      return res.status(400).json(errors.badRequest('缺少参数 table/id/data'));
    }
    const Model = MODELS[table];
    if (!Model) {
      return res.status(400).json(errors.badRequest(`无效的集合名: ${table}`));
    }
    // 防止修改 _id/__v/createdAt/updatedAt（这些字段从 data 中移除）
    const safeData = { ...data };
    delete safeData._id;
    // eslint-disable-next-line no-underscore-dangle
    delete safeData.__v;
    delete safeData.createdAt;
    delete safeData.updatedAt;

    const updated = await withSystemContext(null, () =>
      Model.findByIdAndUpdate(id, safeData, { new: true }).exec()
    );
    if (!updated) {
      return res.status(404).json(errors.notFound('记录不存在'));
    }
    publishSyncEvent({
      type: 'update',
      collection: table,
      documentId: id,
      data: updated.toObject()
    });
    return res.json(success(updated.toObject(), '记录已更新'));
  } catch (error) {
    logger.error('updateMongodbRecord error', error);
    return res.status(500).json(errors.serverError('更新失败'));
  }
}

/**
 * 删除 MongoDB 单条记录
 * DELETE /api/v1/backup/mongodb/record
 * Query: { table, id }
 */
async function deleteMongodbRecord(req, res) {
  try {
    const { table, id } = req.query;   // DELETE 用 query string
    if (!table || !id) {
      return res.status(400).json(errors.badRequest('缺少参数 table/id'));
    }
    const Model = MODELS[table];
    if (!Model) {
      return res.status(400).json(errors.badRequest(`无效的集合名: ${table}`));
    }
    const doc = await withSystemContext(null, () => Model.findById(id).exec());
    if (!doc) {
      return res.status(404).json(errors.notFound('记录不存在'));
    }
    const docData = doc.toObject();
    await withSystemContext(null, () => Model.findByIdAndDelete(id).exec());
    publishSyncEvent({
      type: 'delete',
      collection: table,
      documentId: id,
      data: docData
    });
    return res.json(success(null, '记录已删除'));
  } catch (error) {
    logger.error('deleteMongodbRecord error', error);
    return res.status(500).json(errors.serverError('删除失败'));
  }
}

module.exports = {
  getMongodbStats,
  getMysqlStats,
  compareBackup,
  compareFieldsDetail,
  getMongodbTableData,
  getMysqlTableData,
  fullSync,
  deltaSync,
  recoverMysqlToMongo,
  updateMongodbRecord,
  deleteMongodbRecord
};
