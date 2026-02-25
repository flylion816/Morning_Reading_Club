const mongoose = require('mongoose');

/**
 * 支付/订单模型
 * 记录用户的支付交易信息
 */
const PaymentSchema = new mongoose.Schema(
  {
    // 关联的报名ID
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment',
      required: true,
      index: true
    },

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

    // 支付金额（单位：分，100分 = 1元，例如：9900分 = 99.00元）
    amount: {
      type: Number,
      required: true,
      min: 0
    },

    // 支付方式
    paymentMethod: {
      type: String,
      enum: ['wechat', 'alipay', 'mock'],
      default: 'wechat',
      comment: 'wechat: 微信支付, alipay: 支付宝, mock: 模拟支付（测试）'
    },

    // 支付状态
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      comment:
        'pending: 待支付, processing: 处理中, completed: 已完成, failed: 失败, cancelled: 已取消'
    },

    // 微信相关字段
    wechat: {
      // 微信预支付ID
      prepayId: String,
      // 微信交易号
      transactionId: String,
      // 支付成功时间
      successTime: Date
    },

    // 支付成功时间
    paidAt: Date,

    // 支付失败原因
    failureReason: String,

    // 支付备注
    notes: String,

    // 订单号（用于对账）
    orderNo: {
      type: String,
      unique: true
    },

    // 是否已核销（对账）
    reconciled: {
      type: Boolean,
      default: false
    },

    // 核销时间
    reconciledAt: Date
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// 性能优化索引
PaymentSchema.index({ status: 1, createdAt: -1 }); // 支付状态查询
PaymentSchema.index({ userId: 1, createdAt: -1 }); // 用户支付历史
PaymentSchema.index({ periodId: 1, status: 1 }); // 期次的支付状态
PaymentSchema.index({ createdAt: -1 }); // 按创建时间排序
PaymentSchema.index({ paidAt: -1 }); // 按支付时间排序
PaymentSchema.index({ reconciled: 1, createdAt: -1 }); // 核销状态查询

// 虚拟字段：是否已支付
PaymentSchema.virtual('isPaid').get(function () {
  return this.status === 'completed';
});

// 虚拟字段：是否在处理中
PaymentSchema.virtual('isProcessing').get(function () {
  return this.status === 'processing';
});

// 静态方法：创建订单
PaymentSchema.statics.createOrder = async function (
  enrollmentId,
  userId,
  periodId,
  amount,
  paymentMethod = 'wechat'
) {
  const orderNo = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const payment = await this.create({
    enrollmentId,
    userId,
    periodId,
    amount,
    paymentMethod,
    orderNo,
    status: 'pending'
  });

  return payment;
};

// 静态方法：获取用户的支付记录
PaymentSchema.statics.getUserPayments = async function (userId, options = {}) {
  const { page = 1, limit = 20, status } = options;

  const skip = (page - 1) * limit;

  const query = { userId };
  if (status) {
    query.status = status;
  }

  const [list, total] = await Promise.all([
    this.find(query)
      .populate('enrollmentId', 'name')
      .populate('periodId', 'name title')
      .sort({ createdAt: -1 })
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

// 实例方法：确认支付
PaymentSchema.methods.confirmPayment = function (transactionId = null) {
  this.status = 'completed';
  this.paidAt = new Date();

  if (transactionId) {
    this.wechat = this.wechat || {};
    this.wechat.transactionId = transactionId;
    this.wechat.successTime = new Date();
  }

  return this.save();
};

// 实例方法：标记为失败
PaymentSchema.methods.markFailed = function (reason = '支付失败') {
  this.status = 'failed';
  this.failureReason = reason;
  return this.save();
};

// 实例方法：标记为已取消
PaymentSchema.methods.markCancelled = function (reason = '用户取消') {
  this.status = 'cancelled';
  this.failureReason = reason;
  return this.save();
};

// 实例方法：开始处理
PaymentSchema.methods.startProcessing = function () {
  this.status = 'processing';
  return this.save();
};


const Payment = mongoose.model('Payment', PaymentSchema);

module.exports = Payment;
