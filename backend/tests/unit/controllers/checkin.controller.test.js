/**
 * Checkin Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Checkin Controller', () => {
  let checkinController;
  let sandbox;
  let req;
  let res;
  let next;
  let CheckinStub;
  let UserStub;
  let SectionStub;
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

    // 创建 Stubs
    CheckinStub = {
      create: sandbox.stub(),
      findById: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub(),
      distinct: sandbox.stub(),
      aggregate: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub(),
      find: sandbox.stub()
    };

    SectionStub = {
      findById: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    const loggerStub = {
      debug: sandbox.stub(),
      error: sandbox.stub()
    };

    checkinController = proxyquire(
      '../../../src/controllers/checkin.controller',
      {
        '../models/Checkin': CheckinStub,
        '../models/User': UserStub,
        '../models/Section': SectionStub,
        '../models/Period': PeriodStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createCheckin', () => {
    it('应该创建打卡记录', async () => {
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();
      const sectionId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = {
        periodId,
        sectionId,
        day: 1,
        readingTime: 30,
        completionRate: 100,
        note: '很有收获',
        mood: '😊'
      };

      const mockSection = {
        _id: sectionId,
        checkinCount: 0,
        save: sandbox.stub().resolves()
      };

      const mockUser = {
        _id: userId,
        totalCheckinDays: 10,
        currentStreak: 5,
        maxStreak: 8,
        totalPoints: 100,
        save: sandbox.stub().resolves()
      };

      const mockCheckin = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        periodId,
        sectionId,
        points: 10,
        checkinDate: new Date()
      };

      SectionStub.findById.resolves(mockSection);
      UserStub.findById.resolves(mockUser);
      CheckinStub.findOne.resolves(null);
      CheckinStub.create.resolves(mockCheckin);

      await checkinController.createCheckin(req, res, next);

      expect(CheckinStub.create.called).to.be.true;
      expect(UserStub.findById.called).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
    });

    it('应该返回404当课节不存在', async () => {
      const userId = new mongoose.Types.ObjectId();
      const sectionId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = { sectionId, periodId: new mongoose.Types.ObjectId(), day: 1 };

      SectionStub.findById.resolves(null);

      await checkinController.createCheckin(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该更新用户的连续打卡数', async () => {
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();
      const sectionId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = {
        periodId,
        sectionId,
        day: 1,
        readingTime: 30,
        completionRate: 100
      };

      const mockSection = {
        _id: sectionId,
        checkinCount: 0,
        save: sandbox.stub().resolves()
      };

      const mockUser = {
        _id: userId,
        totalCheckinDays: 10,
        currentStreak: 5,
        maxStreak: 8,
        totalPoints: 100,
        save: sandbox.stub().resolves()
      };

      const mockCheckin = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        points: 10,
        checkinDate: new Date()
      };

      const mockYesterdayCheckin = {
        checkinDate: new Date(Date.now() - 86400000)
      };

      SectionStub.findById.resolves(mockSection);
      UserStub.findById.resolves(mockUser);
      CheckinStub.findOne.resolves(mockYesterdayCheckin);
      CheckinStub.create.resolves(mockCheckin);

      await checkinController.createCheckin(req, res, next);

      expect(mockUser.currentStreak).to.equal(6);
    });

    it('应该增加totalCheckinDays和totalPoints', async () => {
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();
      const sectionId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = {
        periodId,
        sectionId,
        day: 1
      };

      const mockSection = {
        _id: sectionId,
        checkinCount: 0,
        save: sandbox.stub().resolves()
      };

      const mockUser = {
        _id: userId,
        totalCheckinDays: 10,
        currentStreak: 1,
        maxStreak: 1,
        totalPoints: 100,
        save: sandbox.stub().resolves()
      };

      const mockCheckin = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        points: 10,
        checkinDate: new Date()
      };

      SectionStub.findById.resolves(mockSection);
      UserStub.findById.resolves(mockUser);
      CheckinStub.findOne.resolves(null);
      CheckinStub.create.resolves(mockCheckin);

      await checkinController.createCheckin(req, res, next);

      expect(mockUser.totalCheckinDays).to.equal(11);
      expect(mockUser.totalPoints).to.equal(110);
    });
  });

  describe('getUserCheckins', () => {
    it('应该返回用户的打卡列表', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.query = { page: 1, limit: 20 };

      const mockCheckins = [
        { _id: new mongoose.Types.ObjectId(), userId, note: '打卡1' }
      ];

      CheckinStub.countDocuments.resolves(1);
      CheckinStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockCheckins)
      });
      CheckinStub.find.onSecondCall().returns({
        select: sandbox.stub().resolves(mockCheckins)
      });

      await checkinController.getUserCheckins(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('stats');
    });

    it('应该计算统计信息', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.query = { page: 1, limit: 20 };

      const mockCheckins = [
        { _id: new mongoose.Types.ObjectId(), note: '有内容', likeCount: 5, isFeatured: true, checkinDate: new Date() },
        { _id: new mongoose.Types.ObjectId(), note: '', likeCount: 0, isFeatured: false, checkinDate: new Date() }
      ];

      CheckinStub.countDocuments.resolves(2);
      CheckinStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockCheckins)
      });
      CheckinStub.find.onSecondCall().returns({
        select: sandbox.stub().resolves(mockCheckins)
      });

      await checkinController.getUserCheckins(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.stats).to.have.property('diaryCount');
      expect(responseData.data.stats).to.have.property('likeCount');
    });

    it('应该支持按periodId过滤', async () => {
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.query = { page: 1, limit: 20, periodId };

      CheckinStub.countDocuments.resolves(0);
      CheckinStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });
      CheckinStub.find.onSecondCall().returns({
        select: sandbox.stub().resolves([])
      });

      await checkinController.getUserCheckins(req, res, next);

      const firstCall = CheckinStub.find.getCall(0).args[0];
      expect(firstCall).to.have.property('periodId');
      expect(firstCall.periodId.toString()).to.equal(periodId.toString());
    });
  });

  describe('getPeriodCheckins', () => {
    it('应该返回期次的公开打卡', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 20 };

      const mockPeriod = { _id: periodId, title: 'test period' };
      const mockCheckins = [
        { _id: new mongoose.Types.ObjectId(), isPublic: true, note: '公开打卡' }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.countDocuments.resolves(1);

      const populateStub = sandbox.stub().returnsThis();
      const sortStub = sandbox.stub().returnsThis();
      const skipStub = sandbox.stub().returnsThis();
      const limitStub = sandbox.stub().returnsThis();
      const selectStub = sandbox.stub().resolves(mockCheckins);

      populateStub.returns({ populate: sandbox.stub().returnsThis(), sort: sortStub });
      sortStub.returns({ skip: skipStub });
      skipStub.returns({ limit: limitStub });
      limitStub.returns({ select: selectStub });

      CheckinStub.find.returns({ populate: populateStub });

      await checkinController.getPeriodCheckins(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该只返回isPublic为true且有note的打卡', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 20 };

      const mockPeriod = { _id: periodId, title: 'test period' };
      const mockCheckins = [
        { _id: new mongoose.Types.ObjectId(), isPublic: true, note: '有内容的打卡' }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      CheckinStub.countDocuments.resolves(1);
      CheckinStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockCheckins)
      });

      await checkinController.getPeriodCheckins(req, res, next);

      const query = CheckinStub.find.getCall(0).args[0];
      expect(query.isPublic).to.equal(true);
      expect(res.json.called).to.be.true;
    });
  });

  describe('getCheckinDetail', () => {
    it('应该返回打卡详情', async () => {
      const checkinId = new mongoose.Types.ObjectId();
      req.params = { checkinId };

      const mockCheckin = {
        _id: checkinId,
        userId: new mongoose.Types.ObjectId(),
        note: '打卡详情'
      };

      const populateStub1 = sandbox.stub().returnsThis();
      const populateStub2 = sandbox.stub().returnsThis();
      const populateStub3 = sandbox.stub().resolves(mockCheckin);

      populateStub1.returns({ populate: populateStub2 });
      populateStub2.returns({ populate: populateStub3 });

      CheckinStub.findById.returns({ populate: populateStub1 });

      await checkinController.getCheckinDetail(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回404当打卡不存在', async () => {
      const checkinId = new mongoose.Types.ObjectId();
      req.params = { checkinId };

      const populateStub1 = sandbox.stub().returnsThis();
      const populateStub2 = sandbox.stub().returnsThis();
      const populateStub3 = sandbox.stub().resolves(null);

      populateStub1.returns({ populate: populateStub2 });
      populateStub2.returns({ populate: populateStub3 });

      CheckinStub.findById.returns({ populate: populateStub1 });

      await checkinController.getCheckinDetail(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('deleteCheckin', () => {
    it('应该删除用户自己的打卡', async () => {
      const userIdStr = '507f1f77bcf86cd799439011';
      const checkinId = new mongoose.Types.ObjectId();

      req.user = { userId: userIdStr };
      req.params = { checkinId };

      const mockCheckin = {
        _id: checkinId,
        userId: userIdStr,
        points: 10
      };

      const mockUser = {
        _id: userIdStr,
        totalCheckinDays: 10,
        totalPoints: 100,
        save: sandbox.stub().resolves()
      };

      CheckinStub.findById.resolves(mockCheckin);
      UserStub.findById.resolves(mockUser);
      CheckinStub.findByIdAndDelete.resolves(mockCheckin);

      await checkinController.deleteCheckin(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回403当删除他人的打卡', async () => {
      const userId = new mongoose.Types.ObjectId();
      const otherUserId = new mongoose.Types.ObjectId();
      const checkinId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { checkinId };

      const mockCheckin = {
        _id: checkinId,
        userId: otherUserId,
        points: 10
      };

      CheckinStub.findById.resolves(mockCheckin);

      await checkinController.deleteCheckin(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });

    it('应该返回404当打卡不存在', async () => {
      const userId = new mongoose.Types.ObjectId();
      const checkinId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { checkinId };

      CheckinStub.findById.resolves(null);

      await checkinController.deleteCheckin(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该更新用户的totalCheckinDays和totalPoints', async () => {
      const userIdStr = '507f1f77bcf86cd799439012';
      const checkinId = new mongoose.Types.ObjectId();

      req.user = { userId: userIdStr };
      req.params = { checkinId };

      const mockCheckin = {
        _id: checkinId,
        userId: userIdStr,
        points: 10
      };

      const mockUser = {
        _id: userIdStr,
        totalCheckinDays: 10,
        totalPoints: 100,
        save: sandbox.stub().resolves()
      };

      CheckinStub.findById.resolves(mockCheckin);
      UserStub.findById.resolves(mockUser);
      CheckinStub.findByIdAndDelete.resolves(mockCheckin);

      await checkinController.deleteCheckin(req, res, next);

      expect(mockUser.totalCheckinDays).to.equal(9);
      expect(mockUser.totalPoints).to.equal(90);
    });
  });

  describe('getAdminCheckins', () => {
    it('应该返回所有打卡记录', async () => {
      req.query = { page: 1, limit: 20 };

      const mockCheckins = [
        { _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId() }
      ];

      CheckinStub.countDocuments.resolves(1);
      CheckinStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockCheckins)
      });
      CheckinStub.find.onSecondCall().returns({
        select: sandbox.stub().resolves(mockCheckins)
      });

      await checkinController.getAdminCheckins(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('stats');
    });

    it('应该支持日期范围过滤', async () => {
      const dateFrom = '2025-01-01';
      const dateTo = '2025-12-31';
      req.query = { page: 1, limit: 20, dateFrom, dateTo };

      CheckinStub.countDocuments.resolves(0);
      CheckinStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });
      CheckinStub.find.onSecondCall().returns({
        select: sandbox.stub().resolves([])
      });

      await checkinController.getAdminCheckins(req, res, next);

      const query = CheckinStub.find.getCall(0).args[0];
      expect(query).to.have.property('checkinDate');
    });
  });

  describe('getCheckinStats', () => {
    it('应该返回打卡统计数据', async () => {
      req.query = {};

      CheckinStub.countDocuments.resolves(100);
      CheckinStub.distinct.resolves(['user1', 'user2']);
      CheckinStub.aggregate.resolves([
        {
          totalPoints: 1000,
          totalLikes: 50,
          featuredCount: 10
        }
      ]);

      await checkinController.getCheckinStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('totalCount');
      expect(responseData.data).to.have.property('uniqueUserCount');
    });

    it('应该计算平均积分', async () => {
      req.query = {};

      CheckinStub.countDocuments.resolves(100);
      CheckinStub.distinct.resolves(['user1', 'user2', 'user3', 'user4', 'user5']);
      CheckinStub.aggregate.resolves([
        {
          totalPoints: 1000,
          totalLikes: 50,
          featuredCount: 10
        }
      ]);

      await checkinController.getCheckinStats(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('averagePointsPerUser');
      expect(parseFloat(responseData.data.averagePointsPerUser)).to.equal(200);
    });
  });

  describe('getCheckins', () => {
    it('应该返回打卡列表', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.query = { periodId };

      const mockCheckins = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(),
          periodId,
          sectionId: new mongoose.Types.ObjectId(),
          checkinDate: new Date(),
          readingTime: 30,
          points: 10
        }
      ];

      CheckinStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockCheckins)
      });
      CheckinStub.countDocuments.resolves(1);

      await checkinController.getCheckins(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data.list.length).to.equal(1);
    });
  });

  describe('updateCheckin', () => {
    it('应该更新自己的打卡记录', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const checkinId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { checkinId };
      req.body = { readingTime: 45, note: '更新的笔记' };

      const mockCheckin = {
        _id: checkinId,
        userId,
        readingTime: 30,
        note: '原笔记',
        save: sandbox.stub().resolves()
      };

      CheckinStub.findById.resolves(mockCheckin);

      await checkinController.updateCheckin(req, res, next);

      expect(res.json.called).to.be.true;
      expect(mockCheckin.save.called).to.be.true;
    });

    it('应该返回403当更新他人的打卡', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const otherUserId = new mongoose.Types.ObjectId().toString();
      const checkinId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { checkinId };
      req.body = { readingTime: 45 };

      const mockCheckin = {
        _id: checkinId,
        userId: otherUserId, // 不同的用户
        readingTime: 30
      };

      CheckinStub.findById.resolves(mockCheckin);

      await checkinController.updateCheckin(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });

    it('应该返回404当打卡不存在', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const checkinId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { checkinId };
      req.body = { readingTime: 45 };

      CheckinStub.findById.resolves(null);

      await checkinController.updateCheckin(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('deleteAdminCheckin', () => {
    it('应该删除指定的打卡记录', async () => {
      const checkinId = new mongoose.Types.ObjectId();
      req.params = { checkinId };

      const mockCheckin = { _id: checkinId, userId: new mongoose.Types.ObjectId() };

      CheckinStub.findByIdAndDelete.resolves(mockCheckin);

      await checkinController.deleteAdminCheckin(req, res, next);

      expect(res.json.called).to.be.true;
      expect(CheckinStub.findByIdAndDelete.called).to.be.true;
    });

    it('应该返回404当打卡不存在', async () => {
      const checkinId = new mongoose.Types.ObjectId();
      req.params = { checkinId };

      CheckinStub.findByIdAndDelete.resolves(null);

      await checkinController.deleteAdminCheckin(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });
});
