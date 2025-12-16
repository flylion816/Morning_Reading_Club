#!/usr/bin/env node

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';

async function showAdmins() {
  let connection = null;

  try {
    console.log('🔄 连接 MongoDB...');
    connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ MongoDB 连接成功\n');

    // 导入 Admin 模型
    const Admin = require('../src/models/Admin');

    // 查询所有管理员
    console.log('📋 查询所有管理员...\n');
    const admins = await Admin.find({});

    if (admins.length === 0) {
      console.log('❌ 数据库中没有管理员\n');
      process.exit(0);
    }

    console.log(`✅ 找到 ${admins.length} 个管理员\n`);
    console.log('═'.repeat(80));

    // 显示每个管理员的详细信息
    admins.forEach((admin, index) => {
      console.log(`\n👤 管理员 #${index + 1}`);
      console.log('─'.repeat(80));

      // 获取所有字段
      const adminObj = admin.toObject({ virtuals: true });

      // 按类别显示字段
      console.log('\n【基本信息】');
      console.log(`  • ID (_id):       ${adminObj._id}`);
      console.log(`  • 名称 (name):    ${adminObj.name}`);
      console.log(`  • 邮箱 (email):   ${adminObj.email}`);
      console.log(`  • 头像 (avatar):  ${adminObj.avatar || '(无)'}`);

      console.log('\n【权限管理】');
      console.log(`  • 角色 (role):         ${adminObj.role}`);
      console.log(
        `  • 权限列表 (permissions): ${adminObj.permissions && adminObj.permissions.length > 0 ? adminObj.permissions.join(', ') : '(无)'}`
      );

      console.log('\n【账户状态】');
      console.log(`  • 状态 (status):        ${adminObj.status}`);
      console.log(`  • 登录次数 (loginCount): ${adminObj.loginCount}`);
      console.log(
        `  • 最后登录 (lastLoginAt): ${adminObj.lastLoginAt ? new Date(adminObj.lastLoginAt).toLocaleString() : '(从未登录)'}`
      );

      console.log('\n【时间戳】');
      console.log(`  • 创建时间 (createdAt): ${new Date(adminObj.createdAt).toLocaleString()}`);
      console.log(`  • 更新时间 (updatedAt): ${new Date(adminObj.updatedAt).toLocaleString()}`);

      console.log('\n【密码】');
      console.log(`  • 密码 (password):     [HASHED - ${admin.password ? '已设置' : '未设置'}]`);

      console.log('\n' + '─'.repeat(80));
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`\n📊 数据库统计：`);
    console.log(`   总管理员数: ${admins.length}`);
    console.log(`   活跃管理员: ${admins.filter(a => a.status === 'active').length}`);
    console.log(`   禁用管理员: ${admins.filter(a => a.status === 'inactive').length}`);

    // 显示 Admin 模型的所有字段定义
    console.log(`\n📋 Admin 模型字段定义：`);
    const schema = Admin.schema;
    console.log('─'.repeat(80));
    Object.keys(schema.paths).forEach(path => {
      const schemaType = schema.paths[path];
      console.log(
        `  • ${path}: ${schemaType.instance} ${schemaType.isRequired ? '[必需]' : '[可选]'}`
      );
    });

    console.log('\n' + '═'.repeat(80) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await mongoose.disconnect();
    }
  }
}

// 运行查询
showAdmins();
