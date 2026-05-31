const mongoose = require('mongoose');

const ACTIONS = [
  'app_open',
  'profile_update',
  'course_view',
  'checkin_submit',
  'comment_create',
  'like_create',
  'own_insight_view',
  'other_insight_view',
  'meeting_enter',
  'insight_request_approve',
  'zaichang_list_view',
  'zaichang_publish_view',
  'zaichang_imprint_publish',
  'zaichang_detail_view',
  'zaichang_imprint_like',
  'zaichang_imprint_comment',
  'index_popup_view',
  'index_podcast_enter',
  'checkin_records_view',
  'course_ai_read',
  'insight_ai_read',
  'insight_share',
  'insight_like',
  'insight_danmaku',
  'podcast_play',
  'podcast_bar_play',
  'podcast_share',
  'closing_video_share',
  'course_share',
  'activity_enroll'
];

const UserActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      enum: ACTIONS,
      required: true
    },
    actionDate: {
      type: String,
      required: true
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true
    },
    targetType: {
      type: String,
      default: null
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    periodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Period',
      default: null
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ipAddress: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
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
    versionKey: false
  }
);

UserActivitySchema.index({ actionDate: 1, action: 1, userId: 1 });
UserActivitySchema.index({ occurredAt: -1 });
UserActivitySchema.index({ userId: 1, occurredAt: -1 });
UserActivitySchema.index({ action: 1, occurredAt: -1 });
UserActivitySchema.index({ periodId: 1, actionDate: 1 });
UserActivitySchema.index({ tenantId: 1, createdAt: -1 });

const tenantPlugin = require('./plugins/tenantPlugin');
UserActivitySchema.plugin(tenantPlugin);

module.exports = mongoose.model('UserActivity', UserActivitySchema);
module.exports.ACTIONS = ACTIONS;
