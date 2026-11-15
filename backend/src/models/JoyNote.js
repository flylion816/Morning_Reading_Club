const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const JoyNoteSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 3000 },
  periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', default: null },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null }
}, { timestamps: true, versionKey: false });

JoyNoteSchema.index({ tenantId: 1, userId: 1, createdAt: -1, _id: -1 });
JoyNoteSchema.index({ tenantId: 1, userId: 1, periodId: 1, createdAt: -1 });
JoyNoteSchema.plugin(tenantPlugin);

module.exports = mongoose.model('JoyNote', JoyNoteSchema);
