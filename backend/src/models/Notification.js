const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // 接收通知的用户
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // 通知类型
    type: {
      type: String,
      enum: [
        'request_created', // 新的查看申请
        'request_approved', // 申请被同意
        'request_rejected', // 申请被拒绝
        'permission_revoked', // 权限被撤销
        'admin_approved', // 管理员同意
        'admin_rejected' // 管理员拒绝
      ],
      required: true
    },

    // 标题
    title: {
      type: String,
      required: true
    },

    // 内容
    content: {
      type: String,
      required: true
    },

    // 关联的申请ID（可选）
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InsightRequest',
      default: null
    },

    // 发送者（可选，用于显示谁执行了操作）
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // 是否已读
    isRead: {
      type: Boolean,
      default: false
    },

    // 标记为已读的时间
    readAt: {
      type: Date,
      default: null
    },

    // 是否已归档
    isArchived: {
      type: Boolean,
      default: false
    },

    // 归档时间
    archivedAt: {
      type: Date,
      default: null
    },

    // 数据载荷（用于前端展示额外信息）
    data: {
      senderName: String, // 发送者昵称
      senderAvatar: String, // 发送者头像
      fromUserName: String, // 申请者昵称（对于request_created）
      toUserName: String, // 被申请者昵称（对于request_created）
      periodName: String, // 期次名称（对于request_approved）
      reason: String // 原因（对于request_rejected）
    }
  },
  {
    timestamps: true,
    collection: 'notifications'
  }
);

// 索引：加快查询
// 查询某用户的通知（包括归档状态）
notificationSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });

// 查询某用户的未读通知
notificationSchema.index({ userId: 1, isRead: 1 });

// 按创建时间排序
notificationSchema.index({ createdAt: -1 });

// 按归档时间排序
notificationSchema.index({ archivedAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
