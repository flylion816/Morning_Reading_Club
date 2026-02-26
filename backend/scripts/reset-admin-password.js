#!/usr/bin/env node

/**
 * 重置管理员密码脚本
 * 用于更新 MongoDB 中的管理员账号密码和数据库访问密码
 *
 * 使用方法：
 *   node backend/scripts/reset-admin-password.js <email> <newPassword> [dbAccessPassword]
 *
 * 示例：
 *   node backend/scripts/reset-admin-password.js admin@morningreading.com Km7$Px2Qw9
 *   node backend/scripts/reset-admin-password.js admin@morningreading.com Km7$Px2Qw9 Jb3#Rl8Tn5
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Admin = require('../src/models/Admin');

async function resetAdminPassword() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ 缺少参数！');
    console.log('');
    console.log('使用方法：');
    console.log('  node backend/scripts/reset-admin-password.js <email> <newPassword> [dbAccessPassword]');
    console.log('');
    console.log('示例：');
    console.log('  node backend/scripts/reset-admin-password.js admin@morningreading.com Km7$Px2Qw9');
    console.log('  node backend/scripts/reset-admin-password.js admin@morningreading.com Km7$Px2Qw9 Jb3#Rl8Tn5');
    process.exit(1);
  }

  const email = args[0];
  const newPassword = args[1];
  const dbAccessPassword = args[2];

  try {
    console.log('🔗 连接 MongoDB...');
    const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';
    await mongoose.connect(mongodbUri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ MongoDB 连接成功');
    console.log('');

    console.log(`🔍 查找管理员账号: ${email}`);
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      console.error(`❌ 未找到邮箱为 ${email} 的管理员`);
      process.exit(1);
    }

    console.log(`✅ 找到管理员: ${admin.name}`);
    console.log('');

    // 更新登录密码
    console.log('🔐 更新登录密码...');
    admin.password = newPassword;

    // 如果提供了第三个参数，同时更新数据库访问密码
    if (dbAccessPassword) {
      console.log('🔐 更新数据库访问密码...');
      admin.dbAccessPassword = dbAccessPassword;
    }

    await admin.save();

    console.log('✅ 密码更新成功！');
    console.log('');
    console.log('📋 管理员信息：');
    console.log(`   邮箱: ${admin.email}`);
    console.log(`   姓名: ${admin.name}`);
    console.log(`   角色: ${admin.role}`);
    console.log(`   新登录密码: ${newPassword}`);
    if (dbAccessPassword) {
      console.log(`   新数据库访问密码: ${dbAccessPassword}`);
    }
    console.log('');
    console.log('💡 提示：请妥善保管新密码');

    await mongoose.connection.close();
    console.log('');
    console.log('✅ 完成');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

resetAdminPassword();
