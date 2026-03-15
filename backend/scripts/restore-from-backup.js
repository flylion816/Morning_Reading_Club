#!/usr/bin/env node

/**
 * 数据恢复脚本 - 从备份文件恢复 MongoDB 和 MySQL 数据
 *
 * 用法：
 *   node scripts/restore-from-backup.js                     # 交互式选择备份
 *   node scripts/restore-from-backup.js --list              # 列出所有备份
 *   node scripts/restore-from-backup.js --mongodb <备份名>   # 恢复指定 MongoDB 备份
 *   node scripts/restore-from-backup.js --mysql <备份名>     # 恢复指定 MySQL 备份
 *   node scripts/restore-from-backup.js --both <日期>        # 同时恢复同一天的 MongoDB 和 MySQL
 *
 * 示例：
 *   node scripts/restore-from-backup.js --list
 *   node scripts/restore-from-backup.js --mongodb mongodb-backup-2026-03-15-1773555079127
 *   node scripts/restore-from-backup.js --mysql mysql-backup-2026-03-15-1773555079400
 *   node scripts/restore-from-backup.js --both 2026-03-15
 *
 * 注意：
 *   - 恢复操作会覆盖现有数据，请确认后再执行
 *   - 建议在恢复前先执行一次新的备份
 *   - MongoDB 恢复需要 Docker 环境（mongorestore 在容器内执行）
 */

const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const readline = require('readline');

// 加载环境变量
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const execAsync = promisify(exec);

// 备份目录
const BACKUP_BASE_DIR = process.env.BACKUP_DIR || '/var/backups';
const MONGODB_BACKUP_DIR = path.join(BACKUP_BASE_DIR, 'mongodb');
const MYSQL_BACKUP_DIR = path.join(BACKUP_BASE_DIR, 'mysql');

// MongoDB 配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading';
const MONGODB_CONTAINER = process.env.MONGODB_CONTAINER || 'morning-reading-mongodb';

// =====================================================================
// 工具函数
// =====================================================================

function log(msg) {
  console.log(`[${new Date().toLocaleString('zh-CN')}] ${msg}`);
}

function logError(msg) {
  console.error(`[${new Date().toLocaleString('zh-CN')}] ❌ ${msg}`);
}

function logSuccess(msg) {
  console.log(`[${new Date().toLocaleString('zh-CN')}] ✅ ${msg}`);
}

async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// =====================================================================
// 1. 列出所有备份
// =====================================================================
async function listAllBackups() {
  console.log('\n📦 可用备份列表\n');

  // MongoDB 备份
  console.log('═══ MongoDB 备份 ═══');
  try {
    const mongoDirs = await fs.readdir(MONGODB_BACKUP_DIR);
    const mongoBackups = [];
    for (const dir of mongoDirs) {
      const metaPath = path.join(MONGODB_BACKUP_DIR, dir, 'backup-meta.json');
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        mongoBackups.push(meta);
      } catch {
        // 忽略无效备份
      }
    }
    if (mongoBackups.length === 0) {
      console.log('  (无备份)');
    } else {
      mongoBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      for (const b of mongoBackups) {
        const date = new Date(b.timestamp).toLocaleString('zh-CN');
        const size = formatSize(b.size);
        console.log(`  📁 ${b.backupName}`);
        console.log(`     时间: ${date}  大小: ${size}`);
      }
    }
  } catch {
    console.log('  (备份目录不存在)');
  }

  console.log('\n═══ MySQL 备份 ═══');
  try {
    const mysqlDirs = await fs.readdir(MYSQL_BACKUP_DIR);
    const mysqlBackups = [];
    for (const dir of mysqlDirs) {
      const metaPath = path.join(MYSQL_BACKUP_DIR, dir, 'backup-meta.json');
      try {
        const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
        mysqlBackups.push(meta);
      } catch {
        // 忽略无效备份
      }
    }
    if (mysqlBackups.length === 0) {
      console.log('  (无备份)');
    } else {
      mysqlBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      for (const b of mysqlBackups) {
        const date = new Date(b.timestamp).toLocaleString('zh-CN');
        const size = b.sizeHuman || formatSize(b.size);
        console.log(`  📁 ${b.backupName}`);
        console.log(`     时间: ${date}  大小: ${size}  表: ${b.tables}  行: ${b.totalRows}`);
      }
    }
  } catch {
    console.log('  (备份目录不存在)');
  }

  console.log('');
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
}

// =====================================================================
// 2. 恢复 MongoDB
// =====================================================================
async function restoreMongoDB(backupName) {
  const backupPath = path.join(MONGODB_BACKUP_DIR, backupName);
  const dbDataPath = path.join(backupPath, 'morning_reading');

  // 验证备份存在
  try {
    await fs.access(dbDataPath);
  } catch {
    logError(`MongoDB 备份不存在: ${backupPath}`);
    logError('请使用 --list 查看可用备份');
    return false;
  }

  // 读取备份元数据
  let meta = {};
  try {
    meta = JSON.parse(await fs.readFile(path.join(backupPath, 'backup-meta.json'), 'utf-8'));
  } catch {
    // 无元数据也可以继续
  }

  console.log('\n🔄 MongoDB 恢复信息:');
  console.log(`   备份名: ${backupName}`);
  console.log(`   备份时间: ${meta.timestamp ? new Date(meta.timestamp).toLocaleString('zh-CN') : '未知'}`);
  console.log(`   备份大小: ${formatSize(meta.size)}`);
  console.log(`   目标: ${MONGODB_URI.replace(/:[^:@]*@/, ':***@')}`);
  console.log(`   容器: ${MONGODB_CONTAINER}`);
  console.log('');
  console.log('   ⚠️  此操作将覆盖 MongoDB 中的现有数据！');
  console.log('');

  const ok = await confirm('确认恢复？(y/N): ');
  if (!ok) {
    log('已取消恢复');
    return false;
  }

  try {
    log('开始恢复 MongoDB...');

    const containerRestoreDir = `/tmp/restore-${Date.now()}`;
    const containerUri = MONGODB_URI.replace(/127\.0\.0\.1|localhost/, 'localhost');

    // 1. 复制备份文件到容器
    log('复制备份文件到容器...');
    await execAsync(`docker exec ${MONGODB_CONTAINER} mkdir -p ${containerRestoreDir}`);
    await execAsync(`docker cp ${dbDataPath}/. ${MONGODB_CONTAINER}:${containerRestoreDir}/morning_reading/`);

    // 2. 执行 mongorestore
    log('执行 mongorestore（--drop 模式，会先删除现有集合再恢复）...');
    const restoreCmd = `docker exec ${MONGODB_CONTAINER} mongorestore --uri="${containerUri}" --gzip --drop --nsInclude="morning_reading.*" ${containerRestoreDir}`;
    const { stdout, stderr } = await execAsync(restoreCmd, { timeout: 300000 });

    if (stdout) log(stdout);
    // mongorestore 的进度信息输出到 stderr，不算错误
    if (stderr) {
      const lines = stderr.split('\n').filter(l => l.trim());
      for (const line of lines) {
        log(`  ${line}`);
      }
    }

    // 3. 清理容器内临时文件
    log('清理临时文件...');
    await execAsync(`docker exec ${MONGODB_CONTAINER} rm -rf ${containerRestoreDir}`);

    logSuccess('MongoDB 恢复完成！');
    return true;
  } catch (error) {
    logError(`MongoDB 恢复失败: ${error.message}`);
    return false;
  }
}

// =====================================================================
// 3. 恢复 MySQL
// =====================================================================
async function restoreMySQL(backupName) {
  const backupPath = path.join(MYSQL_BACKUP_DIR, backupName);

  // 验证备份存在
  try {
    await fs.access(backupPath);
  } catch {
    logError(`MySQL 备份不存在: ${backupPath}`);
    logError('请使用 --list 查看可用备份');
    return false;
  }

  // 读取备份元数据
  let meta = {};
  try {
    meta = JSON.parse(await fs.readFile(path.join(backupPath, 'backup-meta.json'), 'utf-8'));
  } catch {
    // 无元数据也可以继续
  }

  console.log('\n🔄 MySQL 恢复信息:');
  console.log(`   备份名: ${backupName}`);
  console.log(`   备份时间: ${meta.timestamp ? new Date(meta.timestamp).toLocaleString('zh-CN') : '未知'}`);
  console.log(`   备份大小: ${meta.sizeHuman || formatSize(meta.size)}`);
  console.log(`   表数量: ${meta.tables || '未知'}`);
  console.log(`   总行数: ${meta.totalRows || '未知'}`);
  console.log(`   目标数据库: ${process.env.MYSQL_DATABASE || 'morning_reading'}`);
  console.log('');
  console.log('   ⚠️  此操作将覆盖 MySQL 中的现有数据！');
  console.log('');

  const ok = await confirm('确认恢复？(y/N): ');
  if (!ok) {
    log('已取消恢复');
    return false;
  }

  try {
    log('开始恢复 MySQL...');

    // 加载数据库连接
    const { mysqlPool } = require('../src/config/database');

    // 获取所有 JSON 备份文件
    const files = (await fs.readdir(backupPath))
      .filter(f => f.endsWith('.json') && f !== 'backup-meta.json')
      .sort();

    log(`发现 ${files.length} 个表的备份文件`);

    let totalRestored = 0;

    for (const file of files) {
      const tableName = path.basename(file, '.json');
      const filePath = path.join(backupPath, file);
      const rows = JSON.parse(await fs.readFile(filePath, 'utf-8'));

      if (rows.length === 0) {
        log(`  ⏭  ${tableName}: 0 行（跳过）`);
        continue;
      }

      // 清空表
      await mysqlPool.query(`DELETE FROM \`${tableName}\``);

      // 逐行插入
      let inserted = 0;
      for (const row of rows) {
        const cols = Object.keys(row).map(c => `\`${c}\``);
        const placeholders = cols.map(() => '?').join(', ');
        const values = Object.values(row);

        try {
          await mysqlPool.query(
            `INSERT INTO \`${tableName}\` (${cols.join(', ')}) VALUES (${placeholders})`,
            values
          );
          inserted++;
        } catch (err) {
          // 跳过插入失败的行（如外键约束等），记录日志
          if (inserted === 0) {
            logError(`  ${tableName}: 插入失败 - ${err.message}`);
          }
        }
      }

      log(`  ✅ ${tableName}: 恢复 ${inserted}/${rows.length} 行`);
      totalRestored += inserted;
    }

    logSuccess(`MySQL 恢复完成！共恢复 ${totalRestored} 行数据`);

    // 关闭连接池
    await mysqlPool.end();
    return true;
  } catch (error) {
    logError(`MySQL 恢复失败: ${error.message}`);
    return false;
  }
}

// =====================================================================
// 4. 查找指定日期的备份
// =====================================================================
async function findBackupByDate(dateStr) {
  const result = { mongodb: null, mysql: null };

  try {
    const mongoDirs = await fs.readdir(MONGODB_BACKUP_DIR);
    const matched = mongoDirs.filter(d => d.includes(dateStr)).sort().reverse();
    if (matched.length > 0) result.mongodb = matched[0];
  } catch { /* ignore */ }

  try {
    const mysqlDirs = await fs.readdir(MYSQL_BACKUP_DIR);
    const matched = mysqlDirs.filter(d => d.includes(dateStr)).sort().reverse();
    if (matched.length > 0) result.mysql = matched[0];
  } catch { /* ignore */ }

  return result;
}

// =====================================================================
// 主流程
// =====================================================================
async function main() {
  const args = process.argv.slice(2);

  console.log('');
  console.log('🔧 晨读营数据恢复工具');
  console.log('════════════════════════════════════════');

  // --list: 列出备份
  if (args.includes('--list') || args.length === 0) {
    await listAllBackups();
    if (args.length === 0) {
      console.log('用法:');
      console.log('  node scripts/restore-from-backup.js --list              列出所有备份');
      console.log('  node scripts/restore-from-backup.js --mongodb <备份名>   恢复 MongoDB');
      console.log('  node scripts/restore-from-backup.js --mysql <备份名>     恢复 MySQL');
      console.log('  node scripts/restore-from-backup.js --both <日期>        同时恢复');
      console.log('');
    }
    process.exit(0);
  }

  // --mongodb: 恢复 MongoDB
  if (args.includes('--mongodb')) {
    const idx = args.indexOf('--mongodb');
    const backupName = args[idx + 1];
    if (!backupName) {
      logError('请指定备份名称，如: --mongodb mongodb-backup-2026-03-15-XXXXX');
      process.exit(1);
    }
    const ok = await restoreMongoDB(backupName);
    process.exit(ok ? 0 : 1);
  }

  // --mysql: 恢复 MySQL
  if (args.includes('--mysql')) {
    const idx = args.indexOf('--mysql');
    const backupName = args[idx + 1];
    if (!backupName) {
      logError('请指定备份名称，如: --mysql mysql-backup-2026-03-15-XXXXX');
      process.exit(1);
    }
    const ok = await restoreMySQL(backupName);
    process.exit(ok ? 0 : 1);
  }

  // --both: 同时恢复
  if (args.includes('--both')) {
    const idx = args.indexOf('--both');
    const dateStr = args[idx + 1];
    if (!dateStr) {
      logError('请指定日期，如: --both 2026-03-15');
      process.exit(1);
    }

    const backups = await findBackupByDate(dateStr);

    if (!backups.mongodb && !backups.mysql) {
      logError(`未找到 ${dateStr} 的备份`);
      await listAllBackups();
      process.exit(1);
    }

    console.log(`\n找到 ${dateStr} 的备份:`);
    if (backups.mongodb) console.log(`  MongoDB: ${backups.mongodb}`);
    if (backups.mysql) console.log(`  MySQL:   ${backups.mysql}`);
    console.log('');

    let success = true;

    if (backups.mongodb) {
      const ok = await restoreMongoDB(backups.mongodb);
      if (!ok) success = false;
    } else {
      log('⏭ 未找到该日期的 MongoDB 备份，跳过');
    }

    if (backups.mysql) {
      const ok = await restoreMySQL(backups.mysql);
      if (!ok) success = false;
    } else {
      log('⏭ 未找到该日期的 MySQL 备份，跳过');
    }

    if (success) {
      logSuccess('所有恢复操作完成！');
    } else {
      logError('部分恢复操作失败，请检查日志');
    }

    process.exit(success ? 0 : 1);
  }

  // 未识别的参数
  logError(`未识别的参数: ${args.join(' ')}`);
  console.log('使用 --list 查看可用备份');
  process.exit(1);
}

main().catch(err => {
  logError(err.message);
  process.exit(1);
});
