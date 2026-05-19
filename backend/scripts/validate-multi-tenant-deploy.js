/**
 * 多租户上线只读校验脚本。
 *
 * 用法：
 *   node scripts/validate-multi-tenant-deploy.js --phase release-config
 *   node scripts/validate-multi-tenant-deploy.js --phase pre-migration
 *   node scripts/validate-multi-tenant-deploy.js --phase post-migration
 *
 * 本脚本只读 MongoDB / MySQL / 配置文件，不会写入或迁移任何数据。
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const { EJSON } = require('bson');

dotenv.config({ path: path.resolve(__dirname, '../.env.production') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const BUSINESS_COLLECTIONS = [
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

const MYSQL_TABLES = [
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

const UNIQUE_INDEX_EXPECTATIONS = [
  { collection: 'users', name: 'tenant_openid_unique' },
  { collection: 'payments', name: 'tenant_orderNo_unique' },
  { collection: 'sections', name: 'tenant_period_day_unique' },
  { collection: 'checkins', name: 'tenant_user_period_date_unique' },
  { collection: 'enrollments', name: 'tenant_user_period_unique' },
  { collection: 'insight_requests', name: 'tenant_pending_insight_request_unique' },
  { collection: 'subscribe_message_grants', name: 'tenant_user_scene_template_unique' }
];

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] || fallback;
}

function printCheck(ok, message, detail = '') {
  const prefix = ok ? '✅' : '❌';
  console.log(`${prefix} ${message}${detail ? `: ${detail}` : ''}`);
}

function fail(failures, message, detail = '') {
  failures.push(detail ? `${message}: ${detail}` : message);
  printCheck(false, message, detail);
}

function pass(message, detail = '') {
  printCheck(true, message, detail);
}

function requireEnv(failures, key) {
  if (!process.env[key]) {
    fail(failures, `缺少环境变量 ${key}`);
    return;
  }
  pass(`环境变量 ${key} 已配置`);
}

function readMiniProgramEnv() {
  const envPath = path.resolve(__dirname, '../../miniprogram/config/env.js');
  if (!fs.existsSync(envPath)) return null;
  const source = fs.readFileSync(envPath, 'utf8');
  const match = source.match(/const\s+currentEnv\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

async function validateReleaseConfig() {
  const failures = [];

  requireEnv(failures, 'MONGODB_URI');
  requireEnv(failures, 'JWT_SECRET');
  requireEnv(failures, 'WECHAT_APPID');
  requireEnv(failures, 'WECHAT_SECRET');
  requireEnv(failures, 'WECHAT_MCH_ID');
  requireEnv(failures, 'WECHAT_API_KEY');
  requireEnv(failures, 'WECHAT_NOTIFY_URL');

  if (process.env.ENABLE_LEGACY_DEFAULT_TENANT !== 'true') {
    fail(failures, 'ENABLE_LEGACY_DEFAULT_TENANT 必须在过渡期设为 true');
  } else {
    pass('ENABLE_LEGACY_DEFAULT_TENANT=true');
  }

  const currentEnv = readMiniProgramEnv();
  if (!currentEnv) {
    fail(failures, '无法读取 miniprogram/config/env.js 的 currentEnv');
  } else if (currentEnv !== 'prod') {
    fail(failures, '小程序 currentEnv 不是 prod', currentEnv);
  } else {
    pass('小程序 currentEnv=prod');
  }

  return failures;
}

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    throw new Error('未配置 MONGODB_URI');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  return mongoose.connection.db;
}

async function inspectMongo(db) {
  const collections = await db.listCollections().toArray();
  const collectionNames = new Set(collections.map(item => item.name));
  const result = {
    database: db.databaseName,
    tenantCount: collectionNames.has('tenants') ? await db.collection('tenants').countDocuments({}) : 0,
    tenants: collectionNames.has('tenants')
      ? await db.collection('tenants').find({}, {
        projection: {
          slug: 1,
          name: 1,
          wxAppIds: 1,
          'wechatLogin.appId': 1,
          'wechatPay.appId': 1,
          'wechatPay.mchId': 1,
          status: 1
        }
      }).toArray()
      : [],
    collections: {},
    admins: [],
    indexes: {}
  };

  for (const name of BUSINESS_COLLECTIONS) {
    if (!collectionNames.has(name)) {
      result.collections[name] = { exists: false, count: 0, missingTenantId: 0 };
      continue;
    }
    const col = db.collection(name);
    result.collections[name] = {
      exists: true,
      count: await col.countDocuments({}),
      missingTenantId: await col.countDocuments({
        $or: [{ tenantId: { $exists: false } }, { tenantId: null }]
      })
    };
  }

  if (collectionNames.has('admins')) {
    result.admins = await db.collection('admins').find({}, {
      projection: { email: 1, role: 1, tenantId: 1, status: 1 }
    }).toArray();
  }

  for (const item of UNIQUE_INDEX_EXPECTATIONS) {
    if (!collectionNames.has(item.collection)) {
      result.indexes[item.collection] = [];
      continue;
    }
    result.indexes[item.collection] = await db.collection(item.collection).indexes();
  }

  return result;
}

async function connectMysql() {
  if (!process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) {
    return null;
  }
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });
}

async function inspectMysql(conn) {
  if (!conn) return { skipped: true, tables: {} };
  const result = { skipped: false, tables: {} };
  for (const table of MYSQL_TABLES) {
    try {
      const [countRows] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      const [columns] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
      const [indexes] = await conn.query(`SHOW INDEX FROM \`${table}\``);
      result.tables[table] = {
        exists: true,
        count: countRows[0].count,
        hasTenantId: columns.some(col => col.Field === 'tenant_id'),
        hasTenantIndex: indexes.some(index => index.Key_name === 'idx_tenant_id')
      };
    } catch (error) {
      result.tables[table] = {
        exists: false,
        error: error.message,
        count: 0,
        hasTenantId: false,
        hasTenantIndex: false
      };
    }
  }
  return result;
}

function printMongoSummary(mongoInfo) {
  console.log(`\nMongoDB: ${mongoInfo.database}`);
  pass('租户数量', String(mongoInfo.tenantCount));
  if (mongoInfo.tenants.length > 0) {
    console.log(EJSON.stringify(mongoInfo.tenants, { relaxed: true, indent: 2 }));
  }
  for (const [name, info] of Object.entries(mongoInfo.collections)) {
    printCheck(
      info.exists,
      `Mongo 集合 ${name}`,
      `count=${info.count}, missingTenantId=${info.missingTenantId}`
    );
  }
}

function printMysqlSummary(mysqlInfo) {
  if (mysqlInfo.skipped) {
    console.log('\nMySQL: 跳过（未配置 MYSQL_USER/MYSQL_DATABASE）');
    return;
  }
  console.log('\nMySQL:');
  for (const [table, info] of Object.entries(mysqlInfo.tables)) {
    printCheck(
      info.exists && info.hasTenantId && info.hasTenantIndex,
      `MySQL 表 ${table}`,
      `count=${info.count}, tenant_id=${info.hasTenantId}, idx_tenant_id=${info.hasTenantIndex}`
    );
  }
}

function validatePostMigration(mongoInfo, mysqlInfo) {
  const failures = [];
  const fanren = mongoInfo.tenants.find(tenant => tenant.slug === 'fanren');
  if (!fanren) {
    fail(failures, '缺少 fanren 租户');
  } else {
    pass('fanren 租户存在', String(fanren._id));
    const appIds = new Set([...(fanren.wxAppIds || []), fanren.wechatLogin?.appId].filter(Boolean));
    if (!appIds.has(process.env.WECHAT_APPID)) {
      fail(failures, 'fanren 租户未绑定 WECHAT_APPID', process.env.WECHAT_APPID || '');
    } else {
      pass('fanren 租户已绑定 WECHAT_APPID');
    }
    if (!fanren.wechatPay?.mchId) {
      fail(failures, 'fanren 租户缺少 wechatPay.mchId');
    } else {
      pass('fanren 租户已配置 wechatPay.mchId');
    }
  }

  for (const [name, info] of Object.entries(mongoInfo.collections)) {
    if (info.exists && info.missingTenantId > 0) {
      fail(failures, `Mongo 集合 ${name} 仍有未迁移 tenantId`, String(info.missingTenantId));
    }
  }

  for (const admin of mongoInfo.admins) {
    const role = admin.role;
    const isPlatform = role === 'platform_superadmin' || role === 'superadmin';
    if (isPlatform && admin.tenantId) {
      fail(failures, `平台管理员 tenantId 应为空`, `${admin.email || admin._id}`);
    }
    if (!isPlatform && !admin.tenantId) {
      fail(failures, `租户管理员缺少 tenantId`, `${admin.email || admin._id}`);
    }
  }

  for (const expected of UNIQUE_INDEX_EXPECTATIONS) {
    const indexes = mongoInfo.indexes[expected.collection] || [];
    if (!indexes.some(index => index.name === expected.name)) {
      fail(failures, `缺少 Mongo 唯一索引 ${expected.collection}.${expected.name}`);
    } else {
      pass(`Mongo 唯一索引存在 ${expected.collection}.${expected.name}`);
    }
  }

  if (!mysqlInfo.skipped) {
    for (const [table, info] of Object.entries(mysqlInfo.tables)) {
      if (!info.exists) {
        fail(failures, `MySQL 表不存在 ${table}`, info.error || '');
      } else if (!info.hasTenantId || !info.hasTenantIndex) {
        fail(failures, `MySQL 表 ${table} 缺少 tenant_id 或 idx_tenant_id`);
      }
    }
  }

  return failures;
}

function validatePreMigration(mongoInfo, mysqlInfo) {
  const failures = [];
  const hasTenant = mongoInfo.tenantCount > 0;
  const missingCounts = Object.values(mongoInfo.collections).filter(info => info.exists && info.missingTenantId > 0).length;
  if (hasTenant && missingCounts > 0) {
    fail(failures, '检测到部分多租户状态', '已存在 tenants 但仍有集合缺 tenantId，请先人工确认再继续');
  }
  if (!mysqlInfo.skipped) {
    const partialMysql = Object.values(mysqlInfo.tables).filter(info => info.exists && info.hasTenantId).length;
    if (partialMysql > 0 && partialMysql < MYSQL_TABLES.length) {
      fail(failures, 'MySQL tenant_id 迁移状态不完整', `${partialMysql}/${MYSQL_TABLES.length}`);
    }
  }
  if (failures.length === 0) {
    pass('迁移前状态可识别', '可以进入备份和维护窗口');
  }
  return failures;
}

async function main() {
  const phase = getArg('phase', 'post-migration');
  let failures = [];

  if (phase === 'release-config') {
    failures = await validateReleaseConfig();
  } else if (phase === 'pre-migration' || phase === 'post-migration') {
    const db = await connectMongo();
    const mysqlConn = await connectMysql();
    try {
      const [mongoInfo, mysqlInfo] = await Promise.all([
        inspectMongo(db),
        inspectMysql(mysqlConn)
      ]);
      printMongoSummary(mongoInfo);
      printMysqlSummary(mysqlInfo);
      failures = phase === 'pre-migration'
        ? validatePreMigration(mongoInfo, mysqlInfo)
        : validatePostMigration(mongoInfo, mysqlInfo);
    } finally {
      if (mysqlConn) await mysqlConn.end();
      await mongoose.disconnect();
    }
  } else {
    failures = [`未知 phase: ${phase}`];
  }

  if (failures.length > 0) {
    console.error('\n校验失败：');
    failures.forEach(item => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log('\n校验通过');
}

main().catch(error => {
  console.error('校验脚本执行失败:', error);
  process.exit(1);
});
