/**
 * User Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('User Controller', () => {
  let userController;
  let sandbox;
  let req;
  let res;
  let next;
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

    UserStub = {
      findById: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    userController = proxyquire(
      '../../../src/controllers/user.controller',
      {
        '../models/User': UserStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getCurrentUser', () => {
    it('应该返回当前用户信息', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };

      const mockUser = {
        _id: userId,
        openid: 'test_openid',
        nickname: '测试用户',
        avatar: '🦁',
        avatarUrl: 'https://example.com/avatar.jpg',
        signature: '我是测试用户',
        gender: 'male',
        totalCheckinDays: 10,
        currentStreak: 5,
        maxStreak: 8,
        totalCompletedPeriods: 2,
        totalPoints: 100,
        level: 2,
        role: 'user',
        status: 'active',
        createdAt: new Date()
      };

      UserStub.findById.resolves(mockUser);

      await userController.getCurrentUser(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.data).to.have.property('_id');
      expect(responseData.data).to.have.property('nickname');
      expect(responseData.data).to.have.property('totalCheckinDays');
    });

    it('应该返回404当用户不存在', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };

      UserStub.findById.resolves(null);

      await userController.getCurrentUser(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该返回403当用户被禁用', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };

      const mockUser = {
        _id: userId,
        status: 'inactive'
      };

      UserStub.findById.resolves(mockUser);

      await userController.getCurrentUser(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });
  });

  describe('updateProfile', () => {
    it('应该更新用户资料', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.body = {
        nickname: '新昵称',
        signature: '新签名',
        gender: 'female'
      };

      const mockUser = {
        _id: userId,
        nickname: '旧昵称',
        avatar: '🦁',
        avatarUrl: '',
        signature: '旧签名',
        gender: 'male',
        save: sandbox.stub().resolves()
      };

      UserStub.findById.resolves(mockUser);

      await userController.updateProfile(req, res, next);

      expect(mockUser.save.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当用户不存在', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.body = { nickname: '新昵称' };

      UserStub.findById.resolves(null);

      await userController.updateProfile(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该只更新提供的字段', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.body = { nickname: '新昵称' };

      const mockUser = {
        _id: userId,
        nickname: '旧昵称',
        avatar: '🦁',
        avatarUrl: '',
        signature: '签名',
        gender: 'male',
        save: sandbox.stub().resolves()
      };

      UserStub.findById.resolves(mockUser);

      await userController.updateProfile(req, res, next);

      expect(mockUser.nickname).to.equal('新昵称');
    });
  });

  describe('getUserById', () => {
    it('应该返回指定用户的信息', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };

      const mockUser = {
        _id: targetUserId,
        nickname: '其他用户',
        avatar: '🐢',
        avatarUrl: 'https://example.com/avatar2.jpg',
        signature: '我是其他用户',
        gender: 'female',
        totalCheckinDays: 20,
        currentStreak: 10,
        maxStreak: 15,
        totalCompletedPeriods: 3,
        totalPoints: 200,
        level: 3,
        status: 'active',
        createdAt: new Date()
      };

      UserStub.findById.resolves(mockUser);

      await userController.getUserById(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.nickname).to.equal('其他用户');
    });

    it('应该返回400当userId为空', async () => {
      req.params = { userId: '' };

      await userController.getUserById(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该返回404当用户不存在', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };

      UserStub.findById.resolves(null);

      await userController.getUserById(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该返回403当用户被禁用', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };

      const mockUser = {
        _id: targetUserId,
        status: 'inactive'
      };

      UserStub.findById.resolves(mockUser);

      await userController.getUserById(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });
  });

  describe('getUserStats', () => {
    it('应该返回用户统计信息', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId: 'me' };
      req.user = { userId };

      const mockUser = {
        _id: userId,
        totalCheckinDays: 15,
        currentStreak: 7,
        maxStreak: 12,
        totalCompletedPeriods: 2,
        totalPoints: 150,
        level: 3
      };

      UserStub.findById.resolves(mockUser);

      await userController.getUserStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('totalCheckinDays');
      expect(responseData.data).to.have.property('currentStreak');
    });

    it('应该支持"me"作为userId参数', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId: 'me' };
      req.user = { userId };

      const mockUser = {
        _id: userId,
        totalCheckinDays: 10,
        currentStreak: 5,
        maxStreak: 8,
        totalCompletedPeriods: 1,
        totalPoints: 100,
        level: 2
      };

      UserStub.findById.resolves(mockUser);

      await userController.getUserStats(req, res, next);

      expect(UserStub.findById.calledWith(userId)).to.be.true;
    });

    it('应该返回404当用户不存在', async () => {
      req.params = { userId: 'me' };
      req.user = { userId: new mongoose.Types.ObjectId() };

      UserStub.findById.resolves(null);

      await userController.getUserStats(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getUserList', () => {
    it('应该返回分页的用户列表', async () => {
      req.query = { page: 1, limit: 10 };

      const mockUsers = [
        { _id: new mongoose.Types.ObjectId(), nickname: '用户1' },
        { _id: new mongoose.Types.ObjectId(), nickname: '用户2' }
      ];

      UserStub.countDocuments.resolves(2);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockUsers)
      });

      await userController.getUserList(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
    });

    it('应该按role过滤', async () => {
      req.query = { page: 1, limit: 10, role: 'admin' };

      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await userController.getUserList(req, res, next);

      const callArgs = UserStub.find.getCall(0).args[0];
      expect(callArgs).to.have.property('role');
      expect(callArgs.role).to.equal('admin');
    });

    it('应该支持search参数', async () => {
      req.query = { page: 1, limit: 10, search: 'test' };

      UserStub.countDocuments.resolves(0);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await userController.getUserList(req, res, next);

      const callArgs = UserStub.find.getCall(0).args[0];
      expect(callArgs).to.have.property('$or');
    });
  });

  describe('updateUser (Admin)', () => {
    it('应该更新用户信息', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };
      req.body = { status: 'inactive', role: 'user' };

      const mockUser = {
        _id: targetUserId,
        status: 'active',
        role: 'user',
        save: sandbox.stub().resolves()
      };

      UserStub.findById.resolves(mockUser);

      await userController.updateUser(req, res, next);

      expect(mockUser.save.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当用户不存在', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };
      req.body = { status: 'inactive' };

      UserStub.findById.resolves(null);

      await userController.updateUser(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该支持isActive字段转换', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };
      req.body = { isActive: false };

      const mockUser = {
        _id: targetUserId,
        status: 'active',
        save: sandbox.stub().resolves()
      };

      UserStub.findById.resolves(mockUser);

      await userController.updateUser(req, res, next);

      expect(mockUser.status).to.equal('inactive');
    });
  });

  describe('deleteUser (Admin)', () => {
    it('应该删除用户', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };

      const mockUser = { _id: targetUserId, nickname: '测试用户' };

      UserStub.findByIdAndDelete.resolves(mockUser);

      await userController.deleteUser(req, res, next);

      expect(UserStub.findByIdAndDelete.calledWith(targetUserId)).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当用户不存在', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };

      UserStub.findByIdAndDelete.resolves(null);

      await userController.deleteUser(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该返回删除后的用户ID', async () => {
      const targetUserId = new mongoose.Types.ObjectId();
      req.params = { userId: targetUserId };

      const mockUser = { _id: targetUserId };

      UserStub.findByIdAndDelete.resolves(mockUser);

      await userController.deleteUser(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data._id.toString()).to.equal(targetUserId.toString());
    });
  });
});
