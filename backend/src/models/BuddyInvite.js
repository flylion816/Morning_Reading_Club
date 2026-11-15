const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 读伴邀请：从本期学员里挑一位，发出邀请，对方同意后才结成读伴
const BuddyInviteSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled', 'expired'],
      default: 'pending'
    }
  },
  { timestamps: true, versionKey: false }
);

// 同一期里，我对同一个人同时只能有一条待回复的邀请
BuddyInviteSchema.index(
  { tenantId: 1, periodId: 1, fromUserId: 1, toUserId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);
BuddyInviteSchema.index({ tenantId: 1, periodId: 1, toUserId: 1, status: 1 });

BuddyInviteSchema.plugin(tenantPlugin);
module.exports = mongoose.model('BuddyInvite', BuddyInviteSchema);
