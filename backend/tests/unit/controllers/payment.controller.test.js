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
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    EnrollmentStub = {
      findOne: sandbox.stub()
    };

    // Mock logger
    const loggerStub = {
      warn: sandbox.stub(),
      error: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub()
    };

    // Mock mysqlBackupService
    const mysqlBackupServiceStub = {
      syncPayment: sandbox.stub().resolves()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg }),
        serverError: (msg) => ({ code: 500, message: msg })
      }
    };

    paymentController = proxyquire(
      '../../../src/controllers/payment.controller',
      {
        '../models/Payment': PaymentStub,
        '../models/Enrollment': EnrollmentStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub,
        '../services/mysql-backup.service': mysqlBackupServiceStub
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

      req.user = { userId };
      req.body = { enrollmentId, paymentMethod: 'wechat', amount: 99 };

      const mockEnrollment = { _id: enrollmentId, userId };
      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        enrollmentId,
        status: 'pending',
        amount: 99
      };

      EnrollmentStub.findOne.resolves(mockEnrollment);
      PaymentStub.findOne.onFirstCall().resolves(null);
      PaymentStub.findOne.onSecondCall().resolves(null);
      PaymentStub.create.resolves(mockPayment);

      await paymentController.initiatePayment(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('confirmPayment', () => {
    it('应该确认支付', async () => {
      const paymentId = new mongoose.Types.ObjectId();

      req.params = { paymentId };
      req.body = { transactionId: 'tx123' };

      const mockPayment = {
        _id: paymentId,
        status: 'pending',
        save: sandbox.stub().resolves()
      };

      PaymentStub.findById.resolves(mockPayment);

      await paymentController.confirmPayment(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getPaymentStatus', () => {
    it('应该获取支付状态', async () => {
      const paymentId = new mongoose.Types.ObjectId();

      req.params = { paymentId };

      const mockPayment = {
        _id: paymentId,
        status: 'completed'
      };

      PaymentStub.findById.resolves(mockPayment);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getUserPayments', () => {
    it('应该返回用户的支付列表', async () => {
      const userId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.query = { page: 1, limit: 10 };

      const mockPayments = [
        { _id: new mongoose.Types.ObjectId(), userId, status: 'completed' }
      ];

      PaymentStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockPayments)
      });

      PaymentStub.countDocuments.resolves(1);

      await paymentController.getUserPayments(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });
});
