#!/usr/bin/env node

require('dotenv').config()
const mongoose = require('mongoose')
const Admin = require('../src/models/Admin')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db'

async function initAdmin() {
  try {
    // 连接数据库
    await mongoose.connect(MONGODB_URI)
    console.log('✅ MongoDB 连接成功')

    // 检查管理员是否已存在
    const existingAdmin = await Admin.findOne({ email: 'admin@morningreading.com' })

    if (existingAdmin) {
      console.log('✅ 管理员已存在：', existingAdmin.email)
      console.log('📧 邮箱：admin@morningreading.com')
      console.log('🔑 密码：password123')
      await mongoose.disconnect()
      return
    }

    // 创建新管理员
    const admin = new Admin({
      name: '系统管理员',
      email: 'admin@morningreading.com',
      password: 'password123',
      role: 'superadmin',
      status: 'active',
      permissions: ['*']  // 拥有所有权限
    })

    await admin.save()
    console.log('✅ 管理员创建成功！')
    console.log('📧 邮箱：admin@morningreading.com')
    console.log('🔑 密码：password123')
    console.log('👤 角色：超级管理员 (superadmin)')

  } catch (error) {
    console.error('❌ 创建管理员失败：', error.message)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

// 运行初始化
initAdmin()
