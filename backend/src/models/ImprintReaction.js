const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ImprintReactionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  imprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Imprint', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['gonming', 'ran', 'xiangqu'], required: true }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

ImprintReactionSchema.index({ imprintId: 1, userId: 1 }, { unique: true });
ImprintReactionSchema.index({ tenantId: 1 });

ImprintReactionSchema.plugin(tenantPlugin);
module.exports = mongoose.model('ImprintReaction', ImprintReactionSchema);
