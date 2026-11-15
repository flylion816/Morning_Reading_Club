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
    ],
    // 击掌记录：两人都读完后，每人每天一次
    highFiveLog: [
      {
        _id: false,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dayKey: { type: String },
        at: { type: Date, default: Date.now }
      }
    ],
    // 送一句：只存预设短句的 key，每人每天一条
    gifts: [
      {
        _id: false,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dayKey: { type: String },
        key: { type: String },
        at: { type: Date, default: Date.now }
      }
    ],
    // 「下一期还做读伴」的意愿：双方都在里面才生效
    rematchVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { versionKey: false }
);

BuddyPairSchema.index(
  { tenantId: 1, periodId: 1, members: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

BuddyPairSchema.plugin(tenantPlugin);
module.exports = mongoose.model('BuddyPair', BuddyPairSchema);
