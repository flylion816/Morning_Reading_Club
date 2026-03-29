const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { publishSyncEvent } = require('../services/sync.service');
const paymentService = require('../services/payment.service');
const { createNotification } = require('./notification.controller');
const subscribeMessageService = require('../services/subscribe-message.service');
const { formatNotificationTime } = require('../utils/notification-links');

async function notifyPaymentSuccess(req, { userId, payment, enrollment }) {
  try {
    const periodName =
      payment?.periodId?.name ||
      payment?.periodId?.title ||
      enrollment?.periodId?.name ||
      enrollment?.periodId?.title ||
      '晨读营';
    const paidAt = payment?.paidAt || enrollment?.paidAt || new Date();

    await createNotification(
      userId,
      'payment_result',
      '付款成功',
      `你已完成 ${periodName} 的付款`,
      {
        wsManager: req.wsManager,
        data: {
          scene: 'payment_result',
          periodId:
            payment?.periodId?._id?.toString?.() || payment?.periodId?.toString?.() || null,
          periodName,
          targetPage: 'pages/index/index'
        }
      }
    );

    await subscribeMessageService.sendSceneMessage({
      scene: 'payment_result',
      recipientUserId: userId,
      fields: {
        orderContent: periodName,
        orderTime: formatNotificationTime(paidAt)
      },
      page: 'pages/index/index',
      sourceType: 'payment',
      sourceId: payment?._id?.toString?.() || `${userId}:${periodName}`
    });
  } catch (error) {
    logger.warn('付款结果通知发送失败', {
      userId,
      paymentId: payment?._id?.toString?.(),
      message: error.message
    });
  }
}

async function attachWechatPaymentParams(payment, userOpenid) {
  let prepayId = payment?.wechat?.prepayId || '';
  let unifiedOrderError = '';

  if (userOpenid) {
    const unifiedOrderResult = await paymentService.unifiedOrder({
      orderId: payment.orderNo,
      amount: payment.amount,
      openid: userOpenid,
      body: `晨读营课程费用 - 订单${payment.orderNo}`
    });

    if (unifiedOrderResult.success && unifiedOrderResult.prepayId) {
      prepayId = unifiedOrderResult.prepayId;
      payment.wechat = payment.wechat || {};
      payment.wechat.prepayId = unifiedOrderResult.prepayId;

      if (typeof payment.save === 'function') {
        await payment.save();
      }
    } else {
      unifiedOrderError = unifiedOrderResult.error || '获取微信支付参数失败，请稍后重试';
      logger.warn('WeChat unifiedOrder failed', {
        paymentId: payment._id,
        orderNo: payment.orderNo,
        error: unifiedOrderError
      });
    }
  } else if (!prepayId) {
    unifiedOrderError = '缺少用户 openid，无法发起微信支付';
  }

  if (!prepayId) {
    return {
      success: false,
      error: unifiedOrderError || '获取微信支付参数失败，请稍后重试'
    };
  }

  const paymentParams = paymentService.generatePaymentParams(prepayId);
  return {
    success: true,
    paymentParams
  };
}

/**
 * 初始化支付（创建订单）
 * POST /api/v1/payments/initiate
 */
exports.initiatePayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    // amount 单位为"分"（100分 = 1元），默认 9900分 = 99元
    const { enrollmentId, paymentMethod = 'wechat', amount = 9900 } = req.body;

    // 验证报名记录是否存在
    const enrollment = await Enrollment.findOne({
      _id: enrollmentId,
      userId
    });

    if (!enrollment) {
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    // 检查是否已有待支付的订单
    let payment = await Payment.findOne({
      enrollmentId,
      status: { $in: ['pending', 'processing'] }
    });

    // 如果已有待支付或处理中的订单，直接返回该订单
    if (payment) {
      let responseData = {
        paymentId: payment._id,
        orderNo: payment.orderNo,
        amount: payment.amount,
        status: payment.status,
        message: '订单已存在，请继续支付'
      };

      if (payment.paymentMethod === 'wechat') {
        const wechatPaymentResult = await attachWechatPaymentParams(payment, req.user.openid || '');

        if (wechatPaymentResult.success) {
          responseData = {
            ...responseData,
            ...wechatPaymentResult.paymentParams,
            total_fee: payment.amount
          };
        } else {
          responseData.message = `订单已存在，但获取支付参数失败，请重试：${wechatPaymentResult.error}`;
        }
      }

      return res.json(
        success(responseData)
      );
    }

    // 检查是否已完成支付
    const completedPayment = await Payment.findOne({
      enrollmentId,
      status: 'completed'
    });

    if (completedPayment) {
      return res.status(400).json(errors.badRequest('该报名已完成支付'));
    }

    // 创建新的支付订单
    payment = await Payment.createOrder(
      enrollmentId,
      userId,
      enrollment.periodId,
      amount,
      paymentMethod
    );

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'payments',
      documentId: payment._id.toString(),
      data: payment.toObject()
    });

    // 对于模拟支付，直接返回成功
    if (paymentMethod === 'mock') {
      await payment.confirmPayment();

      // 更新报名记录的支付状态
      await Enrollment.findByIdAndUpdate(enrollmentId, {
        paymentStatus: 'paid',
        paidAt: new Date()
      });

      // 异步同步到 MySQL（更新后）
      publishSyncEvent({
        type: 'update',
        collection: 'payments',
        documentId: payment._id.toString(),
        data: payment.toObject()
      });

      return res.json(
        success(
          {
            paymentId: payment._id,
            orderNo: payment.orderNo,
            status: 'completed',
            message: '模拟支付成功'
          },
          '支付成功'
        )
      );
    }

    const wechatPaymentResult = await attachWechatPaymentParams(payment, req.user.openid || '');

    if (!wechatPaymentResult.success) {
      return res.json(
        success({
          paymentId: payment._id,
          orderNo: payment.orderNo,
          amount: payment.amount,
          status: 'pending',
          message: `订单创建成功，但获取支付参数失败，请重试：${wechatPaymentResult.error}`
        })
      );
    }

    // 5. 返回完整的支付参数
    res.json(
      success({
        paymentId: payment._id,
        orderNo: payment.orderNo,
        amount: payment.amount,
        status: 'pending',
        // 微信支付参数（wx.requestPayment 所需）
        timeStamp: wechatPaymentResult.paymentParams.timeStamp,
        nonceStr: wechatPaymentResult.paymentParams.nonceStr,
        package: wechatPaymentResult.paymentParams.package,
        signType: wechatPaymentResult.paymentParams.signType,
        paySign: wechatPaymentResult.paymentParams.paySign,
        total_fee: payment.amount, // 微信要求的字段
        message: '订单创建成功，请继续支付'
      })
    );
  } catch (error) {
    logger.error('Payment initiation failed', error);
    res.status(500).json(errors.serverError('初始化支付失败: ' + error.message));
  }
};

/**
 * 确认支付
 * POST /api/v1/payments/:paymentId/confirm
 */
exports.confirmPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
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
    const enrollment = await Enrollment.findByIdAndUpdate(
      payment.enrollmentId,
      {
        paymentStatus: 'paid',
        paidAt: new Date()
      },
      { new: true }
    );

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'payments',
      documentId: payment._id.toString(),
      data: payment.toObject()
    });

    // 填充关联数据
    if (typeof payment.populate === 'function') {
      await payment.populate('enrollmentId', 'name');
      await payment.populate('periodId', 'name title');
    }
    if (enrollment && typeof enrollment.populate === 'function') {
      await enrollment.populate('periodId', 'name title');
    }

    await notifyPaymentSuccess(req, {
      userId,
      payment,
      enrollment
    });

    res.json(
      success(
        {
          payment,
          enrollment
        },
        '支付确认成功'
      )
    );
  } catch (error) {
    logger.error('Payment confirmation failed', error);
    res.status(500).json(errors.serverError('确认支付失败: ' + error.message));
  }
};

/**
 * 查询支付状态
 * GET /api/v1/payments/:paymentId
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
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

    res.json(
      success({
        paymentId: payment._id,
        orderNo: payment.orderNo,
        amount: payment.amount,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        enrollmentName: payment.enrollmentId?.name,
        periodName: payment.periodId?.name
      })
    );
  } catch (error) {
    logger.error('Payment status query failed', error);
    res.status(500).json(errors.serverError('查询支付状态失败: ' + error.message));
  }
};

/**
 * 取消支付
 * POST /api/v1/payments/:paymentId/cancel
 */
exports.cancelPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
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

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'payments',
      documentId: payment._id.toString(),
      data: payment.toObject()
    });

    res.json(
      success(
        {
          paymentId: payment._id,
          status: payment.status
        },
        '支付已取消'
      )
    );
  } catch (error) {
    logger.error('Payment cancellation failed', error);
    res.status(500).json(errors.serverError('取消支付失败: ' + error.message));
  }
};

/**
 * 管理员取消支付
 * POST /api/v1/payments/:paymentId/admin-cancel
 */
exports.adminCancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const operator = req.user?.email || req.user?.id || 'admin';

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json(errors.notFound('支付记录不存在'));
    }

    if (payment.status === 'completed') {
      return res.status(400).json(errors.badRequest('已完成的支付请使用“重置为待支付”'));
    }

    await payment.markCancelled(`管理员取消: ${operator}`);

    publishSyncEvent({
      type: 'update',
      collection: 'payments',
      documentId: payment._id.toString(),
      data: payment.toObject()
    });

    res.json(
      success(
        {
          paymentId: payment._id,
          status: payment.status
        },
        '支付已取消'
      )
    );
  } catch (error) {
    logger.error('Admin payment cancellation failed', error);
    res.status(500).json(errors.serverError('管理员取消支付失败: ' + error.message));
  }
};

/**
 * 管理员重置为待支付
 * POST /api/v1/payments/:paymentId/reset-to-pending
 */
exports.adminResetPaymentToPending = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const operator = req.user?.email || req.user?.id || 'admin';

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json(errors.notFound('支付记录不存在'));
    }

    const enrollment = await Enrollment.findById(payment.enrollmentId);
    if (!enrollment) {
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    enrollment.paymentStatus = 'pending';
    enrollment.paymentAmount = 0;
    enrollment.paidAt = null;
    await enrollment.save();

    publishSyncEvent({
      type: 'update',
      collection: 'enrollments',
      documentId: enrollment._id.toString(),
      data: enrollment.toObject()
    });

    const relatedPayments = await Payment.find({
      enrollmentId: payment.enrollmentId,
      status: { $in: ['pending', 'processing', 'completed'] }
    });

    const resetReason = `管理员重置为待支付: ${operator}`;
    for (const item of relatedPayments) {
      item.status = 'cancelled';
      item.failureReason = resetReason;
      item.paidAt = null;
      item.reconciled = false;
      item.reconciledAt = null;
      item.wechat = {};
      await item.save();

      publishSyncEvent({
        type: 'update',
        collection: 'payments',
        documentId: item._id.toString(),
        data: item.toObject()
      });
    }

    res.json(
      success(
        {
          paymentId: payment._id,
          enrollmentId: enrollment._id,
          paymentStatus: enrollment.paymentStatus,
          cancelledPaymentCount: relatedPayments.length
        },
        '已重置为待支付'
      )
    );
  } catch (error) {
    logger.error('Admin reset payment to pending failed', error);
    res.status(500).json(errors.serverError('重置为待支付失败: ' + error.message));
  }
};

/**
 * 获取用户的支付记录列表
 * GET /api/v1/payments/user/:userId?
 */
exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    const { page = 1, limit = 20, status } = req.query;

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

    res.json(
      success({
        list: payments,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      })
    );
  } catch (error) {
    logger.error('Get payment record failed', error);
    res.status(500).json(errors.serverError('获取支付记录失败: ' + error.message));
  }
};

/**
 * 微信支付回调
 * POST /api/v1/payments/wechat/callback
 *
 * 微信服务器发送 XML 格式的支付结果通知
 * 必须返回 XML 格式的应答，否则微信会重复通知
 */
exports.wechatCallback = async (req, res) => {
  const isXmlCallback = typeof req.body === 'string';
  const sendJson = (statusCode, payload) => res.status(statusCode).json(payload);

  // 微信要求返回 XML 格式
  const replySuccess = () => {
    if (!isXmlCallback || typeof res.set !== 'function' || typeof res.send !== 'function') {
      return sendJson(200, success(null, '回调处理成功'));
    }
    res.set('Content-Type', 'text/xml');
    return res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
  };
  const replyFail = (msg) => {
    if (!isXmlCallback || typeof res.set !== 'function' || typeof res.send !== 'function') {
      const statusCode = msg === 'order not found' ? 404 : 400;
      const errorPayload =
        statusCode === 404 ? errors.notFound('支付记录不存在') : errors.badRequest(msg);
      return sendJson(statusCode, errorPayload);
    }
    res.set('Content-Type', 'text/xml');
    return res.send(`<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[${msg}]]></return_msg></xml>`);
  };

  try {
    let notifyData;

    if (isXmlCallback) {
      const xmlBody = req.body;
      if (!xmlBody) {
        logger.warn('WeChat callback: empty body');
        return replyFail('empty body');
      }

      const { xmlToObject, verifyNotifySign } = require('../services/payment.service');
      notifyData = xmlToObject(xmlBody);

      if (notifyData.return_code !== 'SUCCESS') {
        logger.warn('WeChat callback: return_code is not SUCCESS', notifyData);
        return replyFail('return_code not SUCCESS');
      }

      if (!verifyNotifySign(notifyData)) {
        logger.warn('WeChat callback: signature verification failed');
        return replyFail('sign error');
      }
    } else {
      notifyData = {
        out_trade_no: req.body?.out_trade_no || req.body?.order_no || '',
        transaction_id: req.body?.transaction_id || null,
        result_code: req.body?.result_code || req.body?.status || 'FAIL',
        return_code: req.body?.return_code || 'SUCCESS',
        total_fee: req.body?.total_fee || null,
        err_code_des: req.body?.err_code_des || null
      };
    }

    logger.info('WeChat callback received', {
      return_code: notifyData.return_code,
      result_code: notifyData.result_code,
      out_trade_no: notifyData.out_trade_no
    });

    // 查找支付记录（微信回调用 out_trade_no，即我们的 orderNo）
    const payment = await Payment.findOne({ orderNo: notifyData.out_trade_no });

    if (!payment) {
      logger.warn('WeChat callback: payment not found', { out_trade_no: notifyData.out_trade_no });
      return replyFail('order not found');
    }

    // 防止重复处理
    if (payment.status === 'completed') {
      return replySuccess();
    }

    if (notifyData.result_code === 'SUCCESS') {
      // 支付成功
      await payment.confirmPayment(notifyData.transaction_id);

      // 更新报名记录
      await Enrollment.findByIdAndUpdate(payment.enrollmentId, {
        paymentStatus: 'paid',
        paidAt: new Date()
      });

      // 异步同步到 MySQL
      publishSyncEvent({
        type: 'update',
        collection: 'payments',
        documentId: payment._id.toString(),
        data: payment.toObject()
      });

      if (typeof payment.populate === 'function') {
        await payment.populate('enrollmentId', 'name');
        await payment.populate('periodId', 'name title');
      }

      const enrollment = await Enrollment.findById(payment.enrollmentId);
      if (enrollment) {
        if (typeof enrollment.populate === 'function') {
          await enrollment.populate('periodId', 'name title');
        }
        await notifyPaymentSuccess(req, {
          userId: payment.userId?.toString?.() || payment.userId,
          payment,
          enrollment
        });
      }

      logger.info('WeChat payment confirmed', {
        orderNo: payment.orderNo,
        transactionId: notifyData.transaction_id,
        amount: notifyData.total_fee
      });

      return replySuccess();
    } else {
      // 支付失败
      await payment.markFailed(notifyData.err_code_des || '微信支付失败');

      publishSyncEvent({
        type: 'update',
        collection: 'payments',
        documentId: payment._id.toString(),
        data: payment.toObject()
      });

      return replySuccess(); // 即使支付失败，也要告诉微信我们已处理
    }
  } catch (error) {
    logger.error('WeChat callback handling failed', error);
    return replyFail(error.message);
  }
};

/**
 * 模拟支付确认（用于开发测试）
 * POST /api/v1/payments/:paymentId/mock-confirm
 */
exports.mockConfirmPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
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
    const enrollment = await Enrollment.findByIdAndUpdate(
      payment.enrollmentId,
      {
        paymentStatus: 'paid',
        paidAt: new Date()
      },
      { new: true }
    );

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'payments',
      documentId: payment._id.toString(),
      data: payment.toObject()
    });

    if (typeof payment.populate === 'function') {
      await payment.populate('enrollmentId', 'name');
      await payment.populate('periodId', 'name title');
    }
    if (typeof enrollment.populate === 'function') {
      await enrollment.populate('periodId', 'name title');
    }

    await notifyPaymentSuccess(req, {
      userId: userId,
      payment,
      enrollment
    });

    res.json(
      success(
        {
          payment,
          enrollment
        },
        '模拟支付成功'
      )
    );
  } catch (error) {
    logger.error('Mock payment failed', error);
    res.status(500).json(errors.serverError('模拟支付失败: ' + error.message));
  }
};

/**
 * 获取支付列表（管理员）
 * GET /api/v1/payments
 */
exports.getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, method, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (method) query.paymentMethod = method;
    if (search) {
      query.$or = [
        { orderNo: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('enrollmentId', 'name')
      .populate('periodId', 'name')
      .select('-__v');

    res.json(
      success({
        list: payments,
        total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      })
    );
  } catch (error) {
    logger.error('Get payment list failed', error);
    res.status(500).json(errors.serverError('获取支付列表失败: ' + error.message));
  }
};
