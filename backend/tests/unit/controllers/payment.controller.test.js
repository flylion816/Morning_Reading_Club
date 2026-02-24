/**
 * Payment Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Payment Controller', () => {
  let paymentController;
  let sandbox;
  let req;
  let res;
  let next;
  let PaymentStub;
  let EnrollmentStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = { body: {}, params: {}, query: {}, user: {} };
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
      countDocuments: sandbox.stub(),
      // Static methods
      getUserPayments: sandbox.stub(),
      createOrder: sandbox.stub(),
      getPaymentStatus: sandbox.stub()
    };

    EnrollmentStub = {
      findOne: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
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
        '../utils/logger': loggerStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('initiatePayment', () => {
    it('应该初始化支付订单', async () => {
      const userId = new mongoose.Types.ObjectId();
      const enrollmentId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.body = {
        enrollmentId,
        paymentMethod: 'wechat',
        amount: 99
      };

      const mockEnrollment = {
        _id: enrollmentId,
        userId,
        periodId,
        status: 'active'
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        enrollmentId,
        periodId,
        amount: 99,
        paymentMethod: 'wechat',
        status: 'pending',
        orderNo: 'ORDER_123456'
      };

      // Mock the enrollment check
      EnrollmentStub.findOne.resolves(mockEnrollment);

      // Mock Payment.findOne to check for pending/processing payments
      PaymentStub.findOne.resolves(null);

      // Mock Payment.createOrder static method
      PaymentStub.createOrder.resolves(mockPayment);

      await paymentController.initiatePayment(req, res, next);

      expect(EnrollmentStub.findOne.called).to.be.true;
      expect(PaymentStub.findOne.called).to.be.true;
      expect(PaymentStub.createOrder.called).to.be.true;
      expect(res.json.called).to.be.true;
    });
  });

  describe('getUserPayments', () => {
    it('应该返回用户的支付历史', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.query = { page: 1, limit: 10 };

      const mockPayments = [{
        _id: new mongoose.Types.ObjectId(),
        userId,
        amount: 99,
        status: 'completed',
        orderNo: 'ORDER_123456',
        paymentMethod: 'wechat',
        paidAt: new Date(),
        createdAt: new Date(),
        enrollmentId: { name: 'Enrollment 1' },
        periodId: { name: 'Period 1' }
      }];

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
    });
  });

  describe('confirmPayment', () => {
    it('应该确认支付', async () => {
      const userId = new mongoose.Types.ObjectId();
      const paymentId = new mongoose.Types.ObjectId();
      const enrollmentId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { paymentId };
      req.body = { transactionId: 'txn_123456' };

      const mockPayment = {
        _id: paymentId,
        userId,
        enrollmentId,
        status: 'pending',
        confirmPayment: sandbox.stub().resolves(),
        populate: sandbox.stub().resolves()
      };

      const mockEnrollment = {
        _id: enrollmentId,
        paymentStatus: 'paid'
      };

      PaymentStub.findOne.resolves(mockPayment);
      EnrollmentStub.findByIdAndUpdate.resolves(mockEnrollment);

      await paymentController.confirmPayment(req, res, next);

      expect(PaymentStub.findOne.called).to.be.true;
      expect(mockPayment.confirmPayment.called).to.be.true;
      expect(res.json.called).to.be.true;
    });
  });

  describe('cancelPayment', () => {
    it('应该取消待支付的订单', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const paymentId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { paymentId };

      const mockPayment = {
        _id: paymentId,
        userId,
        status: 'pending',
        markCancelled: sandbox.stub().resolves()
      };

      PaymentStub.findOne.resolves(mockPayment);

      await paymentController.cancelPayment(req, res, next);

      expect(res.json.called).to.be.true;
      expect(mockPayment.markCancelled.called).to.be.true;
    });

    it('应该返回400当已完成的支付无法取消', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const paymentId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { paymentId };

      const mockPayment = {
        _id: paymentId,
        userId,
        status: 'completed'
      };

      PaymentStub.findOne.resolves(mockPayment);

      await paymentController.cancelPayment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('无法取消');
    });

    it('应该返回404当支付记录不存在', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const paymentId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { paymentId };

      PaymentStub.findOne.resolves(null);

      await paymentController.cancelPayment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getPaymentStatus', () => {
    it('应该返回支付状态', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const paymentId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { paymentId };

      const mockPayment = {
        _id: paymentId,
        userId,
        orderNo: 'order123',
        status: 'completed',
        amount: 99,
        paymentMethod: 'wechat',
        paidAt: new Date()
      };

      // 创建支持链式调用和 await 的 Query 对象
      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(mockPayment)
      };
      // 添加 then 方法使其成为 Thenable（支持 await）
      mockQuery.then = function(onFulfilled, onRejected) {
        return mockQuery.exec().then(onFulfilled, onRejected);
      };
      PaymentStub.findOne.returns(mockQuery);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('status');
    });

    it('应该返回404当支付记录不存在', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const paymentId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { paymentId };

      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(null)
      };
      mockQuery.then = function(onFulfilled, onRejected) {
        return mockQuery.exec().then(onFulfilled, onRejected);
      };
      PaymentStub.findOne.returns(mockQuery);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });
});
