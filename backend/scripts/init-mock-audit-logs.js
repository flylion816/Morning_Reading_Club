const mongoose = require('mongoose')
const path = require('path')

// 导入模型
const AuditLog = require('../src/models/AuditLog')
const Admin = require('../src/models/Admin')

// 导入数据库配置
// 尝试多个可能的连接字符串
const mongoUri = process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/morning-reading' ||
  'mongodb://localhost:27017/morning-reading'

/**
 * 生成Mock审计日志数据
 */
async function initMockAuditLogs() {
  try {
    // 连接数据库
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log('✅ 数据库连接成功')

    // 获取或创建测试管理员
    const adminNames = ['李管理员', '王审计', '张运营', '超级管理员']
    const admins = []

    for (const name of adminNames) {
      let admin = await Admin.findOne({ name })
      if (!admin) {
        admin = await Admin.create({
          name,
          email: `${name}@example.com`,
          password: 'admin123456', // 默认密码
          role: name === '超级管理员' ? 'superadmin' : 'admin'
        })
        console.log(`✅ 创建管理员: ${name}`)
      }
      admins.push(admin)
    }

    // 生成Mock数据的时间范围（最近30天）
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // 清空现有的审计日志（可选）
    const deleteResult = await AuditLog.deleteMany({})
    console.log(`🗑️  删除了 ${deleteResult.deletedCount} 条旧审计日志`)

    // 操作类型和资源类型的组合
    const auditLogTemplates = [
      {
        actionType: 'CREATE',
        resourceType: 'period',
        resourceName: '第一期期次',
        description: '创建新的期次：第一期期次'
      },
      {
        actionType: 'UPDATE',
        resourceType: 'period',
        resourceName: '第一期期次',
        description: '修改期次名称'
      },
      {
        actionType: 'CREATE',
        resourceType: 'section',
        resourceName: 'Day 1 - 启航',
        description: '创建课节：Day 1 - 启航'
      },
      {
        actionType: 'UPDATE',
        resourceType: 'section',
        resourceName: 'Day 1 - 启航',
        description: '更新课节内容',
        changes: {
          title: { before: '启航', after: '启航 - 新的开始' },
          content: { before: '旧内容...', after: '新内容...' }
        }
      },
      {
        actionType: 'APPROVE',
        resourceType: 'enrollment',
        resourceName: '用户张三的报名',
        description: '审批通过用户报名',
        reason: '信息完整，符合条件'
      },
      {
        actionType: 'REJECT',
        resourceType: 'enrollment',
        resourceName: '用户李四的报名',
        description: '审批拒绝用户报名',
        reason: '信息不完整'
      },
      {
        actionType: 'UPDATE',
        resourceType: 'user',
        resourceName: '张三',
        description: '更新用户信息',
        changes: {
          status: { before: 'pending', after: 'active' },
          role: { before: 'user', after: 'vip' }
        }
      },
      {
        actionType: 'DELETE',
        resourceType: 'section',
        resourceName: '已删除的课节',
        description: '删除无效课节'
      },
      {
        actionType: 'EXPORT',
        resourceType: 'enrollment',
        resourceName: '报名列表导出',
        description: '导出全部报名数据',
        batchCount: 156
      },
      {
        actionType: 'BATCH_UPDATE',
        resourceType: 'enrollment',
        resourceName: '批量更新报名状态',
        description: '批量审批通过100条报名',
        batchCount: 100
      },
      {
        actionType: 'BATCH_DELETE',
        resourceType: 'user',
        resourceName: '清理无效用户',
        description: '批量删除未登录的用户',
        batchCount: 25
      },
      {
        actionType: 'LOGIN',
        resourceType: 'admin',
        resourceName: '管理员登录',
        description: '管理员成功登录系统'
      },
      {
        actionType: 'UPDATE',
        resourceType: 'payment',
        resourceName: '支付记录更新',
        description: '标记支付为已完成',
        changes: {
          status: { before: 'pending', after: 'completed' },
          completedAt: { before: null, after: new Date().toISOString() }
        }
      }
    ]

    // 生成多个随机时间点的日志
    const auditLogs = []
    const logsPerTemplate = 3

    for (let i = 0; i < auditLogTemplates.length * logsPerTemplate; i++) {
      const template = auditLogTemplates[i % auditLogTemplates.length]
      const admin = admins[i % admins.length]

      // 生成随机时间（在30天内）
      const randomTime = new Date(
        thirtyDaysAgo.getTime() + Math.random() * (now.getTime() - thirtyDaysAgo.getTime())
      )

      // 随机生成一些失败的操作（10%概率）
      const isFailed = Math.random() < 0.1
      const status = isFailed ? 'failure' : 'success'
      const errorMessage = isFailed ? '权限不足或操作失败' : null

      const auditLog = {
        adminId: admin._id,
        adminName: admin.name,
        actionType: template.actionType,
        resourceType: template.resourceType,
        resourceId: new mongoose.Types.ObjectId(), // 随机ID
        resourceName: template.resourceName,
        details: {
          description: template.description,
          changes: template.changes || null,
          reason: template.reason || null,
          batchCount: template.batchCount || null
        },
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: `Mozilla/5.0 (${['Windows NT 10.0', 'Macintosh; Intel Mac OS X', 'X11; Linux x86_64'][Math.floor(Math.random() * 3)]})`,
        status,
        errorMessage,
        timestamp: randomTime
      }

      auditLogs.push(auditLog)
    }

    // 添加一些特殊的操作日志
    const specialLogs = [
      {
        adminId: admins[0]._id,
        adminName: admins[0].name,
        actionType: 'DELETE',
        resourceType: 'system',
        details: {
          description: '清理过期日志，删除30天前的记录'
        },
        ipAddress: '127.0.0.1',
        status: 'success',
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) // 2天前
      },
      {
        adminId: admins[3]._id,
        adminName: admins[3].name,
        actionType: 'LOGIN',
        resourceType: 'admin',
        details: {
          description: '超级管理员登录'
        },
        ipAddress: '192.168.1.100',
        status: 'success',
        timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000) // 1小时前
      },
      {
        adminId: admins[1]._id,
        adminName: admins[1].name,
        actionType: 'UPDATE',
        resourceType: 'period',
        resourceName: '第二期期次',
        details: {
          description: '发布期次',
          changes: {
            isPublished: { before: false, after: true }
          }
        },
        ipAddress: '192.168.1.50',
        status: 'success',
        timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000) // 5小时前
      }
    ]

    auditLogs.push(...specialLogs)

    // 保存所有审计日志
    const result = await AuditLog.insertMany(auditLogs)
    console.log(`✅ 成功创建 ${result.length} 条审计日志`)

    // 显示统计信息
    const stats = {
      总数: await AuditLog.countDocuments(),
      成功: await AuditLog.countDocuments({ status: 'success' }),
      失败: await AuditLog.countDocuments({ status: 'failure' }),
      操作类型统计: await AuditLog.aggregate([
        { $group: { _id: '$actionType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      资源类型统计: await AuditLog.aggregate([
        { $group: { _id: '$resourceType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      管理员统计: await AuditLog.aggregate([
        { $group: { _id: '$adminName', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    }

    console.log('\n📊 审计日志统计信息:')
    console.log(`├─ 总审计日志数: ${stats.总数}`)
    console.log(`├─ 成功操作: ${stats.成功}`)
    console.log(`├─ 失败操作: ${stats.失败}`)
    console.log('\n操作类型分布:')
    stats.操作类型统计.forEach(item => {
      console.log(`├─ ${item._id}: ${item.count}`)
    })
    console.log('\n资源类型分布:')
    stats.资源类型统计.forEach(item => {
      console.log(`├─ ${item._id}: ${item.count}`)
    })
    console.log('\n管理员操作统计:')
    stats.管理员统计.forEach(item => {
      console.log(`├─ ${item._id}: ${item.count}`)
    })

    console.log('\n✅ Mock审计日志初始化完成！')
    console.log('📝 您现在可以在管理后台的"审计日志"页面查看这些数据')

    process.exit(0)
  } catch (error) {
    console.error('❌ 初始化失败:', error)
    process.exit(1)
  }
}

// 运行脚本
initMockAuditLogs()
