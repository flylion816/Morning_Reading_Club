const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const HighlightSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
  // 摘下的原文（存原文，不存段落序号，课程内容后续改动不影响已存摘抄）
  text: { type: String, required: true, maxlength: 500 },
  // 规范化后文本的 FNV-1a 哈希，见 utils/text-hash.js
  textHash: { type: String, required: true },
  note: { type: String, default: '', maxlength: 200 }
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

HighlightSchema.index({ userId: 1, sectionId: 1, textHash: 1 }, { unique: true });
HighlightSchema.index({ userId: 1, createdAt: -1 });
HighlightSchema.index({ sectionId: 1, textHash: 1 });
HighlightSchema.index({ tenantId: 1 });

HighlightSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Highlight', HighlightSchema);
