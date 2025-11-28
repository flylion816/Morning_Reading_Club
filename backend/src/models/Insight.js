const mongoose = require('mongoose');

const InsightSchema = new mongoose.Schema({
  // 用户相关
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // 被看见人（被看见的用户ID）- 如果为空表示自己可见
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // 打卡相关（可选）
  checkinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Checkin'
  },

  // 期次和课节
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Period',
    required: true
  },
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  },

  // 第几天
  day: {
    type: Number,
    min: 0
  },

  // 内容类型：daily=单日, weekly=周报, monthly=月报, insight=小凡看见
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'insight'],
    default: 'daily'
  },

  // 媒体类型：text=文本, image=图片
  mediaType: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },

  // 内容
  content: {
    type: String,
    required: true
  },

  // 图片URL (仅mediaType=image时使用)
  imageUrl: {
    type: String,
    default: null
  },

  // 摘要
  summary: {
    type: String,
    maxlength: 500,
    default: null
  },

  // 标签
  tags: {
    type: [String],
    default: []
  },

  // 状态
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'completed'
  },

  // 来源: manual=手动导入, auto=自动生成
  source: {
    type: String,
    enum: ['manual', 'auto'],
    default: 'manual'
  },

  // 是否发布
  isPublished: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// 索引
InsightSchema.index({ userId: 1, createdAt: -1 });
InsightSchema.index({ periodId: 1 });
InsightSchema.index({ type: 1, isPublished: 1 });
InsightSchema.index({ status: 1 });

module.exports = mongoose.model('Insight', InsightSchema);
