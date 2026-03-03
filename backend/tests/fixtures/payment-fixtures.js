/**
 * Payment 模块测试 Fixtures
 * 包含支付记录、支付方法、金额场景、请求体和预期响应
 */

const mongoose = require('mongoose');

/**
 * 测试用户数据（引用自 user-fixtures）
 */
const testUsers = {
  regularUser: {
    _id: new mongoose.Types.ObjectId(),
    wechatOpenId: 'test-openid-regular',
    nickName: '常规用户',
    gender: 1,
    avatarUrl: 'https://example.com/avatar1.jpg',
    status: 'active'
  },

  premiumUser: {
    _id: new mongoose.Types.ObjectId(),
    wechatOpenId: 'test-openid-premium',
    nickName: '高级用户',
    gender: 0,
    avatarUrl: 'https://example.com/avatar2.jpg',
    status: 'active'
  },

  inactiveUser: {
    _id: new mongoose.Types.ObjectId(),
    wechatOpenId: 'test-openid-inactive',
    nickName: '停用用户',
    status: 'inactive'
  }
};

/**
 * 测试期次数据
 */
const testPeriods = {
  ongoingPeriod: {
    _id: new mongoose.Types.ObjectId(),
    title: '心流之境',
    description: '深度阅读七个习惯',
    price: 99,
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    enrollmentDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    capacity: 100,
    enrollmentCount: 45
  },

  upcomingPeriod: {
    _id: new mongoose.Types.ObjectId(),
    title: '主动积极',
    description: '掌握自己的命运',
    price: 99,
    startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    enrollmentDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    capacity: 100,
    enrollmentCount: 10
  }
};

/**
 * 测试报名记录
 */
const testEnrollments = {
  // 待支付的报名
  pendingPaymentEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.regularUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    status: 'active',
    paymentStatus: 'pending',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },

  // 已支付的报名
  paidEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.premiumUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    status: 'active',
    paymentStatus: 'paid',
    paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },

  // 另一个用户待支付的报名（用于权限测试）
  anotherUserEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    periodId: testPeriods.ongoingPeriod._id,
    status: 'active',
    paymentStatus: 'pending',
    createdAt: new Date()
  },

  // 无效的报名ID
  nonExistentEnrollmentId: new mongoose.Types.ObjectId()
};

/**
 * 支付记录 - 各种状态
 */
const testPayments = {
  // 待支付
  pendingPayment: {
    _id: new mongoose.Types.ObjectId(),
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    userId: testUsers.regularUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    amount: 9900, // 99元
    paymentMethod: 'wechat',
    status: 'pending',
    orderNo: `ORDER_${Date.now()}_test1`,
    createdAt: new Date()
  },

  // 处理中
  processingPayment: {
    _id: new mongoose.Types.ObjectId(),
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    userId: testUsers.regularUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    amount: 9900,
    paymentMethod: 'wechat',
    status: 'processing',
    orderNo: `ORDER_${Date.now()}_test2`,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
  },

  // 已支付（已完成）
  completedPayment: {
    _id: new mongoose.Types.ObjectId(),
    enrollmentId: testEnrollments.paidEnrollment._id,
    userId: testUsers.premiumUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    amount: 9900,
    paymentMethod: 'wechat',
    status: 'completed',
    orderNo: `ORDER_${Date.now()}_test3`,
    paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    wechat: {
      transactionId: 'wx_txn_12345',
      successTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },

  // 已失败
  failedPayment: {
    _id: new mongoose.Types.ObjectId(),
    enrollmentId: new mongoose.Types.ObjectId(),
    userId: testUsers.regularUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    amount: 9900,
    paymentMethod: 'wechat',
    status: 'failed',
    orderNo: `ORDER_${Date.now()}_test4`,
    failureReason: '用户取消',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  },

  // 已取消
  cancelledPayment: {
    _id: new mongoose.Types.ObjectId(),
    enrollmentId: new mongoose.Types.ObjectId(),
    userId: testUsers.regularUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    amount: 9900,
    paymentMethod: 'mock',
    status: 'cancelled',
    orderNo: `ORDER_${Date.now()}_test5`,
    failureReason: '用户取消',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  },

  // 支付宝支付
  alipayPayment: {
    _id: new mongoose.Types.ObjectId(),
    enrollmentId: new mongoose.Types.ObjectId(),
    userId: testUsers.premiumUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    amount: 9900,
    paymentMethod: 'alipay',
    status: 'completed',
    orderNo: `ORDER_${Date.now()}_alipay`,
    paidAt: new Date(),
    createdAt: new Date()
  },

  // 模拟支付
  mockPayment: {
    _id: new mongoose.Types.ObjectId(),
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    userId: testUsers.regularUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    amount: 1, // 最小金额
    paymentMethod: 'mock',
    status: 'completed',
    orderNo: `ORDER_${Date.now()}_mock`,
    paidAt: new Date(),
    createdAt: new Date()
  }
};

/**
 * 支付金额场景 - 边界值和异常值
 */
const paymentAmountScenarios = {
  // 正常金额（99元 = 9900分）
  normalAmount: 9900,

  // 最小金额（1分）
  minAmount: 1,

  // 最大合理金额（10000元 = 1000000分）
  maxReasonableAmount: 1000000,

  // 零金额
  zeroAmount: 0,

  // 负金额
  negativeAmount: -100,

  // 超大金额（异常）
  excessiveAmount: 99999999,

  // 非整数金额（小数）
  decimalAmount: 99.99,

  // 非常小的金额（0.01元）
  verySmallAmount: 1,

  // 报名期次默认金额（99元）
  defaultEnrollmentPrice: 9900
};

/**
 * 支付方法场景
 */
const paymentMethods = {
  wechat: 'wechat',
  alipay: 'alipay',
  mock: 'mock',
  invalid: 'invalid_method'
};

/**
 * 支付请求体 - 初始化支付
 */
const paymentInitiateRequests = {
  // 正常请求
  validRequest: {
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    paymentMethod: 'wechat',
    amount: 9900
  },

  // 使用模拟支付
  mockPaymentRequest: {
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    paymentMethod: 'mock',
    amount: 1
  },

  // 最小金额
  minAmountRequest: {
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    paymentMethod: 'wechat',
    amount: 1
  },

  // 零金额（无效）
  zeroAmountRequest: {
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    paymentMethod: 'wechat',
    amount: 0
  },

  // 负金额（无效）
  negativeAmountRequest: {
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    paymentMethod: 'wechat',
    amount: -100
  },

  // 无效支付方法
  invalidMethodRequest: {
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    paymentMethod: 'invalid_method',
    amount: 9900
  },

  // 不存在的报名
  nonExistentEnrollmentRequest: {
    enrollmentId: testEnrollments.nonExistentEnrollmentId,
    paymentMethod: 'wechat',
    amount: 9900
  },

  // 已支付的报名（重复支付）
  alreadyPaidRequest: {
    enrollmentId: testEnrollments.paidEnrollment._id,
    paymentMethod: 'wechat',
    amount: 9900
  }
};

/**
 * 确认支付请求体
 */
const confirmPaymentRequests = {
  // 正常请求
  validRequest: {
    transactionId: 'wx_txn_12345'
  },

  // 空交易ID
  emptyTransactionIdRequest: {
    transactionId: ''
  },

  // null 交易ID
  nullTransactionIdRequest: {
    transactionId: null
  }
};

/**
 * 支付回调请求体（微信）
 */
const wechatCallbackRequests = {
  // 支付成功
  successCallback: {
    order_no: testPayments.pendingPayment.orderNo,
    transaction_id: 'wx_txn_success_123',
    status: 'SUCCESS'
  },

  // 支付失败
  failureCallback: {
    order_no: testPayments.processingPayment.orderNo,
    transaction_id: null,
    status: 'FAILED'
  },

  // 不存在的订单
  nonExistentOrderCallback: {
    order_no: `ORDER_${Date.now()}_nonexistent`,
    transaction_id: null,
    status: 'SUCCESS'
  }
};

/**
 * 预期的成功响应
 */
const successResponses = {
  // 初始化支付成功（订单创建）
  initiatePaymentSuccess: {
    code: 200,
    message: '订单创建成功，请继续支付',
    data: {
      paymentId: 'string',
      orderNo: 'string',
      amount: 9900,
      status: 'pending',
      message: '订单创建成功，请继续支付'
    }
  },

  // 支付已存在（待支付中）
  paymentAlreadyExists: {
    code: 200,
    message: undefined,
    data: {
      paymentId: 'string',
      orderNo: 'string',
      amount: 9900,
      status: 'pending',
      message: '订单已存在，请继续支付'
    }
  },

  // 模拟支付成功
  mockPaymentSuccess: {
    code: 200,
    message: '支付成功',
    data: {
      paymentId: 'string',
      orderNo: 'string',
      status: 'completed',
      message: '模拟支付成功'
    }
  },

  // 确认支付成功
  confirmPaymentSuccess: {
    code: 200,
    message: '支付确认成功',
    data: {
      payment: 'object',
      enrollment: 'object'
    }
  },

  // 取消支付成功
  cancelPaymentSuccess: {
    code: 200,
    message: '支付已取消',
    data: {
      paymentId: 'string',
      status: 'cancelled'
    }
  },

  // 查询支付状态成功
  getPaymentStatusSuccess: {
    code: 200,
    data: {
      paymentId: 'string',
      orderNo: 'string',
      amount: 'number',
      status: 'string'
    }
  },

  // 获取支付列表成功
  getPaymentsSuccess: {
    code: 200,
    data: {
      list: 'array',
      total: 'number',
      page: 'number',
      limit: 'number',
      totalPages: 'number'
    }
  }
};

/**
 * 预期的错误响应
 */
const errorResponses = {
  // 400: 金额为零
  badRequest_zeroAmount: {
    code: 400,
    messageIncludes: '金额'
  },

  // 400: 金额为负
  badRequest_negativeAmount: {
    code: 400,
    messageIncludes: '金额'
  },

  // 400: 无效的支付方法
  badRequest_invalidMethod: {
    code: 400,
    messageIncludes: '支付方法'
  },

  // 400: 重复支付
  badRequest_alreadyPaid: {
    code: 400,
    messageIncludes: '已完成支付'
  },

  // 400: 支付已确认
  badRequest_alreadyConfirmed: {
    code: 400,
    messageIncludes: '支付已确认'
  },

  // 400: 已完成的支付无法取消
  badRequest_cannotCancelCompleted: {
    code: 400,
    messageIncludes: '已完成的支付无法取消'
  },

  // 400: 仅模拟支付支持此操作
  badRequest_mockOnlyOperation: {
    code: 400,
    messageIncludes: '仅模拟支付支持'
  },

  // 404: 报名记录不存在
  notFound_enrollment: {
    code: 404,
    messageIncludes: '报名记录'
  },

  // 404: 支付记录不存在
  notFound_payment: {
    code: 404,
    messageIncludes: '支付记录'
  },

  // 401: 未授权
  unauthorized: {
    code: 401,
    messageIncludes: '未授权'
  },

  // 403: 禁止操作
  forbidden: {
    code: 403,
    messageIncludes: '无权'
  },

  // 500: 服务器错误
  serverError: {
    code: 500,
    messageIncludes: '失败'
  }
};

/**
 * 并发测试场景
 */
const concurrencyScenarios = {
  // 两个并发支付同一报名
  duplicatePaymentConcurrency: {
    enrollmentId: testEnrollments.pendingPaymentEnrollment._id,
    userId: testUsers.regularUser._id,
    paymentMethod: 'wechat',
    amount: 9900,
    concurrentRequests: 2
  },

  // 多个并发支付不同报名
  multipleConcurrentPayments: {
    userIds: [
      testUsers.regularUser._id,
      testUsers.premiumUser._id
    ],
    enrollmentIds: [
      testEnrollments.pendingPaymentEnrollment._id,
      testEnrollments.anotherUserEnrollment._id
    ],
    concurrentRequests: 2
  }
};

module.exports = {
  testUsers,
  testPeriods,
  testEnrollments,
  testPayments,
  paymentAmountScenarios,
  paymentMethods,
  paymentInitiateRequests,
  confirmPaymentRequests,
  wechatCallbackRequests,
  successResponses,
  errorResponses,
  concurrencyScenarios
};
