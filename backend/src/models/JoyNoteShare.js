const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 随喜 / 觉察的分享：每条笔记至多一条。
// 「停止分享」只标记 revokedAt；之后再分享会换一个新的 code，旧链接和旧二维码永远失效。
const JoyNoteShareSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    code: { type: String, required: true },
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'JoyNote', required: true },
    // 作者
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // period：非作者须有笔记所属期次的社群权限；login：任何已登录的同租户书友都能看
    audience: { type: String, enum: ['period', 'login'], default: 'period' },
    revokedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

JoyNoteShareSchema.index({ tenantId: 1, code: 1 }, { unique: true });
JoyNoteShareSchema.index({ tenantId: 1, noteId: 1 }, { unique: true });

JoyNoteShareSchema.plugin(tenantPlugin);
module.exports = mongoose.model('JoyNoteShare', JoyNoteShareSchema);
