const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ImprintCommentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  imprintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Imprint', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 500 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImprintComment', default: null },
  replyToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

ImprintCommentSchema.index({ imprintId: 1, createdAt: 1 });
ImprintCommentSchema.index({ tenantId: 1 });

ImprintCommentSchema.plugin(tenantPlugin);
module.exports = mongoose.model('ImprintComment', ImprintCommentSchema);
