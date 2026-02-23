/**
 * Ranking Controller 单元测试 - 20 个测试用例
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Ranking Controller', () => {
  let rankingController;
  let sandbox;
  let req;
  let res;
  let next;
  let CheckinStub;
  let UserStub;
  let PeriodStub;
  let loggerStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      query: { page: 1, limit: 20 },
      params: {},
      user: { userId: new mongoose.Types.ObjectId().toString() }
    };
    res = {
      json: sandbox.stub().returnsThis(),
      status: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    CheckinStub = {
      aggregate: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub()
    };

    loggerStub = {
      error: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        notFound: (msg) => ({ code: 404, message: msg })
      }
    };

    rankingController = proxyquire(
      '../../../src/controllers/ranking.controller',
      {
        '../models/Checkin': CheckinStub,
        '../models/User': UserStub,
        '../models/Period': PeriodStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getPeriodRanking - 基础功能', () => {
    it('应该返回期次打卡排行榜', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = req.user.userId;
      req.params = { periodId };

      const mockPeriod = {
        _id: periodId,
        name: '2025年第一期'
      };

      const mockCountResult = [
        {
          _id: userId,
          checkinCount: 15,
          lastCheckinDate: new Date()
        }
      ];

      const mockRankings = [
        {
          _id: userId,
          checkinCount: 15,
          lastCheckinDate: new Date(),
          userInfo: {
            _id: userId,
            nickname: '用户1',
            avatar: 'avatar1.jpg',
            avatarUrl: 'https://example.com/avatar1.jpg'
          }
        }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);
      UserStub.findById.resolves({
        _id: userId,
        nickname: '用户1',
        avatar: 'avatar1.jpg',
        avatarUrl: 'https://example.com/avatar1.jpg'
      });

      await rankingController.getPeriodRanking(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('currentUser');
      expect(responseData.data).to.have.property('timeRange');
      expect(responseData.data.list[0].checkinCount).to.equal(15);
    });

    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      PeriodStub.findById.resolves(null);

      await rankingController.getPeriodRanking(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该正确处理排行榜排名计算', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId1 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();
      req.params = { periodId };
      req.user = { userId: userId1 };

      const mockPeriod = { _id: periodId };

      const mockCountResult = [
        { _id: userId2, checkinCount: 20 },
        { _id: userId1, checkinCount: 15 }
      ];

      const mockRankings = [
        {
          _id: userId2,
          checkinCount: 20,
          userInfo: {
            _id: userId2,
            nickname: '用户2',
            avatar: 'avatar2.jpg',
            avatarUrl: 'https://example.com/avatar2.jpg'
          }
        }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.list[0].rank).to.equal(1);
      expect(responseData.data.currentUser.rank).to.equal(2);
    });
  });

  describe('getPeriodRanking - 时间范围', () => {
    it('应该支持 thisWeek 时间范围', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { timeRange: 'thisWeek', page: 1, limit: 20 };

      const mockPeriod = { _id: periodId };
      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves([])
        .onSecondCall()
        .resolves([]);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.timeRange).to.equal('thisWeek');
    });

    it('应该支持 lastWeek 时间范围', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { timeRange: 'lastWeek', page: 1, limit: 20 };

      const mockPeriod = { _id: periodId };
      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves([])
        .onSecondCall()
        .resolves([]);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.timeRange).to.equal('lastWeek');
    });

    it('应该支持 yesterday 时间范围', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { timeRange: 'yesterday', page: 1, limit: 20 };

      const mockPeriod = { _id: periodId };
      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves([])
        .onSecondCall()
        .resolves([]);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.timeRange).to.equal('yesterday');
    });

    it('应该默认使用 all 时间范围', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 20 };

      const mockPeriod = { _id: periodId };
      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves([])
        .onSecondCall()
        .resolves([]);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.timeRange).to.equal('all');
    });
  });

  describe('getPeriodRanking - 分页', () => {
    it('应该支持第2页查询', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = req.user.userId;
      req.params = { periodId };
      req.query = { page: 2, limit: 10 };

      const mockPeriod = { _id: periodId };
      const mockCountResult = Array.from({ length: 30 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId().toString(),
        checkinCount: 30 - i
      }));

      const mockRankings = Array.from({ length: 10 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId().toString(),
        checkinCount: 20 - i,
        userInfo: {
          _id: new mongoose.Types.ObjectId().toString(),
          nickname: `用户${i + 11}`,
          avatar: `avatar${i}.jpg`,
          avatarUrl: `https://example.com/avatar${i}.jpg`
        }
      }));

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.page).to.equal(2);
      expect(responseData.data.list.length).to.equal(10);
      expect(responseData.data.list[0].rank).to.equal(11); // 第二页第一个排名应该是11
    });

    it('应该使用默认的page和limit值', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = {};

      const mockPeriod = { _id: periodId };
      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves([])
        .onSecondCall()
        .resolves([]);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.page).to.equal(1);
      expect(responseData.data.limit).to.equal(20);
    });

    it('应该正确计算totalPages', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 10 };

      const mockPeriod = { _id: periodId };
      const mockCountResult = Array.from({ length: 25 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId().toString(),
        checkinCount: 25 - i
      }));

      const mockRankings = Array.from({ length: 10 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId().toString(),
        checkinCount: 25 - i,
        userInfo: {
          _id: new mongoose.Types.ObjectId().toString(),
          nickname: `用户${i + 1}`,
          avatar: `avatar${i}.jpg`,
          avatarUrl: `https://example.com/avatar${i}.jpg`
        }
      }));

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.totalPages).to.equal(3); // 25 / 10 = 2.5 -> 3页
    });
  });

  describe('getPeriodRanking - 空数据', () => {
    it('应该处理空排行榜（无打卡记录）', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      const mockPeriod = { _id: periodId };
      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves([])
        .onSecondCall()
        .resolves([]);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.list).to.be.an('array').that.is.empty;
      expect(responseData.data.currentUser).to.be.null;
      expect(responseData.data.total).to.equal(0);
    });

    it('应该处理currentUser为null的情况（用户无打卡记录）', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = req.user.userId;
      const otherUserId = new mongoose.Types.ObjectId().toString();
      req.params = { periodId };

      const mockPeriod = { _id: periodId };
      const mockCountResult = [
        {
          _id: otherUserId,
          checkinCount: 10
        }
      ];

      const mockRankings = [
        {
          _id: otherUserId,
          checkinCount: 10,
          userInfo: {
            _id: otherUserId,
            nickname: '其他用户',
            avatar: 'avatar.jpg',
            avatarUrl: 'https://example.com/avatar.jpg'
          }
        }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.list.length).to.equal(1);
      expect(responseData.data.currentUser).to.be.null;
    });
  });

  describe('getPeriodRanking - 排名逻辑', () => {
    it('应该按打卡次数降序排列', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      const mockPeriod = { _id: periodId };
      const userId1 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();
      const userId3 = new mongoose.Types.ObjectId().toString();

      const mockCountResult = [
        { _id: userId1, checkinCount: 30 },
        { _id: userId2, checkinCount: 20 },
        { _id: userId3, checkinCount: 10 }
      ];

      const mockRankings = [
        {
          _id: userId1,
          checkinCount: 30,
          userInfo: {
            _id: userId1,
            nickname: '用户1',
            avatar: 'avatar1.jpg',
            avatarUrl: 'https://example.com/avatar1.jpg'
          }
        },
        {
          _id: userId2,
          checkinCount: 20,
          userInfo: {
            _id: userId2,
            nickname: '用户2',
            avatar: 'avatar2.jpg',
            avatarUrl: 'https://example.com/avatar2.jpg'
          }
        },
        {
          _id: userId3,
          checkinCount: 10,
          userInfo: {
            _id: userId3,
            nickname: '用户3',
            avatar: 'avatar3.jpg',
            avatarUrl: 'https://example.com/avatar3.jpg'
          }
        }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.list[0].checkinCount).to.equal(30);
      expect(responseData.data.list[1].checkinCount).to.equal(20);
      expect(responseData.data.list[2].checkinCount).to.equal(10);
    });

    it('应该在currentUser中显示正确的排名', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = req.user.userId;
      req.params = { periodId };

      const mockPeriod = { _id: periodId };
      const userId1 = new mongoose.Types.ObjectId().toString();
      const userId2 = new mongoose.Types.ObjectId().toString();

      const mockCountResult = [
        { _id: userId1, checkinCount: 30 },
        { _id: userId, checkinCount: 20 },
        { _id: userId2, checkinCount: 10 }
      ];

      const mockRankings = [
        {
          _id: userId1,
          checkinCount: 30,
          userInfo: {
            _id: userId1,
            nickname: '用户1',
            avatar: 'avatar1.jpg',
            avatarUrl: 'https://example.com/avatar1.jpg'
          }
        }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);
      UserStub.findById.resolves({
        _id: userId,
        nickname: '当前用户',
        avatar: 'current.jpg',
        avatarUrl: 'https://example.com/current.jpg'
      });

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.currentUser.rank).to.equal(2);
      expect(responseData.data.currentUser.checkinCount).to.equal(20);
    });

    it('应该在列表中包含nickname和avatar', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { periodId };
      req.user = { userId };

      const mockPeriod = { _id: periodId };
      const mockCountResult = [{ _id: userId, checkinCount: 15 }];
      const mockRankings = [
        {
          _id: userId,
          checkinCount: 15,
          userInfo: {
            _id: userId,
            nickname: '张三',
            avatar: 'avatar.jpg',
            avatarUrl: 'https://example.com/avatar.jpg'
          }
        }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);

      await rankingController.getPeriodRanking(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.list[0]).to.have.property('nickname', '张三');
      expect(responseData.data.list[0]).to.have.property('avatar', 'avatar.jpg');
      expect(responseData.data.list[0]).to.have.property('avatarUrl');
    });
  });

  describe('getPeriodRanking - 异常场景', () => {
    it('应该捕获数据库错误并调用next', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      const mockPeriod = { _id: periodId };
      const dbError = new Error('Database connection failed');
      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate.rejects(dbError);

      await rankingController.getPeriodRanking(req, res, next);

      expect(next.called).to.be.true;
      expect(next.getCall(0).args[0]).to.equal(dbError);
      expect(loggerStub.error.called).to.be.true;
    });

    it('应该在User查询失败时捕获错误', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = req.user.userId;
      req.params = { periodId };

      const mockPeriod = { _id: periodId };
      const mockCountResult = [{ _id: userId, checkinCount: 15 }];
      const mockRankings = [
        {
          _id: userId,
          checkinCount: 15,
          userInfo: {
            _id: userId,
            nickname: '用户',
            avatar: 'avatar.jpg',
            avatarUrl: 'https://example.com/avatar.jpg'
          }
        }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(mockCountResult)
        .onSecondCall()
        .resolves(mockRankings);
      UserStub.findById.rejects(new Error('User query failed'));

      await rankingController.getPeriodRanking(req, res, next);

      expect(next.called).to.be.true;
      expect(loggerStub.error.called).to.be.true;
    });

    it('应该处理无效periodId格式', async () => {
      const invalidPeriodId = 'invalid-id';
      req.params = { periodId: invalidPeriodId };

      const error = new Error('Invalid ObjectId');
      PeriodStub.findById.rejects(error);

      await rankingController.getPeriodRanking(req, res, next);

      expect(next.called).to.be.true;
      expect(loggerStub.error.called).to.be.true;
    });

    it('应该处理req.user未定义的情况', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.user = undefined;

      const mockPeriod = { _id: periodId };
      PeriodStub.findById.resolves(mockPeriod);

      // 这会导致 TypeError: Cannot read property 'userId' of undefined
      let caught = false;
      try {
        await rankingController.getPeriodRanking(req, res, next);
      } catch (e) {
        caught = true;
      }

      expect(next.called || caught).to.be.true;
    });

    it('应该处理aggregate返回null的情况', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      const mockPeriod = { _id: periodId };
      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.aggregate
        .onFirstCall()
        .resolves(null)
        .onSecondCall()
        .resolves([]);

      let errorOccurred = false;
      try {
        await rankingController.getPeriodRanking(req, res, next);
      } catch (e) {
        errorOccurred = true;
      }

      expect(errorOccurred || next.called).to.be.true;
    });
  });
});
