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
      countDocuments: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg })
      }
    };

    paymentController = proxyquire(
      '../../../src/controllers/payment.controller',
      {
        '../models/Payment': PaymentStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createPayment', () => {
    it('应该创建支付记录', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.body = {
        amount: 99.99,
        description: '课程费用',
        paymentMethod: 'wechat'
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        ...req.body,
        status: 'pending'
      };

      PaymentStub.create.resolves(mockPayment);

      await paymentController.createPayment(req, res, next);

      expect(PaymentStub.create.called).to.be.true;
      expect(res.json.called).to.be.true;
    });
  });

  describe('getPaymentHistory', () => {
    it('应该返回用户的支付历史', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.query = { page: 1, limit: 10 };

      PaymentStub.countDocuments.resolves(1);
      PaymentStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await paymentController.getPaymentHistory(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getPaymentStats', () => {
    it('应该返回支付统计数据', async () => {
      req.query = {};

      PaymentStub.countDocuments.resolves(100);

      await paymentController.getPaymentStats(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('verifyPayment', () => {
    it('应该验证支付结果', async () => {
      const paymentId = new mongoose.Types.ObjectId();
      req.params = { paymentId };

      const mockPayment = {
        _id: paymentId,
        status: 'completed'
      };

      PaymentStub.findById.resolves(mockPayment);

      await paymentController.verifyPayment(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });
});
