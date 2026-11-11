const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');
const { SEEN_PHRASE_KEYS } = require('../constants/seenPhrases');

// 看见卡：书友对一篇打卡送出的一句预设短句。一人对同一篇打卡只有一张。
const SeenCardSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    checkinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Checkin', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', default: null },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },
    phrase: { type: String, enum: SEEN_PHRASE_KEYS, required: true },
    // 撤回为软删除；重新送出时复用原记录并清空，不再重复通知
    withdrawnAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

SeenCardSchema.index({ checkinId: 1, userId: 1 }, { unique: true });
SeenCardSchema.index({ receiverId: 1, createdAt: -1 });
SeenCardSchema.index({ tenantId: 1 });

SeenCardSchema.plugin(tenantPlugin);
module.exports = mongoose.model('SeenCard', SeenCardSchema);
