/**
 * AuditLog Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const AuditLog = require('../../../src/models/AuditLog');

describe('AuditLog Model', () => {
  let userId;
  let adminId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
    userId = new mongoose.Types.ObjectId();
    adminId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await AuditLog.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的审计日志', async () => {
      const log = await AuditLog.create({
        userId,
        action: 'user_created',
        targetType: 'User',
        targetId: userId,
        changes: { nickname: '新用户' }
      });

      expect(log._id).to.exist;
      expect(log.userId.toString()).to.equal(userId.toString());
      expect(log.action).to.equal('user_created');
    });

    it('应该使用默认值', async () => {
      const log = await AuditLog.create({
        userId: new mongoose.Types.ObjectId(),
        action: 'test_action',
        targetType: 'Test',
        targetId: new mongoose.Types.ObjectId()
      });

      expect(log.changes).to.deep.equal({});
      expect(log.status).to.equal('success');
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索审计日志', async () => {
      const log = await AuditLog.create({
        userId,
        action: 'period_updated',
        targetType: 'Period',
        targetId: new mongoose.Types.ObjectId(),
        changes: { status: 'ongoing', enrollmentCount: 50 },
        status: 'success'
      });

      const retrieved = await AuditLog.findById(log._id);
      expect(retrieved.action).to.equal('period_updated');
      expect(retrieved.changes.status).to.equal('ongoing');
      expect(retrieved.status).to.equal('success');
    });

    it('应该支持按userId查询', async () => {
      const u1 = new mongoose.Types.ObjectId();

      await AuditLog.create({
        userId: u1,
        action: 'action1',
        targetType: 'Test',
        targetId: new mongoose.Types.ObjectId()
      });

      await AuditLog.create({
        userId: u1,
        action: 'action2',
        targetType: 'Test',
        targetId: new mongoose.Types.ObjectId()
      });

      const logs = await AuditLog.find({ userId: u1 });
      expect(logs).to.have.lengthOf(2);
    });

    it('应该支持按action查询', async () => {
      const u = new mongoose.Types.ObjectId();

      await AuditLog.create({
        userId: u,
        action: 'created',
        targetType: 'Test',
        targetId: new mongoose.Types.ObjectId()
      });

      await AuditLog.create({
        userId: u,
        action: 'deleted',
        targetType: 'Test',
        targetId: new mongoose.Types.ObjectId()
      });

      const logs = await AuditLog.find({ action: 'created' });
      expect(logs).to.have.lengthOf(1);
    });
  });

  describe('Timestamps', () => {
    it('应该自动创建createdAt', async () => {
      const log = await AuditLog.create({
        userId,
        action: 'test',
        targetType: 'Test',
        targetId: new mongoose.Types.ObjectId()
      });

      expect(log.createdAt).to.exist;
      expect(log.createdAt).to.be.instanceof(Date);
    });
  });
});
