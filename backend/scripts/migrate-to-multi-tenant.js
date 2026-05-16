/**
 * 一次性迁移脚本：将单租户数据迁移到多租户结构
 *
 * 执行步骤：
 * 1. 创建初始租户"凡人共读"
 * 2. 给所有业务集合的所有文档加 tenantId
 * 3. 删除旧全局 unique 索引，创建带 tenantId 的新 unique 索引
 * 4. 把现有 superadmin 重写为 tenant_admin（绑定到凡人共读）
 * 5. 创建一个 platform_superadmin 账号（用环境变量提供凭证）
 *
 * 使用方法：
 *   cd backend
 *   PLATFORM_ADMIN_EMAIL=root@platform.local \
 *   PLATFORM_ADMIN_PASSWORD=ChangeMeNow123 \
 *   node scripts/migrate-to-multi-tenant.js
 *
 * 安全与幂等性：
 * - 步骤 1（创建租户）：通过 slug 去重，重复运行安全
 * - 步骤 2（回填 tenantId）：filter { tenantId: { $exists: false } }，已回填的文档自动跳过
 * - 步骤 3（重建索引）：dropIndexByKeyIfExists 在索引不存在时直接返回；createIndex 在索引已存在且参数相同时为幂等操作
 * - 步骤 4（admin 角色迁移）：
 *     第一条 updateMany 以 { role: 'superadmin', tenantId: { $exists: false } } 为条件，
 *     已迁移的 superadmin（tenantId 已存在）不会被重复处理；
 *     第二条 updateMany 以 { tenantId: { $exists: false } } 为条件，已补全的 admin/operator 同样跳过。
 *     脚本中途中断后重跑，两条 updateMany 都只处理"剩余未完成"的记录，不会重复操作。
 * - 步骤 5（创建 platform_superadmin）：通过 email 去重，重复运行安全
 * - 全程使用 withSystemContext 绕过租户过滤
 * - 完成后立即修改 platform_superadmin 密码
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { withSystemContext } = require('../src/utils/tenantContext');
const Tenant = require('../src/models/Tenant');
const Admin = require('../src/models/Admin');

const COLLECTIONS_TO_MIGRATE = [
  'users',
  'periods',
  'sections',
  'checkins',
  'enrollments',
  'payments',
  'insights',
  'insight_requests',
  'comments',
  'notifications',
  'useractivities',
  'subscribe_message_grants',
  'subscribe_message_deliveries',
  'auditlogs'
];

const UNIQUE_INDEX_MIGRATIONS = [
  {
    collection: 'users',
    oldKey: { openid: 1 },
    newKey: { tenantId: 1, openid: 1 },
    options: { unique: true, name: 'tenant_openid_unique' }
  },
  {
    collection: 'payments',
    oldKey: { orderNo: 1 },
    newKey: { tenantId: 1, orderNo: 1 },
    options: { unique: true, name: 'tenant_orderNo_unique' }
  },
  {
    collection: 'sections',
    oldKey: { periodId: 1, day: 1 },
    newKey: { tenantId: 1, periodId: 1, day: 1 },
    options: { unique: true, name: 'tenant_period_day_unique' }
  },
  {
    collection: 'checkins',
    oldKey: { userId: 1, periodId: 1, checkinDate: 1 },
    newKey: { tenantId: 1, userId: 1, periodId: 1, checkinDate: 1 },
    options: { unique: true, name: 'tenant_user_period_date_unique' }
  },
  {
    collection: 'enrollments',
    oldKey: { userId: 1, periodId: 1 },
    newKey: { tenantId: 1, userId: 1, periodId: 1 },
    options: { unique: true, name: 'tenant_user_period_unique' }
  },
  {
    collection: 'insight_requests',
    oldKey: { fromUserId: 1, toUserId: 1, insightId: 1, status: 1 },
    newKey: { tenantId: 1, fromUserId: 1, toUserId: 1, insightId: 1, status: 1 },
    options: {
      unique: true,
      partialFilterExpression: { status: 'pending' },
      name: 'tenant_pending_insight_request_unique'
    }
  },
  {
    collection: 'subscribe_message_grants',
    oldKey: { userId: 1, scene: 1, templateId: 1 },
    newKey: { tenantId: 1, userId: 1, scene: 1, templateId: 1 },
    options: { unique: true, name: 'tenant_user_scene_template_unique' }
  }
];

const INITIAL_TENANT = {
  slug: 'fanren',
  name: '凡人共读',
  description: '初始租户（自动迁移创建）',
  wxAppIds: [process.env.WECHAT_APPID || 'wx2b9a3c1d5e4195f8'],
  wechatLogin: {
    appId: process.env.WECHAT_APPID || 'wx2b9a3c1d5e4195f8',
    appSecret: process.env.WECHAT_SECRET || null
  },
  status: 'active'
};

function sameKey(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function dropIndexByKeyIfExists(collection, key) {
  const indexes = await collection.indexes();
  const existing = indexes.find(index => sameKey(index.key, key));
  if (!existing) return;
  await collection.dropIndex(existing.name);
  console.log(`[migrate] ${collection.collectionName}: 已删除旧索引 ${existing.name}`);
}

async function rebuildUniqueIndexes(db) {
  for (const migration of UNIQUE_INDEX_MIGRATIONS) {
    const col = db.collection(migration.collection);
    await dropIndexByKeyIfExists(col, migration.oldKey);
    await col.createIndex(migration.newKey, migration.options);
    console.log(`[migrate] ${migration.collection}: 已创建索引 ${migration.options.name}`);
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('未配置 MONGODB_URI');
  await mongoose.connect(mongoUri);
  console.log('[migrate] MongoDB 已连接');

  const result = await withSystemContext(null, async () => {
    // 1. 创建初始租户（幂等）
    let tenant = await Tenant.findOne({ slug: INITIAL_TENANT.slug });
    if (!tenant) {
      tenant = await Tenant.create(INITIAL_TENANT);
      console.log(`[migrate] 已创建初始租户: ${tenant.slug} (${tenant._id})`);
    } else {
      console.log(`[migrate] 初始租户已存在: ${tenant.slug} (${tenant._id})`);
    }

    // 2. 回填业务集合的 tenantId
    const db = mongoose.connection.db;
    for (const collName of COLLECTIONS_TO_MIGRATE) {
      const col = db.collection(collName);
      const filter = { tenantId: { $exists: false } };
      const count = await col.countDocuments(filter);
      if (count === 0) {
        console.log(`[migrate] ${collName}: 无需回填`);
        continue;
      }
      const res = await col.updateMany(filter, { $set: { tenantId: tenant._id } });
      console.log(`[migrate] ${collName}: 回填 ${res.modifiedCount} 条`);
    }

    // 3. 重建 unique 索引：必须在 tenantId 回填后执行
    await rebuildUniqueIndexes(db);

    // 4. 现有 admin 重写：
    //    - superadmin → tenant_admin（权限语义不变，名称统一）
    //    - admin / operator 保持原 role，只补 tenantId
    // ⚠️ 必须两步走，避免把 admin/operator 错误升级为 tenant_admin
    const superadminUpdate = await Admin.updateMany(
      { role: 'superadmin', tenantId: { $exists: false } },
      { $set: { tenantId: tenant._id, role: 'tenant_admin' } }
    );
    console.log(`[migrate] superadmin → tenant_admin 升级: ${superadminUpdate.modifiedCount} 条`);

    const otherAdminUpdate = await Admin.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: tenant._id } }
    );
    console.log(`[migrate] admin/operator 补 tenantId: ${otherAdminUpdate.modifiedCount} 条`);

    // 5. 创建 platform_superadmin（如果配置了凭证且不存在）
    const platformEmail = process.env.PLATFORM_ADMIN_EMAIL;
    const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD;
    if (platformEmail && platformPassword) {
      const exists = await Admin.findOne({ email: platformEmail });
      if (!exists) {
        await Admin.create({
          name: 'Platform Root',
          email: platformEmail,
          password: platformPassword,
          role: 'platform_superadmin',
          tenantId: null,
          status: 'active'
        });
        console.log(`[migrate] 已创建 platform_superadmin: ${platformEmail}`);
        console.log(`[migrate] ⚠️ 请立即登录修改密码！`);
      } else {
        console.log(`[migrate] platform_superadmin 已存在: ${platformEmail}`);
      }
    } else {
      console.log('[migrate] 未配置 PLATFORM_ADMIN_EMAIL/PASSWORD，跳过创建 platform_superadmin');
    }

    return { tenantId: tenant._id, slug: tenant.slug };
  });

  console.log('[migrate] 迁移完成', result);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] 迁移失败', err);
  process.exit(1);
});
