/**
 * 迁移脚本：为所有历史业务数据补填 tenantId
 *
 * 背景：多租户改造前，所有数据属于"凡人共读"单一租户，没有 tenantId 字段。
 *       本脚本将所有缺少 tenantId 的文档批量打上指定租户的 _id。
 *
 * 前置条件：
 *   1. 已在管理后台创建"凡人共读"租户记录
 *   2. 已备份数据库（运行 .claude/commands/deployment/backup-db.sh）
 *   3. 将下方 FANREN_TENANT_ID 替换为实际的租户 _id
 *
 * 用法：
 *   node backend/scripts/migrate-add-tenant-id.js
 *
 * 幂等性：只更新 tenantId 不存在的文档，重复执行安全。
 */

const mongoose = require('mongoose');
const path = require('path');

// ============================================================
// ⚠️  执行前必须填入"凡人共读"租户的 MongoDB _id
//     在管理后台「租户管理」页面创建后可以从列表复制
// ============================================================
const FANREN_TENANT_ID = process.env.FANREN_TENANT_ID || '6a093a4acd3626e58585c1ca';

// 需要补填 tenantId 的集合列表
const COLLECTIONS = [
  'users',
  'admins',
  'periods',
  'sections',
  'checkins',
  'enrollments',
  'payments',
  'insights',
  'insightrequests',
  'comments',
  'notifications',
  'useractivities',
  'userreadingcompletions',
  'auditlogs'
];

const { config } = require(path.join(__dirname, '../../.env.config.js'));
const mongodbUri = config.backend.mongodbUri;

async function connectDB() {
  await mongoose.connect(mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log('✅ MongoDB 连接成功');
}

async function migrate() {
  if (FANREN_TENANT_ID === 'REPLACE_WITH_ACTUAL_TENANT_ID') {
    console.error('❌ 请先在脚本顶部填入真实的 FANREN_TENANT_ID，再执行迁移');
    process.exit(1);
  }

  if (!mongoose.Types.ObjectId.isValid(FANREN_TENANT_ID)) {
    console.error('❌ FANREN_TENANT_ID 不是合法的 MongoDB ObjectId');
    process.exit(1);
  }

  const tenantObjectId = new mongoose.Types.ObjectId(FANREN_TENANT_ID);
  const db = mongoose.connection.db;

  console.log(`\n🏷️  目标 tenantId：${FANREN_TENANT_ID}`);
  console.log('─'.repeat(60));

  let totalUpdated = 0;

  for (const collectionName of COLLECTIONS) {
    try {
      const collection = db.collection(collectionName);

      // 统计需要更新的文档数
      const needsUpdate = await collection.countDocuments({
        tenantId: { $exists: false }
      });

      if (needsUpdate === 0) {
        console.log(`⏭️  ${collectionName}：无需更新（已全部有 tenantId）`);
        continue;
      }

      // 批量更新缺少 tenantId 的文档
      const result = await collection.updateMany(
        { tenantId: { $exists: false } },
        { $set: { tenantId: tenantObjectId } }
      );

      console.log(`✅ ${collectionName}：更新 ${result.modifiedCount} 条文档`);
      totalUpdated += result.modifiedCount;
    } catch (err) {
      // 集合不存在时跳过（不是所有集合都一定有数据）
      if (err.message?.includes('ns does not exist') || err.codeName === 'NamespaceNotFound') {
        console.log(`⏭️  ${collectionName}：集合不存在，跳过`);
      } else {
        console.error(`❌ ${collectionName} 更新失败：`, err.message);
        throw err;
      }
    }
  }

  console.log('─'.repeat(60));
  console.log(`\n✨ 迁移完成，共更新 ${totalUpdated} 条文档`);

  // 验证：抽查每个集合还有多少文档缺少 tenantId
  console.log('\n📋 验证（缺少 tenantId 的文档数，应全为 0）：');
  for (const collectionName of COLLECTIONS) {
    try {
      const collection = db.collection(collectionName);
      const remaining = await collection.countDocuments({ tenantId: { $exists: false } });
      const status = remaining === 0 ? '✅' : '⚠️ ';
      console.log(`  ${status} ${collectionName}：${remaining} 条缺少 tenantId`);
    } catch {
      // 集合不存在，忽略
    }
  }
}

async function main() {
  try {
    await connectDB();
    await migrate();
  } catch (error) {
    console.error('\n❌ 迁移失败：', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main();
