const mongoose = require('mongoose');

const subscribeMessageGrantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    scene: {
      type: String,
      required: true,
      index: true
    },
    templateId: {
      type: String,
      required: true
    },
    periodId: {
      type: String,
      default: null,
      index: true
    },
    sourceAction: {
      type: String,
      default: null
    },
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    availableCount: {
      type: Number,
      default: 0,
      min: 0
    },
    autoTopUpTarget: {
      type: Number,
      default: 1,
      min: 1
    },
    scheduledSendDate: {
      type: Date,
      default: null
    },
    scheduledSendDateKey: {
      type: String,
      default: null,
      index: true
    },
    retryAt: {
      type: Date,
      default: null
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastResult: {
      type: String,
      enum: ['accept', 'reject', 'ban', 'error', null],
      default: null
    },
    lastAcceptedAt: {
      type: Date,
      default: null
    },
    lastRejectedAt: {
      type: Date,
      default: null
    },
    lastRequestedAt: {
      type: Date,
      default: null
    },
    deliveryBlocked: {
      type: Boolean,
      default: false
    },
    deliveryBlockedReason: {
      type: String,
      default: null
    },
    lastWechatErrorCode: {
      type: Number,
      default: null
    },
    lastWechatRefusedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'subscribe_message_grants'
  }
);

subscribeMessageGrantSchema.index({ userId: 1, scene: 1, templateId: 1 }, { unique: true });
subscribeMessageGrantSchema.index({ scene: 1, scheduledSendDate: 1, retryAt: 1, availableCount: 1 });

module.exports = mongoose.model('SubscribeMessageGrant', subscribeMessageGrantSchema);
