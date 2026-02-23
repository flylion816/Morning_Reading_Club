/**
 * Comment Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Comment = require('../../../src/models/Comment');

describe('Comment Model', () => {
  let userId;
  let targetId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
    userId = new mongoose.Types.ObjectId();
    targetId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await Comment.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的评论', async () => {
      const comment = await Comment.create({
        userId,
        checkinId: targetId,
        content: '很好的分享'
      });

      expect(comment._id).to.exist;
      expect(comment.userId.toString()).to.equal(userId.toString());
      expect(comment.checkinId.toString()).to.equal(targetId.toString());
      expect(comment.content).to.equal('很好的分享');
    });

    it('应该使用默认值', async () => {
      const comment = await Comment.create({
        userId,
        checkinId: targetId,
        content: '内容'
      });

      expect(comment.replyCount).to.equal(0);
      expect(comment.replies).to.deep.equal([]);
    });

    it('应该在缺少必填字段时抛出错误', async () => {
      try {
        await Comment.create({
          userId,
          checkinId: targetId
          // 缺少content
        });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('content');
      }
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索评论数据', async () => {
      const comment = await Comment.create({
        userId,
        checkinId: targetId,
        content: '评论内容'
      });

      const retrieved = await Comment.findById(comment._id);
      expect(retrieved.content).to.equal('评论内容');
      expect(retrieved.replyCount).to.equal(0);
    });

    it('应该支持按checkinId查询', async () => {
      const t1 = new mongoose.Types.ObjectId();

      await Comment.create({
        userId,
        checkinId: t1,
        content: '评论1'
      });

      await Comment.create({
        userId: new mongoose.Types.ObjectId(),
        checkinId: t1,
        content: '评论2'
      });

      const comments = await Comment.find({ checkinId: t1 });
      expect(comments).to.have.lengthOf(2);
    });
  });

  describe('Timestamps', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const comment = await Comment.create({
        userId,
        checkinId: targetId,
        content: '内容'
      });

      expect(comment.createdAt).to.exist;
      expect(comment.updatedAt).to.exist;
    });
  });
});
