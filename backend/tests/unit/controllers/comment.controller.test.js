/**
 * Comment Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Comment Controller', () => {
  let commentController;
  let sandbox;
  let req;
  let res;
  let next;
  let CommentStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = { body: {}, params: {}, query: {}, user: {} };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    CommentStub = {
      create: sandbox.stub(),
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    // 为 findById 返回值添加 populate 方法链
    CommentStub.findById.returns({
      populate: sandbox.stub().returnsThis()
    });

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    commentController = proxyquire(
      '../../../src/controllers/comment.controller',
      {
        '../models/Comment': CommentStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createComment', () => {
    it('应该创建新评论', async () => {
      const userId = new mongoose.Types.ObjectId();
      const targetId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = { targetId, content: '很好的想法' };

      const mockComment = { _id: new mongoose.Types.ObjectId(), ...req.body, userId };
      const mockPopulatedComment = { ...mockComment, userId: { nickname: '用户名' } };

      CommentStub.create.resolves(mockComment);
      CommentStub.findById.returns({
        populate: sandbox.stub().resolves(mockPopulatedComment)
      });

      await commentController.createComment(req, res, next);

      expect(CommentStub.create.called).to.be.true;
      expect(res.json.called).to.be.true;
    });
  });

  describe('getComments', () => {
    it('应该返回评论列表', async () => {
      const targetId = new mongoose.Types.ObjectId();
      req.params = { targetId };
      req.query = { page: 1, limit: 10 };

      CommentStub.countDocuments.resolves(5);
      CommentStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await commentController.getComments(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('updateComment', () => {
    it('应该更新评论', async () => {
      const userIdStr = '507f1f77bcf86cd799439014';
      const commentId = new mongoose.Types.ObjectId();

      req.user = { userId: userIdStr };
      req.params = { commentId };
      req.body = { content: '更新的内容' };

      const mockComment = {
        _id: commentId,
        userId: userIdStr,
        content: '更新的内容'
      };

      CommentStub.findById.resolves(mockComment);
      CommentStub.findByIdAndUpdate.resolves(mockComment);

      await commentController.updateComment(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回403当修改他人评论', async () => {
      const userId = new mongoose.Types.ObjectId();
      const commentId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { commentId };
      req.body = { content: '新内容' };

      const mockComment = {
        _id: commentId,
        userId: new mongoose.Types.ObjectId()
      };

      CommentStub.findById.resolves(mockComment);

      await commentController.updateComment(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });
  });

  describe('deleteComment', () => {
    it('应该删除评论', async () => {
      const userIdStr = '507f1f77bcf86cd799439015';
      const commentId = new mongoose.Types.ObjectId();

      req.user = { userId: userIdStr };
      req.params = { commentId };

      const mockComment = {
        _id: commentId,
        userId: userIdStr
      };

      CommentStub.findById.resolves(mockComment);
      CommentStub.findByIdAndDelete.resolves(mockComment);

      await commentController.deleteComment(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回404当评论不存在', async () => {
      req.user = { userId: new mongoose.Types.ObjectId() };
      req.params = { commentId: new mongoose.Types.ObjectId() };

      CommentStub.findById.resolves(null);

      await commentController.deleteComment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });
});
