const mongoose = require('mongoose');

const SectionSchema = new mongoose.Schema(
  {
    periodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Period',
      required: true
    },
    day: {
      type: Number,
      required: true,
      min: 0
    },
    title: {
      type: String,
      required: true,
      maxlength: 100
    },
    subtitle: {
      type: String,
      maxlength: 200,
      default: null
    },
    icon: {
      type: String,
      maxlength: 10,
      default: '📖'
    },
    meditation: {
      type: String,
      maxlength: 500,
      default: null
    },
    question: {
      type: String,
      maxlength: 200,
      default: null
    },
    content: {
      type: String,
      required: false,
      default: null
    },
    description: {
      type: String,
      maxlength: 500,
      default: null
    },
    reflection: {
      type: String,
      maxlength: 500,
      default: null
    },
    action: {
      type: String,
      maxlength: 500,
      default: null
    },
    learn: {
      type: String,
      maxlength: 500,
      default: null
    },
    extract: {
      type: String,
      maxlength: 500,
      default: null
    },
    say: {
      type: String,
      maxlength: 500,
      default: null
    },
    audioUrl: {
      type: String,
      maxlength: 500,
      default: null
    },
    podcastUrl: {
      type: String,
      maxlength: 500,
      default: null
    },
    podcastDescription: {
      type: String,
      maxlength: 3000,
      default: null
    },
    podcastDuration: {
      type: Number,
      default: null,
      min: 0
    },
    videoCover: {
      type: String,
      maxlength: 500,
      default: null
    },
    duration: {
      type: Number,
      default: null,
      min: 0
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    order: {
      type: Number,
      default: 0
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    checkinCount: {
      type: Number,
      default: 0,
      min: 0
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// 索引
SectionSchema.index({ periodId: 1, sortOrder: 1 });
SectionSchema.index({ isPublished: 1 });

// 复合唯一索引：同一期次中的同一天只能有一个
SectionSchema.index({ tenantId: 1, periodId: 1, day: 1 }, { unique: true });
SectionSchema.index({ tenantId: 1, createdAt: -1 });

const tenantPlugin = require('./plugins/tenantPlugin');
SectionSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Section', SectionSchema);
