const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // 操作者信息
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    adminName: {
      type: String,
      required: true
    },

    // 操作类型
    actionType: {
      type: String,
      enum: [
        'CREATE', // 创建
        'READ', // 查看
        'UPDATE', // 更新
        'DELETE', // 删除
        'APPROVE', // 审批通过
        'REJECT', // 审批拒绝
        'EXPORT', // 导出
        'BATCH_UPDATE', // 批量更新
        'BATCH_DELETE', // 批量删除
        'LOGIN', // 登录
        'LOGOUT', // 登出
        'ROLE_CHANGE' // 角色变更
      ],
      required: true,
      index: true
    },

    // 操作对象
    resourceType: {
      type: String,
      enum: [
        'enrollment', // 报名
        'period', // 期次
        'section', // 课节
        'user', // 用户
        'payment', // 支付
        'admin', // 管理员
        'system' // 系统操作
      ],
      required: true,
      index: true
    },

    // 被操作对象的ID
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },

    // 被操作对象的额外信息（用于快速查看）
    resourceName: String,

    // 操作详情
    details: {
      description: String, // 操作描述
      changes: {
        // 字段变更记录
        type: Map,
        of: {
          before: mongoose.Schema.Types.Mixed,
          after: mongoose.Schema.Types.Mixed
        }
      },
      reason: String, // 操作原因（如拒绝原因）
      batchCount: Number // 批量操作的数量
    },

    // IP和用户代理信息
    ipAddress: String,
    userAgent: String,

    // 操作状态
    status: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success'
    },

    // 失败原因
    errorMessage: String,

    // 时间戳
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false // 不使用自动 createdAt/updatedAt
  }
);

// 复合索引用于常见查询
auditLogSchema.index({ adminId: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, timestamp: -1 });
auditLogSchema.index({ actionType: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// 创建TTL索引，30天后自动删除
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
