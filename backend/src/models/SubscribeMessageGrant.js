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
    availableCount: {
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
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'subscribe_message_grants'
  }
);

subscribeMessageGrantSchema.index({ userId: 1, scene: 1, templateId: 1 }, { unique: true });

module.exports = mongoose.model('SubscribeMessageGrant', subscribeMessageGrantSchema);
