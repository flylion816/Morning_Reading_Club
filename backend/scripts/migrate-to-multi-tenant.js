/**
 * 一次性迁移脚本：将单租户数据迁移到多租户结构
 *
 * 执行步骤：
 * 1. 创建初始租户"凡人共读"
 * 2. 给所有业务集合的所有文档加 tenantId
 * 3. 删除旧全局 unique 索引，创建带 tenantId 的新 unique 索引
 * 4. 保留现有 superadmin/platform_superadmin 平台角色，给其他管理员绑定凡人共读
 * 5. 可选创建一个 platform_superadmin 账号（用环境变量提供凭证）
 *
 * 使用方法：
 *   cd backend
 *   PLATFORM_ADMIN_EMAIL=root@platform.local \
 *   PLATFORM_ADMIN_PASSWORD=ChangeMeNow123 \
 *   node scripts/migrate-to-multi-tenant.js
 *
 * 安全与幂等性：
 * - 步骤 1（创建租户）：通过 slug 去重，重复运行安全
 * - 步骤 2（回填 tenantId）：只处理 tenantId 缺失或为 null 的文档，已回填的文档自动跳过
 * - 步骤 3（重建索引）：dropIndexByKeyIfExists 在索引不存在时直接返回；createIndex 在索引已存在且参数相同时为幂等操作
 * - 步骤 4（admin 角色迁移）：
 *     superadmin/platform_superadmin 保持平台角色且 tenantId 为空；
 *     admin/operator/tenant_admin 补 tenantId。脚本中途中断后重跑，只处理剩余未完成记录。
 * - 步骤 5（创建 platform_superadmin）：通过 email 去重，重复运行安全
 * - 全程使用 withSystemContext 绕过租户过滤
 * - 完成后立即修改 platform_superadmin 密码
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
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
  'auditlogs',
  'checkincelebrationconfigs',
  'insightdanmakus',
  'userreadingcompletions'
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
  wechatPay: {
    mchId: process.env.WECHAT_MCH_ID || null,
    apiKey: process.env.WECHAT_API_KEY || null,
    appId: process.env.WECHAT_APPID || 'wx2b9a3c1d5e4195f8',
    notifyUrl: process.env.WECHAT_NOTIFY_URL || null
  },
  status: 'active'
};

function buildTenantConfigUpdate() {
  const $set = {
    status: 'active',
    'wechatLogin.appId': INITIAL_TENANT.wechatLogin.appId,
    'wechatPay.appId': INITIAL_TENANT.wechatPay.appId
  };

  if (process.env.WECHAT_SECRET) {
    $set['wechatLogin.appSecret'] = process.env.WECHAT_SECRET;
  }
  if (process.env.WECHAT_MCH_ID) {
    $set['wechatPay.mchId'] = process.env.WECHAT_MCH_ID;
  }
  if (process.env.WECHAT_API_KEY) {
    $set['wechatPay.apiKey'] = process.env.WECHAT_API_KEY;
  }
  if (process.env.WECHAT_NOTIFY_URL) {
    $set['wechatPay.notifyUrl'] = process.env.WECHAT_NOTIFY_URL;
  }

  return {
    $set,
    $addToSet: {
      wxAppIds: { $each: INITIAL_TENANT.wxAppIds.filter(Boolean) }
    }
  };
}

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

function moveUploadsToTenantDir(slug) {
  const uploadRoot = path.resolve(__dirname, '../uploads');
  const tenantRoot = path.join(uploadRoot, 'tenants', slug);
  if (!fs.existsSync(uploadRoot)) {
    console.log('[migrate] uploads 目录不存在，跳过文件迁移');
    return;
  }
  fs.mkdirSync(tenantRoot, { recursive: true });

  let moved = 0;
  const entries = fs.readdirSync(uploadRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'tenants') continue;
    const src = path.join(uploadRoot, entry.name);
    const dest = path.join(tenantRoot, entry.name);
    if (fs.existsSync(dest)) {
      console.log(`[migrate] uploads 跳过已存在目标: ${entry.name}`);
      continue;
    }
    copyRecursiveSync(src, dest);
    fs.rmSync(src, { recursive: true, force: true });
    moved += 1;
  }
  console.log(`[migrate] uploads 文件迁移: ${moved} 个`);
}

function copyRecursiveSync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function replaceUploadUrl(value, slug) {
  if (typeof value === 'string') {
    return value.replace(/\/uploads\/(?!tenants\/)/g, `/uploads/tenants/${slug}/`);
  }
  if (Array.isArray(value)) {
    return value.map(item => replaceUploadUrl(item, slug));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((next, key) => {
      next[key] = replaceUploadUrl(value[key], slug);
      return next;
    }, {});
  }
  return value;
}

function getByPath(obj, pathStr) {
  return pathStr.split('.').reduce((cur, key) => (cur ? cur[key] : undefined), obj);
}

async function rewriteUploadUrls(db, slug) {
  const targets = [
    { collection: 'users', fields: ['avatar', 'avatarUrl'] },
    { collection: 'sections', fields: ['content', 'audioUrl', 'videoCover'] },
    { collection: 'periods', fields: ['description', 'coverColor'] },
    { collection: 'comments', fields: ['content'] },
    { collection: 'notifications', fields: ['content', 'data'] },
    { collection: 'checkins', fields: ['images', 'note'] },
    { collection: 'insights', fields: ['content', 'summary', 'imageUrls'] }
  ];

  for (const target of targets) {
    const col = db.collection(target.collection);
    const cursor = col.find({});
    let fixed = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const $set = {};
      for (const field of target.fields) {
        const oldValue = getByPath(doc, field);
        if (oldValue === undefined || oldValue === null) continue;
        const newValue = replaceUploadUrl(oldValue, slug);
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          $set[field] = newValue;
        }
      }
      if (Object.keys($set).length > 0) {
        await col.updateOne({ _id: doc._id }, { $set });
        fixed += 1;
      }
    }
    console.log(`[migrate] ${target.collection} URL 重写: ${fixed} 条`);
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
      await Tenant.updateOne({ _id: tenant._id }, buildTenantConfigUpdate());
      tenant = await Tenant.findById(tenant._id);
      console.log(`[migrate] 初始租户已存在: ${tenant.slug} (${tenant._id})`);
    }

    // 2. 回填业务集合的 tenantId
    const db = mongoose.connection.db;
    for (const collName of COLLECTIONS_TO_MIGRATE) {
      const col = db.collection(collName);
      const filter = {
        $or: [{ tenantId: { $exists: false } }, { tenantId: null }]
      };
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

    // 4. 现有 admin 迁移：
    //    - superadmin / platform_superadmin 保持平台角色，tenantId 为空
    //    - admin / operator / tenant_admin 绑定到初始租户
    const platformAdminUpdate = await Admin.updateMany(
      { role: { $in: ['superadmin', 'platform_superadmin'] } },
      { $set: { tenantId: null } }
    );
    console.log(`[migrate] 平台管理员保持平台角色: ${platformAdminUpdate.modifiedCount} 条`);

    const tenantAdminUpdate = await Admin.updateMany(
      {
        role: { $nin: ['superadmin', 'platform_superadmin'] },
        $or: [{ tenantId: { $exists: false } }, { tenantId: null }]
      },
      { $set: { tenantId: tenant._id } }
    );
    console.log(`[migrate] 租户管理员补 tenantId: ${tenantAdminUpdate.modifiedCount} 条`);

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

    // 6. 迁移历史上传文件与富文本 URL（幂等）
    moveUploadsToTenantDir(tenant.slug);
    await rewriteUploadUrls(db, tenant.slug);

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
