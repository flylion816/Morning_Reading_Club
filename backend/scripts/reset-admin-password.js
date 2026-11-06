#!/usr/bin/env node

/** Update one existing admin. Credentials are supplied only via environment variables. */
const path = require('path');
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = path.resolve(__dirname, nodeEnv === 'production' ? '../.env.production' : '../.env');
require('dotenv').config({ path: envFile });
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');

async function resetAdminCredentials(AdminModel, email, newPassword, dbAccessPassword) {
  if (!email || !newPassword || newPassword.length < 12) {
    throw new Error('email and a password of at least 12 characters are required');
  }
  if (dbAccessPassword && dbAccessPassword.length < 12) {
    throw new Error('database access password must be at least 12 characters');
  }

  const admin = await AdminModel.findOne({ email: email.toLowerCase() });
  if (!admin) throw new Error(`未找到邮箱为 ${email} 的管理员`);
  admin.password = newPassword;
  if (dbAccessPassword) admin.dbAccessPassword = dbAccessPassword;
  await admin.save();
  return { email: admin.email, name: admin.name, role: admin.role };
}

async function main() {
  const [email, ...extraArgs] = process.argv.slice(2);
  if (!email || extraArgs.length) {
    throw new Error('Usage: ADMIN_NEW_PASSWORD=... [ADMIN_DB_ACCESS_PASSWORD=...] node reset-admin-password.js <email>');
  }
  const newPassword = process.env.ADMIN_NEW_PASSWORD;
  const dbAccessPassword = process.env.ADMIN_DB_ACCESS_PASSWORD;
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) throw new Error('MONGODB_URI must be supplied by the runtime environment');

  await mongoose.connect(mongodbUri, { serverSelectionTimeoutMS: 10000 });
  try {
    const updated = await resetAdminCredentials(Admin, email, newPassword, dbAccessPassword);
    console.log(`管理员凭据已更新：${updated.email}（${updated.role}）；密码未写入日志。`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`管理员密码更新失败：${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { resetAdminCredentials };
