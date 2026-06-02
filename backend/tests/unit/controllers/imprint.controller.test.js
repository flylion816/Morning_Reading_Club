const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Imprint Controller', () => {
  let sandbox;
  let req;
  let res;
  let ImprintStub;
  let ImprintReactionStub;
  let ImprintCommentStub;
  let ImprintActivityTypeStub;
  let UserStub;
  let dispatchNotificationWithSubscribeStub;
  let controller;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = {
      body: {},
      params: {},
      query: {},
      user: {
        _id: new mongoose.Types.ObjectId(),
        nickname: '测试用户'
      }
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    ImprintStub = {
      find: sandbox.stub(),
      countDocuments: sandbox.stub(),
      create: sandbox.stub(),
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub()
    };
    ImprintReactionStub = {
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      create: sandbox.stub(),
      findOneAndDelete: sandbox.stub()
    };
    ImprintCommentStub = {
      find: sandbox.stub(),
      countDocuments: sandbox.stub(),
      create: sandbox.stub(),
      findById: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      deleteMany: sandbox.stub()
    };
    ImprintActivityTypeStub = {
      countDocuments: sandbox.stub()
    };
    UserStub = {
      findById: sandbox.stub()
    };
    dispatchNotificationWithSubscribeStub = sandbox.stub().resolves();

    controller = proxyquire('../../../src/controllers/imprint.controller', {
      '../models/Imprint': ImprintStub,
      '../models/ImprintReaction': ImprintReactionStub,
      '../models/ImprintComment': ImprintCommentStub,
      '../models/ImprintActivityType': ImprintActivityTypeStub,
      '../models/User': UserStub,
      '../services/user-notification.service': {
        dispatchNotificationWithSubscribe: dispatchNotificationWithSubscribeStub
      },
      '../utils/notification-links': {
        formatNotificationTime: () => '2026-06-02 10:00',
        truncateText: (text) => text
      },
      '../utils/logger': {
        warn: sandbox.stub(),
        error: sandbox.stub()
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('list', () => {
    it('按 updatedAt 倒序查询并返回当前用户反应映射', async () => {
      const imprintId = new mongoose.Types.ObjectId();
      const authorId = new mongoose.Types.ObjectId();
      const list = [{
        _id: imprintId,
        title: '下午茶',
        authorId: { _id: authorId, nickname: '作者', avatarUrl: '' },
        attendees: [],
        reactionCounts: { gonming: 1, ran: 0, xiangqu: 0 }
      }];
      const sortStub = sandbox.stub().returnsThis();

      ImprintStub.find.returns({
        sort: sortStub,
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(list)
      });
      ImprintStub.countDocuments.resolves(1);
      ImprintReactionStub.find.returns({
        lean: sandbox.stub().resolves([{ imprintId, userId: req.user._id, type: 'gonming' }])
      });

      await controller.list(req, res);

      expect(sortStub.calledWith({ updatedAt: -1 })).to.equal(true);
      const payload = res.json.getCall(0).args[0];
      expect(payload.code).to.equal(0);
      expect(payload.data.total).to.equal(1);
      expect(payload.data.myReactions[imprintId.toString()]).to.equal('gonming');
      expect(payload.data.list[0].author.nickname).to.equal('作者');
    });
  });

  describe('create', () => {
    it('拒绝无效活动类型', async () => {
      req.body = {
        title: '下午茶',
        activityType: 'invalid',
        mediaList: [{ type: 'image', url: 'https://example.com/a.jpg' }]
      };
      ImprintActivityTypeStub.countDocuments.resolves(0);

      await controller.create(req, res);

      expect(res.status.calledWith(400)).to.equal(true);
      expect(ImprintStub.create.called).to.equal(false);
    });

    it('创建印记后通知被添加的注册在场人', async () => {
      const attendeeId = new mongoose.Types.ObjectId();
      const imprintId = new mongoose.Types.ObjectId();
      req.body = {
        title: '下午茶',
        activityType: 'tea',
        mediaList: [{ type: 'image', url: 'https://example.com/a.jpg' }],
        attendees: [{ userId: attendeeId, name: '书友', isRegistered: true }]
      };
      ImprintActivityTypeStub.countDocuments.resolves(1);
      ImprintStub.create.resolves({ _id: imprintId, title: '下午茶' });

      await controller.create(req, res);

      expect(res.status.calledWith(201)).to.equal(true);
      expect(ImprintStub.create.calledOnce).to.equal(true);
      expect(dispatchNotificationWithSubscribeStub.calledOnce).to.equal(true);
      const notification = dispatchNotificationWithSubscribeStub.getCall(0).args[1];
      expect(notification.recipientUserId.toString()).to.equal(attendeeId.toString());
      expect(notification.targetPage).to.equal(`pages/zaichang/detail/detail?id=${imprintId}`);
    });
  });

  describe('react', () => {
    it('首次共鸣时创建记录、增加计数并通知作者', async () => {
      const imprintId = new mongoose.Types.ObjectId();
      const authorId = new mongoose.Types.ObjectId();
      req.params = { id: imprintId.toString() };
      req.body = { type: 'ran' };

      ImprintStub.findById.returns({
        lean: sandbox.stub().resolves({ _id: imprintId, title: '下午茶', authorId })
      });
      ImprintReactionStub.findOne.resolves(null);
      ImprintReactionStub.create.resolves({});
      ImprintStub.findByIdAndUpdate.resolves({});

      await controller.react(req, res);

      expect(ImprintReactionStub.create.calledWith({
        imprintId: imprintId.toString(),
        userId: req.user._id,
        type: 'ran'
      })).to.equal(true);
      expect(ImprintStub.findByIdAndUpdate.calledWith(
        imprintId.toString(),
        { $inc: { 'reactionCounts.ran': 1 } }
      )).to.equal(true);
      expect(dispatchNotificationWithSubscribeStub.calledOnce).to.equal(true);
    });
  });
});
