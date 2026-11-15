const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 读伴回应：读伴对 TA 的一篇打卡回一句预设短句，每人每篇打卡只能回应一次
const BuddyReactionSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
    checkinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Checkin', required: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 只存预设短句的 key，不存自由文本
    key: { type: String, required: true },
    dayKey: { type: String, required: true }
  },
  { timestamps: true, versionKey: false }
);

BuddyReactionSchema.index({ tenantId: 1, checkinId: 1, fromUserId: 1 }, { unique: true });
BuddyReactionSchema.index({ tenantId: 1, periodId: 1, toUserId: 1, dayKey: 1 });

BuddyReactionSchema.plugin(tenantPlugin);
module.exports = mongoose.model('BuddyReaction', BuddyReactionSchema);
