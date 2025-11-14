const mongoose = require('mongoose');

const PeriodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 50
  },
  subtitle: {
    type: String,
    maxlength: 100,
    default: null
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    default: null
  },
  icon: {
    type: String,
    maxlength: 10,
    default: '📚'
  },
  coverColor: {
    type: String,
    maxlength: 200,
    default: null
  },
  coverEmoji: {
    type: String,
    maxlength: 10,
    default: '📖'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalDays: {
    type: Number,
    default: 23,
    min: 1
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  originalPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  maxEnrollment: {
    type: Number,
    default: null,
    min: 0
  },
  currentEnrollment: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['not_started', 'ongoing', 'completed'],
    default: 'not_started'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  checkinCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCheckins: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  versionKey: false
});

// 索引
PeriodSchema.index({ startDate: 1, endDate: 1 });
PeriodSchema.index({ status: 1 });
PeriodSchema.index({ isPublished: 1, sortOrder: 1 });

// 虚拟字段 - 日期范围格式化
PeriodSchema.virtual('dateRange').get(function() {
  const start = this.startDate.toISOString().slice(5, 10).replace('-', '/');
  const end = this.endDate.toISOString().slice(5, 10).replace('-', '/');
  return `${start} 至 ${end}`;
});

module.exports = mongoose.model('Period', PeriodSchema);
