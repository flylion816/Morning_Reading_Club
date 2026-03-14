/**
 * 数据备份服务（MongoDB + MySQL）
 *
 * 功能：
 * - 定时备份 MongoDB 数据（每天凌晨 2 点）
 * - 定时备份 MySQL 数据（每天凌晨 2:30 点）
 * - 自动清理过期备份（保留最近 30 天）
 * - 备份到本地 /var/backups/morning-reading/
 */

const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const mongoose = require('mongoose');
const { mysqlPool } = require('../config/database');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

// 备份目录配置
const BACKUP_BASE_DIR = process.env.BACKUP_DIR || '/var/backups';
const MONGODB_BACKUP_DIR = path.join(BACKUP_BASE_DIR, 'mongodb');
const MYSQL_BACKUP_DIR = path.join(BACKUP_BASE_DIR, 'mysql');
const BACKUP_RETENTION_DAYS = 30; // 保留 30 天的备份

// =====================================================================
// 1. 初始化备份目录
// =====================================================================
async function initBackupDirs() {
  try {
    await fs.mkdir(MONGODB_BACKUP_DIR, { recursive: true });
    await fs.mkdir(MYSQL_BACKUP_DIR, { recursive: true });
    logger.info('Backup directories initialized', {
      mongodbDir: MONGODB_BACKUP_DIR,
      mysqlDir: MYSQL_BACKUP_DIR
    });
  } catch (error) {
    logger.error('Failed to initialize backup directories', error);
    throw error;
  }
}

// =====================================================================
// 2. MongoDB 备份（使用 mongodump）
// =====================================================================
async function backupMongoDB() {
  try {
    logger.info('Starting MongoDB backup...');

    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupName = `mongodb-backup-${timestamp}-${Date.now()}`;
    const backupPath = path.join(MONGODB_BACKUP_DIR, backupName);

    // 构造 mongodump 命令
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';
    const dumpCmd = `mongodump --uri="${mongoUri}" --out="${backupPath}" --gzip`;

    logger.info('Executing mongodump command', { backupPath });

    const { stderr } = await execAsync(dumpCmd);

    if (stderr) {
      logger.warn('mongodump warning/stderr', stderr);
    }

    // 创建备份元数据文件
    const metaData = {
      type: 'mongodb',
      timestamp: new Date().toISOString(),
      backupName,
      backupPath,
      mongoUri: mongoUri.replace(/password[^@]*@/, 'password:***@'), // 隐藏密码
      size: await getDirectorySize(backupPath)
    };

    await fs.writeFile(
      path.join(backupPath, 'backup-meta.json'),
      JSON.stringify(metaData, null, 2)
    );

    logger.info('✅ MongoDB backup completed successfully', metaData);
    return metaData;
  } catch (error) {
    logger.error('Failed to backup MongoDB', error);
    throw error;
  }
}

// =====================================================================
// 3. MySQL 备份（使用 mysqldump）
// =====================================================================
async function backupMySQL() {
  try {
    logger.info('Starting MySQL backup...');

    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupName = `mysql-backup-${timestamp}-${Date.now()}.sql.gz`;
    const backupPath = path.join(MYSQL_BACKUP_DIR, backupName);

    // 从环境变量获取 MySQL 配置
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = process.env.MYSQL_PORT || 3306;
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'morning_reading';

    // 构造 mysqldump 命令（使用管道压缩）
    const dumpCmd = password
      ? `mysqldump -h${host} -P${port} -u${user} -p${password} --single-transaction --quick --lock-tables=false ${database} | gzip > ${backupPath}`
      : `mysqldump -h${host} -P${port} -u${user} --single-transaction --quick --lock-tables=false ${database} | gzip > ${backupPath}`;

    logger.info('Executing mysqldump command', { backupPath });

    await execAsync(dumpCmd);

    // 验证备份文件
    const stats = await fs.stat(backupPath);
    if (stats.size === 0) {
      throw new Error('MySQL backup file is empty');
    }

    // 创建备份元数据文件
    const metaData = {
      type: 'mysql',
      timestamp: new Date().toISOString(),
      backupName,
      backupPath,
      host,
      port,
      database,
      size: stats.size,
      sizeHuman: formatFileSize(stats.size)
    };

    await fs.writeFile(
      path.join(MYSQL_BACKUP_DIR, `${backupName}.meta.json`),
      JSON.stringify(metaData, null, 2)
    );

    logger.info('✅ MySQL backup completed successfully', metaData);
    return metaData;
  } catch (error) {
    logger.error('Failed to backup MySQL', error);
    throw error;
  }
}

// =====================================================================
// 4. 清理过期备份
// =====================================================================
async function cleanupOldBackups() {
  try {
    logger.info('Cleaning up old backups...', {
      retentionDays: BACKUP_RETENTION_DAYS
    });

    const now = Date.now();
    const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    // 清理 MongoDB 备份
    const mongoFiles = await fs.readdir(MONGODB_BACKUP_DIR);
    for (const file of mongoFiles) {
      const filePath = path.join(MONGODB_BACKUP_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtime.getTime();

      if (age > retentionMs) {
        await execAsync(`rm -rf "${filePath}"`);
        logger.info('Deleted old MongoDB backup', { file, ageInDays: Math.floor(age / (24 * 60 * 60 * 1000)) });
      }
    }

    // 清理 MySQL 备份
    const mysqlFiles = await fs.readdir(MYSQL_BACKUP_DIR);
    for (const file of mysqlFiles) {
      if (!file.endsWith('.sql.gz')) continue;

      const filePath = path.join(MYSQL_BACKUP_DIR, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtime.getTime();

      if (age > retentionMs) {
        await fs.unlink(filePath);
        logger.info('Deleted old MySQL backup', { file, ageInDays: Math.floor(age / (24 * 60 * 60 * 1000)) });
      }
    }

    logger.info('✅ Old backup cleanup completed');
  } catch (error) {
    logger.error('Failed to cleanup old backups', error);
  }
}

// =====================================================================
// 4B. 数据一致性检查和同步触发
// =====================================================================
async function checkDataConsistencyAndSync() {
  try {
    logger.info('🔍 Starting MongoDB/MySQL data consistency check...');

    // 导入模型和同步函数
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
    const { publishSyncEvent } = require('./sync.service');

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

    const tables = Object.keys(MODELS);
    let incompleteTableFound = false;

    // 检查各表的数据一致性
    for (const table of tables) {
      const model = MODELS[table];
      const mongoCount = await model.countDocuments();

      // 获取 MySQL 记录数
      const conn = await mysqlPool.getConnection();
      try {
        const [result] = await conn.query(`SELECT COUNT(*) as count FROM \`${table}\``);
        const mysqlCount = result[0].count || 0;

        if (mongoCount !== mysqlCount) {
          incompleteTableFound = true;
          logger.warn(`⚠️ Data mismatch found in table: ${table}`, {
            mongodb: mongoCount,
            mysql: mysqlCount,
            difference: mongoCount - mysqlCount
          });

          // 发现不一致，触发该表的全量同步
          logger.info(`🔄 Triggering full sync for table: ${table}`);
          const mongoData = await model.find().lean();

          for (const doc of mongoData) {
            publishSyncEvent({
              type: 'create',
              collection: table,
              documentId: doc._id.toString(),
              data: doc
            });
          }

          logger.info(`✅ Sync triggered for ${mongoData.length} records in ${table}`);
        } else {
          logger.info(`✅ Data consistent for table: ${table} (${mongoCount} records)`);
        }
      } finally {
        conn.release();
      }
    }

    if (!incompleteTableFound) {
      logger.info('✅ All tables are consistent between MongoDB and MySQL');
    }

    return !incompleteTableFound;
  } catch (error) {
    logger.error('Failed to check data consistency', error);
    return false;
  }
}

// =====================================================================
// 5. 启动定时备份和一致性检查任务
// =====================================================================
function startBackupSchedules() {
  try {
    // 数据一致性检查：每天凌晨 1:00
    cron.schedule('0 1 * * *', async () => {
      try {
        logger.info('🔍 Data consistency check scheduled triggered');
        await checkDataConsistencyAndSync();
      } catch (error) {
        logger.error('Scheduled data consistency check failed', error);
      }
    });

    // MongoDB 备份：每天凌晨 2:00
    cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('🔄 MongoDB scheduled backup triggered');
        await backupMongoDB();
      } catch (error) {
        logger.error('Scheduled MongoDB backup failed', error);
      }
    });

    // MySQL 备份：每天凌晨 2:30
    cron.schedule('30 2 * * *', async () => {
      try {
        logger.info('🔄 MySQL scheduled backup triggered');
        await backupMySQL();
      } catch (error) {
        logger.error('Scheduled MySQL backup failed', error);
      }
    });

    // 清理过期备份：每天凌晨 3:00
    cron.schedule('0 3 * * *', async () => {
      try {
        logger.info('🔄 Backup cleanup triggered');
        await cleanupOldBackups();
      } catch (error) {
        logger.error('Backup cleanup failed', error);
      }
    });

    logger.info('✅ Backup schedules started successfully', {
      consistencyCheck: '01:00 UTC',
      mongodbBackup: '02:00 UTC',
      mysqlBackup: '02:30 UTC',
      cleanup: '03:00 UTC'
    });
  } catch (error) {
    logger.error('Failed to start backup schedules', error);
  }
}

// =====================================================================
// 6. 手动触发备份（用于测试或按需备份）
// =====================================================================
async function manualBackup() {
  try {
    logger.info('Starting manual backup...');

    const mongoResult = await backupMongoDB();
    const mysqlResult = await backupMySQL();

    logger.info('✅ Manual backup completed', {
      mongodb: mongoResult,
      mysql: mysqlResult
    });

    return { mongodb: mongoResult, mysql: mysqlResult };
  } catch (error) {
    logger.error('Manual backup failed', error);
    throw error;
  }
}

// =====================================================================
// 7. 列出所有备份
// =====================================================================
async function listBackups() {
  try {
    const result = {
      mongodb: [],
      mysql: []
    };

    // 列举 MongoDB 备份
    const mongoFiles = await fs.readdir(MONGODB_BACKUP_DIR);
    for (const file of mongoFiles) {
      const metaFile = path.join(MONGODB_BACKUP_DIR, file, 'backup-meta.json');
      try {
        const meta = JSON.parse(await fs.readFile(metaFile, 'utf-8'));
        result.mongodb.push(meta);
      } catch {
        // 忽略没有 meta 的备份
      }
    }

    // 列举 MySQL 备份
    const mysqlFiles = await fs.readdir(MYSQL_BACKUP_DIR);
    for (const file of mysqlFiles) {
      if (!file.endsWith('.meta.json')) continue;
      try {
        const meta = JSON.parse(await fs.readFile(path.join(MYSQL_BACKUP_DIR, file), 'utf-8'));
        result.mysql.push(meta);
      } catch {
        // 忽略损坏的 meta 文件
      }
    }

    // 按时间排序
    result.mongodb.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    result.mysql.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return result;
  } catch (error) {
    logger.error('Failed to list backups', error);
    return { mongodb: [], mysql: [] };
  }
}

// =====================================================================
// 8. 恢复备份（MongoDB）
// =====================================================================
async function restoreMongoDBFromBackup(backupPath) {
  try {
    logger.warn('Starting MongoDB restore from backup', { backupPath });

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';
    const restoreCmd = `mongorestore --uri="${mongoUri}" --gzip --archive="${backupPath}/dump" --drop`;

    logger.info('Executing mongorestore command');
    const { stderr } = await execAsync(restoreCmd);

    if (stderr) {
      logger.warn('mongorestore warning/stderr', stderr);
    }

    logger.info('✅ MongoDB restore completed successfully');
    return true;
  } catch (error) {
    logger.error('Failed to restore MongoDB from backup', error);
    throw error;
  }
}

// =====================================================================
// 工具函数
// =====================================================================

/**
 * 获取目录大小（字节）
 */
async function getDirectorySize(dirPath) {
  try {
    const { stdout } = await execAsync(`du -sb "${dirPath}" | cut -f1`);
    return parseInt(stdout.trim(), 10);
  } catch {
    return 0;
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

module.exports = {
  initBackupDirs,
  backupMongoDB,
  backupMySQL,
  cleanupOldBackups,
  startBackupSchedules,
  manualBackup,
  listBackups,
  restoreMongoDBFromBackup,
  BACKUP_BASE_DIR,
  MONGODB_BACKUP_DIR,
  MYSQL_BACKUP_DIR
};
