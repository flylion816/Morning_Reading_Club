const mongoose = require('mongoose');

const CommunityActivitySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      maxlength: 100
    },

    // witness: 见证分享, chat: 交流会, other: 其他
    type: {
      type: String,
      enum: ['witness', 'chat', 'other'],
      default: 'other'
    },

    // 海报图 URL
    posterUrl: {
      type: String,
      default: null
    },

    // 富文本 HTML
    description: {
      type: String,
      default: null
    },

    startTime: {
      type: Date,
      required: true
    },

    endTime: {
      type: Date,
      default: null
    },

    // 腾讯会议号
    meetingId: {
      type: String,
      default: null
    },

    // 腾讯会议邀请链接
    meetingJoinUrl: {
      type: String,
      default: null
    },

    // 0 = 不限
    maxParticipants: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled'],
      default: 'draft'
    },

    // 是否在小程序首页弹窗
    showPopup: {
      type: Boolean,
      default: false
    },

    // 弹窗展示开始时间
    popupStartTime: {
      type: Date,
      default: null
    },

    // 弹窗展示结束时间
    popupEndTime: {
      type: Date,
      default: null
    },

    // 10分钟提醒是否已发
    reminderSent: {
      type: Boolean,
      default: false
    },

    // 是否付费活动
    isPaid: {
      type: Boolean,
      default: false
    },

    // 活动价格（单位：分）
    price: {
      type: Number,
      default: 0,
      min: 0
    },

    // 可见范围：all=全部用户，specific=指定用户
    visibilityType: {
      type: String,
      enum: ['all', 'specific'],
      default: 'all'
    },

    // 指定可见用户列表（visibilityType=specific 时生效）
    visibleUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

CommunityActivitySchema.index({ tenantId: 1, startTime: 1 });
CommunityActivitySchema.index({ tenantId: 1, status: 1 });

const CommunityActivity = mongoose.model('CommunityActivity', CommunityActivitySchema);

module.exports = CommunityActivity;
