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
    },

    // 支付状态：free=免费活动, pending=待支付, paid=已支付
    paymentStatus: {
      type: String,
      enum: ['free', 'pending', 'paid'],
      default: 'free'
    },

    // 关联支付记录
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },

    // 使用的优惠券
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ActivityCoupon',
      default: null
    },

    // 实际支付金额（单位：分）
    paidAmount: {
      type: Number,
      default: 0
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
