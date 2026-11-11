const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const BuddyRequestSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['waiting', 'matched', 'cancelled'], default: 'waiting' }
  },
  { timestamps: true, versionKey: false }
);

// 同一用户同一期同时只能有一条等待中的申请
BuddyRequestSchema.index(
  { tenantId: 1, periodId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'waiting' } }
);
BuddyRequestSchema.index({ tenantId: 1, periodId: 1, status: 1 });

BuddyRequestSchema.plugin(tenantPlugin);
module.exports = mongoose.model('BuddyRequest', BuddyRequestSchema);
