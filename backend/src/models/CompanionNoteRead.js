const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const CompanionNoteReadSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'CompanionNote', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    firstOpenedAt: { type: Date, default: Date.now },
    lastOpenedAt: { type: Date, default: Date.now },
    openCount: { type: Number, default: 1, min: 1 },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true }
  },
  { versionKey: false }
);

CompanionNoteReadSchema.index({ noteId: 1, userId: 1 }, { unique: true });
CompanionNoteReadSchema.index({ userId: 1, lastOpenedAt: -1 });
CompanionNoteReadSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CompanionNoteRead', CompanionNoteReadSchema);
