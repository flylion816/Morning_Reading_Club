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
        'admin_rejected', // 管理员拒绝
        'enrollment_result', // 报名结果
        'payment_result', // 付款结果
        'comment_received', // 收到评论/回复
        'like_received', // 收到点赞
        'insight_created', // 被小凡看见
        'insight_liked', // 小凡看见收到点赞
        'danmaku_received', // 小凡看见收到弹幕
        'imprint_mentioned', // 被提及在印记里
        'podcast_published' // 播客发布通知
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
      reason: String, // 原因（对于request_rejected）
      scene: String,
      targetPage: String,
      sectionId: String,
      checkinId: String,
      commentId: String,
      replyId: String,
      periodId: String,
      insightRequestId: String,
      insightId: String,
      danmakuId: String
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true
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

// 复用同一条小凡看见申请站内信
notificationSchema.index({ userId: 1, type: 1, requestId: 1 });
notificationSchema.index({ userId: 1, type: 1, 'data.insightRequestId': 1 });

// 按创建时间排序
notificationSchema.index({ createdAt: -1 });

// 按归档时间排序
notificationSchema.index({ archivedAt: -1 });
notificationSchema.index({ tenantId: 1, createdAt: -1 });

const tenantPlugin = require('./plugins/tenantPlugin');
notificationSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Notification', notificationSchema);
