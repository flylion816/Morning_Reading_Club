const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 慢递邮局：写给结营那天的自己的信。送达时间不存，按所属期次的 endDate 实时计算。
const LetterSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
    content: { type: String, default: '', maxlength: 2000 },
    stamp: { type: String, enum: ['dawn', 'leaf', 'book'], default: 'dawn' },
    status: { type: String, enum: ['draft', 'sealed', 'delivered', 'opened'], default: 'draft' },
    writtenAt: { type: Date, default: null },
    sealedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    reply: { type: String, default: '', maxlength: 200 },
    repliedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

LetterSchema.index({ userId: 1, periodId: 1 }, { unique: true });
LetterSchema.index({ status: 1, periodId: 1 });
LetterSchema.index({ tenantId: 1 });

LetterSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Letter', LetterSchema);
