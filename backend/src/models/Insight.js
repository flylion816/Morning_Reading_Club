const mongoose = require('mongoose');

const InsightSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  checkinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Checkin',
    required: true
  },
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Period',
    required: true
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  day: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily'
  },
  content: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    maxlength: 500,
    default: null
  },
  tags: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true,
  versionKey: false
});

// 索引
InsightSchema.index({ userId: 1, day: 1 }, { unique: true });
InsightSchema.index({ userId: 1, createdAt: -1 });
InsightSchema.index({ periodId: 1 });
InsightSchema.index({ status: 1 });

module.exports = mongoose.model('Insight', InsightSchema);
