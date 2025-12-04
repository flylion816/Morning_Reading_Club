const mongoose = require('mongoose');

const insightRequestSchema = new mongoose.Schema(
  {
    // 申请者 ID
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // 被申请者 ID
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // 申请状态：pending(待处理), approved(已同意), rejected(已拒绝)
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },

    // 申请理由
    reason: {
      type: String,
      default: ''
    },

    // 允许查看的期次（仅在approved时有效）
    periodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Period',
      default: null
    },

    // 审批时间戳
    approvedAt: {
      type: Date,
      default: null
    },

    rejectedAt: {
      type: Date,
      default: null
    },

    // 审计日志：记录所有操作
    auditLog: [
      {
        action: {
          type: String,
          enum: ['create', 'approve', 'reject', 'admin_approve', 'admin_reject', 'revoke'],
          required: true
        },
        actor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        actorType: {
          type: String,
          enum: ['user', 'admin'],
          default: 'user'
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        note: String,
        reason: String
      }
    ]
  },
  {
    timestamps: true,
    collection: 'insight_requests'
  }
);

// 索引：加快查询
// 防止重复pending申请：同一对用户不能有多个pending状态的申请
insightRequestSchema.index(
  { fromUserId: 1, toUserId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' }
  }
);

// 查询被申请者收到的申请
insightRequestSchema.index({ toUserId: 1, status: 1 });

// 查询申请者发起的申请
insightRequestSchema.index({ fromUserId: 1, status: 1 });

// 按创建时间排序
insightRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InsightRequest', insightRequestSchema);
