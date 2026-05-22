const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const ImprintActivityTypeSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
  key: { type: String, required: true, maxlength: 30 },
  label: { type: String, required: true, maxlength: 20 },
  emoji: { type: String, required: true, maxlength: 10 },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

ImprintActivityTypeSchema.index({ tenantId: 1, sortOrder: 1 });
ImprintActivityTypeSchema.index({ tenantId: 1, key: 1 }, { unique: true });

ImprintActivityTypeSchema.plugin(tenantPlugin);
module.exports = mongoose.model('ImprintActivityType', ImprintActivityTypeSchema);
