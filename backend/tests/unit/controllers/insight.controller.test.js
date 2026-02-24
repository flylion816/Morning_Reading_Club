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
  let InsightRequestStub;

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

    InsightRequestStub = {
      findOne: sandbox.stub()
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

    const loggerStub = {
      debug: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub()
    };

    insightController = proxyquire(
      '../../../src/controllers/insight.controller',
      {
        '../models/Insight': InsightStub,
        '../models/User': UserStub,
        '../models/InsightRequest': InsightRequestStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub
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
        ...req.body,
        userId,
        status: 'completed'
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
        likeCount: 10
      };

      InsightStub.findById.returns({
        populate: sandbox.stub().returnsThis(),
        populate: sandbox.stub().returnsThis(),
        populate: sandbox.stub().returnsThis(),
        resolves: sandbox.stub().resolves(mockInsight)
      });

      await insightController.getInsightDetail(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回404当小凡看见不存在', async () => {
      const insightId = new mongoose.Types.ObjectId();
      req.params = { insightId };

      const populateStub = sandbox.stub().returnsThis();
      InsightStub.findById.returns({
        populate: populateStub
      });
      // 模拟第三次 populate 后直接返回 null
      populateStub.onThirdCall().returnsThis();
      populateStub.returns({
        populate: sandbox.stub().returnsThis()
      });

      // 最后让最终的链返回 null
      InsightStub.findById.withArgs(insightId).returns({
        populate: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(null)
      });

      await insightController.getInsightDetail(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getUserInsights', () => {
    it('应该返回用户收到的小凡看见', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { userId };
      req.query = { page: 1, limit: 10 };

      const mockInsights = [
        { _id: new mongoose.Types.ObjectId(), targetUserId: userId, content: '看见1' }
      ];

      InsightStub.countDocuments.resolves(1);
      InsightStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockInsights)
      });

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
      req.user = { userId: userId.toString() };
      req.params = { insightId };
      req.body = { action: 'like' };

      const mockInsight = {
        _id: insightId,
        likeCount: 10,
        likes: [],
        save: sandbox.stub().resolves()
      };

      InsightStub.findById.resolves(mockInsight);

      await insightController.likeInsight(req, res, next);

      expect(mockInsight.likes.length).to.equal(1);
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
