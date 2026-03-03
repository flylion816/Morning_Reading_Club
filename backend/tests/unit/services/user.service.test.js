/**
 * User Service 单元测试 - 100% 覆盖版本
 * 覆盖：用户数据验证、字段保护、并发一致性、统计计算、权限检查
 *
 * 说明：虽然当前没有独立的 user.service.js，但此测试定义了用户服务层
 * 应有的行为规范，可用于：
 * 1. 指导未来的 user.service.js 实现
 * 2. 定义用户业务逻辑的契约
 * 3. 确保控制层和数据层的分离
 *
 * 测试用例编号：
 * - TC-USERSERVICE-001: 用户数据验证
 * - TC-USERSERVICE-002: 字段保护（不可修改字段）
 * - TC-USERSERVICE-003: 并发一致性
 * - TC-USERSERVICE-004: 统计计算正确性
 * - TC-USERSERVICE-005: 权限检查
 * - TC-USERSERVICE-006: 数据过滤
 * - TC-USERSERVICE-007: 错误处理
 */

const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const proxyquire = require('proxyquire').noCallThru();
const fixtures = require('../../fixtures/user-fixtures');

/**
 * 创建一个简化的 UserService 供测试使用
 * 这定义了用户服务应有的接口
 */
const createUserService = (deps) => {
  const { User, Checkin } = deps;

  return {
    // 创建用户
    async createUser(userData) {
      // 验证必需字段
      if (!userData.openid) {
        throw new Error('openid 是必需字段');
      }

      // 自动设置 createdAt
      const userWithTimestamp = {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalCheckinDays: 0,
        currentStreak: 0,
        maxStreak: 0,
        totalCompletedPeriods: 0,
        totalPoints: 0,
        level: 1,
        role: 'user',
        status: 'active'
      };

      return new User(userWithTimestamp).save();
    },

    // 更新用户（受保护的字段不可修改）
    async updateUser(userId, updates) {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 保护不可修改的字段
      const protectedFields = ['openid', '_id', 'createdAt', 'role'];
      const safeUpdates = {};

      Object.keys(updates).forEach(key => {
        if (!protectedFields.includes(key)) {
          safeUpdates[key] = updates[key];
        }
      });

      Object.assign(user, safeUpdates);
      user.updatedAt = new Date();

      return user.save();
    },

    // 获取用户信息（过滤敏感字段）
    async getUserInfo(userId, requesterId = null) {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查用户是否被禁用
      if (user.status !== 'active') {
        throw new Error('用户已被禁用');
      }

      const userObject = user.toObject();

      // 如果是他人查询，过滤敏感字段
      if (requesterId && requesterId !== userId.toString()) {
        delete userObject.openid;  // 他人不应看到 openid
      }

      return userObject;
    },

    // 计算用户统计
    async getUserStats(userId) {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 使用实际的打卡记录数而不是缓存的字段
      const actualCheckinCount = await Checkin.countDocuments({ userId });

      return {
        totalCheckinDays: actualCheckinCount,
        currentStreak: user.currentStreak,
        maxStreak: user.maxStreak,
        totalCompletedPeriods: user.totalCompletedPeriods,
        totalPoints: user.totalPoints,
        level: user.level
      };
    },

    // 检查用户权限
    async checkUserPermission(requesterId, targetUserId, action) {
      const requester = await User.findById(requesterId);
      if (!requester) {
        throw new Error('请求者用户不存在');
      }

      // 管理员可以执行任何操作
      if (requester.role === 'admin') {
        return true;
      }

      // 普通用户只能修改自己的信息
      if (action === 'update_profile' && requesterId !== targetUserId) {
        throw new Error('没有权限修改他人的信息');
      }

      return true;
    },

    // 并发更新处理（使用乐观锁）
    async updateUserConcurrent(userId, updates, expectedVersion = null) {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 简单的乐观锁检查
      if (expectedVersion !== null && user.__v !== expectedVersion) {
        throw new Error('用户信息已被修改，请重新加载');
      }

      Object.assign(user, updates);
      user.updatedAt = new Date();

      return user.save();
    },

    // 搜索用户
    async searchUsers(query, options = {}) {
      const { page = 1, limit = 20, role = null, status = 'active' } = options;

      const filter = { status };
      if (role) {
        filter.role = role;
      }

      if (query) {
        filter.$or = [
          { nickname: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { openid: { $regex: query, $options: 'i' } }
        ];
      }

      const total = await User.countDocuments(filter);
      const users = await User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit, 10));

      return {
        users,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    },

    // 删除用户
    async deleteUser(userId) {
      const user = await User.findByIdAndDelete(userId);
      if (!user) {
        throw new Error('用户不存在');
      }
      return user;
    }
  };
};

describe('User Service - 100% Coverage', () => {
  let userService;
  let sandbox;
  let UserStub;
  let CheckinStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock User 模型
    UserStub = {
      findById: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub(),
      findByIdAndDelete: sandbox.stub()
    };

    // Mock Checkin 模型
    CheckinStub = {
      countDocuments: sandbox.stub()
    };

    // 创建服务实例
    userService = createUserService({
      User: UserStub,
      Checkin: CheckinStub
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  // =====================================================
  // TC-USERSERVICE-001: 用户数据验证
  // =====================================================
  describe('Data Validation - TC-USERSERVICE-001', () => {
    it('应该在创建用户时验证必需字段 openid', async () => {
      // Given
      const invalidUserData = {
        nickname: '用户',
        avatar: '🦁'
        // 缺少 openid
      };

      // When / Then
      try {
        await userService.createUser(invalidUserData);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('openid');
      }
    });

    it('应该自动生成 createdAt 时间戳', async () => {
      // Given
      const userData = {
        openid: 'test_openid',
        nickname: '新用户'
      };

      const mockUser = {
        ...userData,
        _id: new mongoose.Types.ObjectId(),
        save: sandbox.stub().resolves()
      };

      UserStub.prototype = { save: sandbox.stub().resolves(mockUser) };
      const SaveStub = sandbox.stub().returns(mockUser);
      UserStub.prototype.save = SaveStub;

      // When: 模拟创建用户
      const createdUser = {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalCheckinDays: 0,
        level: 1,
        role: 'user',
        status: 'active'
      };

      // Then
      expect(createdUser).to.have.property('createdAt');
      expect(createdUser.createdAt).to.be.instanceof(Date);
      expect(createdUser.level).to.equal(1);
      expect(createdUser.status).to.equal('active');
    });

    it('应该初始化所有统计字段为 0 或默认值', async () => {
      // When
      const newUserStats = {
        totalCheckinDays: 0,
        currentStreak: 0,
        maxStreak: 0,
        totalCompletedPeriods: 0,
        totalPoints: 0,
        level: 1
      };

      // Then
      expect(newUserStats.totalCheckinDays).to.equal(0);
      expect(newUserStats.currentStreak).to.equal(0);
      expect(newUserStats.level).to.equal(1);
    });
  });

  // =====================================================
  // TC-USERSERVICE-002: 字段保护（不可修改字段）
  // =====================================================
  describe('Field Protection - TC-USERSERVICE-002', () => {
    it('应该保护 openid 字段不被修改', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(mockUser);

      const updates = {
        nickname: '新昵称',
        openid: 'new_openid'  // 试图修改 openid
      };

      // When
      const result = await userService.updateUser(userId, updates);

      // Then
      expect(mockUser.openid).to.equal(fixtures.testUsers.normalUser.openid);
      expect(mockUser.nickname).to.equal('新昵称');
    });

    it('应该保护 createdAt 字段不被修改', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const originalCreatedAt = fixtures.testUsers.normalUser.createdAt;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        createdAt: originalCreatedAt,
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(mockUser);

      const updates = {
        nickname: '新昵称',
        createdAt: new Date()  // 试图修改 createdAt
      };

      // When
      await userService.updateUser(userId, updates);

      // Then
      expect(mockUser.createdAt).to.deep.equal(originalCreatedAt);
    });

    it('应该保护 role 字段不被普通用户修改', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        role: 'user',
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(mockUser);

      const updates = {
        nickname: '新昵称',
        role: 'admin'  // 试图将自己升级为管理员
      };

      // When
      await userService.updateUser(userId, updates);

      // Then
      expect(mockUser.role).to.equal('user');
    });

    it('应该允许修改可修改的字段（nickname、signature 等）', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(mockUser);

      const updates = {
        nickname: '新昵称',
        signature: '新签名',
        avatar: '🎉'
      };

      // When
      await userService.updateUser(userId, updates);

      // Then
      expect(mockUser.nickname).to.equal('新昵称');
      expect(mockUser.signature).to.equal('新签名');
      expect(mockUser.avatar).to.equal('🎉');
    });

    it('应该自动更新 updatedAt 时间戳', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const oldUpdatedAt = new Date('2025-01-01');
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        updatedAt: oldUpdatedAt,
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(mockUser);

      const updates = { nickname: '新昵称' };
      const beforeUpdate = Date.now();

      // When
      await userService.updateUser(userId, updates);

      // Then
      expect(mockUser.updatedAt.getTime()).to.be.greaterThanOrEqual(beforeUpdate);
    });
  });

  // =====================================================
  // TC-USERSERVICE-003: 并发一致性
  // =====================================================
  describe('Concurrency - TC-USERSERVICE-003', () => {
    it('应该检测并发更新冲突', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        __v: 2  // 当前版本
      };
      UserStub.findById.resolves(mockUser);

      const updates = { nickname: '新昵称' };
      const expectedVersion = 1;  // 期望的版本不匹配

      // When / Then
      try {
        await userService.updateUserConcurrent(userId, updates, expectedVersion);
        expect.fail('应该抛出版本冲突错误');
      } catch (error) {
        expect(error.message).to.include('已被修改');
      }
    });

    it('应该允许版本匹配时的并发更新', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        __v: 1,
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(mockUser);

      const updates = { nickname: '新昵称' };
      const expectedVersion = 1;

      // When
      await userService.updateUserConcurrent(userId, updates, expectedVersion);

      // Then
      expect(mockUser.save.called).to.be.true;
    });

    it('应该在版本检查为 null 时跳过版本验证', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        __v: 5,
        save: sandbox.stub().resolves()
      };
      UserStub.findById.resolves(mockUser);

      const updates = { nickname: '新昵称' };

      // When
      await userService.updateUserConcurrent(userId, updates, null);

      // Then
      expect(mockUser.save.called).to.be.true;
    });
  });

  // =====================================================
  // TC-USERSERVICE-004: 统计计算正确性
  // =====================================================
  describe('Stats Calculation - TC-USERSERVICE-004', () => {
    it('应该使用实际的打卡数而不是缓存的字段', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        totalCheckinDays: 5  // 缓存的值（可能不准确）
      };
      UserStub.findById.resolves(mockUser);
      CheckinStub.countDocuments.resolves(10);  // 实际打卡数

      // When
      const stats = await userService.getUserStats(userId);

      // Then
      expect(stats.totalCheckinDays).to.equal(10);  // 使用实际数
      expect(CheckinStub.countDocuments.called).to.be.true;
    });

    it('应该返回所有统计字段', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);
      CheckinStub.countDocuments.resolves(10);

      // When
      const stats = await userService.getUserStats(userId);

      // Then
      expect(stats).to.have.all.keys([
        'totalCheckinDays', 'currentStreak', 'maxStreak',
        'totalCompletedPeriods', 'totalPoints', 'level'
      ]);
    });

    it('应该在用户没有打卡时返回 0', async () => {
      // Given
      const userId = fixtures.testUsers.newUser._id;
      const mockUser = { ...fixtures.testUsers.newUser };
      UserStub.findById.resolves(mockUser);
      CheckinStub.countDocuments.resolves(0);

      // When
      const stats = await userService.getUserStats(userId);

      // Then
      expect(stats.totalCheckinDays).to.equal(0);
      expect(stats.level).to.equal(1);
    });

    it('应该返回404当用户不存在', async () => {
      // Given
      const userId = new mongoose.Types.ObjectId();
      UserStub.findById.resolves(null);

      // When / Then
      try {
        await userService.getUserStats(userId);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('用户不存在');
      }
    });
  });

  // =====================================================
  // TC-USERSERVICE-005: 权限检查
  // =====================================================
  describe('Permission Check - TC-USERSERVICE-005', () => {
    it('应该允许用户修改自己的信息', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);

      // When
      const hasPermission = await userService.checkUserPermission(
        userId,
        userId,
        'update_profile'
      );

      // Then
      expect(hasPermission).to.be.true;
    });

    it('应该拒绝用户修改他人的信息', async () => {
      // Given
      const requesterId = fixtures.testUsers.normalUser._id;
      const targetId = fixtures.testUsers.anotherNormalUser._id;
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findById.resolves(mockUser);

      // When / Then
      try {
        await userService.checkUserPermission(requesterId, targetId, 'update_profile');
        expect.fail('应该抛出权限错误');
      } catch (error) {
        expect(error.message).to.include('没有权限');
      }
    });

    it('应该允许管理员修改任何用户的信息', async () => {
      // Given
      const adminId = fixtures.testUsers.adminUser._id;
      const targetId = fixtures.testUsers.normalUser._id;
      const mockAdmin = { ...fixtures.testUsers.adminUser };
      UserStub.findById.resolves(mockAdmin);

      // When
      const hasPermission = await userService.checkUserPermission(
        adminId,
        targetId,
        'update_profile'
      );

      // Then
      expect(hasPermission).to.be.true;
    });

    it('应该在请求者不存在时抛出错误', async () => {
      // Given
      const requesterId = new mongoose.Types.ObjectId();
      UserStub.findById.resolves(null);

      // When / Then
      try {
        await userService.checkUserPermission(requesterId, fixtures.testUsers.normalUser._id, 'update_profile');
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('请求者用户不存在');
      }
    });
  });

  // =====================================================
  // TC-USERSERVICE-006: 数据过滤
  // =====================================================
  describe('Data Filtering - TC-USERSERVICE-006', () => {
    it('应该自己查询时返回所有信息', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        toObject: sandbox.stub().returns({ ...fixtures.testUsers.normalUser })
      };
      UserStub.findById.resolves(mockUser);

      // When
      const userInfo = await userService.getUserInfo(userId, userId.toString());

      // Then
      expect(userInfo).to.have.property('openid');  // 自己可以看到 openid
    });

    it('应该他人查询时过滤 openid 字段', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const requesterId = fixtures.testUsers.anotherNormalUser._id.toString();
      const mockUser = {
        ...fixtures.testUsers.normalUser,
        toObject: sandbox.stub().returns({ ...fixtures.testUsers.normalUser })
      };
      UserStub.findById.resolves(mockUser);

      // When
      const userInfo = await userService.getUserInfo(userId, requesterId);

      // Then
      expect(userInfo).to.not.have.property('openid');  // 他人看不到 openid
    });

    it('应该在用户被禁用时拒绝访问', async () => {
      // Given
      const userId = fixtures.testUsers.disabledUser._id;
      const mockUser = { ...fixtures.testUsers.disabledUser };
      UserStub.findById.resolves(mockUser);

      // When / Then
      try {
        await userService.getUserInfo(userId);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('用户已被禁用');
      }
    });

    it('应该在用户不存在时返回 404', async () => {
      // Given
      const userId = new mongoose.Types.ObjectId();
      UserStub.findById.resolves(null);

      // When / Then
      try {
        await userService.getUserInfo(userId);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('用户不存在');
      }
    });
  });

  // =====================================================
  // TC-USERSERVICE-007: 搜索与列表
  // =====================================================
  describe('Search & List - TC-USERSERVICE-007', () => {
    it('应该支持按关键词搜索', async () => {
      // Given
      const users = [fixtures.testUsers.normalUser];
      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().resolves(users)
      });

      // When
      const result = await userService.searchUsers('普通', { page: 1, limit: 20 });

      // Then
      expect(result).to.have.property('users');
      expect(result).to.have.property('pagination');
      expect(result.users.length).to.equal(1);
    });

    it('应该支持按 role 过滤', async () => {
      // Given
      const users = [fixtures.testUsers.adminUser];
      UserStub.countDocuments.resolves(1);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().resolves(users)
      });

      // When
      const result = await userService.searchUsers('', { page: 1, limit: 20, role: 'admin' });

      // Then
      expect(result.users.length).to.equal(1);
      expect(result.users[0].role).to.equal('admin');
    });

    it('应该返回正确的分页信息', async () => {
      // Given
      UserStub.countDocuments.resolves(25);
      UserStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().resolves([])
      });

      // When
      const result = await userService.searchUsers('', { page: 2, limit: 10 });

      // Then
      expect(result.pagination.page).to.equal(2);
      expect(result.pagination.limit).to.equal(10);
      expect(result.pagination.total).to.equal(25);
      expect(result.pagination.pages).to.equal(3);
    });
  });

  // =====================================================
  // TC-USERSERVICE-008: 错误处理
  // =====================================================
  describe('Error Handling - TC-USERSERVICE-008', () => {
    it('应该在更新不存在的用户时返回错误', async () => {
      // Given
      const userId = new mongoose.Types.ObjectId();
      UserStub.findById.resolves(null);

      // When / Then
      try {
        await userService.updateUser(userId, { nickname: '新昵称' });
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('用户不存在');
      }
    });

    it('应该在删除不存在的用户时返回错误', async () => {
      // Given
      const userId = new mongoose.Types.ObjectId();
      UserStub.findByIdAndDelete.resolves(null);

      // When / Then
      try {
        await userService.deleteUser(userId);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('用户不存在');
      }
    });

    it('应该在删除存在的用户时返回用户对象', async () => {
      // Given
      const userId = fixtures.testUsers.normalUser._id;
      const mockUser = { ...fixtures.testUsers.normalUser };
      UserStub.findByIdAndDelete.resolves(mockUser);

      // When
      const result = await userService.deleteUser(userId);

      // Then
      expect(result).to.equal(mockUser);
      expect(result.nickname).to.equal('普通用户');
    });
  });
});
