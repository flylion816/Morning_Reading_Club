const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const PracticeLogSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // 东八区自然日 YYYY-MM-DD
    done: { type: Boolean, required: true },
    note: { type: String, default: '', maxlength: 60 }
  },
  { _id: false }
);

const PracticeSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
    weekIndex: { type: Number, required: true, min: 1 },
    text: { type: String, required: true, maxlength: 30 },
    logs: { type: [PracticeLogSchema], default: [] }
  },
  { timestamps: true, versionKey: false }
);

PracticeSchema.index({ tenantId: 1, userId: 1, periodId: 1, weekIndex: 1 }, { unique: true });

PracticeSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Practice', PracticeSchema);
