#!/usr/bin/env node

/**
 * Create the first platform administrator through a local, operator-run script.
 * This never deletes or changes existing administrator accounts.
 */
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production'
  ? path.join(__dirname, '../.env.production')
  : path.join(__dirname, '../.env');
dotenv.config({ path: envFile });

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) throw new Error(`${name} must be provided`);
  return value;
}

async function ensureFirstPlatformAdmin(Admin, { email, name, password, dbAccessPassword }) {
  const normalizedEmail = email.toLowerCase();
  const existing = await Admin.findOne({ email: normalizedEmail })
    .select('_id email role status')
    .lean()
    .exec();
  if (existing) return { created: false, admin: existing };

  const admin = new Admin({
    email: normalizedEmail,
    name,
    password,
    dbAccessPassword,
    role: 'platform_superadmin',
    status: 'active',
    permissions: []
  });
  await admin.save();
  return { created: true, admin };
}

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@morningreading.com';
  const name = process.env.ADMIN_NAME || '平台管理员';
  const password = required('ADMIN_DEFAULT_PASSWORD');
  const dbAccessPassword = required('ADMIN_DB_ACCESS_PASSWORD');
  const mongodbUri = required('MONGODB_URI');
  await mongoose.connect(mongodbUri, { serverSelectionTimeoutMS: 10000 });
  try {
    const Admin = require('../src/models/Admin');
    const result = await ensureFirstPlatformAdmin(Admin, { email, name, password, dbAccessPassword });
    if (result.created) console.log(`已创建平台管理员：${result.admin.email}`);
    else console.log(`管理员已存在：${result.admin.email}（${result.admin.role}/${result.admin.status}），未修改任何账号。`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`管理员初始化失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { ensureFirstPlatformAdmin };
