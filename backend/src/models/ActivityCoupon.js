const mongoose = require('mongoose');
const { getCurrentTenantId } = require('../utils/tenantContext');

const ActivityCouponSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },

    // 适用活动（null 表示通用券）
    activityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommunityActivity',
      default: null
    },

    // 优惠券名称
    name: {
      type: String,
      required: true,
      maxlength: 50
    },

    // 折扣类型：fixed=固定减免金额（分），percent=折扣百分比（0-100）
    discountType: {
      type: String,
      enum: ['fixed', 'percent'],
      required: true
    },

    // 折扣值：fixed 时为减免分数，percent 时为折扣百分比
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },

    // 有效期开始
    validFrom: {
      type: Date,
      required: true
    },

    // 有效期结束
    validUntil: {
      type: Date,
      required: true
    },

    // 归属用户
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // 状态：active=可用, used=已使用, expired=已过期
    status: {
      type: String,
      enum: ['active', 'used', 'expired'],
      default: 'active'
    },

    // 使用时间
    usedAt: {
      type: Date,
      default: null
    },

    // 使用该券的报名记录
    usedByRegistrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ActivityRegistration',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

ActivityCouponSchema.index({ tenantId: 1, userId: 1, status: 1 });
ActivityCouponSchema.index({ tenantId: 1, activityId: 1, status: 1 });

const tenantPlugin = require('./plugins/tenantPlugin');
ActivityCouponSchema.plugin(tenantPlugin);

const ActivityCoupon = mongoose.model('ActivityCoupon', ActivityCouponSchema);
module.exports = ActivityCoupon;
