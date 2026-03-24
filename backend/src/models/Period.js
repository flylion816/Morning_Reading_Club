const mongoose = require('mongoose');

const PeriodSchema = new mongoose.Schema(
  {
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
      required: false,
      maxlength: 100,
      default: null
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
    // 价格统一使用"分"作为单位（100分 = 1元）
    // 所有涉及金额的字段都遵循这个约定
    price: {
      type: Number,
      default: 0,
      min: 0
      // 单位：分（例如：9900 = 99.00元）
    },
    originalPrice: {
      type: Number,
      default: 0,
      min: 0
      // 单位：分（例如：9900 = 99.00元）
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
    enrollmentCount: {
      type: Number,
      default: 0,
      min: 0,
      description: '该期次的报名人数'
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
    },
    meetingId: {
      type: String,
      maxlength: 50,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// 索引
PeriodSchema.index({ startDate: 1, endDate: 1 });
PeriodSchema.index({ status: 1 });
PeriodSchema.index({ isPublished: 1, sortOrder: 1 });

// 虚拟字段 - 日期范围格式化
// 直接从 Date 对象提取本地日期，避免 toISOString() 导致的 UTC 转换
PeriodSchema.virtual('dateRange').get(function () {
  // 使用本地时区提取日期
  const formatLocalDate = date => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  };

  const start = formatLocalDate(this.startDate);
  const end = formatLocalDate(this.endDate);
  return `${start} 至 ${end}`;
});

module.exports = mongoose.model('Period', PeriodSchema);
