/**
 * Payment Controller 单元测试
 * 覆盖支付初始化、确认、取消、查询等25+个测试场景
 * 包括：金额验证、重复支付防护、权限检查、并发防护、错误处理
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const fixtures = require('../../fixtures/payment-fixtures');

describe('Payment Controller', () => {
  let paymentController;
  let sandbox;
  let req;
  let res;
  let next;
  let PaymentStub;
  let EnrollmentStub;
  let syncServiceStub;
  let paymentServiceStub;
  let notificationControllerStub;
  let subscribeMessageServiceStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: {
        userId: fixtures.testUsers.regularUser._id.toString(),
        openid: fixtures.testUsers.regularUser.wechatOpenId
      }
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    PaymentStub = {
      create: sandbox.stub(),
      findById: sandbox.stub(),
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      countDocuments: sandbox.stub(),
      // Static methods
      getUserPayments: sandbox.stub(),
      createOrder: sandbox.stub()
    };

    EnrollmentStub = {
      findOne: sandbox.stub(),
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    syncServiceStub = {
      publishSyncEvent: sandbox.stub()
    };

    paymentServiceStub = {
      unifiedOrder: sandbox.stub().resolves({
        success: true,
        prepayId: 'mock_prepay_id'
      }),
      generatePaymentParams: sandbox.stub().returns({
        timeStamp: '1234567890',
        nonceStr: 'nonce_str',
        package: 'prepay_id=mock_prepay_id',
        signType: 'MD5',
        paySign: 'mock_sign'
      })
    };

    notificationControllerStub = {
      createNotification: sandbox.stub().resolves()
    };

    subscribeMessageServiceStub = {
      sendSceneMessage: sandbox.stub().resolves()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        serverError: (msg) => ({ code: 500, message: msg })
      }
    };

    const loggerStub = {
      error: sandbox.stub(),
      warn: sandbox.stub(),
      info: sandbox.stub()
    };

    paymentController = proxyquire(
      '../../../src/controllers/payment.controller',
      {
        '../models/Payment': PaymentStub,
        '../models/Enrollment': EnrollmentStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub,
        '../services/sync.service': syncServiceStub,
        '../services/payment.service': paymentServiceStub,
        './notification.controller': notificationControllerStub,
        '../services/subscribe-message.service': subscribeMessageServiceStub,
        '../utils/notification-links': {
          formatNotificationTime: sandbox.stub().returns('2026-03-29 12:00')
        }
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  // ============ initiatePayment 测试 ============
  describe('initiatePayment - 支付初始化', () => {
    // TC-PAYMENT-001: 创建支付记录
    it('应该成功初始化支付订单', async () => {
      req.user = {
        userId: fixtures.testUsers.regularUser._id.toString(),
        openid: fixtures.testUsers.regularUser.wechatOpenId
      };
      req.body = fixtures.paymentInitiateRequests.validRequest;

      const mockEnrollment = { ...fixtures.testEnrollments.pendingPaymentEnrollment };
      const mockPayment = {
        ...fixtures.testPayments.pendingPayment,
        toObject: () => ({ ...fixtures.testPayments.pendingPayment })
      };

      EnrollmentStub.findOne.resolves(mockEnrollment);
      // 设置多个返回值用于多次 findOne 调用
      PaymentStub.findOne.onFirstCall().resolves(null); // 无待支付订单
      PaymentStub.findOne.onSecondCall().resolves(null); // 无已完成订单
      PaymentStub.createOrder.resolves(mockPayment);

      await paymentController.initiatePayment(req, res, next);

      expect(EnrollmentStub.findOne.called).to.be.true;
      expect(PaymentStub.createOrder.called).to.be.true;
      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.code).to.equal(200);
      expect(response.data.status).to.equal('pending');
      expect(response.data).to.include({
        timeStamp: '1234567890',
        nonceStr: 'nonce_str',
        package: 'prepay_id=mock_prepay_id',
        paySign: 'mock_sign'
      });
    });

    // TC-PAYMENT-002: 重复支付同一报名（防护）
    it('应该返回已存在的待支付订单而不是重复创建', async () => {
      req.user = {
        userId: fixtures.testUsers.regularUser._id.toString(),
        openid: fixtures.testUsers.regularUser.wechatOpenId
      };
      req.body = fixtures.paymentInitiateRequests.validRequest;

      const mockEnrollment = { ...fixtures.testEnrollments.pendingPaymentEnrollment };
      const mockPayment = {
        ...fixtures.testPayments.pendingPayment,
        wechat: { prepayId: 'existing_prepay_id' },
        save: sandbox.stub().resolves()
      };

      EnrollmentStub.findOne.withArgs({
        _id: fixtures.testEnrollments.pendingPaymentEnrollment._id,
        userId: fixtures.testUsers.regularUser._id.toString()
      }).resolves(mockEnrollment);

      PaymentStub.findOne.withArgs({
        enrollmentId: fixtures.testEnrollments.pendingPaymentEnrollment._id,
        status: { $in: ['pending', 'processing'] }
      }).resolves(mockPayment); // 已有待支付订单

      await paymentController.initiatePayment(req, res, next);

      expect(PaymentStub.createOrder.called).to.be.false;
      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.data.message).to.include('订单已存在');
      expect(paymentServiceStub.unifiedOrder.calledOnce).to.be.true;
      expect(response.data).to.include({
        timeStamp: '1234567890',
        nonceStr: 'nonce_str',
        package: 'prepay_id=mock_prepay_id',
        paySign: 'mock_sign'
      });
    });

    // TC-PAYMENT-003: 报名已支付，无法重复支付
    it('应该拒绝已完成支付的报名再次支付', async () => {
      req.user = {
        userId: fixtures.testUsers.premiumUser._id.toString(),
        openid: fixtures.testUsers.premiumUser.wechatOpenId
      };
      req.body = {
        enrollmentId: fixtures.testEnrollments.paidEnrollment._id,
        paymentMethod: 'wechat',
        amount: 9900
      };

      const mockEnrollment = { ...fixtures.testEnrollments.paidEnrollment };
      const mockCompletedPayment = { ...fixtures.testPayments.completedPayment };

      EnrollmentStub.findOne.resolves(mockEnrollment);
      PaymentStub.findOne.onFirstCall().resolves(null); // 无待支付
      PaymentStub.findOne.onSecondCall().resolves(mockCompletedPayment); // 有已完成

      await paymentController.initiatePayment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.message).to.include('已完成支付');
    });

    // TC-PAYMENT-004: 报名不存在返回 404
    it('应该返回404当报名记录不存在', async () => {
      req.user = {
        userId: fixtures.testUsers.regularUser._id.toString(),
        openid: fixtures.testUsers.regularUser.wechatOpenId
      };
      req.body = fixtures.paymentInitiateRequests.nonExistentEnrollmentRequest;

      EnrollmentStub.findOne.resolves(null);

      await paymentController.initiatePayment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.message).to.include('报名记录');
    });

    // TC-PAYMENT-005: 模拟支付直接成功
    it('应该在模拟支付时直接返回成功', async () => {
      req.user = {
        userId: fixtures.testUsers.regularUser._id.toString(),
        openid: fixtures.testUsers.regularUser.wechatOpenId
      };
      req.body = fixtures.paymentInitiateRequests.mockPaymentRequest;

      const mockEnrollment = { ...fixtures.testEnrollments.pendingPaymentEnrollment };
      const mockPayment = {
        ...fixtures.testPayments.mockPayment,
        confirmPayment: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({})
      };

      EnrollmentStub.findOne.resolves(mockEnrollment);

      PaymentStub.findOne.withArgs({
        enrollmentId: fixtures.testEnrollments.pendingPaymentEnrollment._id,
        status: { $in: ['pending', 'processing'] }
      }).resolves(null);

      PaymentStub.findOne.withArgs({
        enrollmentId: fixtures.testEnrollments.pendingPaymentEnrollment._id,
        status: 'completed'
      }).resolves(null);

      PaymentStub.createOrder.resolves(mockPayment);
      EnrollmentStub.findByIdAndUpdate.resolves(mockEnrollment);

      await paymentController.initiatePayment(req, res, next);

      expect(mockPayment.confirmPayment.called).to.be.true;
      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.data.status).to.equal('completed');
    });

    // TC-SEC-005: 金额为零验证
    it('应该验证金额不能为零', async () => {
      req.user = {
        userId: fixtures.testUsers.regularUser._id.toString(),
        openid: fixtures.testUsers.regularUser.wechatOpenId
      };
      req.body = fixtures.paymentInitiateRequests.zeroAmountRequest;

      const mockEnrollment = { ...fixtures.testEnrollments.pendingPaymentEnrollment };

      EnrollmentStub.findOne.resolves(mockEnrollment);
      PaymentStub.findOne.resolves(null);

      // 模拟 createOrder 抛出验证错误
      PaymentStub.createOrder.rejects(new Error('金额必须大于0'));

      await paymentController.initiatePayment(req, res, next);

      expect(res.status.calledWith(500)).to.be.true;
    });

    // TC-SEC-006: 金额为负验证
    it('应该验证金额不能为负', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.body = fixtures.paymentInitiateRequests.negativeAmountRequest;

      const mockEnrollment = { ...fixtures.testEnrollments.pendingPaymentEnrollment };

      EnrollmentStub.findOne.resolves(mockEnrollment);
      PaymentStub.findOne.resolves(null);

      PaymentStub.createOrder.rejects(new Error('金额不能为负'));

      await paymentController.initiatePayment(req, res, next);

      expect(res.status.calledWith(500)).to.be.true;
    });

    // TC-SEC-007: 权限检查 - 用户只能操作自己的报名
    it('应该返回404当用户尝试操作其他用户的报名', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.body = {
        enrollmentId: fixtures.testEnrollments.anotherUserEnrollment._id,
        paymentMethod: 'wechat',
        amount: 9900
      };

      // findOne 会根据 userId 和 enrollmentId 查询
      EnrollmentStub.findOne.resolves(null); // 没找到用户的报名

      await paymentController.initiatePayment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  // ============ confirmPayment 测试 ============
  describe('confirmPayment - 支付确认', () => {
    // TC-PAYMENT-006: 支付完成后自动更新报名状态
    it('应该确认支付并更新报名状态', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: fixtures.testPayments.pendingPayment._id };
      req.body = { transactionId: 'txn_123456' };

      const mockPayment = {
        _id: fixtures.testPayments.pendingPayment._id,
        userId: fixtures.testUsers.regularUser._id.toString(),
        enrollmentId: fixtures.testEnrollments.pendingPaymentEnrollment._id,
        status: 'pending',
        confirmPayment: sandbox.stub().resolves(),
        populate: sandbox.stub().returnsThis(),
        toObject: sandbox.stub().returns({})
      };

      const mockEnrollment = {
        _id: fixtures.testEnrollments.pendingPaymentEnrollment._id,
        paymentStatus: 'paid'
      };

      PaymentStub.findOne.resolves(mockPayment);
      EnrollmentStub.findByIdAndUpdate.resolves(mockEnrollment);

      await paymentController.confirmPayment(req, res, next);

      expect(mockPayment.confirmPayment.called).to.be.true;
      expect(EnrollmentStub.findByIdAndUpdate.called).to.be.true;
      expect(notificationControllerStub.createNotification.calledOnce).to.be.true;
      expect(subscribeMessageServiceStub.sendSceneMessage.calledOnce).to.be.true;
      expect(res.json.called).to.be.true;
    });

    // TC-PAYMENT-007: 支付已确认不能再确认
    it('应该返回400当支付已确认', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: fixtures.testPayments.completedPayment._id };
      req.body = { transactionId: 'txn_123456' };

      const mockPayment = {
        _id: fixtures.testPayments.completedPayment._id,
        userId: fixtures.testUsers.regularUser._id.toString(),
        status: 'completed'
      };

      PaymentStub.findOne.resolves(mockPayment);

      await paymentController.confirmPayment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.message).to.include('支付已确认');
    });

    // TC-SEC-005: 权限检查 - 支付不存在
    it('应该返回404当支付记录不存在', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: new mongoose.Types.ObjectId() };
      req.body = { transactionId: 'txn_123456' };

      PaymentStub.findOne.resolves(null);

      await paymentController.confirmPayment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  // ============ cancelPayment 测试 ============
  describe('cancelPayment - 支付取消', () => {
    // TC-PAYMENT-008: 取消待支付订单
    it('应该成功取消待支付的订单', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: fixtures.testPayments.pendingPayment._id };

      const mockPayment = {
        _id: fixtures.testPayments.pendingPayment._id,
        userId: fixtures.testUsers.regularUser._id.toString(),
        status: 'pending',
        markCancelled: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({})
      };

      PaymentStub.findOne.resolves(mockPayment);

      await paymentController.cancelPayment(req, res, next);

      expect(mockPayment.markCancelled.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    // TC-PAYMENT-009: 已完成的支付无法取消
    it('应该返回400当已完成的支付无法取消', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: fixtures.testPayments.completedPayment._id };

      const mockPayment = {
        _id: fixtures.testPayments.completedPayment._id,
        userId: fixtures.testUsers.regularUser._id.toString(),
        status: 'completed'
      };

      PaymentStub.findOne.resolves(mockPayment);

      await paymentController.cancelPayment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('无法取消');
    });

    // TC-SEC-005: 支付不存在返回 404
    it('应该返回404当支付记录不存在', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: new mongoose.Types.ObjectId() };

      PaymentStub.findOne.resolves(null);

      await paymentController.cancelPayment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  // ============ adminCancelPayment 测试 ============
  describe('adminCancelPayment - 管理员取消支付', () => {
    it('应该允许管理员取消待支付订单', async () => {
      req.user = { id: 'admin-001', role: 'admin', email: 'admin@test.com' };
      req.params = { paymentId: fixtures.testPayments.pendingPayment._id };

      const mockPayment = {
        _id: fixtures.testPayments.pendingPayment._id,
        status: 'pending',
        markCancelled: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({})
      };

      PaymentStub.findById.resolves(mockPayment);

      await paymentController.adminCancelPayment(req, res, next);

      expect(mockPayment.markCancelled.calledOnce).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该拒绝管理员直接取消已完成支付', async () => {
      req.user = { id: 'admin-001', role: 'admin', email: 'admin@test.com' };
      req.params = { paymentId: fixtures.testPayments.completedPayment._id };

      const mockPayment = {
        _id: fixtures.testPayments.completedPayment._id,
        status: 'completed'
      };

      PaymentStub.findById.resolves(mockPayment);

      await paymentController.adminCancelPayment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  // ============ adminResetPaymentToPending 测试 ============
  describe('adminResetPaymentToPending - 管理员重置为待支付', () => {
    it('应该将报名重置为待支付并取消相关订单', async () => {
      req.user = { id: 'admin-001', role: 'admin', email: 'admin@test.com' };
      req.params = { paymentId: fixtures.testPayments.completedPayment._id };

      const resetPayment = {
        _id: fixtures.testPayments.completedPayment._id,
        enrollmentId: fixtures.testEnrollments.paidEnrollment._id,
        status: 'completed',
        paidAt: new Date(),
        reconciled: true,
        reconciledAt: new Date(),
        wechat: {
          prepayId: 'prepay_1',
          transactionId: 'txn_1',
          successTime: new Date()
        },
        save: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({})
      };

      const relatedPendingPayment = {
        _id: fixtures.testPayments.pendingPayment._id,
        enrollmentId: fixtures.testEnrollments.paidEnrollment._id,
        status: 'pending',
        paidAt: null,
        reconciled: false,
        reconciledAt: null,
        wechat: {
          prepayId: 'prepay_pending'
        },
        save: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({})
      };

      const enrollment = {
        _id: fixtures.testEnrollments.paidEnrollment._id,
        paymentStatus: 'paid',
        paymentAmount: 9900,
        paidAt: new Date(),
        save: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({})
      };

      PaymentStub.findById.resolves(resetPayment);
      EnrollmentStub.findById.resolves(enrollment);
      PaymentStub.find.resolves([resetPayment, relatedPendingPayment]);

      await paymentController.adminResetPaymentToPending(req, res, next);

      expect(enrollment.paymentStatus).to.equal('pending');
      expect(enrollment.paymentAmount).to.equal(0);
      expect(enrollment.paidAt).to.equal(null);
      expect(enrollment.save.calledOnce).to.be.true;

      expect(resetPayment.status).to.equal('cancelled');
      expect(resetPayment.paidAt).to.equal(null);
      expect(resetPayment.reconciled).to.equal(false);
      expect(resetPayment.reconciledAt).to.equal(null);
      expect(resetPayment.wechat).to.deep.equal({});
      expect(resetPayment.save.calledOnce).to.be.true;

      expect(relatedPendingPayment.status).to.equal('cancelled');
      expect(relatedPendingPayment.save.calledOnce).to.be.true;

      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.data.paymentStatus).to.equal('pending');
      expect(response.data.cancelledPaymentCount).to.equal(2);
    });

    it('应该在支付记录不存在时返回404', async () => {
      req.user = { id: 'admin-001', role: 'admin', email: 'admin@test.com' };
      req.params = { paymentId: new mongoose.Types.ObjectId() };

      PaymentStub.findById.resolves(null);

      await paymentController.adminResetPaymentToPending(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该在报名记录不存在时返回404', async () => {
      req.user = { id: 'admin-001', role: 'admin', email: 'admin@test.com' };
      req.params = { paymentId: fixtures.testPayments.completedPayment._id };

      const resetPayment = {
        _id: fixtures.testPayments.completedPayment._id,
        enrollmentId: fixtures.testEnrollments.paidEnrollment._id
      };

      PaymentStub.findById.resolves(resetPayment);
      EnrollmentStub.findById.resolves(null);

      await paymentController.adminResetPaymentToPending(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  // ============ getPaymentStatus 测试 ============
  describe('getPaymentStatus - 查询支付状态', () => {
    // TC-PAYMENT-010: 查询支付状态
    it('应该返回支付状态', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: fixtures.testPayments.pendingPayment._id };

      const mockPayment = {
        _id: fixtures.testPayments.pendingPayment._id,
        userId: fixtures.testUsers.regularUser._id.toString(),
        orderNo: 'order123',
        status: 'completed',
        amount: 9900,
        paymentMethod: 'wechat',
        paidAt: new Date(),
        createdAt: new Date(),
        enrollmentId: { name: 'Enrollment 1' },
        periodId: { name: 'Period 1' }
      };

      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(mockPayment)
      };
      mockQuery.then = function (onFulfilled, onRejected) {
        return mockQuery.exec().then(onFulfilled, onRejected);
      };
      PaymentStub.findOne.returns(mockQuery);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('status');
    });

    // TC-SEC-005: 支付不存在返回 404
    it('应该返回404当支付记录不存在', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: new mongoose.Types.ObjectId() };

      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(null)
      };
      mockQuery.then = function (onFulfilled, onRejected) {
        return mockQuery.exec().then(onFulfilled, onRejected);
      };
      PaymentStub.findOne.returns(mockQuery);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  // ============ getUserPayments 测试 ============
  describe('getUserPayments - 获取用户支付历史', () => {
    it('应该返回用户的支付历史', async () => {
      req.params = { userId: fixtures.testUsers.regularUser._id };
      req.query = { page: 1, limit: 10 };

      const mockPayments = [fixtures.testPayments.completedPayment];

      const mockResult = {
        list: mockPayments,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      };

      PaymentStub.getUserPayments.resolves(mockResult);

      await paymentController.getUserPayments(req, res, next);

      expect(PaymentStub.getUserPayments.called).to.be.true;
      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.data.list).to.be.an('array');
    });

    it('应该支持按状态过滤', async () => {
      req.params = { userId: fixtures.testUsers.regularUser._id };
      req.query = { page: 1, limit: 10, status: 'completed' };

      const mockResult = {
        list: [fixtures.testPayments.completedPayment],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
      };

      PaymentStub.getUserPayments.resolves(mockResult);

      await paymentController.getUserPayments(req, res, next);

      // 验证调用时传入了 status 参数
      const callArgs = PaymentStub.getUserPayments.getCall(0).args;
      expect(callArgs[1].status).to.equal('completed');
    });
  });

  // ============ getPayments 管理员接口测试 ============
  describe('getPayments - 管理员获取支付列表 (TC-ADMIN-010)', () => {
    it('应该返回所有支付记录列表', async () => {
      req.query = { page: 1, limit: 20 };

      const mockPayments = [
        fixtures.testPayments.completedPayment,
        fixtures.testPayments.pendingPayment
      ];

      PaymentStub.countDocuments.resolves(2);
      PaymentStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        populate: sandbox.stub()
          .withArgs('enrollmentId', 'name')
          .returnsThis()
          .withArgs('periodId', 'name')
          .returnsThis(),
        select: sandbox.stub().resolves(mockPayments)
      });

      await paymentController.getPayments(req, res, next);

      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.data.list).to.be.an('array');
      expect(response.data.total).to.equal(2);
    });

    it('应该支持按状态搜索', async () => {
      req.query = { page: 1, limit: 20, status: 'completed' };

      const mockPayments = [fixtures.testPayments.completedPayment];

      PaymentStub.countDocuments.resolves(1);
      PaymentStub.find.withArgs({ status: 'completed' }).returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        populate: sandbox.stub()
          .withArgs('enrollmentId', 'name')
          .returnsThis()
          .withArgs('periodId', 'name')
          .returnsThis(),
        select: sandbox.stub().resolves(mockPayments)
      });

      await paymentController.getPayments(req, res, next);

      expect(PaymentStub.countDocuments.called).to.be.true;
    });

    it('应该支持按支付方法搜索', async () => {
      req.query = { page: 1, limit: 20, method: 'wechat' };

      const mockPayments = [fixtures.testPayments.completedPayment];

      PaymentStub.countDocuments.resolves(1);
      PaymentStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        populate: sandbox.stub()
          .withArgs('enrollmentId', 'name')
          .returnsThis()
          .withArgs('periodId', 'name')
          .returnsThis(),
        select: sandbox.stub().resolves(mockPayments)
      });

      await paymentController.getPayments(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  // ============ mockConfirmPayment 测试 ============
  describe('mockConfirmPayment - 模拟支付确认', () => {
    it('应该确认模拟支付', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: fixtures.testPayments.mockPayment._id };

      const mockPayment = {
        _id: fixtures.testPayments.mockPayment._id,
        userId: fixtures.testUsers.regularUser._id.toString(),
        paymentMethod: 'mock',
        enrollmentId: fixtures.testEnrollments.pendingPaymentEnrollment._id,
        status: 'pending',
        confirmPayment: sandbox.stub().resolves(),
        populate: sandbox.stub().returnsThis(),
        toObject: sandbox.stub().returns({})
      };

      const mockEnrollment = {
        ...fixtures.testEnrollments.pendingPaymentEnrollment,
        populate: sandbox.stub().returnsThis()
      };

      PaymentStub.findOne.resolves(mockPayment);
      EnrollmentStub.findByIdAndUpdate.resolves(mockEnrollment);

      await paymentController.mockConfirmPayment(req, res, next);

      expect(mockPayment.confirmPayment.called).to.be.true;
      expect(notificationControllerStub.createNotification.calledOnce).to.be.true;
      expect(subscribeMessageServiceStub.sendSceneMessage.calledOnce).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回400当非模拟支付', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: fixtures.testPayments.completedPayment._id };

      const mockPayment = {
        _id: fixtures.testPayments.completedPayment._id,
        userId: fixtures.testUsers.regularUser._id.toString(),
        paymentMethod: 'wechat'
      };

      PaymentStub.findOne.resolves(mockPayment);

      await paymentController.mockConfirmPayment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.message).to.include('仅模拟支付');
    });
  });

  // ============ wechatCallback 测试 ============
  describe('wechatCallback - 微信回调', () => {
    it('应该处理微信支付成功回调', async () => {
      req.body = fixtures.wechatCallbackRequests.successCallback;

      const mockPayment = {
        ...fixtures.testPayments.pendingPayment,
        userId: fixtures.testUsers.regularUser._id.toString(),
        confirmPayment: sandbox.stub().resolves(),
        populate: sandbox.stub().returnsThis(),
        toObject: sandbox.stub().returns({})
      };

      const mockEnrollment = {
        ...fixtures.testEnrollments.pendingPaymentEnrollment,
        populate: sandbox.stub().returnsThis()
      };

      PaymentStub.findOne.resolves(mockPayment);
      EnrollmentStub.findById.resolves(mockEnrollment);
      EnrollmentStub.findByIdAndUpdate.resolves(mockEnrollment);

      await paymentController.wechatCallback(req, res, next);

      expect(mockPayment.confirmPayment.called).to.be.true;
      expect(notificationControllerStub.createNotification.calledOnce).to.be.true;
      expect(subscribeMessageServiceStub.sendSceneMessage.calledOnce).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该处理微信支付失败回调', async () => {
      req.body = fixtures.wechatCallbackRequests.failureCallback;

      const mockPayment = {
        ...fixtures.testPayments.processingPayment,
        markFailed: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({})
      };

      PaymentStub.findOne.resolves(mockPayment);

      await paymentController.wechatCallback(req, res, next);

      expect(mockPayment.markFailed.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当订单不存在', async () => {
      req.body = fixtures.wechatCallbackRequests.nonExistentOrderCallback;

      PaymentStub.findOne.resolves(null);

      await paymentController.wechatCallback(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  // ============ 错误处理测试 ============
  describe('错误处理', () => {
    it('应该捕获数据库错误并返回500', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.body = fixtures.paymentInitiateRequests.validRequest;

      EnrollmentStub.findOne.rejects(new Error('Database error'));

      await paymentController.initiatePayment(req, res, next);

      expect(res.status.calledWith(500)).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.message).to.include('初始化支付失败');
    });

    it('应该捕获确认支付时的错误', async () => {
      req.user = { userId: fixtures.testUsers.regularUser._id.toString() };
      req.params = { paymentId: fixtures.testPayments.pendingPayment._id };
      req.body = { transactionId: 'txn_123456' };

      PaymentStub.findOne.rejects(new Error('Database error'));

      await paymentController.confirmPayment(req, res, next);

      expect(res.status.calledWith(500)).to.be.true;
    });
  });
});
