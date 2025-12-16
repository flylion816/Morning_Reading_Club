/**
 * Insight Model 单元测试 - 小凡看见（观点分享）
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Insight = require('../../../src/models/Insight');

describe('Insight Model', () => {
  let userId;
  let targetUserId;
  let periodId;
  let sectionId;
  let checkinId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
    userId = new mongoose.Types.ObjectId();
    targetUserId = new mongoose.Types.ObjectId();
    periodId = new mongoose.Types.ObjectId();
    sectionId = new mongoose.Types.ObjectId();
    checkinId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await Insight.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的观点分享', async () => {
      const insight = await Insight.create({
        userId,
        periodId,
        content: '这是一个很好的观点分享'
      });

      expect(insight._id).to.exist;
      expect(insight.userId.toString()).to.equal(userId.toString());
      expect(insight.periodId.toString()).to.equal(periodId.toString());
      expect(insight.content).to.equal('这是一个很好的观点分享');
    });

    it('应该在缺少userId时抛出验证错误', async () => {
      try {
        await Insight.create({
          periodId,
          content: '内容'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('userId');
      }
    });

    it('应该在缺少periodId时抛出验证错误', async () => {
      try {
        await Insight.create({
          userId,
          content: '内容'
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('periodId');
      }
    });

    it('应该在缺少content时抛出验证错误', async () => {
      try {
        await Insight.create({
          userId,
          periodId
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('content');
      }
    });

    it('应该使用默认值', async () => {
      const insight = await Insight.create({
        userId,
        periodId,
        content: '内容'
      });

      expect(insight.targetUserId).to.be.null;
      expect(insight.type).to.equal('daily');
      expect(insight.mediaType).to.equal('text');
      expect(insight.isPublic).to.be.true;
      expect(insight.likeCount).to.equal(0);
    });

    it('应该接受有效的type值', async () => {
      const types = ['daily', 'weekly', 'monthly', 'insight'];
      for (const type of types) {
        const insight = await Insight.create({
          userId: new mongoose.Types.ObjectId(),
          periodId: new mongoose.Types.ObjectId(),
          content: '内容',
          type
        });
        expect(insight.type).to.equal(type);
      }
    });

    it('应该接受有效的mediaType值', async () => {
      const mediaTypes = ['text', 'image'];
      for (const mediaType of mediaTypes) {
        const insight = await Insight.create({
          userId: new mongoose.Types.ObjectId(),
          periodId: new mongoose.Types.ObjectId(),
          content: '内容',
          mediaType
        });
        expect(insight.mediaType).to.equal(mediaType);
      }
    });
  });

  describe('Field Constraints', () => {
    it('应该验证content最大长度', async () => {
      try {
        await Insight.create({
          userId,
          periodId,
          content: 'a'.repeat(2001)
        });
        expect.fail('应该抛出长度验证错误');
      } catch (err) {
        expect(err.message).to.include('content');
      }
    });

    it('应该验证likeCount最小值', async () => {
      try {
        await Insight.create({
          userId,
          periodId,
          content: '内容',
          likeCount: -1
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('likeCount');
      }
    });

    it('应该接受很大的likeCount', async () => {
      const insight = await Insight.create({
        userId,
        periodId,
        content: '内容',
        likeCount: 10000
      });

      expect(insight.likeCount).to.equal(10000);
    });
  });

  describe('References', () => {
    it('应该保存userId引用', async () => {
      const insight = await Insight.create({
        userId,
        periodId,
        content: '内容'
      });

      expect(insight.userId.toString()).to.equal(userId.toString());
    });

    it('应该保存targetUserId引用（可选）', async () => {
      const insight = await Insight.create({
        userId,
        targetUserId,
        periodId,
        content: '内容'
      });

      expect(insight.targetUserId.toString()).to.equal(targetUserId.toString());
    });

    it('应该接受null的targetUserId', async () => {
      const insight = await Insight.create({
        userId,
        periodId,
        content: '内容',
        targetUserId: null
      });

      expect(insight.targetUserId).to.be.null;
    });
  });

  describe('Boolean Fields', () => {
    it('应该接受isPublic为true', async () => {
      const insight = await Insight.create({
        userId,
        periodId,
        content: '内容',
        isPublic: true
      });

      expect(insight.isPublic).to.be.true;
    });

    it('应该接受isPublic为false', async () => {
      const insight = await Insight.create({
        userId,
        periodId,
        content: '内容',
        isPublic: false
      });

      expect(insight.isPublic).to.be.false;
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索观点分享数据', async () => {
      const insight = await Insight.create({
        userId,
        targetUserId,
        checkinId,
        periodId,
        sectionId,
        day: 5,
        type: 'daily',
        mediaType: 'text',
        content: '这是一个有深度的观点分享',
        isPublic: true,
        likeCount: 25
      });

      const retrieved = await Insight.findById(insight._id);

      expect(retrieved.userId.toString()).to.equal(userId.toString());
      expect(retrieved.targetUserId.toString()).to.equal(targetUserId.toString());
      expect(retrieved.type).to.equal('daily');
      expect(retrieved.mediaType).to.equal('text');
      expect(retrieved.content).to.equal('这是一个有深度的观点分享');
      expect(retrieved.isPublic).to.be.true;
      expect(retrieved.likeCount).to.equal(25);
    });

    it('应该支持按userId查询', async () => {
      const u1 = new mongoose.Types.ObjectId();
      const u2 = new mongoose.Types.ObjectId();
      const p = new mongoose.Types.ObjectId();

      await Insight.create({ userId: u1, periodId: p, content: '内容1' });
      await Insight.create({ userId: u1, periodId: p, content: '内容2' });
      await Insight.create({ userId: u2, periodId: p, content: '内容3' });

      const insights = await Insight.find({ userId: u1 });
      expect(insights).to.have.lengthOf(2);
    });

    it('应该支持按periodId查询', async () => {
      const u = new mongoose.Types.ObjectId();
      const p1 = new mongoose.Types.ObjectId();
      const p2 = new mongoose.Types.ObjectId();

      await Insight.create({ userId: u, periodId: p1, content: '内容1' });
      await Insight.create({ userId: u, periodId: p1, content: '内容2' });
      await Insight.create({ userId: u, periodId: p2, content: '内容3' });

      const insights = await Insight.find({ periodId: p1 });
      expect(insights).to.have.lengthOf(2);
    });

    it('应该支持按type查询', async () => {
      const u = new mongoose.Types.ObjectId();
      const p = new mongoose.Types.ObjectId();

      await Insight.create({ userId: u, periodId: p, content: '内容1', type: 'daily' });
      await Insight.create({ userId: u, periodId: p, content: '内容2', type: 'weekly' });
      await Insight.create({ userId: u, periodId: p, content: '内容3', type: 'daily' });

      const insights = await Insight.find({ type: 'daily' });
      expect(insights).to.have.lengthOf(2);
    });
  });

  describe('Timestamps', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const insight = await Insight.create({
        userId,
        periodId,
        content: '内容'
      });

      expect(insight.createdAt).to.exist;
      expect(insight.updatedAt).to.exist;
      expect(insight.createdAt).to.be.instanceof(Date);
    });
  });

  describe('Edge Cases', () => {
    it('应该处理很长的content', async () => {
      const longContent = 'a'.repeat(2000);
      const insight = await Insight.create({
        userId,
        periodId,
        content: longContent
      });

      expect(insight.content).to.have.lengthOf(2000);
    });

    it('应该支持特殊字符在content中', async () => {
      const specialContent = '观点分享 🎉 @#$%^&*()';
      const insight = await Insight.create({
        userId,
        periodId,
        content: specialContent
      });

      expect(insight.content).to.equal(specialContent);
    });
  });
});
