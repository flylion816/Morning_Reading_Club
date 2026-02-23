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
  let CheckinStub;
  let mysqlBackupServiceStub;

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

    CheckinStub = {
      findById: sandbox.stub()
    };

    // Mock mysqlBackupService
    mysqlBackupServiceStub = {
      syncComment: sandbox.stub().resolves()
    };

    // Mock logger
    const loggerStub = {
      warn: sandbox.stub(),
      error: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub()
    };

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
        '../models/Checkin': CheckinStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub,
        '../services/mysql-backup.service': mysqlBackupServiceStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createComment', () => {
    it('应该创建新评论', async () => {
      const userId = new mongoose.Types.ObjectId();
      const checkinId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = { checkinId, content: '很好的想法' };

      const mockCheckin = { _id: checkinId };
      const mockComment = { _id: new mongoose.Types.ObjectId(), ...req.body, userId };
      const mockPopulatedComment = { ...mockComment, userId: { nickname: '用户名' } };

      CheckinStub.findById.resolves(mockCheckin);
      CommentStub.create.resolves(mockComment);

      // 为 findById 配置链式调用：返回有 populate 方法的对象
      const populateStub = sandbox.stub().resolves(mockPopulatedComment);
      CommentStub.findById.returns({
        populate: populateStub
      });

      await commentController.createComment(req, res, next);

      expect(CommentStub.create.called).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
    }).timeout(10000);
  });

  describe('getComments', () => {
    it('应该返回评论列表', async () => {
      const checkinId = new mongoose.Types.ObjectId();
      req.params = { checkinId };
      req.query = { page: 1, limit: 10 };

      CommentStub.countDocuments.resolves(5);
      CommentStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await commentController.getCommentsByCheckin(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('replyToComment', () => {
    it('应该添加回复到评论', async () => {
      const userId = new mongoose.Types.ObjectId();
      const commentId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { commentId };
      req.body = { content: '很好的观点', replyToUserId: null };

      const mockComment = {
        _id: commentId,
        replies: [],
        replyCount: 0,
        save: sandbox.stub().resolves()
      };

      const mockPopulatedComment = {
        ...mockComment,
        userId: { nickname: '用户名' },
        replies: []
      };

      // 第一次 findById：直接 await，返回 mockComment
      // 第二次 findById：链式调用 populate，返回 mockPopulatedComment
      CommentStub.findById
        .onFirstCall()
        .resolves(mockComment)
        .onSecondCall()
        .returns({
          populate: sandbox.stub().returns({
            populate: sandbox.stub().returns({
              populate: sandbox.stub().resolves(mockPopulatedComment)
            })
          })
        });

      await commentController.replyToComment(req, res, next);

      expect(CommentStub.findById.called).to.be.true;
    });

    it('应该返回404当评论不存在', async () => {
      const userId = new mongoose.Types.ObjectId();
      const commentId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { commentId };
      req.body = { content: '回复内容' };

      CommentStub.findById.resolves(null);

      await commentController.replyToComment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
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
