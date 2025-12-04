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
    }
  },
  {
    timestamps: true,
    collection: 'insight_requests'
  }
);

// 索引：加快查询
insightRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
insightRequestSchema.index({ toUserId: 1, status: 1 });
insightRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('InsightRequest', insightRequestSchema);
