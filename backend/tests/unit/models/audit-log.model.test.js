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
        adminId,
        adminName: '测试管理员',
        actionType: 'CREATE',
        resourceType: 'user',
        resourceId: userId
      });

      expect(log._id).to.exist;
      expect(log.adminId.toString()).to.equal(adminId.toString());
      expect(log.actionType).to.equal('CREATE');
    });

    it('应该使用默认值', async () => {
      const log = await AuditLog.create({
        adminId: new mongoose.Types.ObjectId(),
        adminName: '测试管理员',
        actionType: 'CREATE',
        resourceType: 'user'
      });

      expect(log.status).to.equal('success');
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索审计日志', async () => {
      const log = await AuditLog.create({
        adminId,
        adminName: '测试管理员',
        actionType: 'UPDATE',
        resourceType: 'period',
        resourceId: new mongoose.Types.ObjectId(),
        status: 'success'
      });

      const retrieved = await AuditLog.findById(log._id);
      expect(retrieved.actionType).to.equal('UPDATE');
      expect(retrieved.status).to.equal('success');
    });

    it('应该支持按adminId查询', async () => {
      const a1 = new mongoose.Types.ObjectId();

      await AuditLog.create({
        adminId: a1,
        adminName: '管理员1',
        actionType: 'CREATE',
        resourceType: 'user'
      });

      await AuditLog.create({
        adminId: a1,
        adminName: '管理员1',
        actionType: 'UPDATE',
        resourceType: 'user'
      });

      const logs = await AuditLog.find({ adminId: a1 });
      expect(logs).to.have.lengthOf(2);
    });

    it('应该支持按actionType查询', async () => {
      const a = new mongoose.Types.ObjectId();

      await AuditLog.create({
        adminId: a,
        adminName: '测试管理员',
        actionType: 'CREATE',
        resourceType: 'user'
      });

      await AuditLog.create({
        adminId: a,
        adminName: '测试管理员',
        actionType: 'DELETE',
        resourceType: 'user'
      });

      const logs = await AuditLog.find({ actionType: 'CREATE' });
      expect(logs).to.have.lengthOf(1);
    });
  });

  describe('Timestamps', () => {
    it('应该自动创建timestamp', async () => {
      const log = await AuditLog.create({
        adminId,
        adminName: '测试管理员',
        actionType: 'CREATE',
        resourceType: 'user'
      });

      expect(log.timestamp).to.exist;
      expect(log.timestamp).to.be.instanceof(Date);
    });
  });
});
