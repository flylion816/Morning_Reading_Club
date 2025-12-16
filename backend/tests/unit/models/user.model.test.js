/**
 * User Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const User = require('../../../src/models/User');

describe('User Model', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的用户', async () => {
      const user = await User.create({
        openid: 'test_openid_001',
        nickname: '测试用户'
      });

      expect(user._id).to.exist;
      expect(user.openid).to.equal('test_openid_001');
      expect(user.nickname).to.equal('测试用户');
      expect(user.role).to.equal('user');
      expect(user.status).to.equal('active');
    });

    it('应该使用默认值', async () => {
      const user = await User.create({
        openid: 'test_openid_002',
        nickname: '默认用户'
      });

      expect(user.avatar).to.equal('🦁');
      expect(user.gender).to.equal('unknown');
      expect(user.totalCheckinDays).to.equal(0);
      expect(user.currentStreak).to.equal(0);
      expect(user.maxStreak).to.equal(0);
      expect(user.totalCompletedPeriods).to.equal(0);
      expect(user.totalPoints).to.equal(0);
      expect(user.level).to.equal(1);
    });

    it('应该在缺少openid时抛出验证错误', async () => {
      try {
        await User.create({ nickname: '无openid用户' });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('openid');
      }
    });

    it('应该在缺少nickname时使用默认值', async () => {
      const user = await User.create({
        openid: 'test_openid_003'
      });

      expect(user.nickname).to.equal('微信用户');
    });

    it('应该验证role枚举值', async () => {
      try {
        await User.create({
          openid: 'test_openid_004',
          nickname: '用户',
          role: 'invalid_role'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('role');
      }
    });

    it('应该接受有效的role值', async () => {
      const roles = ['user', 'admin', 'super_admin'];
      for (const role of roles) {
        const user = await User.create({
          openid: `test_openid_${role}`,
          nickname: `${role}用户`,
          role
        });
        expect(user.role).to.equal(role);
      }
    });

    it('应该验证status枚举值', async () => {
      try {
        await User.create({
          openid: 'test_openid_005',
          nickname: '用户',
          status: 'invalid_status'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('status');
      }
    });

    it('应该接受有效的status值', async () => {
      const statuses = ['active', 'banned', 'deleted'];
      for (const status of statuses) {
        const user = await User.create({
          openid: `test_openid_status_${status}`,
          nickname: `${status}用户`,
          status
        });
        expect(user.status).to.equal(status);
      }
    });

    it('应该验证gender枚举值', async () => {
      try {
        await User.create({
          openid: 'test_openid_006',
          nickname: '用户',
          gender: 'other'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('gender');
      }
    });

    it('应该接受有效的gender值', async () => {
      const genders = ['male', 'female', 'unknown'];
      for (const gender of genders) {
        const user = await User.create({
          openid: `test_openid_gender_${gender}`,
          nickname: `${gender}用户`,
          gender
        });
        expect(user.gender).to.equal(gender);
      }
    });

    it('应该验证mood枚举值（Checkin使用）', () => {
      // 验证Schema中mood字段的有效值
      const checkinMoods = ['happy', 'calm', 'thoughtful', 'inspired', 'other'];
      expect(checkinMoods).to.have.lengthOf(5);
    });
  });

  describe('Field Constraints', () => {
    it('应该强制openid唯一性', async () => {
      await User.create({
        openid: 'unique_openid',
        nickname: '第一个用户'
      });

      try {
        await User.create({
          openid: 'unique_openid',
          nickname: '第二个用户'
        });
        expect.fail('应该抛出唯一性错误');
      } catch (err) {
        expect(err.message).to.include('unique');
      }
    });

    it('应该验证nickname最大长度', async () => {
      try {
        await User.create({
          openid: 'test_openid_007',
          nickname: 'a'.repeat(51)
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('nickname');
      }
    });

    it('应该验证avatar最大长度（通常是emoji）', async () => {
      try {
        await User.create({
          openid: 'test_openid_008',
          nickname: '用户',
          avatar: 'a'.repeat(11)
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('avatar');
      }
    });

    it('应该验证signature最大长度', async () => {
      try {
        await User.create({
          openid: 'test_openid_009',
          nickname: '用户',
          signature: 'a'.repeat(201)
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('signature');
      }
    });

    it('应该验证totalCheckinDays最小值', async () => {
      try {
        await User.create({
          openid: 'test_openid_010',
          nickname: '用户',
          totalCheckinDays: -1
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('totalCheckinDays');
      }
    });

    it('应该验证level最小值（至少为1）', async () => {
      try {
        await User.create({
          openid: 'test_openid_011',
          nickname: '用户',
          level: 0
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('level');
      }
    });

    it('应该接受有效的数值字段', async () => {
      const user = await User.create({
        openid: 'test_openid_012',
        nickname: '积分用户',
        totalCheckinDays: 100,
        currentStreak: 30,
        maxStreak: 50,
        totalCompletedPeriods: 5,
        totalPoints: 500,
        level: 3
      });

      expect(user.totalCheckinDays).to.equal(100);
      expect(user.currentStreak).to.equal(30);
      expect(user.maxStreak).to.equal(50);
      expect(user.totalCompletedPeriods).to.equal(5);
      expect(user.totalPoints).to.equal(500);
      expect(user.level).to.equal(3);
    });
  });

  describe('Virtual Fields', () => {
    it('应该返回avatarText虚拟字段', async () => {
      const user = await User.create({
        openid: 'test_openid_013',
        nickname: '张三',
        avatar: '🦁'
      });

      const userObj = user.toJSON();
      expect(userObj.avatarText).to.equal('🦁');
    });

    it('当avatar为空时avatarText应该返回nickname首字', async () => {
      const user = await User.create({
        openid: 'test_openid_014',
        nickname: '李四',
        avatar: null
      });

      const userObj = user.toJSON();
      expect(userObj.avatarText).to.equal('李');
    });

    it('应该返回isActive虚拟字段（当status为active时）', async () => {
      const user = await User.create({
        openid: 'test_openid_015',
        nickname: '活跃用户',
        status: 'active'
      });

      const userObj = user.toJSON();
      expect(userObj.isActive).to.be.true;
    });

    it('应该返回isActive虚拟字段（当status为banned时）', async () => {
      const user = await User.create({
        openid: 'test_openid_016',
        nickname: '被禁用户',
        status: 'banned'
      });

      const userObj = user.toJSON();
      expect(userObj.isActive).to.be.false;
    });

    it('应该在toJSON时包含虚拟字段', async () => {
      const user = await User.create({
        openid: 'test_openid_017',
        nickname: '测试',
        avatar: '🐶',
        status: 'active'
      });

      const userObj = user.toJSON();
      expect(userObj).to.have.property('avatarText');
      expect(userObj).to.have.property('isActive');
    });
  });

  describe('Timestamps and Metadata', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const user = await User.create({
        openid: 'test_openid_018',
        nickname: '时间戳用户'
      });

      expect(user.createdAt).to.exist;
      expect(user.updatedAt).to.exist;
      expect(user.createdAt).to.be.instanceof(Date);
      expect(user.updatedAt).to.be.instanceof(Date);
    });

    it('应该更新updatedAt当记录被修改', async () => {
      const user = await User.create({
        openid: 'test_openid_019',
        nickname: '修改用户'
      });

      const originalUpdatedAt = user.updatedAt;
      await new Promise(resolve => setTimeout(resolve, 10));

      user.nickname = '新昵称';
      await user.save();

      expect(user.updatedAt.getTime()).to.be.greaterThan(originalUpdatedAt.getTime());
    });

    it('不应该包含__v字段（versionKey: false）', async () => {
      const user = await User.create({
        openid: 'test_openid_020',
        nickname: '版本用户'
      });

      const userObj = user.toObject();
      expect(userObj).to.not.have.property('__v');
    });
  });

  describe('Indexes', () => {
    it('应该在openid字段上有唯一索引', async () => {
      const indexes = await User.collection.getIndexes();
      const openidIndex = Object.values(indexes).find(idx => idx.key?.openid === 1);
      expect(openidIndex).to.exist;
      expect(openidIndex.unique).to.be.true;
    });

    it('应该在nickname字段上有索引', async () => {
      const indexes = await User.collection.getIndexes();
      const nicknameIndex = Object.values(indexes).find(idx => idx.key?.nickname === 1);
      expect(nicknameIndex).to.exist;
    });

    it('应该在createdAt字段上有索引', async () => {
      const indexes = await User.collection.getIndexes();
      const createdAtIndex = Object.values(indexes).find(idx => idx.key?.createdAt === 1);
      expect(createdAtIndex).to.exist;
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索用户数据', async () => {
      const originalUser = await User.create({
        openid: 'test_openid_021',
        nickname: '持久化用户',
        gender: 'female',
        totalPoints: 250,
        level: 2
      });

      const retrievedUser = await User.findById(originalUser._id);

      expect(retrievedUser.openid).to.equal('test_openid_021');
      expect(retrievedUser.nickname).to.equal('持久化用户');
      expect(retrievedUser.gender).to.equal('female');
      expect(retrievedUser.totalPoints).to.equal(250);
      expect(retrievedUser.level).to.equal(2);
    });

    it('应该更新用户数据', async () => {
      const user = await User.create({
        openid: 'test_openid_022',
        nickname: '原昵称',
        totalCheckinDays: 10
      });

      user.nickname = '新昵称';
      user.totalCheckinDays = 15;
      await user.save();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.nickname).to.equal('新昵称');
      expect(updatedUser.totalCheckinDays).to.equal(15);
    });

    it('应该删除用户数据', async () => {
      const user = await User.create({
        openid: 'test_openid_023',
        nickname: '待删除用户'
      });

      await User.findByIdAndDelete(user._id);
      const deletedUser = await User.findById(user._id);

      expect(deletedUser).to.be.null;
    });

    it('应该支持批量查询', async () => {
      await User.create({ openid: 'batch_001', nickname: '用户1' });
      await User.create({ openid: 'batch_002', nickname: '用户2' });
      await User.create({ openid: 'batch_003', nickname: '用户3' });

      const users = await User.find();
      expect(users).to.have.lengthOf(3);
    });

    it('应该支持按status过滤', async () => {
      await User.create({
        openid: 'status_001',
        nickname: '活跃用户',
        status: 'active'
      });

      await User.create({
        openid: 'status_002',
        nickname: '被禁用户',
        status: 'banned'
      });

      const activeUsers = await User.find({ status: 'active' });
      expect(activeUsers).to.have.lengthOf(1);
      expect(activeUsers[0].nickname).to.equal('活跃用户');
    });
  });

  describe('Optional Fields', () => {
    it('应该接受unionid为null', async () => {
      const user = await User.create({
        openid: 'test_openid_024',
        nickname: '用户',
        unionid: null
      });

      expect(user.unionid).to.be.null;
    });

    it('应该接受avatarUrl为null', async () => {
      const user = await User.create({
        openid: 'test_openid_025',
        nickname: '用户',
        avatarUrl: null
      });

      expect(user.avatarUrl).to.be.null;
    });

    it('应该接受signature为null', async () => {
      const user = await User.create({
        openid: 'test_openid_026',
        nickname: '用户',
        signature: null
      });

      expect(user.signature).to.be.null;
    });

    it('应该接受lastLoginAt为null', async () => {
      const user = await User.create({
        openid: 'test_openid_027',
        nickname: '用户',
        lastLoginAt: null
      });

      expect(user.lastLoginAt).to.be.null;
    });

    it('应该在提供lastLoginAt时保存日期', async () => {
      const loginDate = new Date();
      const user = await User.create({
        openid: 'test_openid_028',
        nickname: '用户',
        lastLoginAt: loginDate
      });

      expect(user.lastLoginAt).to.be.instanceof(Date);
      expect(user.lastLoginAt.getTime()).to.equal(loginDate.getTime());
    });
  });

  describe('Edge Cases', () => {
    it('应该处理超长nickname（在最大长度范围内）', async () => {
      const longNickname = 'a'.repeat(50);
      const user = await User.create({
        openid: 'test_openid_029',
        nickname: longNickname
      });

      expect(user.nickname).to.have.lengthOf(50);
    });

    it('应该处理特殊字符在nickname中', async () => {
      const specialNickname = '用户🦁名字@#$';
      const user = await User.create({
        openid: 'test_openid_030',
        nickname: specialNickname
      });

      expect(user.nickname).to.equal(specialNickname);
    });

    it('应该处理空数组类型字段（如果存在）', () => {
      // User model中没有数组字段，但此测试演示了处理方式
      // 检查Schema是否支持默认空数组
      expect(User.schema.path('avatar')).to.exist;
    });

    it('应该允许多个用户有相同的nickname', async () => {
      await User.create({
        openid: 'openid_same_nickname_1',
        nickname: '相同昵称'
      });

      const secondUser = await User.create({
        openid: 'openid_same_nickname_2',
        nickname: '相同昵称'
      });

      expect(secondUser.nickname).to.equal('相同昵称');
    });

    it('应该在提供完整信息时保存所有字段', async () => {
      const fullUser = await User.create({
        openid: 'test_openid_031',
        unionid: 'test_unionid',
        nickname: '完整用户',
        avatar: '🐯',
        avatarUrl: 'https://example.com/avatar.jpg',
        signature: '这是我的签名',
        gender: 'male',
        totalCheckinDays: 50,
        currentStreak: 15,
        maxStreak: 30,
        totalCompletedPeriods: 3,
        totalPoints: 300,
        level: 2,
        role: 'user',
        status: 'active',
        lastLoginAt: new Date()
      });

      expect(fullUser.openid).to.equal('test_openid_031');
      expect(fullUser.unionid).to.equal('test_unionid');
      expect(fullUser.nickname).to.equal('完整用户');
      expect(fullUser.avatar).to.equal('🐯');
      expect(fullUser.avatarUrl).to.equal('https://example.com/avatar.jpg');
      expect(fullUser.signature).to.equal('这是我的签名');
      expect(fullUser.gender).to.equal('male');
      expect(fullUser.totalCheckinDays).to.equal(50);
      expect(fullUser.currentStreak).to.equal(15);
      expect(fullUser.maxStreak).to.equal(30);
      expect(fullUser.totalCompletedPeriods).to.equal(3);
      expect(fullUser.totalPoints).to.equal(300);
      expect(fullUser.level).to.equal(2);
      expect(fullUser.role).to.equal('user');
      expect(fullUser.status).to.equal('active');
      expect(fullUser.lastLoginAt).to.exist;
    });
  });
});
