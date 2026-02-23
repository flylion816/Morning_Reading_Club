/**
 * Stats Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Stats Controller', () => {
  let statsController;
  let sandbox;
  let req;
  let res;
  let next;
  let CheckinStub;
  let UserStub;
  let PeriodStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: {}
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    CheckinStub = {
      countDocuments: sandbox.stub(),
      aggregate: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub(),
      find: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        notFound: (msg) => ({ code: 404, message: msg })
      }
    };

    statsController = proxyquire(
      '../../../src/controllers/stats.controller',
      {
        '../models/Checkin': CheckinStub,
        '../models/User': UserStub,
        '../models/Period': PeriodStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getDashboardStats', () => {
    it('应该返回仪表板统计数据', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };

      const mockUser = {
        _id: userId,
        totalCheckinDays: 100,
        currentStreak: 30,
        maxStreak: 60,
        totalPoints: 1000,
        level: 5
      };

      UserStub.findById.resolves(mockUser);
      CheckinStub.countDocuments.resolves(100);

      await statsController.getDashboardStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('totalCheckinDays');
      expect(responseData.data).to.have.property('currentStreak');
    });

    it('应该返回404当用户不存在', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };

      UserStub.findById.resolves(null);

      await statsController.getDashboardStats(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getEnrollmentStats', () => {
    it('应该返回报名统计数据', async () => {
      CheckinStub.aggregate.resolves([
        {
          _id: new mongoose.Types.ObjectId(),
          periodName: '第一期',
          total: 100,
          approved: 80,
          pending: 10,
          rejected: 10
        }
      ]);

      await statsController.getEnrollmentStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('periodStats');
    });
  });

  describe('getPaymentStats', () => {
    it('应该返回支付统计数据', async () => {
      CheckinStub.aggregate.resolves([
        {
          method: 'wechat',
          count: 50,
          totalAmount: 4950
        }
      ]);

      await statsController.getPaymentStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('paymentMethodStats');
    });
  });

  describe('getCheckinStats', () => {
    it('应该返回打卡统计数据', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.query = { periodId };

      CheckinStub.aggregate.resolves([
        {
          _id: periodId,
          count: 100
        }
      ]);

      await statsController.getCheckinStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('periodCheckinStats');
    });
  });
});
