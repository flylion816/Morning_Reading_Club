const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CompanionNoteLikeSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanionNote', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true }
  },
  { versionKey: false }
);

CompanionNoteLikeSchema.index({ noteId: 1, userId: 1 }, { unique: true });
CompanionNoteLikeSchema.index({ noteId: 1, createdAt: -1 });
CompanionNoteLikeSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CompanionNoteLike', CompanionNoteLikeSchema);
