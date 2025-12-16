/**
 * Ranking Controller 单元测试
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
  let UserStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = { query: {}, params: {}, user: {} };
    res = { json: sandbox.stub().returnsThis() };
    next = sandbox.stub();

    UserStub = {
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data })
    };

    rankingController = proxyquire(
      '../../../src/controllers/ranking.controller',
      {
        '../models/User': UserStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getPointsRanking', () => {
    it('应该返回积分排行榜', async () => {
      req.query = { page: 1, limit: 10 };

      const mockUsers = [
        { _id: new mongoose.Types.ObjectId(), nickname: '用户1', totalPoints: 1000 }
      ];

      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockUsers)
      });

      await rankingController.getPointsRanking(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
    });
  });

  describe('getStreakRanking', () => {
    it('应该返回连续打卡排行', async () => {
      req.query = { page: 1, limit: 10 };

      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await rankingController.getStreakRanking(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getLevelRanking', () => {
    it('应该返回等级排行榜', async () => {
      req.query = { page: 1, limit: 10 };

      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await rankingController.getLevelRanking(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getUserRanking', () => {
    it('应该返回用户在排行榜中的排名', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.query = { type: 'points' };

      UserStub.countDocuments.resolves(100);

      await rankingController.getUserRanking(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });
});
