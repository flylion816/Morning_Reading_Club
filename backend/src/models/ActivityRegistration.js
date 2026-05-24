const mongoose = require('mongoose');

const ActivityRegistrationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },

    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityActivity',
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    registeredAt: {
      type: Date,
      default: Date.now
    },

    status: {
      type: String,
      enum: ['registered', 'cancelled'],
      default: 'registered'
    },

    // 是否授权了订阅消息
    reminderGranted: {
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

// 一个用户对同一活动只能报名一次
ActivityRegistrationSchema.index({ activityId: 1, userId: 1 }, { unique: true });
ActivityRegistrationSchema.index({ tenantId: 1, userId: 1 });

const ActivityRegistration = mongoose.model('ActivityRegistration', ActivityRegistrationSchema);

module.exports = ActivityRegistration;
