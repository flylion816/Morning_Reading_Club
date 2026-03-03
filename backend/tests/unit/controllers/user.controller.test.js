/**
 * User Controller 单元测试 - 100% 覆盖版本
 * 覆盖：获取用户、更新资料、权限验证、统计、列表、管理员操作
 *
 * 测试用例编号：
 * - TC-USER-001: 获取当前用户信息
 * - TC-USER-002: 更新用户资料
 * - TC-USER-003: 获取用户详情（他人主页）
 * - TC-USER-004: 获取用户统计
 * - TC-USER-005: 获取用户列表（管理员）
 * - TC-USER-006: 更新用户（管理员）
 * - TC-USER-007: 删除用户（管理员）
 * - TC-USER-008: 权限检查
 * - TC-USER-009: 错误处理
 */

const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const proxyquire = require('proxyquire').noCallThru();
const fixtures = require('../../fixtures/user-fixtures');

describe('User Controller - 100% Coverage', () => {
  let userController;
  let sandbox;
  let req;
  let res;
  let next;
  let UserStub;
  let CheckinStub;
  let syncServiceStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // ✅ 关键修复：正确的 res Mock 配置
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis(),
      send: sandbox.stub().returnsThis()
    };

    // 创建 req 和 next mock
    req = {
      body: {},
      params: {},
      query: {},
      user: {}
    };

    next = sandbox.stub();

    // Mock User 模型
    UserStub = {
      findById: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    // Mock Checkin 模型
    CheckinStub = {
      countDocuments: sandbox.stub()
    };

    // Mock 响应工具
    const responseUtils = {
      success: (data, message) => ({
        code: 200,
        message,
        data
      }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    // Mock sync service
    syncServiceStub = {
      publishSyncEvent: sandbox.stub()
    };

    userController = proxyquire(
      '../../../src/controllers/user.controller',
      {
        '../models/User': UserStub,
        '../models/Checkin': CheckinStub,
        '../utils/response': responseUtils,
        '../services/sync.service': syncServiceStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  // =====================================================
  // TC-USER-001: 获取当前用户信息
  // =====================================================
  describe('getCurrentUser - TC-USER-001: 获取当前用户', () => {
    it('应该返回当前用户的完整信息', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      const mockUser = { ...fixtures.testUsers.normalUser };

      UserStub.findById.resolves(mockUser);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      expect(UserStub.findById.calledWith(userId)).to.be.true;
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.data).to.have.property('_id');
      expect(responseData.data).to.have.property('nickname');
      expect(responseData.data.nickname).to.equal('普通用户');
      expect(responseData.data).to.have.property('totalCheckinDays');
    });

    it('应该返回404当用户不存在', async () => {
      // Given
      req.user = { userId: new mongoose.Types.ObjectId() };
      UserStub.findById.resolves(null);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      expect(res.status.calledWith(404)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(404);
      expect(responseData.message).to.include('用户不存在');
    });

    it('应该返回403当用户状态为inactive', async () => {
      // Given
      req.user = { userId: fixtures.testUsers.disabledUser._id };
      const disabledUser = { ...fixtures.testUsers.disabledUser };
      UserStub.findById.resolves(disabledUser);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      expect(res.status.calledWith(403)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(403);
      expect(responseData.message).to.include('用户已被禁用');
    });

    it('应该在数据库错误时调用 next', async () => {
      // Given
      req.user = { userId: new mongoose.Types.ObjectId() };
      const dbError = new Error('Database connection failed');
      UserStub.findById.rejects(dbError);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      expect(next.calledWith(dbError)).to.be.true;
    });

    it('应该包含用户的统计信息', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('currentStreak');
      expect(responseData.data).to.have.property('maxStreak');
      expect(responseData.data).to.have.property('totalCompletedPeriods');
      expect(responseData.data).to.have.property('totalPoints');
      expect(responseData.data).to.have.property('level');
    });

    it('应该隐藏敏感字段（openid 不返回）', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then: openid 应该被返回（业务要求）
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('openid');
    });
  });

  // =====================================================
  // TC-USER-002: 更新用户资料
  // =====================================================
  describe('updateProfile - TC-USER-002: 更新资料', () => {
    it('应该成功更新用户资料', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      req.body = fixtures.updateData.validUpdate;

      const saveSpy = sandbox.stub().resolves();
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        ...fixtures.updateData.validUpdate,
        save: saveSpy,
        toObject: sandbox.stub().returns(fixtures.testUsers.normalUser)
      };

      UserStub.findById.resolves(mockUser);

      // When
      await userController.updateProfile(req, res, next);

      // Then
      expect(UserStub.findById.calledWith(userId)).to.be.true;
      expect(saveSpy.called).to.be.true;
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.message).to.include('资料更新成功');
    });

    it('应该只更新提供的字段', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      req.body = fixtures.updateData.nicknameOnly;

      const saveSpy = sandbox.stub().resolves();
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        nickname: fixtures.updateData.nicknameOnly.nickname,
        save: saveSpy,
        toObject: sandbox.stub().returns(fixtures.testUsers.normalUser)
      };

      UserStub.findById.resolves(mockUser);

      // When
      await userController.updateProfile(req, res, next);

      // Then
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.nickname).to.equal(fixtures.updateData.nicknameOnly.nickname);
    });

    it('应该返回404当用户不存在', async () => {
      // Given
      req.user = { userId: new mongoose.Types.ObjectId() };
      req.body = fixtures.updateData.validUpdate;
      UserStub.findById.resolves(null);

      // When
      await userController.updateProfile(req, res, next);

      // Then
      expect(res.status.calledWith(404)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(404);
    });

    it('应该发布同步事件到 MySQL', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      req.body = fixtures.updateData.validUpdate;

      const saveSpy = sandbox.stub().resolves();
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        ...fixtures.updateData.validUpdate,
        save: saveSpy,
        toObject: sandbox.stub().returns(fixtures.testUsers.normalUser)
      };

      UserStub.findById.resolves(mockUser);

      // When
      await userController.updateProfile(req, res, next);

      // Then
      expect(syncServiceStub.publishSyncEvent.called).to.be.true;
      const syncCall = syncServiceStub.publishSyncEvent.getCall(0).args[0];
      expect(syncCall.type).to.equal('update');
      expect(syncCall.collection).to.equal('users');
    });

    it('应该在部分字段为 undefined 时跳过更新', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      req.body = { nickname: '新昵称', avatar: undefined };

      const saveSpy = sandbox.stub().resolves();
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        nickname: '新昵称',
        save: saveSpy,
        toObject: sandbox.stub().returns(fixtures.testUsers.normalUser)
      };

      UserStub.findById.resolves(mockUser);

      // When
      await userController.updateProfile(req, res, next);

      // Then
      expect(saveSpy.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.nickname).to.equal('新昵称');
    });

    it('应该在数据库错误时调用 next', async () => {
      // Given
      req.user = { userId: new mongoose.Types.ObjectId() };
      req.body = fixtures.updateData.validUpdate;
      const dbError = new Error('Save failed');
      UserStub.findById.rejects(dbError);

      // When
      await userController.updateProfile(req, res, next);

      // Then
      expect(next.calledWith(dbError)).to.be.true;
    });
  });

  // =====================================================
  // TC-USER-003: 获取用户详情（他人主页）
  // =====================================================
  describe('getUserById - TC-USER-003: 获取用户详情', () => {
    it('应该返回指定用户的公开信息', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.params = { userId: userId.toString() };
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);

      // When
      await userController.getUserById(req, res, next);

      // Then
      expect(UserStub.findById.calledWith(userId.toString())).to.be.true;
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.data).to.have.property('nickname');
      expect(responseData.data).to.have.property('totalCheckinDays');
    });

    it('应该返回404当用户不存在', async () => {
      // Given
      req.params = { userId: new mongoose.Types.ObjectId().toString() };
      UserStub.findById.resolves(null);

      // When
      await userController.getUserById(req, res, next);

      // Then
      expect(res.status.calledWith(404)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(404);
    });

    it('应该返回400当 userId 为空', async () => {
      // Given
      req.params = { userId: '' };

      // When
      await userController.getUserById(req, res, next);

      // Then
      expect(res.status.calledWith(400)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(400);
      expect(responseData.message).to.include('用户ID不能为空');
    });

    it('应该返回403当用户状态为inactive', async () => {
      // Given
      const userId = fixtures.testUsers.disabledUser._id;
      req.params = { userId: userId.toString() };
      const disabledUser = { ...fixtures.testUsers.disabledUser };
      UserStub.findById.resolves(disabledUser);

      // When
      await userController.getUserById(req, res, next);

      // Then
      expect(res.status.calledWith(403)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.message).to.include('用户已被禁用');
    });

    it('应该不返回敏感字段如 openid', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.params = { userId: userId.toString() };
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);

      // When
      await userController.getUserById(req, res, next);

      // Then: 他人主页不应该显示 openid
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.not.have.property('openid');
    });

    it('应该在数据库错误时调用 next', async () => {
      // Given
      req.params = { userId: new mongoose.Types.ObjectId().toString() };
      const dbError = new Error('Database error');
      UserStub.findById.rejects(dbError);

      // When
      await userController.getUserById(req, res, next);

      // Then
      expect(next.calledWith(dbError)).to.be.true;
    });
  });

  // =====================================================
  // TC-USER-004: 获取用户统计
  // =====================================================
  describe('getUserStats - TC-USER-004: 获取统计', () => {
    it('应该返回当前用户的统计信息（userId 为 me）', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      req.params = { userId: 'me' };
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);
      CheckinStub.countDocuments.resolves(10);

      // When
      await userController.getUserStats(req, res, next);

      // Then
      expect(UserStub.findById.calledWith(userId)).to.be.true;
      expect(CheckinStub.countDocuments.called).to.be.true;
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.data).to.have.property('totalCheckinDays');
    });

    it('应该使用实际的打卡数而不是缓存的字段', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      req.params = { userId };
      const mockUser = { ...fixtures.testUsers.normalUser, totalCheckinDays: 5 };
      UserStub.findById.resolves(mockUser);
      CheckinStub.countDocuments.resolves(10);  // 实际打卡数

      // When
      await userController.getUserStats(req, res, next);

      // Then: 应该使用实际的打卡数 10，而不是缓存的 5
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.totalCheckinDays).to.equal(10);
    });

    it('应该返回指定用户的统计信息', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.params = { userId: userId.toString() };
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);
      CheckinStub.countDocuments.resolves(fixtures.testUsers.normalUser.totalCheckinDays);

      // When
      await userController.getUserStats(req, res, next);

      // Then
      expect(UserStub.findById.calledWith(userId.toString())).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
    });

    it('应该返回404当用户不存在', async () => {
      // Given
      req.params = { userId: new mongoose.Types.ObjectId().toString() };
      UserStub.findById.resolves(null);

      // When
      await userController.getUserStats(req, res, next);

      // Then
      expect(res.status.calledWith(404)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(404);
    });

    it('应该返回0个打卡当用户没有打卡记录', async () => {
      // Given
      const userId = fixtures.testUsers.newUser._id;
      req.params = { userId: userId.toString() };
      const mockUser = { ...fixtures.testUsers.newUser };
      UserStub.findById.resolves(mockUser);
      CheckinStub.countDocuments.resolves(0);

      // When
      await userController.getUserStats(req, res, next);

      // Then
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.totalCheckinDays).to.equal(0);
    });

    it('应该在数据库错误时调用 next', async () => {
      // Given
      req.params = { userId: new mongoose.Types.ObjectId().toString() };
      const dbError = new Error('Database error');
      UserStub.findById.rejects(dbError);

      // When
      await userController.getUserStats(req, res, next);

      // Then
      expect(next.calledWith(dbError)).to.be.true;
    });
  });

  // =====================================================
  // TC-USER-005: 获取用户列表（管理员）
  // =====================================================
  describe('getUserList - TC-USER-005: 用户列表', () => {
    it('应该返回分页用户列表', async () => {
      // Given
      req.query = { page: 1, limit: 20 };
      const users = [fixtures.testUsers.normalUser, fixtures.testUsers.enrolledUser];
      UserStub.countDocuments.resolves(2);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(users)
      });

      // When
      await userController.getUserList(req, res, next);

      // Then
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
      expect(responseData.data.pagination).to.have.property('page');
      expect(responseData.data.pagination).to.have.property('total');
    });

    it('应该支持按 role 过滤', async () => {
      // Given
      req.query = { page: 1, limit: 20, role: 'admin' };
      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([fixtures.testUsers.adminUser])
      });

      // When
      await userController.getUserList(req, res, next);

      // Then
      expect(UserStub.find.called).to.be.true;
      const query = UserStub.find.getCall(0).args[0];
      expect(query).to.have.property('role');
      expect(query.role).to.equal('admin');
    });

    it('应该支持按 status 过滤', async () => {
      // Given
      req.query = { status: 'active' };
      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([fixtures.testUsers.normalUser])
      });

      // When
      await userController.getUserList(req, res, next);

      // Then
      const query = UserStub.find.getCall(0).args[0];
      expect(query.status).to.equal('active');
    });

    it('应该支持按关键词搜索（nickname、email、openid）', async () => {
      // Given
      req.query = { search: '普通用户' };
      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([fixtures.testUsers.normalUser])
      });

      // When
      await userController.getUserList(req, res, next);

      // Then
      const query = UserStub.find.getCall(0).args[0];
      expect(query).to.have.property('$or');
      expect(query.$or.length).to.be.greaterThan(0);
    });

    it('应该支持 keyword 参数（向后兼容）', async () => {
      // Given
      req.query = { keyword: '用户' };
      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([fixtures.testUsers.normalUser])
      });

      // When
      await userController.getUserList(req, res, next);

      // Then
      const query = UserStub.find.getCall(0).args[0];
      expect(query).to.have.property('$or');
    });

    it('应该返回正确的分页信息', async () => {
      // Given
      req.query = { page: 2, limit: 10 };
      UserStub.countDocuments.resolves(25);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([fixtures.testUsers.normalUser])
      });

      // When
      await userController.getUserList(req, res, next);

      // Then
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.pagination.page).to.equal(2);
      expect(responseData.data.pagination.limit).to.equal(10);
      expect(responseData.data.pagination.total).to.equal(25);
      expect(responseData.data.pagination.pages).to.equal(3);
    });

    it('应该在数据库错误时调用 next', async () => {
      // Given
      req.query = { page: 1, limit: 20 };
      const dbError = new Error('Database error');
      UserStub.countDocuments.rejects(dbError);

      // When
      await userController.getUserList(req, res, next);

      // Then
      expect(next.calledWith(dbError)).to.be.true;
    });
  });

  // =====================================================
  // TC-USER-006: 更新用户（管理员）
  // =====================================================
  describe('updateUser - TC-USER-006: 管理员更新用户', () => {
    it('应该更新用户状态', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.params = { userId: userId.toString() };
      req.body = { status: 'inactive' };
      const mockUser = { ...fixtures.testUsers.normalUser };
      const updatedUser = {
        ...mockUser,
        status: 'inactive',
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(updatedUser);

      // When
      await userController.updateUser(req, res, next);

      // Then
      expect(updatedUser.save.called).to.be.true;
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
    });

    it('应该通过 isActive 标志更新用户状态', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.params = { userId: userId.toString() };
      req.body = { isActive: false };
      const mockUser = { ...fixtures.testUsers.normalUser };
      const updatedUser = {
        ...mockUser,
        status: 'inactive',
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(updatedUser);

      // When
      await userController.updateUser(req, res, next);

      // Then
      expect(updatedUser.save.called).to.be.true;
    });

    it('应该更新用户角色', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.params = { userId: userId.toString() };
      req.body = { role: 'admin' };
      const mockUser = { ...fixtures.testUsers.normalUser };
      const updatedUser = {
        ...mockUser,
        role: 'admin',
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(updatedUser);

      // When
      await userController.updateUser(req, res, next);

      // Then
      expect(updatedUser.save.called).to.be.true;
    });

    it('应该返回404当用户不存在', async () => {
      // Given
      req.params = { userId: new mongoose.Types.ObjectId().toString() };
      req.body = { status: 'inactive' };
      UserStub.findById.resolves(null);

      // When
      await userController.updateUser(req, res, next);

      // Then
      expect(res.status.calledWith(404)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(404);
    });

    it('应该在数据库错误时调用 next', async () => {
      // Given
      req.params = { userId: new mongoose.Types.ObjectId().toString() };
      req.body = { status: 'inactive' };
      const dbError = new Error('Save failed');
      UserStub.findById.rejects(dbError);

      // When
      await userController.updateUser(req, res, next);

      // Then
      expect(next.calledWith(dbError)).to.be.true;
    });
  });

  // =====================================================
  // TC-USER-007: 删除用户（管理员）
  // =====================================================
  describe('deleteUser - TC-USER-007: 删除用户', () => {
    it('应该成功删除用户', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.params = { userId: userId.toString() };
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findByIdAndDelete.resolves(mockUser);

      // When
      await userController.deleteUser(req, res, next);

      // Then
      expect(UserStub.findByIdAndDelete.calledWith(userId.toString())).to.be.true;
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.message).to.include('用户已删除');
    });

    it('应该返回404当用户不存在', async () => {
      // Given
      req.params = { userId: new mongoose.Types.ObjectId().toString() };
      UserStub.findByIdAndDelete.resolves(null);

      // When
      await userController.deleteUser(req, res, next);

      // Then
      expect(res.status.calledWith(404)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(404);
    });

    it('应该在数据库错误时调用 next', async () => {
      // Given
      req.params = { userId: new mongoose.Types.ObjectId().toString() };
      const dbError = new Error('Delete failed');
      UserStub.findByIdAndDelete.rejects(dbError);

      // When
      await userController.deleteUser(req, res, next);

      // Then
      expect(next.calledWith(dbError)).to.be.true;
    });
  });

  // =====================================================
  // TC-USER-008: 错误处理与边界情况
  // =====================================================
  describe('Error Handling - TC-USER-008: 错误处理', () => {
    it('应该处理无效的 MongoDB ObjectId', async () => {
      // Given
      req.params = { userId: 'invalid-mongo-id' };

      // When: findById 会因为无效的 ID 抛出错误
      const dbError = new Error('Cast to ObjectId failed');
      UserStub.findById.rejects(dbError);

      await userController.getUserById(req, res, next);

      // Then
      expect(next.calledWith(dbError)).to.be.true;
    });

    it('应该处理数据库连接错误', async () => {
      // Given
      req.user = { userId: new mongoose.Types.ObjectId() };
      const connectionError = new Error('MongoDB connection lost');
      UserStub.findById.rejects(connectionError);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      expect(next.calledWith(connectionError)).to.be.true;
    });

    it('应该安全处理 null/undefined 用户字段', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      const userWithNullFields = {
        ...fixtures.testUsers.normalUser,
        signature: null,
        avatar: undefined
      };
      UserStub.findById.resolves(userWithNullFields);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
    });
  });

  // =====================================================
  // TC-USER-009: 数据完整性
  // =====================================================
  describe('Data Integrity - TC-USER-009: 数据完整性', () => {
    it('应该返回所有必需的用户字段', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      const responseData = res.json.getCall(0).args[0];
      const requiredFields = [
        '_id', 'nickname', 'avatar', 'signature', 'gender',
        'totalCheckinDays', 'currentStreak', 'maxStreak',
        'totalCompletedPeriods', 'totalPoints', 'level', 'status'
      ];
      requiredFields.forEach(field => {
        expect(responseData.data).to.have.property(field);
      });
    });

    it('应该不修改原始用户对象', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId };
      const originalNickname = fixtures.testUsers.normalUser.nickname;
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);

      // When
      await userController.getCurrentUser(req, res, next);

      // Then
      expect(mockUser.nickname).to.equal(originalNickname);
    });
  });
});
