const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const BuddyPairSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 两位成员，配合唯一索引保证同一用户同一期同时只在一对里
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // 轻拍记录：每人每天一条
    nudgeLog: [
      {
        _id: false,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dayKey: { type: String }
      }
    ]
  },
  { versionKey: false }
);

BuddyPairSchema.index(
  { tenantId: 1, periodId: 1, members: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

BuddyPairSchema.plugin(tenantPlugin);
module.exports = mongoose.model('BuddyPair', BuddyPairSchema);
