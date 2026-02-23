/**
 * Admin Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Admin = require('../../../src/models/Admin');

describe('Admin Model', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
  });

  afterEach(async () => {
    await Admin.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的管理员账户', async () => {
      const admin = await Admin.create({
        email: 'admin@example.com',
        name: '管理员',
        password: 'Admin123456!',
        role: 'admin'
      });

      expect(admin._id).to.exist;
      expect(admin.email).to.equal('admin@example.com');
      expect(admin.name).to.equal('管理员');
      expect(admin.role).to.equal('admin');
    });

    it('应该使用默认值', async () => {
      const admin = await Admin.create({
        email: 'admin2@example.com',
        name: '管理员2',
        password: 'Admin123456!',
        role: 'admin'
      });

      expect(admin.status).to.equal('active');
      expect(admin.lastLoginAt).to.be.null;
    });

    it('应该强制email唯一性', async () => {
      await Admin.create({
        email: 'unique@example.com',
        name: '管理员1',
        password: 'Admin123456!',
        role: 'admin'
      });

      try {
        await Admin.create({
          email: 'unique@example.com',
          name: '管理员2',
          password: 'Admin123456!',
          role: 'admin'
        });
        expect.fail('应该抛出唯一性错误');
      } catch (err) {
        expect(err.message).to.include('unique');
      }
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索管理员数据', async () => {
      const admin = await Admin.create({
        email: 'test@example.com',
        name: '测试管理员',
        password: 'Admin123456!',
        role: 'admin',
        status: 'active'
      });

      const retrieved = await Admin.findById(admin._id);
      expect(retrieved.email).to.equal('test@example.com');
      expect(retrieved.name).to.equal('测试管理员');
      expect(retrieved.role).to.equal('admin');
    });

    it('应该支持按email查询', async () => {
      await Admin.create({
        email: 'admin3@example.com',
        name: '管理员3',
        password: 'Admin123456!',
        role: 'admin'
      });

      const admin = await Admin.findOne({ email: 'admin3@example.com' });
      expect(admin).to.exist;
      expect(admin.name).to.equal('管理员3');
    });
  });

  describe('Timestamps', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const admin = await Admin.create({
        email: 'time@example.com',
        name: '时间测试',
        password: 'Admin123456!',
        role: 'admin'
      });

      expect(admin.createdAt).to.exist;
      expect(admin.updatedAt).to.exist;
    });
  });
});
