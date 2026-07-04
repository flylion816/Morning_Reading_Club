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

    it('按活动类型筛选时兼容单选字段和多选字段', async () => {
      req.query = { activityType: 'tea' };
      const imprintId = new mongoose.Types.ObjectId();
      const list = [{
        _id: imprintId,
        title: '下午茶',
        activityType: 'cooking',
        activityTypes: ['cooking', 'tea'],
        authorId: { _id: new mongoose.Types.ObjectId(), nickname: '作者', avatarUrl: '' },
        attendees: []
      }];

      ImprintStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(list)
      });
      ImprintStub.countDocuments.resolves(1);
      ImprintReactionStub.find.returns({ lean: sandbox.stub().resolves([]) });

      await controller.list(req, res);

      const filter = ImprintStub.find.getCall(0).args[0];
      expect(filter.$and[0].$or).to.deep.equal([
        { activityTypes: 'tea' },
        { activityType: 'tea' }
      ]);
      const payload = res.json.getCall(0).args[0];
      expect(payload.data.list[0].activityTypes).to.deep.equal(['cooking', 'tea']);
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

    it('支持创建多活动类型印记并保留旧 activityType 字段', async () => {
      req.body = {
        title: '做饭喝茶',
        activityTypes: ['cooking', 'tea'],
        mediaList: [{ type: 'image', url: 'https://example.com/a.jpg' }]
      };
      ImprintActivityTypeStub.countDocuments.resolves(1);
      ImprintStub.create.resolves({ _id: new mongoose.Types.ObjectId(), title: '做饭喝茶' });

      await controller.create(req, res);

      expect(res.status.calledWith(201)).to.equal(true);
      const created = ImprintStub.create.getCall(0).args[0];
      expect(created.activityType).to.equal('cooking');
      expect(created.activityTypes).to.deep.equal(['cooking', 'tea']);
    });
  });

  describe('update', () => {
    // H6 回归：update 复用 create 的字段校验
    function stubExistingImprint(authorId) {
      ImprintStub.findById.returns({
        lean: sandbox.stub().resolves({
          _id: new mongoose.Types.ObjectId(),
          title: '旧标题',
          authorId
        })
      });
    }

    it('应该返回400当标题被改为空白', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.body = { title: '   ' };
      stubExistingImprint(req.user._id);

      await controller.update(req, res);

      expect(res.status.calledWith(400)).to.equal(true);
      expect(ImprintStub.findByIdAndUpdate.called).to.equal(false);
    });

    it('应该返回400当标题超过30字', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.body = { title: '字'.repeat(31) };
      stubExistingImprint(req.user._id);

      await controller.update(req, res);

      expect(res.status.calledWith(400)).to.equal(true);
      expect(ImprintStub.findByIdAndUpdate.called).to.equal(false);
    });

    it('应该返回400当活动类型无效', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.body = { activityType: 'invalid_type' };
      stubExistingImprint(req.user._id);
      ImprintActivityTypeStub.countDocuments.resolves(0);

      await controller.update(req, res);

      expect(res.status.calledWith(400)).to.equal(true);
      expect(ImprintStub.findByIdAndUpdate.called).to.equal(false);
    });

    it('更新多活动类型时去重并同步旧 activityType 字段', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.body = { activityTypes: ['tea', 'cooking', 'tea'] };
      stubExistingImprint(req.user._id);
      ImprintActivityTypeStub.countDocuments.resolves(1);
      ImprintStub.findByIdAndUpdate.resolves({});

      await controller.update(req, res);

      expect(ImprintStub.findByIdAndUpdate.calledOnce).to.equal(true);
      const update = ImprintStub.findByIdAndUpdate.getCall(0).args[1];
      expect(update.activityType).to.equal('tea');
      expect(update.activityTypes).to.deep.equal(['tea', 'cooking']);
    });
  });

  describe('cancelAttend', () => {
    // H7 回归：取消在场需要存在性检查和 owner 校验
    it('应该返回404当印记不存在', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      ImprintStub.findById.returns({ lean: sandbox.stub().resolves(null) });

      await controller.cancelAttend(req, res);

      expect(res.status.calledWith(404)).to.equal(true);
      expect(ImprintStub.findByIdAndUpdate.called).to.equal(false);
    });

    it('应该返回403当自己不在在场列表中', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      ImprintStub.findById.returns({
        lean: sandbox.stub().resolves({
          _id: new mongoose.Types.ObjectId(),
          attendees: [{ userId: new mongoose.Types.ObjectId() }]
        })
      });

      await controller.cancelAttend(req, res);

      expect(res.status.calledWith(403)).to.equal(true);
      expect(ImprintStub.findByIdAndUpdate.called).to.equal(false);
    });

    it('应该成功移除自己的在场记录', async () => {
      const imprintId = new mongoose.Types.ObjectId().toString();
      req.params = { id: imprintId };
      ImprintStub.findById.returns({
        lean: sandbox.stub().resolves({
          _id: imprintId,
          attendees: [{ userId: req.user._id }]
        })
      });
      ImprintStub.findByIdAndUpdate.resolves({});

      await controller.cancelAttend(req, res);

      expect(ImprintStub.findByIdAndUpdate.calledOnce).to.equal(true);
      const [calledId, update] = ImprintStub.findByIdAndUpdate.getCall(0).args;
      expect(calledId).to.equal(imprintId);
      expect(update.$pull.attendees.userId.toString()).to.equal(req.user._id.toString());
      expect(res.json.called).to.equal(true);
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
