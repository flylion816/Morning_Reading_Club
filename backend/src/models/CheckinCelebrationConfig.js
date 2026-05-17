const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true },
  category: { type: String, default: '励志', trim: true },
  isEnabled: { type: Boolean, default: true }
}, { _id: true });

const checkinCelebrationConfigSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  animationStyle: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'random'],
    default: 'random'
  },
  enabledAnimationStyles: {
    type: [String],
    enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    default: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  },
  messages: [messageSchema]
}, { timestamps: true });

checkinCelebrationConfigSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CheckinCelebrationConfig', checkinCelebrationConfigSchema);
