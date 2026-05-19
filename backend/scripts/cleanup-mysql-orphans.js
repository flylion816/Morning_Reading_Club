#!/usr/bin/env node

/**
 * 清理 MySQL 中存在但 MongoDB 中已删除的孤儿记录
 *
 * 安全策略：
 * - 默认 dry-run 模式，只打印将要删除的记录，不实际删除
 * - 加 --execute 参数才真正执行删除
 * - 每张表删除前打印受影响的 id 列表
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config(); // fallback to .env
const mongoose = require('mongoose');
const { mysqlPool } = require('../src/config/database');
const { withSystemContext } = require('../src/utils/tenantContext');

const User = require('../src/models/User');
const Admin = require('../src/models/Admin');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Checkin = require('../src/models/Checkin');
const Enrollment = require('../src/models/Enrollment');
const Payment = require('../src/models/Payment');
const Insight = require('../src/models/Insight');
const InsightRequest = require('../src/models/InsightRequest');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');

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
  notifications: Notification,
};

const isDryRun = !process.argv.includes('--execute');

async function cleanOrphans() {
  console.log('\n' + '='.repeat(70));
  console.log(isDryRun
    ? '    🔍 [DRY RUN] 检查 MySQL 孤儿记录（不会实际删除）'
    : '    🗑️  [EXECUTE] 删除 MySQL 孤儿记录');
  console.log('='.repeat(70) + '\n');

  if (isDryRun) {
    console.log('提示：加 --execute 参数才会真正删除\n');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB 已连接\n');

  const conn = await mysqlPool.getConnection();
  let totalOrphans = 0;

  try {
    await withSystemContext(null, async () => {
    for (const [table, Model] of Object.entries(MODELS)) {
      // 从 MySQL 取所有 id
      const [mysqlRows] = await conn.execute(`SELECT id FROM \`${table}\``);
      if (mysqlRows.length === 0) continue;

      const mysqlIds = mysqlRows.map(r => r.id);

      // 从 MongoDB 取所有 _id（字符串形式），用 lean 减少内存
      const mongoDocs = await Model.find({}, { _id: 1 }).lean();
      const mongoIdSet = new Set(mongoDocs.map(d => d._id.toString()));

      // 找出 MySQL 有但 MongoDB 没有的
      const orphanIds = mysqlIds.filter(id => !mongoIdSet.has(id));

      if (orphanIds.length === 0) {
        console.log(`✅ ${table}: 无孤儿记录`);
        continue;
      }

      totalOrphans += orphanIds.length;
      console.log(`⚠️  ${table}: 发现 ${orphanIds.length} 条孤儿记录`);
      console.log(`   IDs: ${orphanIds.slice(0, 10).join(', ')}${orphanIds.length > 10 ? ` ... 共 ${orphanIds.length} 条` : ''}`);

      if (!isDryRun) {
        // 分批删除，每批 100 条，避免 SQL 过长
        const batchSize = 100;
        let deleted = 0;
        for (let i = 0; i < orphanIds.length; i += batchSize) {
          const batch = orphanIds.slice(i, i + batchSize);
          const placeholders = batch.map(() => '?').join(',');
          const [result] = await conn.execute(
            `DELETE FROM \`${table}\` WHERE id IN (${placeholders})`,
            batch
          );
          deleted += result.affectedRows;
        }
        console.log(`   ✅ 已删除 ${deleted} 条`);
      }
    }
    }); // end withSystemContext
  } finally {
    conn.release();
  }

  console.log('\n' + '='.repeat(70));
  if (isDryRun) {
    console.log(`🔍 [DRY RUN] 共发现 ${totalOrphans} 条孤儿记录，未执行删除`);
    if (totalOrphans > 0) {
      console.log('   确认无误后执行：node scripts/cleanup-mysql-orphans.js --execute');
    }
  } else {
    console.log(`✅ 共删除 ${totalOrphans} 条孤儿记录`);
  }
  console.log('='.repeat(70) + '\n');

  await mongoose.disconnect();
  await mysqlPool.end();
}

cleanOrphans().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
