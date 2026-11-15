const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 落地页访问计数：按天、按分享人、按来源累加，访客不用登录也能统计（只存次数，不存任何访客信息）
const LandingStatSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    dayKey: { type: String, required: true },
    inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sourceType: { type: String, default: 'other' },
    views: { type: Number, default: 0 }
  },
  { timestamps: true, versionKey: false }
);

LandingStatSchema.index({ tenantId: 1, dayKey: 1, inviterId: 1, sourceType: 1 }, { unique: true });
LandingStatSchema.plugin(tenantPlugin);
module.exports = mongoose.model('LandingStat', LandingStatSchema);
