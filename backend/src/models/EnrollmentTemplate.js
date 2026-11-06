const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true, maxlength: 30 },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '', maxlength: 100 },
  group: { type: String, default: '基本信息', maxlength: 30 }
}, { _id: false });

const EnrollmentTemplateSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true, maxlength: 50 },
  description: { type: String, default: '', maxlength: 200 },
  preset: { type: String, enum: ['simple', 'full', 'custom'], default: 'custom' },
  builtInKey: { type: String, enum: ['simple', 'full', null], default: null },
  isBuiltIn: { type: Boolean, default: false },
  fields: { type: [fieldSchema], required: true },
  active: { type: Boolean, default: true },
  revision: { type: Number, default: 1, min: 1 }
}, { timestamps: true, versionKey: false, collection: 'enrollment_templates' });

EnrollmentTemplateSchema.index(
  { tenantId: 1, builtInKey: 1 },
  { unique: true, partialFilterExpression: { builtInKey: { $type: 'string' } } }
);
EnrollmentTemplateSchema.index({ tenantId: 1, createdAt: -1 });
EnrollmentTemplateSchema.plugin(tenantPlugin);

module.exports = mongoose.model('EnrollmentTemplate', EnrollmentTemplateSchema);
