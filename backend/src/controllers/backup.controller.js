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
const mysqlBackupService = require('../services/mysql-backup.service');

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

  // 处理日期时间精度差异（MongoDB 毫秒级，MySQL 秒级）
  if (mongoVal && mysqlVal && typeof mongoVal === 'string' && typeof mysqlVal === 'string') {
    const mongoDate = new Date(mongoVal);
    const mysqlDate = new Date(mysqlVal);
    if (!Number.isNaN(mongoDate.getTime()) && !Number.isNaN(mysqlDate.getTime())) {
      // 比较到秒级精度
      const mongoSecs = Math.floor(mongoDate.getTime() / 1000);
      const mysqlSecs = Math.floor(mysqlDate.getTime() / 1000);
      if (mongoSecs === mysqlSecs) {
        return true;
      }
    }
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

    for (const [name, model] of Object.entries(MODELS)) {
      stats[name] = await model.countDocuments();
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
    const conn = await mysqlPool.getConnection();
    const stats = {};

    const tables = [
      'users', 'admins', 'periods', 'sections', 'checkins', 'enrollments',
      'payments', 'insights', 'insight_likes', 'insight_requests',
      'insight_request_audit_logs', 'comments', 'comment_replies', 'notifications'
    ];

    try {
      for (const table of tables) {
        try {
          const [result] = await conn.query(`SELECT COUNT(*) as count FROM ${table}`);
          stats[table] = result[0].count;
        } catch (tableError) {
          // 表不存在或查询失败，记录为 0
          logger.warn(`Table ${table} does not exist or cannot be queried`, tableError.message);
          stats[table] = 0;
        }
      }
    } finally {
      conn.release();
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

    // 获取 MongoDB 统计
    for (const [name, model] of Object.entries(MODELS)) {
      mongoStats[name] = await model.countDocuments();
    }

    // 获取 MySQL 统计
    const conn = await mysqlPool.getConnection();
    try {
      const tables = [
        'users', 'admins', 'periods', 'sections', 'checkins', 'enrollments',
        'payments', 'insights', 'insight_requests', 'comments', 'notifications'
      ];

      for (const table of tables) {
        try {
          const [result] = await conn.query(`SELECT COUNT(*) as count FROM ${table}`);
          mysqlStats[table] = result[0].count;
        } catch (tableError) {
          // 表不存在，记录为 0
          logger.warn(`Table ${table} does not exist or cannot be queried`, tableError.message);
          mysqlStats[table] = 0;
        }
      }

      // 计算字段级一致性统计（仅当两个库的记录数相同时）
      for (const table of tables) {
        const mongoCount = mongoStats[table] || 0;
        const mysqlCount = mysqlStats[table] || 0;

        if (mongoCount === 0 && mysqlCount === 0) {
          // 两个库都没有数据，标记为一致
          comparison[table] = {
            mongodb: 0,
            mysql: 0,
            difference: 0,
            recordsMatch: true,
            totalRecords: 0,
            matchedRecords: 0,
            mismatchedRecords: 0,
            matchPercentage: 100,
            consistency: '✅ 完全一致'
          };
          continue;
        }

        if (mongoCount !== mysqlCount) {
          // 记录数不一致
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
          if (table === 'admins') {
            mongoData = await model.find().select('+password').lean();
          } else {
            mongoData = await model.find().lean();
          }

          const [mysqlData] = await conn.query(`SELECT * FROM \`${table}\``);

          let matchedRecords = 0;

          // 为每条 MongoDB 记录找到对应的 MySQL 记录并比较
          for (const mongoRecord of mongoData) {
            const mysqlRecord = mysqlData.find(
              r => r.id === mongoRecord._id.toString()
            );

            if (!mysqlRecord) continue;

            // 检查所有字段是否匹配
            let allFieldsMatch = true;
            for (const field of Object.keys(mongoRecord)) {
              if (field === '__v') continue;

              const mongoVal = mongoRecord[field];
              const mysqlFieldName = field.replace(/([A-Z])/g, '_$1').toLowerCase();
              const mysqlVal = mysqlRecord[mysqlFieldName];

              if (!intelligentCompare(mongoVal, mysqlVal)) {
                allFieldsMatch = false;
                break;
              }
            }

            if (allFieldsMatch) {
              matchedRecords++;
            }
          }

          const mismatchedRecords = mongoCount - matchedRecords;
          const matchPercentage = mongoCount > 0 ? Math.round((matchedRecords / mongoCount) * 100) : 0;

          comparison[table] = {
            mongodb: mongoCount,
            mysql: mysqlCount,
            difference: 0,
            recordsMatch: true,
            totalRecords: mongoCount,
            matchedRecords,
            mismatchedRecords,
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

    const [data, total] = await Promise.all([
      model.find({}).skip(skip).limit(parseInt(limit, 10)).lean(),
      model.countDocuments()
    ]);

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
    const conn = await mysqlPool.getConnection();

    try {
      let data = [];
      let total = 0;

      try {
        const [queryData] = await conn.query(
          `SELECT * FROM ${table} LIMIT ? OFFSET ?`,
          [parseInt(limit, 10), skip]
        );
        const [[countResult]] = await conn.query(`SELECT COUNT(*) as total FROM ${table}`);

        data = queryData;
        total = countResult.total;
      } catch (tableError) {
        // 表不存在，返回空数据
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
    let totalSynced = 0;

    logger.info('Starting full sync from MongoDB to MySQL');

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
    for (const section of sections) {
      await mysqlBackupService.syncSection(section);
      totalSynced++;
    }
    syncResults.sections = sections.length;

    // 同步 Checkins
    const checkins = await Checkin.find({});
    for (const checkin of checkins) {
      await mysqlBackupService.syncCheckin(checkin);
      totalSynced++;
    }
    syncResults.checkins = checkins.length;

    // 同步 Enrollments
    const enrollments = await Enrollment.find({});
    for (const enrollment of enrollments) {
      await mysqlBackupService.syncEnrollment(enrollment);
      totalSynced++;
    }
    syncResults.enrollments = enrollments.length;

    // 同步 Payments
    const payments = await Payment.find({});
    for (const payment of payments) {
      await mysqlBackupService.syncPayment(payment);
      totalSynced++;
    }
    syncResults.payments = payments.length;

    // 同步 Insights
    const insights = await Insight.find({});
    for (const insight of insights) {
      await mysqlBackupService.syncInsight(insight);
      totalSynced++;
    }
    syncResults.insights = insights.length;

    // 同步 InsightRequests
    const requests = await InsightRequest.find({});
    for (const req of requests) {
      await mysqlBackupService.syncInsightRequest(req);
      totalSynced++;
    }
    syncResults.insight_requests = requests.length;

    // 同步 Comments
    const comments = await Comment.find({});
    for (const comment of comments) {
      await mysqlBackupService.syncComment(comment);
      totalSynced++;
    }
    syncResults.comments = comments.length;

    // 同步 Notifications
    const notifications = await Notification.find({});
    for (const notification of notifications) {
      await mysqlBackupService.syncNotification(notification);
      totalSynced++;
    }
    syncResults.notifications = notifications.length;

    logger.info('Full sync completed', { totalSynced, tables: Object.keys(syncResults).length });

    res.json(success({
      syncResults,
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
      let mongoData = [];

      // 获取 MongoDB 数据
      if (tableName === 'admins') {
        mongoData = await model.find().select('+password').lean();
      } else {
        mongoData = await model.find().lean();
      }

      // 获取 MySQL 数据
      const [mysqlData] = await conn.query(`SELECT * FROM \`${tableName}\``);

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
          if (field === '__v') return;

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

module.exports = {
  getMongodbStats,
  getMysqlStats,
  compareBackup,
  compareFieldsDetail,
  getMongodbTableData,
  getMysqlTableData,
  fullSync,
  deltaSync,
  recoverMysqlToMongo
};
