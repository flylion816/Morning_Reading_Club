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
    coverImage: {
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
      required: true
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
    maxAttendees: {
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
    }
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
