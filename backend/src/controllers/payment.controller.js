const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const { success, errors } = require('../utils/response');

/**
 * 初始化支付（创建订单）
 * POST /api/v1/payments/initiate
 */
exports.initiatePayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      enrollmentId,
      paymentMethod = 'wechat',
      amount = 99
    } = req.body;

    // 验证报名记录是否存在
    const enrollment = await Enrollment.findOne({
      _id: enrollmentId,
      userId
    });

    if (!enrollment) {
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    // 检查是否已支付
    const existingPayment = await Payment.findOne({
      enrollmentId,
      status: 'completed'
    });

    if (existingPayment) {
      return res.status(400).json(errors.badRequest('该报名已完成支付'));
    }

    // 创建支付订单
    const payment = await Payment.createOrder(
      enrollmentId,
      userId,
      enrollment.periodId,
      amount,
      paymentMethod
    );

    // 对于模拟支付，直接返回成功
    if (paymentMethod === 'mock') {
      await payment.confirmPayment();

      // 更新报名记录的支付状态
      await Enrollment.findByIdAndUpdate(enrollmentId, {
        paymentStatus: 'paid',
        paidAt: new Date()
      });

      return res.json(success({
        paymentId: payment._id,
        orderNo: payment.orderNo,
        status: 'completed',
        message: '模拟支付成功'
      }, '支付成功'));
    }

    // 对于真实微信支付，返回订单信息
    res.json(success({
      paymentId: payment._id,
      orderNo: payment.orderNo,
      amount: payment.amount,
      status: 'pending',
      message: '订单创建成功，请继续支付'
    }));
  } catch (error) {
    console.error('初始化支付失败:', error);
    res.status(500).json(errors.serverError('初始化支付失败: ' + error.message));
  }
};

/**
 * 确认支付
 * POST /api/v1/payments/:paymentId/confirm
 */
exports.confirmPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentId } = req.params;
    const { transactionId } = req.body;

    // 查找支付记录
    const payment = await Payment.findOne({
      _id: paymentId,
      userId
    });

    if (!payment) {
      return res.status(404).json(errors.notFound('支付记录不存在'));
    }

    if (payment.status === 'completed') {
      return res.status(400).json(errors.badRequest('支付已确认'));
    }

    // 确认支付
    await payment.confirmPayment(transactionId);

    // 更新报名记录的支付状态
    const enrollment = await Enrollment.findByIdAndUpdate(payment.enrollmentId, {
      paymentStatus: 'paid',
      paidAt: new Date()
    }, { new: true });

    // 填充关联数据
    await payment.populate('enrollmentId', 'name');
    await payment.populate('periodId', 'name title');

    res.json(success({
      payment,
      enrollment
    }, '支付确认成功'));
  } catch (error) {
    console.error('确认支付失败:', error);
    res.status(500).json(errors.serverError('确认支付失败: ' + error.message));
  }
};

/**
 * 查询支付状态
 * GET /api/v1/payments/:paymentId
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentId } = req.params;

    // 查找支付记录
    const payment = await Payment.findOne({
      _id: paymentId,
      userId
    })
      .populate('enrollmentId', 'name status')
      .populate('periodId', 'name title');

    if (!payment) {
      return res.status(404).json(errors.notFound('支付记录不存在'));
    }

    res.json(success({
      paymentId: payment._id,
      orderNo: payment.orderNo,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      enrollmentName: payment.enrollmentId?.name,
      periodName: payment.periodId?.name
    }));
  } catch (error) {
    console.error('查询支付状态失败:', error);
    res.status(500).json(errors.serverError('查询支付状态失败: ' + error.message));
  }
};

/**
 * 取消支付
 * POST /api/v1/payments/:paymentId/cancel
 */
exports.cancelPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentId } = req.params;

    // 查找支付记录
    const payment = await Payment.findOne({
      _id: paymentId,
      userId
    });

    if (!payment) {
      return res.status(404).json(errors.notFound('支付记录不存在'));
    }

    if (payment.status === 'completed') {
      return res.status(400).json(errors.badRequest('已完成的支付无法取消'));
    }

    // 取消支付
    await payment.markCancelled();

    res.json(success({
      paymentId: payment._id,
      status: payment.status
    }, '支付已取消'));
  } catch (error) {
    console.error('取消支付失败:', error);
    res.status(500).json(errors.serverError('取消支付失败: ' + error.message));
  }
};

/**
 * 获取用户的支付记录列表
 * GET /api/v1/payments/user/:userId?
 */
exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const {
      page = 1,
      limit = 20,
      status
    } = req.query;

    // 获取支付记录
    const result = await Payment.getUserPayments(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });

    // 转换数据格式
    const payments = result.list.map(payment => ({
      paymentId: payment._id,
      orderNo: payment.orderNo,
      amount: payment.amount,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      enrollmentName: payment.enrollmentId?.name,
      periodName: payment.periodId?.name,
      isPaid: payment.status === 'completed'
    }));

    res.json(success({
      list: payments,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }));
  } catch (error) {
    console.error('获取支付记录失败:', error);
    res.status(500).json(errors.serverError('获取支付记录失败: ' + error.message));
  }
};

/**
 * 微信支付回调
 * POST /api/v1/payments/wechat/callback
 */
exports.wechatCallback = async (req, res) => {
  try {
    const { order_no, transaction_id, status } = req.body;

    // 验证回调签名（实际项目中应验证微信签名）
    // ...

    // 查找支付记录
    const payment = await Payment.findOne({ orderNo: order_no });

    if (!payment) {
      return res.status(404).json(errors.notFound('支付记录不存在'));
    }

    if (status === 'SUCCESS') {
      // 确认支付
      await payment.confirmPayment(transaction_id);

      // 更新报名记录
      await Enrollment.findByIdAndUpdate(payment.enrollmentId, {
        paymentStatus: 'paid',
        paidAt: new Date()
      });

      res.json(success({}, '支付确认成功'));
    } else {
      // 标记为失败
      await payment.markFailed('微信支付失败');
      res.json(success({}, '支付失败'));
    }
  } catch (error) {
    console.error('处理微信回调失败:', error);
    res.status(500).json(errors.serverError('处理回调失败: ' + error.message));
  }
};

/**
 * 模拟支付确认（用于开发测试）
 * POST /api/v1/payments/:paymentId/mock-confirm
 */
exports.mockConfirmPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { paymentId } = req.params;

    // 查找支付记录
    const payment = await Payment.findOne({
      _id: paymentId,
      userId
    });

    if (!payment) {
      return res.status(404).json(errors.notFound('支付记录不存在'));
    }

    if (payment.paymentMethod !== 'mock') {
      return res.status(400).json(errors.badRequest('仅模拟支付支持此操作'));
    }

    // 确认支付
    await payment.confirmPayment();

    // 更新报名记录的支付状态
    const enrollment = await Enrollment.findByIdAndUpdate(payment.enrollmentId, {
      paymentStatus: 'paid',
      paidAt: new Date()
    }, { new: true });

    res.json(success({
      payment,
      enrollment
    }, '模拟支付成功'));
  } catch (error) {
    console.error('模拟支付失败:', error);
    res.status(500).json(errors.serverError('模拟支付失败: ' + error.message));
  }
};
