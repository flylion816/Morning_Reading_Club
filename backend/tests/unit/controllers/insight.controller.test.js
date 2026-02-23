/**
 * Insight Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Insight Controller', () => {
  let insightController;
  let sandbox;
  let req;
  let res;
  let next;
  let InsightStub;
  let UserStub;

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

    InsightStub = {
      create: sandbox.stub(),
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub()
    };

    const InsightRequestStub = {
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
      syncInsight: sandbox.stub().resolves()
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

    insightController = proxyquire(
      '../../../src/controllers/insight.controller',
      {
        '../models/Insight': InsightStub,
        '../models/User': UserStub,
        '../models/InsightRequest': InsightRequestStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub,
        '../services/mysql-backup.service': mysqlBackupServiceStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createInsightManual', () => {
    it('应该创建新的小凡看见', async () => {
      const userId = new mongoose.Types.ObjectId();
      const targetUserId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = {
        targetUserId,
        periodId,
        type: 'insight',
        mediaType: 'text',
        content: '我看到你的努力'
      };

      const mockInsight = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        targetUserId,
        periodId,
        type: 'insight',
        mediaType: 'text',
        content: '我看到你的努力'
      };

      InsightStub.create.resolves(mockInsight);

      await insightController.createInsightManual(req, res, next);

      expect(InsightStub.create.called).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
    });

    it('应该返回400当缺少必填字段', async () => {
      const userId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = { targetUserId: new mongoose.Types.ObjectId() };

      await insightController.createInsightManual(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('getInsightDetail', () => {
    it('应该返回小凡看见详情', async () => {
      const insightId = new mongoose.Types.ObjectId();
      req.params = { insightId };

      const mockInsight = {
        _id: insightId,
        content: '我看到你的努力',
        likeCount: 10,
        commentCount: 5
      };

      // 创建可链式调用的mock，第4次populate后返回resolved promise
      const chainableMock = {};
      let populateCallCount = 0;

      chainableMock.populate = sandbox.stub().callsFake(function() {
        populateCallCount++;
        if (populateCallCount === 4) {
          return Promise.resolve(mockInsight);
        }
        return chainableMock;
      });

      InsightStub.findById.returns(chainableMock);

      await insightController.getInsightDetail(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回404当小凡看见不存在', async () => {
      const insightId = new mongoose.Types.ObjectId();
      req.params = { insightId };

      // 创建可链式调用的mock，第4次populate后返回null
      const chainableMock = {};
      let populateCallCount = 0;

      chainableMock.populate = sandbox.stub().callsFake(function() {
        populateCallCount++;
        if (populateCallCount === 4) {
          return Promise.resolve(null);
        }
        return chainableMock;
      });

      InsightStub.findById.returns(chainableMock);

      await insightController.getInsightDetail(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getUserInsights', () => {
    it('应该返回用户收到的小凡看见', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.user = { userId }; // 用户查看自己的insights
      req.query = { page: 1, limit: 10 };

      const mockInsights = [
        { _id: new mongoose.Types.ObjectId(), targetUserId: userId, content: '看见1' }
      ];

      // 创建可链式调用的mock
      const findChain = {};
      const chainStubs = {};
      ['populate', 'populate', 'populate', 'populate', 'sort', 'skip', 'limit', 'select'];

      chainStubs.populate1 = sandbox.stub().returnsThis();
      chainStubs.populate2 = sandbox.stub().returnsThis();
      chainStubs.populate3 = sandbox.stub().returnsThis();
      chainStubs.populate4 = sandbox.stub().returnsThis();
      chainStubs.sort = sandbox.stub().returnsThis();
      chainStubs.skip = sandbox.stub().returnsThis();
      chainStubs.limit = sandbox.stub().returnsThis();
      chainStubs.select = sandbox.stub().resolves(mockInsights);

      let populateCount = 0;
      findChain.populate = sandbox.stub().callsFake(function() {
        populateCount++;
        return findChain;
      });
      findChain.sort = chainStubs.sort;
      findChain.skip = chainStubs.skip;
      findChain.limit = chainStubs.limit;
      findChain.select = chainStubs.select;

      InsightStub.countDocuments.resolves(1);
      InsightStub.find.returns(findChain);

      await insightController.getUserInsights(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
    });
  });

  describe('getInsightsForPeriod', () => {
    it('应该返回期次中的小凡看见', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.user = { userId };
      req.query = { page: 1, limit: 10 };

      const mockInsights = [
        { _id: new mongoose.Types.ObjectId(), periodId, content: '看见' }
      ];

      InsightStub.countDocuments.resolves(1);
      InsightStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockInsights)
      });

      await insightController.getInsightsForPeriod(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('updateInsight', () => {
    it('应该更新用户自己的小凡看见', async () => {
      const userId = new mongoose.Types.ObjectId();
      const insightId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { insightId };
      req.body = { content: '更新内容' };

      const mockInsight = {
        _id: insightId,
        userId: userId.toString(),
        content: '更新内容'
      };

      InsightStub.findById.resolves(mockInsight);
      InsightStub.findByIdAndUpdate.resolves(mockInsight);

      await insightController.updateInsight(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回403当修改他人的小凡看见', async () => {
      const userId = new mongoose.Types.ObjectId();
      const otherUserId = new mongoose.Types.ObjectId();
      const insightId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { insightId };
      req.body = { content: '更新内容' };

      const mockInsight = {
        _id: insightId,
        userId: otherUserId.toString()
      };

      InsightStub.findById.resolves(mockInsight);

      await insightController.updateInsight(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });

    it('应该返回404当小凡看见不存在', async () => {
      const userId = new mongoose.Types.ObjectId();
      const insightId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { insightId };
      req.body = { content: '更新内容' };

      InsightStub.findById.resolves(null);

      await insightController.updateInsight(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('deleteInsight', () => {
    it('应该删除用户自己的小凡看见', async () => {
      const userIdStr = '507f1f77bcf86cd799439013';
      const insightId = new mongoose.Types.ObjectId();

      req.user = { userId: userIdStr };
      req.params = { insightId };

      const mockInsight = {
        _id: insightId,
        userId: userIdStr
      };

      InsightStub.findById.resolves(mockInsight);
      InsightStub.findByIdAndDelete.resolves(mockInsight);

      await insightController.deleteInsight(req, res, next);

      expect(InsightStub.findByIdAndDelete.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回403当删除他人的小凡看见', async () => {
      const userId = new mongoose.Types.ObjectId();
      const otherUserId = new mongoose.Types.ObjectId();
      const insightId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { insightId };

      const mockInsight = {
        _id: insightId,
        userId: otherUserId.toString()
      };

      InsightStub.findById.resolves(mockInsight);

      await insightController.deleteInsight(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });
  });

  describe('likeInsight', () => {
    it('应该增加小凡看见的点赞数', async () => {
      const insightId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      req.params = { insightId };
      req.user = { userId };
      req.body = { action: 'like' };

      const mockInsight = {
        _id: insightId,
        likeCount: 10,
        likes: [
          { userId: new mongoose.Types.ObjectId() }
        ],
        save: sandbox.stub().resolves()
      };

      InsightStub.findById.resolves(mockInsight);

      await insightController.likeInsight(req, res, next);

      expect(mockInsight.likes.length).to.equal(2);
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当小凡看见不存在', async () => {
      const insightId = new mongoose.Types.ObjectId();
      req.params = { insightId };

      InsightStub.findById.resolves(null);

      await insightController.likeInsight(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });
});
