const mongoose = require('mongoose');

const insightDanmakuSchema = new mongoose.Schema(
  {
    insightId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Insight',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userNickname: {
      type: String,
      required: true,
      maxlength: 50
    },
    content: {
      type: String,
      required: true,
      maxlength: 60
    },
    type: {
      type: String,
      enum: ['comment', 'like'],
      default: 'comment'
    },
    scrollPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    color: {
      type: String,
      default: '#4a90e2'
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

insightDanmakuSchema.index({ insightId: 1, createdAt: 1 });

module.exports = mongoose.model('InsightDanmaku', insightDanmakuSchema);
