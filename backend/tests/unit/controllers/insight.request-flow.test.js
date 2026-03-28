const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Insight Controller - 单条授权与请求流', () => {
  let sandbox;
  let req;
  let res;
  let next;
  let controller;
  let InsightStub;
  let InsightRequestStub;
  let UserStub;
  let EnrollmentStub;
  let PeriodStub;
  let CheckinStub;
  let SectionStub;
  let publishSyncEventStub;
  let dispatchNotificationWithSubscribeStub;

  const user1Id = new mongoose.Types.ObjectId();
  const user2Id = new mongoose.Types.ObjectId();
  const periodId = new mongoose.Types.ObjectId();
  const insightAId = new mongoose.Types.ObjectId();
  const insightBId = new mongoose.Types.ObjectId();
  const requestId = new mongoose.Types.ObjectId();

  const responseUtils = {
    success: (data, message) => ({ code: 200, message, data }),
    errors: {
      badRequest: message => ({ code: 400, message }),
      notFound: message => ({ code: 404, message }),
      forbidden: message => ({ code: 403, message }),
      unauthorized: message => ({ code: 401, message }),
      serverError: message => ({ code: 500, message })
    }
  };

  function createThenableQuery(result) {
    return {
      populate: sandbox.stub().returnsThis(),
      sort: sandbox.stub().returnsThis(),
      skip: sandbox.stub().returnsThis(),
      limit: sandbox.stub().returnsThis(),
      select: sandbox.stub().returnsThis(),
      lean: sandbox.stub().returnsThis(),
      exec: sandbox.stub().resolves(result),
      then(onFulfilled, onRejected) {
        return Promise.resolve(result).then(onFulfilled, onRejected);
      }
    };
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: {},
      wsManager: { broadcast: sandbox.stub() }
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    InsightStub = {
      findById: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub(),
      create: sandbox.stub(),
      findOne: sandbox.stub()
    };

    InsightRequestStub = {
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      create: sandbox.stub(),
      findById: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub()
    };

    EnrollmentStub = {
      findOne: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub()
    };

    CheckinStub = {
      findById: sandbox.stub()
    };

    SectionStub = {
      findById: sandbox.stub()
    };

    publishSyncEventStub = sandbox.stub();
    dispatchNotificationWithSubscribeStub = sandbox.stub().resolves();

    controller = proxyquire('../../../src/controllers/insight.controller', {
      '../models/Insight': InsightStub,
      '../models/InsightRequest': InsightRequestStub,
      '../models/User': UserStub,
      '../models/Enrollment': EnrollmentStub,
      '../models/Period': PeriodStub,
      '../models/Checkin': CheckinStub,
      '../models/Section': SectionStub,
      './notification.controller': {
        createNotification: sandbox.stub().resolves(),
        createNotifications: sandbox.stub().resolves()
      },
      '../services/user-notification.service': {
        dispatchNotificationWithSubscribe: dispatchNotificationWithSubscribeStub
      },
      '../utils/response': responseUtils,
      '../utils/logger': {
        info: sandbox.stub(),
        warn: sandbox.stub(),
        error: sandbox.stub(),
        debug: sandbox.stub()
      },
      '../services/sync.service': {
        publishSyncEvent: publishSyncEventStub
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('重复申请同一条 insight 时应复用原记录并重置为 pending', async () => {
    req.user = { userId: user2Id.toString() };
    req.body = {
      toUserId: user1Id.toString(),
      insightId: insightAId.toString()
    };

    const targetInsight = {
      _id: insightAId,
      userId: user1Id,
      targetUserId: user1Id,
      periodId: { _id: periodId, name: '内在之光' },
      sectionId: { title: '第三天 以原则为中心的思维方式', day: 3 }
    };

    const existingRequest = {
      _id: requestId,
      fromUserId: user2Id,
      toUserId: user1Id,
      periodId: null,
      insightId: null,
      status: 'rejected',
      requestPeriodName: '',
      requestInsightTitle: '',
      requestInsightDay: null,
      save: sandbox.stub().resolves()
    };

    InsightStub.findById.returns(createThenableQuery(targetInsight));
    InsightRequestStub.findOne.returns({
      sort: sandbox.stub().resolves(existingRequest)
    });

    await controller.createInsightRequest(req, res, next);

    expect(InsightRequestStub.create.called).to.equal(false);
    expect(existingRequest.save.calledOnce).to.equal(true);
    expect(existingRequest.status).to.equal('pending');
    expect(existingRequest.insightId.toString()).to.equal(insightAId.toString());
    expect(existingRequest.periodId.toString()).to.equal(periodId.toString());
    expect(existingRequest.requestPeriodName).to.equal('内在之光');
    expect(existingRequest.requestInsightTitle).to.equal('第三天 以原则为中心的思维方式');
    expect(existingRequest.requestInsightDay).to.equal(3);
    expect(res.json.calledOnce).to.equal(true);
    expect(res.json.firstCall.args[0].message).to.equal('申请已更新');
  });

  it('单条授权状态查询不应把 insight 申请当成整期授权', async () => {
    req.user = { userId: user2Id.toString() };
    req.params = { userId: user1Id.toString() };

    InsightRequestStub.find.returns(
      createThenableQuery([
        {
          _id: requestId,
          fromUserId: user2Id,
          toUserId: user1Id,
          insightId: insightAId,
          periodId,
          status: 'approved',
          createdAt: new Date('2026-03-27T10:00:00.000Z')
        }
      ])
    );

    await controller.getRequestStatus(req, res, next);

    expect(res.json.calledOnce).to.equal(true);
    const payload = res.json.firstCall.args[0].data;
    expect(payload.approved).to.equal(true);
    expect(payload.approvedInsightIds).to.deep.equal([insightAId.toString()]);
    expect(payload.approvedPeriodIds).to.deep.equal([]);
    expect(payload.status).to.equal('approved');
  });

  it('查看他人 insights 时只解锁被批准的单条内容，同期其他条目保持锁定', async () => {
    req.user = { userId: user2Id.toString() };
    req.params = { userId: user1Id.toString() };
    req.query = { page: 1, limit: 20 };

    InsightRequestStub.find.returns(
      createThenableQuery([
        {
          _id: requestId,
          insightId: insightAId,
          periodId,
          status: 'approved'
        }
      ])
    );

    InsightStub.countDocuments.resolves(2);
    InsightStub.find.returns(
      createThenableQuery([
        {
          _id: insightAId,
          periodId: { _id: periodId, name: '内在之光' },
          content: 'A 内容',
          summary: 'A 摘要',
          toObject: () => ({
            _id: insightAId,
            periodId: { _id: periodId, name: '内在之光' },
            content: 'A 内容',
            summary: 'A 摘要'
          })
        },
        {
          _id: insightBId,
          periodId: { _id: periodId, name: '内在之光' },
          content: 'B 内容',
          summary: 'B 摘要',
          toObject: () => ({
            _id: insightBId,
            periodId: { _id: periodId, name: '内在之光' },
            content: 'B 内容',
            summary: 'B 摘要'
          })
        }
      ])
    );

    await controller.getUserInsights(req, res, next);

    expect(res.json.calledOnce).to.equal(true);
    const list = res.json.firstCall.args[0].data.list;
    const accessible = list.find(item => item._id.toString() === insightAId.toString());
    const locked = list.find(item => item._id.toString() === insightBId.toString());

    expect(accessible.isAccessible).to.equal(true);
    expect(accessible.content).to.equal('A 内容');
    expect(accessible.requestStatus).to.equal('approved');
    expect(locked.isAccessible).to.equal(false);
    expect(locked.content).to.equal(null);
    expect(locked.summary).to.equal(null);
    expect(locked.requestStatus).to.equal('none');
  });

  it('查看他人 insights 时 pending 只标记到对应条目', async () => {
    req.user = { userId: user2Id.toString() };
    req.params = { userId: user1Id.toString() };
    req.query = { page: 1, limit: 20 };

    InsightRequestStub.find.returns(
      createThenableQuery([
        {
          _id: requestId,
          insightId: insightAId,
          periodId,
          status: 'pending'
        }
      ])
    );

    InsightStub.countDocuments.resolves(2);
    InsightStub.find.returns(
      createThenableQuery([
        {
          _id: insightAId,
          periodId: { _id: periodId, name: '内在之光' },
          content: 'A 内容',
          summary: 'A 摘要',
          toObject: () => ({
            _id: insightAId,
            periodId: { _id: periodId, name: '内在之光' },
            content: 'A 内容',
            summary: 'A 摘要'
          })
        },
        {
          _id: insightBId,
          periodId: { _id: periodId, name: '内在之光' },
          content: 'B 内容',
          summary: 'B 摘要',
          toObject: () => ({
            _id: insightBId,
            periodId: { _id: periodId, name: '内在之光' },
            content: 'B 内容',
            summary: 'B 摘要'
          })
        }
      ])
    );

    await controller.getUserInsights(req, res, next);

    expect(res.json.calledOnce).to.equal(true);
    const list = res.json.firstCall.args[0].data.list;
    const pending = list.find(item => item._id.toString() === insightAId.toString());
    const untouched = list.find(item => item._id.toString() === insightBId.toString());

    expect(pending.requestStatus).to.equal('pending');
    expect(untouched.requestStatus).to.equal('none');
  });
});
