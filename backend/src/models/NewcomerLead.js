const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 新书友线索：访客看了分享内容后，留下“为什么想来”和手机号，由接待组跟进。
// 一个用户只有一条线索，重复提交只更新原记录。
const LEAD_STATUSES = ['pending', 'contacted', 'talked', 'connected', 'declined'];
const SOURCE_TYPES = ['daily_card', 'quote_card', 'keepsake', 'invite', 'other'];

const FollowUpSchema = new mongoose.Schema(
  {
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: LEAD_STATUSES, required: true },
    note: { type: String, default: '', maxlength: 200 },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const NewcomerLeadSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 分享人：谁的内容把这位新书友带进来。没有分享人时为空。
    inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sourceType: { type: String, enum: SOURCE_TYPES, default: 'other' },
    reason: { type: String, required: true, trim: true, maxlength: 60 },
    note: { type: String, default: '', trim: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true },
    // 授权留痕：同意的文案版本和时间，之后文案变更时可以追溯
    consentVersion: { type: String, required: true },
    consentAt: { type: Date, required: true },
    status: { type: String, enum: LEAD_STATUSES, default: 'pending' },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    claimedAt: { type: Date, default: null },
    // 承诺的联系期限，页面上展示给新书友
    contactBy: { type: Date, required: true },
    followUps: { type: [FollowUpSchema], default: [] }
  },
  { timestamps: true, versionKey: false }
);

NewcomerLeadSchema.index({ userId: 1 }, { unique: true });
NewcomerLeadSchema.index({ status: 1, createdAt: -1 });
NewcomerLeadSchema.index({ assigneeId: 1, status: 1 });
NewcomerLeadSchema.index({ tenantId: 1 });

NewcomerLeadSchema.plugin(tenantPlugin);

const NewcomerLead = mongoose.model('NewcomerLead', NewcomerLeadSchema);
NewcomerLead.LEAD_STATUSES = LEAD_STATUSES;
NewcomerLead.SOURCE_TYPES = SOURCE_TYPES;

module.exports = NewcomerLead;
