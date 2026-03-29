const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    openid: {
      type: String,
      required: true,
      unique: true,
      maxlength: 64
    },
    unionid: {
      type: String,
      maxlength: 64,
      default: null
    },
    nickname: {
      type: String,
      required: true,
      maxlength: 50,
      default: '微信用户'
    },
    avatar: {
      type: String,
      maxlength: 500,
      default: '🦁'
    },
    avatarUrl: {
      type: String,
      maxlength: 500,
      default: null
    },
    signature: {
      type: String,
      maxlength: 200,
      default: null
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'unknown'],
      default: 'unknown'
    },
    totalCheckinDays: {
      type: Number,
      default: 0,
      min: 0
    },
    currentStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    maxStreak: {
      type: Number,
      default: 0,
      min: 0
    },
    totalCompletedPeriods: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPoints: {
      type: Number,
      default: 0,
      min: 0
    },
    level: {
      type: Number,
      default: 1,
      min: 1
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'super_admin'],
      default: 'user'
    },
    status: {
      type: String,
      enum: ['active', 'banned', 'deleted'],
      default: 'active'
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    phone: {
      type: String,
      trim: true,
      default: null
    },
    phoneBindAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// 索引
UserSchema.index({ nickname: 1 });
UserSchema.index({ createdAt: 1 });
UserSchema.index({ phone: 1 }, { sparse: true });

// 虚拟字段 - 头像文字
UserSchema.virtual('avatarText').get(function () {
  return this.avatar || this.nickname.charAt(0);
});

// 虚拟字段 - 是否激活
UserSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

// 在转换为JSON时包含虚拟字段
UserSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('User', UserSchema);
