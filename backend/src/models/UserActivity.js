const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');
const { ACTIONS } = require('../constants/userActivity');

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

UserActivitySchema.plugin(tenantPlugin);

module.exports = mongoose.model('UserActivity', UserActivitySchema);
module.exports.ACTIONS = ACTIONS;
