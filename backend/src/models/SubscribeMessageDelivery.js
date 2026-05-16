const mongoose = require('mongoose');

const subscribeMessageDeliverySchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: [
        'sent',
        'mocked',
        'skipped_no_grant',
        'skipped_reauthorization_required',
        'skipped_missing_openid',
        'skipped_missing_config',
        'failed'
      ],
      required: true
    },
    targetPage: {
      type: String,
      default: null
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    responseData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    errorCode: {
      type: Number,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    },
    sourceType: {
      type: String,
      default: null
    },
    sourceId: {
      type: String,
      default: null
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'subscribe_message_deliveries'
  }
);

subscribeMessageDeliverySchema.index({ userId: 1, scene: 1, createdAt: -1 });
subscribeMessageDeliverySchema.index({ sourceType: 1, sourceId: 1 });
subscribeMessageDeliverySchema.index({ tenantId: 1, createdAt: -1 });

const tenantPlugin = require('./plugins/tenantPlugin');
subscribeMessageDeliverySchema.plugin(tenantPlugin);

module.exports = mongoose.model('SubscribeMessageDelivery', subscribeMessageDeliverySchema);
