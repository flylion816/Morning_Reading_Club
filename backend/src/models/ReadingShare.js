const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 阅读分享：沉浸阅读里「分享此刻」的小程序码。
// 小程序码的参数最长 32 个字符，装不下「课程 + 段落 + 分享人」，所以只放一个 8 位短码，
// 扫码后再用短码换回课程、段落位置和分享人。
const ReadingShareSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    code: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', default: null },
    // 分享时读到的那一段（从 0 开始）
    paragraphIndex: { type: Number, default: 0, min: 0, max: 5000 },
    // 那一段开头的一小段文字，没有阅读权限的人扫码时用来展示在欢迎页上
    quote: { type: String, default: '', maxlength: 80 }
  },
  { timestamps: true, versionKey: false }
);

ReadingShareSchema.index({ tenantId: 1, code: 1 }, { unique: true });
// 同一个人对同一课同一段只生成一个码，重复分享沿用
ReadingShareSchema.index({ tenantId: 1, userId: 1, sectionId: 1, paragraphIndex: 1 }, { unique: true });

ReadingShareSchema.plugin(tenantPlugin);
module.exports = mongoose.model('ReadingShare', ReadingShareSchema);
