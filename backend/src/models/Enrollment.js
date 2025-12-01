const mongoose = require('mongoose');

/**
 * 报名/注册模型
 * 记录用户报名参加期次的关系
 */
const EnrollmentSchema = new mongoose.Schema({
  // 用户ID
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // 期次ID
  periodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Period',
    required: true,
    index: true
  },

  // 报名时间
  enrolledAt: {
    type: Date,
    default: Date.now
  },

  // 报名状态
  status: {
    type: String,
    enum: ['active', 'completed', 'withdrawn'],
    default: 'active',
    comment: 'active: 进行中, completed: 已完成, withdrawn: 已退出'
  },

  // 支付状态（如果需要付费）
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'free'],
    default: 'free',
    comment: 'pending: 待支付, paid: 已支付, refunded: 已退款, free: 免费'
  },

  // 支付金额
  paymentAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // 支付时间
  paidAt: {
    type: Date
  },

  // 完成时间
  completedAt: {
    type: Date
  },

  // 退出时间
  withdrawnAt: {
    type: Date
  },

  // ===== 报名表单字段 =====
  // 姓名
  name: {
    type: String,
    trim: true
  },

  // 性别
  gender: {
    type: String,
    enum: ['male', 'female', 'prefer_not_to_say']
  },

  // 省份/城市
  province: {
    type: String,
    trim: true
  },

  // 详细地址
  detailedAddress: {
    type: String,
    trim: true
  },

  // 年龄
  age: {
    type: Number,
    min: 1,
    max: 120
  },

  // 推荐人
  referrer: {
    type: String,
    trim: true
  },

  // 是否读过《高效能人士的七个习惯》
  hasReadBook: {
    type: String,
    enum: ['yes', 'no']
  },

  // 读过几遍
  readTimes: {
    type: Number,
    default: 0,
    min: 0
  },

  // 参加课程的缘起
  enrollReason: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  // 对课程的期待
  expectation: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  // 是否承诺全程参加
  commitment: {
    type: String,
    enum: ['yes', 'no']
  },

  // 备注
  notes: {
    type: String,
    maxlength: 500
  },

  // ✅ 软删除标记
  deleted: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 复合唯一索引：一个用户在一个期次只能报名一次
EnrollmentSchema.index({ userId: 1, periodId: 1 }, { unique: true });

// 性能优化索引
EnrollmentSchema.index({ paymentStatus: 1, createdAt: -1 });  // 支付状态查询
EnrollmentSchema.index({ status: 1, createdAt: -1 });         // 报名状态查询
EnrollmentSchema.index({ createdAt: -1 });                      // 按创建时间排序
EnrollmentSchema.index({ enrolledAt: -1 });                     // 按报名时间排序

// 虚拟字段：是否已支付
EnrollmentSchema.virtual('isPaid').get(function() {
  return this.paymentStatus === 'paid' || this.paymentStatus === 'free';
});

// 虚拟字段：是否进行中
EnrollmentSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// 静态方法：获取期次的成员列表
EnrollmentSchema.statics.getPeriodMembers = async function(periodId, options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'enrolledAt',
    sortOrder = -1,  // -1: 降序, 1: 升序
    status = 'active'
  } = options;

  const skip = (page - 1) * limit;

  const query = { periodId, deleted: { $ne: true } };  // ✅ 排除已删除的记录
  if (status) {
    query.status = status;
  }

  const [list, total] = await Promise.all([
    this.find(query)
      .populate('userId', 'nickname avatar avatarUrl email')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    list,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / limit)
  };
};

// 静态方法：获取用户的报名列表
EnrollmentSchema.statics.getUserEnrollments = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    status
  } = options;

  const skip = (page - 1) * limit;

  const query = { userId, deleted: { $ne: true } };  // ✅ 排除已删除的记录
  if (status) {
    query.status = status;
  }

  const [list, total] = await Promise.all([
    this.find(query)
      .populate('periodId', 'title description startDate endDate coverImage')
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    list,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / limit)
  };
};

// 静态方法：检查用户是否已报名
EnrollmentSchema.statics.isEnrolled = async function(userId, periodId) {
  // 查找 active 或 completed 状态的报名记录，并排除已删除的
  const enrollment = await this.findOne({
    userId,
    periodId,
    status: { $in: ['active', 'completed'] },
    deleted: { $ne: true }  // ✅ 排除已删除的记录
  });
  return !!enrollment;
};

// 实例方法：完成报名
EnrollmentSchema.methods.complete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// 实例方法：退出报名
EnrollmentSchema.methods.withdraw = function() {
  this.status = 'withdrawn';
  this.withdrawnAt = new Date();
  return this.save();
};

// 实例方法：确认支付
EnrollmentSchema.methods.confirmPayment = function(amount) {
  this.paymentStatus = 'paid';
  this.paymentAmount = amount;
  this.paidAt = new Date();
  return this.save();
};

const Enrollment = mongoose.model('Enrollment', EnrollmentSchema);

module.exports = Enrollment;
