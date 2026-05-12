const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true },
  category: { type: String, default: '励志', trim: true },
  isEnabled: { type: Boolean, default: true }
}, { _id: true });

const checkinCelebrationConfigSchema = new mongoose.Schema({
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

module.exports = mongoose.model('CheckinCelebrationConfig', checkinCelebrationConfigSchema);
