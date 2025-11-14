const mongoose = require('mongoose');

const CheckinSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  checkinDate: {
    type: Date,
    required: true
  },
  readingTime: {
    type: Number,
    default: 0,
    min: 0
  },
  completionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  note: {
    type: String,
    maxlength: 1000,
    default: null
  },
  images: {
    type: [String],
    default: []
  },
  mood: {
    type: String,
    enum: ['happy', 'calm', 'thoughtful', 'inspired', 'other'],
    default: null
  },
  points: {
    type: Number,
    default: 10,
    min: 0
  },
  isPublic: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// 索引
// 用户在同一期次、同一天只能打卡一次（基于日期而非day字段）
CheckinSchema.index(
  { userId: 1, periodId: 1, checkinDate: 1 },
  {
    unique: true,
    // 将checkinDate转换为日期（不含时间），确保同一天只能打卡一次
    sparse: true
  }
);
CheckinSchema.index({ userId: 1, checkinDate: -1 });
CheckinSchema.index({ periodId: 1, checkinDate: -1 });
CheckinSchema.index({ sectionId: 1 });

module.exports = mongoose.model('Checkin', CheckinSchema);
