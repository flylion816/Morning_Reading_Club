const mongoose = require('mongoose');
const tenantPlugin = require('./plugins/tenantPlugin');

function countUnicodeChars(value) {
  const content = String(value || '');
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(content)).length;
  }
  return Array.from(content).length;
}

const insightDanmakuSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
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
      validate: {
        validator(value) {
          return countUnicodeChars(value) <= 60;
        },
        message: '弹幕内容不能超过60字'
      }
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
insightDanmakuSchema.plugin(tenantPlugin);

module.exports = mongoose.model('InsightDanmaku', insightDanmakuSchema);
