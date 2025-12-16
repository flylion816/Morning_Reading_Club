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

  describe('getPeriodStats', () => {
    it('应该返回期次统计数据', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      const mockPeriod = {
        _id: periodId,
        name: '第一期',
        enrolledCount: 100,
        capacity: 150
      };

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.countDocuments.resolves(80);
      CheckinStub.aggregate.resolves([
        { totalPoints: 800, uniqueUsers: 80 }
      ]);

      await statsController.getPeriodStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('enrolledCount');
      expect(responseData.data).to.have.property('checkinCount');
    });
  });

  describe('getTopUsers', () => {
    it('应该返回积分排行榜', async () => {
      req.query = { limit: 10 };

      const mockUsers = [
        { _id: new mongoose.Types.ObjectId(), nickname: '用户1', totalPoints: 1000 },
        { _id: new mongoose.Types.ObjectId(), nickname: '用户2', totalPoints: 900 }
      ];

      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockUsers)
      });

      await statsController.getTopUsers(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data.list).to.have.lengthOf(2);
    });
  });

  describe('getStreakStats', () => {
    it('应该返回连续打卡统计', async () => {
      req.query = { limit: 10 };

      const mockUsers = [
        { _id: new mongoose.Types.ObjectId(), nickname: '用户1', currentStreak: 30 },
        { _id: new mongoose.Types.ObjectId(), nickname: '用户2', currentStreak: 25 }
      ];

      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockUsers)
      });

      await statsController.getStreakStats(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getCheckinTrend', () => {
    it('应该返回打卡趋势数据', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { days: 30 };

      CheckinStub.aggregate.resolves([
        { date: '2025-01-01', count: 100 },
        { date: '2025-01-02', count: 95 }
      ]);

      await statsController.getCheckinTrend(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('trend');
    });
  });
});
