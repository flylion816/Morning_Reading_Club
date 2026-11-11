const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 仅用于“此刻有多少人在读”的短期心跳，不是学习记录；30 分钟后自动清除。
const ReadingPingSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    at: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

ReadingPingSchema.index({ tenantId: 1, userId: 1, sectionId: 1 }, { unique: true });
ReadingPingSchema.index({ periodId: 1, at: -1 });
ReadingPingSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 60 });

ReadingPingSchema.plugin(tenantPlugin);
module.exports = mongoose.model('ReadingPing', ReadingPingSchema);
