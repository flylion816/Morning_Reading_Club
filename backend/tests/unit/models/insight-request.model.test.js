/**
 * InsightRequest Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const InsightRequest = require('../../../src/models/InsightRequest');

describe('InsightRequest Model', () => {
  let userId;
  let targetUserId;
  let periodId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
    userId = new mongoose.Types.ObjectId();
    targetUserId = new mongoose.Types.ObjectId();
    periodId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await InsightRequest.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的观点请求', async () => {
      const request = await InsightRequest.create({
        requesterId: userId,
        targetUserId,
        periodId,
        message: '可以分享你的想法吗？'
      });

      expect(request._id).to.exist;
      expect(request.requesterId.toString()).to.equal(userId.toString());
      expect(request.status).to.equal('pending');
    });

    it('应该使用默认值', async () => {
      const request = await InsightRequest.create({
        requesterId: new mongoose.Types.ObjectId(),
        targetUserId: new mongoose.Types.ObjectId(),
        periodId: new mongoose.Types.ObjectId(),
        message: '请求'
      });

      expect(request.status).to.equal('pending');
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索请求数据', async () => {
      const request = await InsightRequest.create({
        requesterId: userId,
        targetUserId,
        periodId,
        message: '分享想法',
        status: 'accepted'
      });

      const retrieved = await InsightRequest.findById(request._id);
      expect(retrieved.message).to.equal('分享想法');
      expect(retrieved.status).to.equal('accepted');
    });

    it('应该支持按targetUserId查询', async () => {
      const requester = new mongoose.Types.ObjectId();
      const target = new mongoose.Types.ObjectId();
      const p = new mongoose.Types.ObjectId();

      await InsightRequest.create({
        requesterId: requester,
        targetUserId: target,
        periodId: p,
        message: '请求1'
      });

      await InsightRequest.create({
        requesterId: new mongoose.Types.ObjectId(),
        targetUserId: target,
        periodId: p,
        message: '请求2'
      });

      const requests = await InsightRequest.find({ targetUserId: target });
      expect(requests).to.have.lengthOf(2);
    });
  });

  describe('Timestamps', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const request = await InsightRequest.create({
        requesterId: userId,
        targetUserId,
        periodId,
        message: '测试请求'
      });

      expect(request.createdAt).to.exist;
      expect(request.updatedAt).to.exist;
    });
  });
});
