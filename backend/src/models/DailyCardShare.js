const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

// 小程序码只能携带很短的 scene；日签内容由分享者主动生成快照后按短码读取。
const DailyCardShareSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  code: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  quote: { type: String, default: '', maxlength: 240 },
  note: { type: String, default: '', maxlength: 80 },
  source: { type: String, default: '', maxlength: 80 },
  periodName: { type: String, default: '', maxlength: 60 },
  day: { type: Number, default: 0, min: 0, max: 9999 },
  dateStr: { type: String, default: '' },
  variant: { type: String, enum: ['dawn', 'paper', 'blank'], default: 'dawn' }
}, { timestamps: true, versionKey: false });

DailyCardShareSchema.index({ tenantId: 1, code: 1 }, { unique: true });
DailyCardShareSchema.plugin(tenantPlugin);
module.exports = mongoose.model('DailyCardShare', DailyCardShareSchema);
