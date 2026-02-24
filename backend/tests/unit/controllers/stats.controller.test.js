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
  let EnrollmentStub;
  let PaymentStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: { userId: new mongoose.Types.ObjectId().toString() }
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    CheckinStub = {
      countDocuments: sandbox.stub(),
      aggregate: sandbox.stub(),
      find: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    EnrollmentStub = {
      countDocuments: sandbox.stub(),
      aggregate: sandbox.stub(),
      find: sandbox.stub()
    };

    PaymentStub = {
      countDocuments: sandbox.stub(),
      aggregate: sandbox.stub(),
      find: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        notFound: (msg) => ({ code: 404, message: msg }),
        internalServerError: (msg) => ({ code: 500, message: msg })
      }
    };

    statsController = proxyquire(
      '../../../src/controllers/stats.controller',
      {
        '../models/Checkin': CheckinStub,
        '../models/User': UserStub,
        '../models/Period': PeriodStub,
        '../models/Enrollment': EnrollmentStub,
        '../models/Payment': PaymentStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getDashboardStats', () => {
    it('应该返回仪表板统计数据', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      PeriodStub.countDocuments.resolves(5);
      PeriodStub.countDocuments.withArgs({
        startDate: { $lte: sinon.match.any },
        endDate: { $gte: sinon.match.any }
      }).resolves(2);

      EnrollmentStub.countDocuments.resolves(100);
      EnrollmentStub.countDocuments.withArgs({ approvalStatus: 'pending' }).resolves(10);
      EnrollmentStub.countDocuments.withArgs({ paymentStatus: 'paid' }).resolves(80);
      EnrollmentStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves([])
      });

      PaymentStub.aggregate.resolves([{ totalAmount: 10000 }]);

      UserStub.countDocuments.resolves(50);

      await statsController.getDashboardStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('totalPeriods');
      expect(responseData.data).to.have.property('totalEnrollments');
      expect(responseData.data).to.have.property('totalPaymentAmount');
    });
  });

  describe('getEnrollmentStats', () => {
    it('应该返回报名统计数据', async () => {
      const periodId = new mongoose.Types.ObjectId();

      // 修复：使用 EnrollmentStub.aggregate 而不是 CheckinStub.aggregate
      EnrollmentStub.aggregate
        .onFirstCall()
        .resolves([
          {
            _id: periodId,
            periodName: '第一期',
            total: 100,
            approved: 80,
            pending: 10,
            rejected: 10
          }
        ])
        .onSecondCall()
        .resolves([
          { gender: 'male', count: 60 },
          { gender: 'female', count: 40 }
        ])
        .onThirdCall()
        .resolves([
          { province: '北京', count: 30 }
        ])
        .onCall(3)
        .resolves([
          { _id: '20-30', count: 50 }
        ])
        .onCall(4)
        .resolves([
          { channel: '推荐', count: 60 },
          { channel: '直接报名', count: 40 }
        ]);

      await statsController.getEnrollmentStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('periodStats');
      expect(responseData.data).to.have.property('genderStats');
      expect(responseData.data).to.have.property('regionStats');
      expect(responseData.data).to.have.property('ageStats');
      expect(responseData.data).to.have.property('channelStats');
    });
  });

  describe('getPaymentStats', () => {
    it('应该返回支付统计数据', async () => {
      // 修复：使用 PaymentStub.aggregate 而不是 CheckinStub.aggregate
      PaymentStub.aggregate
        .onFirstCall()
        .resolves([
          {
            method: 'wechat',
            count: 50,
            totalAmount: 4950
          }
        ])
        .onSecondCall()
        .resolves([
          { status: 'completed', count: 80, totalAmount: 8000 },
          { status: 'pending', count: 10, totalAmount: 1000 }
        ])
        .onThirdCall()
        .resolves([
          { _id: '2026-02-24', count: 5, totalAmount: 500 }
        ])
        .onCall(3)
        .resolves([
          { totalAmount: 20000, totalCount: 100 }
        ]);

      PaymentStub.countDocuments.resolves(5);

      await statsController.getPaymentStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('paymentMethodStats');
      expect(responseData.data).to.have.property('statusStats');
      expect(responseData.data).to.have.property('paymentTrend');
      expect(responseData.data).to.have.property('totalPaymentAmount');
    });
  });

  describe('getCheckinStats', () => {
    it('应该返回用户打卡统计数据', async () => {
      const userId = req.user.userId;
      const periodId = new mongoose.Types.ObjectId().toString();
      req.query = { periodId };

      // Mock Checkin.countDocuments 和 Checkin.find
      CheckinStub.countDocuments.resolves(10);
      CheckinStub.find.returns({
        select: sandbox.stub().resolves([
          {
            readingTime: 30,
            checkinDate: new Date('2026-02-24')
          },
          {
            readingTime: 25,
            checkinDate: new Date('2026-02-25')
          }
        ])
      });

      await statsController.getCheckinStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('totalCheckins');
      expect(responseData.data).to.have.property('totalDuration');
      expect(responseData.data).to.have.property('averageDuration');
      expect(responseData.data).to.have.property('consistentDays');
    });
  });
});
