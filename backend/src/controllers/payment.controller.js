const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Period = require('../models/Period');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { publishSyncEvent } = require('../services/sync.service');
const paymentService = require('../services/payment.service');
const { createNotification } = require('./notification.controller');
const subscribeMessageService = require('../services/subscribe-message.service');
const { formatNotificationTime } = require('../utils/notification-links');
const { getCurrentTenantId, withSystemContext } = require('../utils/tenantContext');

async function updatePersonalCouponUsage(ActivityCoupon, couponId, update) {
  if (!couponId) return;
  await ActivityCoupon.findOneAndUpdate(
    {
      _id: couponId,
      $or: [
        { scope: 'personal' },
        { scope: { $exists: false } }
      ]
    },
    update
  );
}

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
          targetPage: 'pages/periods/periods'
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
      page: 'pages/periods/periods',
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
  const tenantId = payment?.tenantId || getCurrentTenantId();

  if (userOpenid) {
    const unifiedOrderResult = await paymentService.unifiedOrder({
      orderId: payment.orderNo,
      amount: payment.amount,
      openid: userOpenid,
      body: `晨读营课程费用 - 订单${payment.orderNo}`,
      tenantId
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

  const payConfig = await paymentService.resolveWechatPayConfig(tenantId);
  const paymentParams = paymentService.generatePaymentParams(prepayId, payConfig);
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
    const { enrollmentId, registrationId, paymentMethod = 'wechat', amount = 9900 } = req.body;

    if (registrationId) {
      // 活动支付路径：直接返回，由 communityActivity.controller 的 registerActivity 处理
      // initiatePayment 不处理活动支付，活动支付在报名时一并创建
      return res.status(400).json(errors.badRequest('活动支付请通过报名接口发起'));
    }

    // 生产环境禁止 mock 支付，必须在创建订单前拦截，避免留下孤儿 pending 记录
    if (paymentMethod === 'mock' && process.env.NODE_ENV === 'production') {
      return res.status(400).json(errors.badRequest('生产环境不支持模拟支付'));
    }

    // 验证报名记录是否存在
    const enrollment = await Enrollment.findOne({
      _id: enrollmentId,
      userId
    });

    if (!enrollment) {
      return res.status(404).json(errors.notFound('报名记录不存在'));
    }

    const period = await Period.findById(enrollment.periodId).select('price');
    const fallbackAmount = Number.isFinite(Number(amount)) ? Number(amount) : 9900;
    const resolvedAmount = Number.isFinite(Number(period?.price))
      ? Number(period.price)
      : fallbackAmount;

    // 检查是否已有待支付的订单
    let payment = await Payment.findOne({
      enrollmentId,
      status: { $in: ['pending', 'processing'] }
    });

    if (payment && payment.amount !== resolvedAmount) {
      if (typeof payment.markCancelled === 'function') {
        await payment.markCancelled('期次价格已更新，已生成新订单');
      } else {
        payment.status = 'cancelled';
        payment.failureReason = '期次价格已更新，已生成新订单';
        if (typeof payment.save === 'function') {
          await payment.save();
        }
      }
      payment = null;
    }

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
      'enrollment',
      userId,
      enrollment.periodId,
      resolvedAmount,
      paymentMethod
    );

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'payments',
      documentId: payment._id.toString(),
      data: payment.toObject()
    });

    // 对于模拟支付，直接确认（生产环境已在入口拦截）
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

    // 原子抢占：仅从 pending 抢占，防止并发双重确认；
    // processing 超过 5 分钟视为上次确认中断，允许重新抢占（timestamps 会在抢占时刷新 updatedAt）
    const PROCESSING_STALE_MS = 5 * 60 * 1000;
    const payment = await Payment.findOneAndUpdate(
      {
        _id: paymentId,
        userId,
        $or: [
          { status: 'pending' },
          { status: 'processing', updatedAt: { $lt: new Date(Date.now() - PROCESSING_STALE_MS) } }
        ]
      },
      { $set: { status: 'processing' } },
      { new: true }
    );

    if (!payment) {
      // 再查一次以区分"不存在"、"确认中"和"已完成"
      const existing = await Payment.findOne({ _id: paymentId, userId });
      if (!existing) {
        return res.status(404).json(errors.notFound('支付记录不存在'));
      }
      if (existing.status === 'processing') {
        return res.status(409).json(errors.conflict('支付正在确认中，请稍后查询结果'));
      }
      if (existing.status === 'completed') {
        // webhook 先到已确认，前端再调属幂等成功，直接返 200
        let existingEnrollment = null;
        if (existing.enrollmentId) {
          existingEnrollment = await Enrollment.findById(existing.enrollmentId);
        }
        return res.json(success({ payment: existing, enrollment: existingEnrollment }, '支付已确认'));
      }
      return res.status(400).json(errors.badRequest('当前支付状态不允许确认'));
    }

    // 确认支付
    await payment.confirmPayment(transactionId);

    // 更新报名记录的支付状态
    let enrollment = null;
    if (payment.registrationId) {
      // 活动支付：更新 ActivityRegistration
      const ActivityRegistration = require('../models/ActivityRegistration');
      const ActivityCoupon = require('../models/ActivityCoupon');
      const reg = await ActivityRegistration.findByIdAndUpdate(
        payment.registrationId,
        { paymentStatus: 'paid', paidAmount: payment.amount, paymentId: payment._id },
        { new: true }
      );
      // 标记优惠券已使用
      if (reg && reg.couponId) {
        await updatePersonalCouponUsage(ActivityCoupon, reg.couponId, {
          status: 'used',
          usedAt: new Date(),
          usedByRegistrationId: payment.registrationId
        });
      }
    } else if (payment.enrollmentId) {
      // 期次报名支付：原有逻辑
      enrollment = await Enrollment.findByIdAndUpdate(
        payment.enrollmentId,
        {
          paymentStatus: 'paid',
          paidAt: new Date()
        },
        { new: true }
      );
    }

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

    if (payment.registrationId) {
      // 活动支付重置
      const ActivityRegistration = require('../models/ActivityRegistration');
      const ActivityCoupon = require('../models/ActivityCoupon');
      const reg = await ActivityRegistration.findById(payment.registrationId);
      if (reg) {
        // 撤销优惠券使用
        if (reg.couponId) {
          await updatePersonalCouponUsage(ActivityCoupon, reg.couponId, {
            status: 'active',
            usedAt: null,
            usedByRegistrationId: null
          });
        }
        reg.paymentStatus = 'pending';
        await reg.save();
      }
      // 取消所有相关 Payment
      const relatedPayments = await Payment.find({
        registrationId: payment.registrationId,
        status: { $in: ['pending', 'processing', 'completed'] }
      });
      for (const item of relatedPayments) {
        item.status = 'cancelled';
        item.failureReason = `管理员重置为待支付: ${operator}`;
        await item.save();
      }
      return res.json(success({ paymentId: payment._id, registrationId: payment.registrationId }, '已重置为待支付'));
    }

    // 以下是原有 enrollment 逻辑
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
    // 强制使用当前登录用户，防止 IDOR 越权读取他人支付记录
    const userId = req.user.userId;
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
    // 微信正式回调只发 XML body，非 XML 请求一律拒绝（防止无签名的 JSON 请求绕过验证）
    if (!isXmlCallback) {
      logger.warn('WeChat callback: non-XML body rejected');
      return sendJson(400, errors.badRequest('invalid callback format'));
    }

    const xmlBody = req.body;
    if (!xmlBody) {
      logger.warn('WeChat callback: empty body');
      return replyFail('empty body');
    }

    const { xmlToObject } = require('../services/payment.service');
    const notifyData = xmlToObject(xmlBody);

    if (notifyData.return_code !== 'SUCCESS') {
      logger.warn('WeChat callback: return_code is not SUCCESS', notifyData);
      return replyFail('return_code not SUCCESS');
    }

    logger.info('WeChat callback received', {
      return_code: notifyData.return_code,
      result_code: notifyData.result_code,
      out_trade_no: notifyData.out_trade_no
    });

    // 查找支付记录（微信回调用 out_trade_no，即我们的 orderNo）
    // 注意：必须调用 .exec() 让 Promise 在 withSystemContext 的 AsyncLocalStorage 上下文内创建，
    // 否则 Mongoose Query 的 pre-hook 会在 processTicksAndRejections 中执行，此时上下文已丢失。
    const payment = await withSystemContext(null, () =>
      Payment.findOne({ orderNo: notifyData.out_trade_no }).exec()
    );

    if (!payment) {
      logger.warn('WeChat callback: payment not found', { out_trade_no: notifyData.out_trade_no });
      return replyFail('order not found');
    }

    if (isXmlCallback) {
      const payConfig = await paymentService.resolveWechatPayConfig(payment.tenantId);
      if (!paymentService.verifyNotifySign(notifyData, payConfig)) {
        logger.warn('WeChat callback: signature verification failed', {
          paymentId: payment._id,
          tenantId: payment.tenantId
        });
        return replyFail('sign error');
      }
    }

    // 防止重复处理
    if (payment.status === 'completed') {
      return replySuccess();
    }

    if (notifyData.result_code === 'SUCCESS') {
      await withSystemContext(payment.tenantId, async () => {
        // 支付成功
        await payment.confirmPayment(notifyData.transaction_id);

        // 更新报名记录
        if (payment.registrationId) {
          const ActivityRegistration = require('../models/ActivityRegistration');
          const ActivityCoupon = require('../models/ActivityCoupon');
          const reg = await ActivityRegistration.findByIdAndUpdate(
            payment.registrationId,
            { paymentStatus: 'paid', paidAmount: payment.amount, paymentId: payment._id },
            { new: true }
          );
          if (reg && reg.couponId) {
            await updatePersonalCouponUsage(ActivityCoupon, reg.couponId, {
              status: 'used',
              usedAt: new Date(),
              usedByRegistrationId: payment.registrationId
            });
          }
        } else if (payment.enrollmentId) {
          await Enrollment.findByIdAndUpdate(payment.enrollmentId, {
            paymentStatus: 'paid',
            paidAt: new Date()
          });
        }
      });

      // 异步同步到 MySQL
      publishSyncEvent({
        type: 'update',
        collection: 'payments',
        documentId: payment._id.toString(),
        data: payment.toObject()
      });

      if (typeof payment.populate === 'function') {
        await withSystemContext(payment.tenantId, async () => {
          await payment.populate('enrollmentId', 'name');
          await payment.populate('periodId', 'name title');
        });
      }

      let enrollment = null;
      if (payment.enrollmentId) {
        enrollment = await withSystemContext(payment.tenantId, () =>
          Enrollment.findById(payment.enrollmentId)
        );
      }
      if (enrollment) {
        if (typeof enrollment.populate === 'function') {
          await withSystemContext(payment.tenantId, () =>
            enrollment.populate('periodId', 'name title')
          );
        }
        await withSystemContext(payment.tenantId, async () => {
          await notifyPaymentSuccess(req, {
            userId: payment.userId?.toString?.() || payment.userId,
            payment,
            enrollment
          });
        });
      }

      logger.info('WeChat payment confirmed', {
        orderNo: payment.orderNo,
        transactionId: notifyData.transaction_id,
        amount: notifyData.total_fee
      });

      return replySuccess();
    } else {
      await withSystemContext(payment.tenantId, async () => {
        // 支付失败
        await payment.markFailed(notifyData.err_code_des || '微信支付失败');
      });

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
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('enrollmentId', 'name')
      .populate('periodId', 'name')
      .select('-__v');

    const paymentList = payments.map(p => {
      const obj = p.toObject ? p.toObject() : p;
      obj.userName = p.userId?.nickname || obj.userName || '未知';
      obj.userAvatarUrl = typeof p.userId === 'object'
        ? (p.userId?.avatarUrl || null)
        : null;
      return obj;
    });

    res.json(
      success({
        list: paymentList,
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
