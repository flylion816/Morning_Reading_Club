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
  'insight_request_approve'
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

module.exports = mongoose.model('UserActivity', UserActivitySchema);
module.exports.ACTIONS = ACTIONS;
