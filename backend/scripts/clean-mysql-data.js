#!/usr/bin/env node

/**
 * 清理 MySQL 备份数据
 * 在重新同步前清空所有表
 */

require('dotenv').config();
const { mysqlPool } = require('../src/config/database');

const tables = [
  'users',
  'admins',
  'periods',
  'sections',
  'checkins',
  'enrollments',
  'payments',
  'insights',
  'insight_likes',
  'insight_requests',
  'insight_request_audit_logs',
  'comments',
  'comment_replies',
  'notifications'
];

async function cleanData() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('    🧹 清理 MySQL 数据');
    console.log('='.repeat(70) + '\n');

    const conn = await mysqlPool.getConnection();
    try {
      // 禁用外键检查
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      console.log('✅ 禁用外键检查\n');

      // 清空所有表
      for (const table of tables) {
        try {
          await conn.query(`TRUNCATE TABLE ${table}`);
          console.log(`✅ 清空表: ${table}`);
        } catch (error) {
          if (error.code === 'ER_NO_REFERENCED_TABLE') {
            console.log(`⚠️  表不存在: ${table}`);
          } else {
            throw error;
          }
        }
      }

      console.log('\n');

      // 启用外键检查
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ 启用外键检查');
    } finally {
      conn.release();
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ 清理完成！');
    console.log('='.repeat(70) + '\n');
    console.log('下一步：运行 npm run sync:mongodb-to-mysql\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mysqlPool.end();
  }
}

if (require.main === module) {
  cleanData();
}

module.exports = { cleanData };
