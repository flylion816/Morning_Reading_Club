/**
 * Backup Controller 集成测试
 *
 * 测试 MongoDB 单条记录的 CRUD 操作完整的 HTTP 流程：
 * - PUT /api/v1/backup/mongodb/record (更新)
 * - DELETE /api/v1/backup/mongodb/record (删除)
 */

const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { withSystemContext } = require('../../src/utils/tenantContext');

let app;
let User;
let Admin;
let Period;
let adminUser;
let adminToken;

describe('Backup Integration - MongoDB 记录 CRUD 操作', () => {
  before(async function() {
    this.timeout(60000);

    User = require('../../src/models/User');
    Admin = require('../../src/models/Admin');
    Period = require('../../src/models/Period');

    app = require('../../src/server');

    // 创建管理员用户（用于认证）
    adminUser = await withSystemContext(null, () => Admin.create({
      email: 'backup-test@admin.com',
      password: 'test-password-123',
      name: '备份测试管理员',
      role: 'admin'
    }));

    // 生成 admin token
    adminToken = jwt.sign(
      { adminId: adminUser._id.toString(), role: 'platform_superadmin' },
      process.env.JWT_SECRET || 'dev-secret-key-12345678',
      { expiresIn: '7d' }
    );
  });

  after(async function() {
    this.timeout(30000);
    try {
      await withSystemContext(null, async () => {
        await User.deleteMany({});
        await Admin.deleteMany({});
        await Period.deleteMany({});
      });
    } catch (err) {
      console.log('Error clearing test data:', err.message);
    }
  });

  beforeEach(async () => {
    await withSystemContext(null, async () => {
      await User.deleteMany({});
      await Period.deleteMany({});
    });
  });

  // =========================================================================
  // PUT /api/v1/backup/mongodb/record - 更新记录
  // =========================================================================

  describe('PUT /api/v1/backup/mongodb/record', () => {
    it('应该成功更新 MongoDB 记录', async () => {
      const testUser = await withSystemContext(null, () => User.create({
        openid: 'test-user-001',
        nickname: '原始昵称',
        avatar: '🦁',
        gender: 'male'
      }));

      const res = await request(app)
        .put('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          table: 'users',
          id: testUser._id.toString(),
          data: {
            nickname: '更新后的昵称',
            gender: 'female'
          }
        });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('code', 0);
      expect(res.body.data).to.have.property('nickname', '更新后的昵称');
      expect(res.body.data).to.have.property('gender', 'female');

      const updatedUser = await withSystemContext(null, () => User.findById(testUser._id).exec());
      expect(updatedUser.nickname).to.equal('更新后的昵称');
      expect(updatedUser.gender).to.equal('female');
    });

    it('应该防止修改 _id 字段', async () => {
      const testUser = await withSystemContext(null, () => User.create({
        openid: 'test-user-002',
        nickname: '测试用户',
        avatar: '🦁'
      }));

      const newId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          table: 'users',
          id: testUser._id.toString(),
          data: {
            _id: newId.toString(),
            nickname: '新昵称'
          }
        });

      expect(res.status).to.equal(200);

      const user = await withSystemContext(null, () => User.findById(testUser._id).exec());
      expect(user._id.toString()).to.equal(testUser._id.toString());
      expect(user._id.toString()).to.not.equal(newId.toString());
    });

    it('应该返回 401 当无有效的 token', async () => {
      const testUser = await withSystemContext(null, () => User.create({
        openid: 'test-user-003',
        nickname: '测试用户'
      }));

      const res = await request(app)
        .put('/api/v1/backup/mongodb/record')
        .send({
          table: 'users',
          id: testUser._id.toString(),
          data: { nickname: '新昵称' }
        });

      expect(res.status).to.equal(401);
    });

    it('应该返回 400 当缺少必要参数', async () => {
      const res = await request(app)
        .put('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          table: 'users'
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('缺少参数');
    });

    it('应该返回 400 当集合名无效', async () => {
      const res = await request(app)
        .put('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          table: 'invalid_collection',
          id: new mongoose.Types.ObjectId().toString(),
          data: { nickname: '新昵称' }
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('无效的集合名');
    });

    it('应该返回 404 当记录不存在', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .put('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          table: 'users',
          id: nonExistentId.toString(),
          data: { nickname: '新昵称' }
        });

      expect(res.status).to.equal(404);
      expect(res.body.message).to.include('记录不存在');
    });

    it('应该支持更新不同集合的记录', async () => {
      const testPeriod = await withSystemContext(null, () => Period.create({
        name: '原始期次名称',
        description: '期次描述',
        status: 'not_started',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31')
      }));

      const res = await request(app)
        .put('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          table: 'periods',
          id: testPeriod._id.toString(),
          data: {
            name: '更新后的期次名称'
          }
        });

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('name', '更新后的期次名称');

      const updatedPeriod = await withSystemContext(null, () => Period.findById(testPeriod._id).exec());
      expect(updatedPeriod.name).to.equal('更新后的期次名称');
    });
  });

  // =========================================================================
  // DELETE /api/v1/backup/mongodb/record - 删除记录
  // =========================================================================

  describe('DELETE /api/v1/backup/mongodb/record', () => {
    it('应该成功删除 MongoDB 记录', async () => {
      const testUser = await withSystemContext(null, () => User.create({
        openid: 'test-user-delete-001',
        nickname: '待删除用户',
        avatar: '🦁'
      }));

      const res = await request(app)
        .delete('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          table: 'users',
          id: testUser._id.toString()
        });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('code', 0);
      expect(res.body.message).to.include('记录已删除');

      const user = await withSystemContext(null, () => User.findById(testUser._id).exec());
      expect(user).to.be.null;
    });

    it('应该返回 401 当无有效的 token', async () => {
      const testUser = await withSystemContext(null, () => User.create({
        openid: 'test-user-delete-002',
        nickname: '待删除用户'
      }));

      const res = await request(app)
        .delete('/api/v1/backup/mongodb/record')
        .query({
          table: 'users',
          id: testUser._id.toString()
        });

      expect(res.status).to.equal(401);

      const user = await withSystemContext(null, () => User.findById(testUser._id).exec());
      expect(user).to.not.be.null;
    });

    it('应该返回 400 当缺少必要参数', async () => {
      const res = await request(app)
        .delete('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          table: 'users'
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('缺少参数');
    });

    it('应该返回 400 当集合名无效', async () => {
      const res = await request(app)
        .delete('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          table: 'invalid_collection',
          id: new mongoose.Types.ObjectId().toString()
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('无效的集合名');
    });

    it('应该返回 404 当记录不存在', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          table: 'users',
          id: nonExistentId.toString()
        });

      expect(res.status).to.equal(404);
      expect(res.body.message).to.include('记录不存在');
    });

    it('应该支持删除不同集合的记录', async () => {
      const testPeriod = await withSystemContext(null, () => Period.create({
        name: '待删除期次',
        description: '期次描述',
        status: 'not_started',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31')
      }));

      const res = await request(app)
        .delete('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          table: 'periods',
          id: testPeriod._id.toString()
        });

      expect(res.status).to.equal(200);

      const period = await withSystemContext(null, () => Period.findById(testPeriod._id).exec());
      expect(period).to.be.null;
    });

    it('应该在删除前保存完整的文档数据用于同步', async () => {
      const testUser = await withSystemContext(null, () => User.create({
        openid: 'test-user-delete-003',
        nickname: '待删除用户',
        avatar: '🦁',
        gender: 'male'
      }));

      const res = await request(app)
        .delete('/api/v1/backup/mongodb/record')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          table: 'users',
          id: testUser._id.toString()
        });

      expect(res.status).to.equal(200);
      expect(res.body.message).to.include('记录已删除');

      const user = await withSystemContext(null, () => User.findById(testUser._id).exec());
      expect(user).to.be.null;
    });
  });

  // =========================================================================
  // 权限检查
  // =========================================================================

  describe('Admin 权限检查', () => {
    it('非管理员不能访问更新 API', async () => {
      const testUser = await withSystemContext(null, () => User.create({
        openid: 'test-user-004',
        nickname: '测试用户'
      }));

      const res = await request(app)
        .put('/api/v1/backup/mongodb/record')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          table: 'users',
          id: testUser._id.toString(),
          data: { nickname: '新昵称' }
        });

      expect(res.status).to.equal(401);
    });

    it('非管理员不能访问删除 API', async () => {
      const testUser = await withSystemContext(null, () => User.create({
        openid: 'test-user-005',
        nickname: '测试用户'
      }));

      const res = await request(app)
        .delete('/api/v1/backup/mongodb/record')
        .set('Authorization', 'Bearer invalid-token')
        .query({
          table: 'users',
          id: testUser._id.toString()
        });

      expect(res.status).to.equal(401);

      const user = await withSystemContext(null, () => User.findById(testUser._id).exec());
      expect(user).to.not.be.null;
    });
  });
});
