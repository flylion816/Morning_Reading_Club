const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Mobile Admin Analytics Controller', () => {
  let sandbox;
  let controller;
  let req;
  let res;
  let next;
  let EnrollmentStub;
  let PaymentStub;
  let PeriodStub;
  let UserStub;
  let UserActivityStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = {
      user: { userId: new mongoose.Types.ObjectId().toString() },
      query: {
        startDate: '2026-06-01',
        endDate: '2026-06-03'
      }
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    EnrollmentStub = {
      aggregate: sandbox.stub()
    };
    PaymentStub = {
      aggregate: sandbox.stub()
    };
    PeriodStub = {
      find: sandbox.stub(),
      findById: sandbox.stub()
    };
    UserStub = {
      findById: sandbox.stub(),
      countDocuments: sandbox.stub()
    };
    UserActivityStub = {
      aggregate: sandbox.stub(),
      distinct: sandbox.stub().resolves([])
    };

    const responseUtils = {
      success: (data, message = 'success') => ({ code: 0, message, data }),
      errors: {
        badRequest: (message) => ({ code: 400, message }),
        unauthorized: (message) => ({ code: 401, message }),
        forbidden: (message) => ({ code: 403, message }),
        notFound: (message) => ({ code: 404, message }),
        serverError: (message) => ({ code: 500, message })
      }
    };

    controller = proxyquire('../../../src/controllers/mobileAdminAnalytics.controller', {
      '../models/Enrollment': EnrollmentStub,
      '../models/Payment': PaymentStub,
      '../models/Period': PeriodStub,
      '../models/User': UserStub,
      '../models/UserActivity': UserActivityStub,
      '../utils/response': responseUtils,
      '../utils/logger': {
        error: sandbox.stub()
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  function makeFindByIdQuery(result) {
    return {
      select: sandbox.stub().returns({
        lean: sandbox.stub().resolves(result)
      })
    };
  }

  describe('requireMobileAdmin', () => {
    it('allows active admin users', async () => {
      UserStub.findById.returns(makeFindByIdQuery({
        _id: req.user.userId,
        role: 'admin',
        status: 'active'
      }));

      await controller.requireMobileAdmin(req, res, next);

      expect(next.calledOnce).to.equal(true);
      expect(res.status.called).to.equal(false);
    });

    it('rejects normal users', async () => {
      UserStub.findById.returns(makeFindByIdQuery({
        _id: req.user.userId,
        role: 'user',
        status: 'active'
      }));

      await controller.requireMobileAdmin(req, res, next);

      expect(res.status.calledWith(403)).to.equal(true);
      expect(next.called).to.equal(false);
    });
  });

  describe('getOverviewAnalytics', () => {
    it('returns overview metrics and revenue split', async () => {
      UserStub.countDocuments.onFirstCall().resolves(177).onSecondCall().resolves(3);
      EnrollmentStub.aggregate
        .onFirstCall()
        .resolves([{ totalEnrollments: 65, paidEnrollments: 51 }])
        .onSecondCall()
        .resolves([
          { _id: '2026-06-01', enrollmentCount: 2, paidEnrollmentCount: 1 }
        ])
        .onThirdCall()
        .resolves([
          {
            periodId: new mongoose.Types.ObjectId(),
            periodName: '第八期',
            enrollmentCount: 20,
            paidEnrollmentCount: 18
          }
        ]);
      PaymentStub.aggregate
        .onFirstCall()
        .resolves([{
          enrollmentRevenue: 30000,
          activityRevenue: 248,
          totalRevenue: 30248,
          paymentCount: 52
        }])
        .onSecondCall()
        .resolves([
          {
            _id: '2026-06-01',
            enrollmentAmount: 10000,
            activityAmount: 248,
            totalAmount: 10248,
            paymentCount: 2
          }
        ])
        .onThirdCall()
        .resolves([{ method: 'wechat', count: 52, amount: 30248 }]);

      await controller.getOverviewAnalytics(req, res);

      expect(res.json.calledOnce).to.equal(true);
      const body = res.json.getCall(0).args[0];
      expect(body.data.summary.totalUsers).to.equal(177);
      expect(body.data.summary.enrollmentRevenue).to.equal(30000);
      expect(body.data.summary.activityRevenue).to.equal(248);
      expect(body.data.summary.totalRevenue).to.equal(30248);
      expect(body.data.summary.conversionRate).to.equal(78.5);
      expect(body.data.enrollmentTrend).to.have.length(3);
      expect(body.data.paymentTrend[0].totalAmount).to.equal(10248);
    });
  });

  describe('getActivityAnalytics', () => {
    it('returns trend, summaries and user details', async () => {
      const userId = new mongoose.Types.ObjectId();
      UserActivityStub.aggregate
        .onFirstCall()
        .resolves([
          { date: '2026-06-01', action: 'app_open', userCount: 19 },
          { date: '2026-06-01', action: 'checkin_submit', userCount: 2 },
          { date: '2026-06-01', action: 'zaichang_list_view', userCount: 5 },
          { date: '2026-06-01', action: 'podcast_bar_play', userCount: 3 },
          { date: '2026-06-01', action: 'insight_share', userCount: 4 }
        ])
        .onSecondCall()
        .resolves([{ date: '2026-06-01', activeUserCount: 20 }])
        .onThirdCall()
        .resolves([
          {
            date: '2026-06-01',
            userId,
            nickname: '狮子',
            phone: '13564053520',
            actions: [{ action: 'app_open', count: 41 }],
            totalCount: 41,
            lastOccurredAt: new Date('2026-06-01T04:22:07.000Z')
          }
        ])
        .onCall(3)
        .resolves([{ action: 'app_open', userCount: 19 }])
        .onCall(4)
        .resolves([{ activeUsers: 20 }])
        .onCall(5)
        .resolves([{ insightViewUsers: 18 }])
        .onCall(6)
        .resolves([{ action: 'app_open', userCount: 8 }])
        .onCall(7)
        .resolves([{ activeUsers: 9 }])
        .onCall(8)
        .resolves([{ insightViewUsers: 7 }]);

      await controller.getActivityAnalytics(req, res);

      expect(res.json.calledOnce).to.equal(true);
      const body = res.json.getCall(0).args[0];
      expect(body.data.summary.today.appOpenUsers).to.equal(19);
      expect(body.data.summary.yesterday.activeUsers).to.equal(9);
      expect(body.data.summary.delta.insightViewUsers).to.equal(11);
      expect(body.data.trend[0].app_open).to.equal(19);
      expect(body.data.trend[0].zaichang_activity).to.equal(5);
      expect(body.data.trend[0].podcast_activity).to.equal(3);
      expect(body.data.trend[0].share_activity).to.equal(4);
      expect(body.data.details[0].phone).to.equal('13564053520');
      expect(body.data.details[0].actions[0].label).to.equal('访问小程序');
    });

    it('uses enrolled user cohort for global actions when period filter is selected', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      req.query.periodId = periodId.toString();

      PeriodStub.findById.returns(makeFindByIdQuery({
        _id: periodId,
        name: '第八期'
      }));
      EnrollmentStub.aggregate.resolves([{ _id: userId }]);
      UserActivityStub.distinct.resolves([]);
      UserActivityStub.aggregate
        .onFirstCall()
        .resolves([
          { date: '2026-06-01', action: 'app_open', userCount: 1 },
          { date: '2026-06-01', action: 'podcast_bar_play', userCount: 1 },
          { date: '2026-06-01', action: 'zaichang_list_view', userCount: 1 }
        ])
        .onSecondCall()
        .resolves([{ date: '2026-06-01', activeUserCount: 1 }])
        .onThirdCall()
        .resolves([
          {
            date: '2026-06-01',
            userId,
            nickname: '狮子',
            phone: '13564053520',
            actions: [
              { action: 'app_open', count: 64 },
              { action: 'podcast_bar_play', count: 1 },
              { action: 'zaichang_list_view', count: 5 },
              { action: 'activity_enroll', count: 1 }
            ],
            totalCount: 71,
            lastOccurredAt: new Date('2026-06-01T07:42:24.000Z')
          }
        ])
        .onCall(3)
        .resolves([{ action: 'app_open', userCount: 1 }])
        .onCall(4)
        .resolves([{ activeUsers: 1 }])
        .onCall(5)
        .resolves([])
        .onCall(6)
        .resolves([])
        .onCall(7)
        .resolves([])
        .onCall(8)
        .resolves([]);

      await controller.getActivityAnalytics(req, res);

      const firstMatch = UserActivityStub.aggregate.getCall(0).args[0][0].$match;
      expect(firstMatch.$or[0]).to.deep.equal({ periodId });
      expect(firstMatch.$or[1].userId.$in).to.deep.equal([userId]);
      expect(firstMatch.$or[1].action.$in).to.include('podcast_bar_play');
      expect(firstMatch.$or[1].action.$in).to.include('zaichang_list_view');
      expect(firstMatch.$or[1].action.$in).to.include('activity_enroll');

      const body = res.json.getCall(0).args[0];
      const labels = body.data.details[0].actions.map((item) => item.label);
      expect(body.data.details[0].totalCount).to.equal(71);
      expect(body.data.trend[0].podcast_activity).to.equal(1);
      expect(body.data.trend[0].zaichang_activity).to.equal(1);
      expect(labels).to.include('访问小程序');
      expect(labels).to.include('底部悬浮窗播放播客');
      expect(labels).to.include('进入在场列表');
      expect(labels).to.include('活动报名');
    });
  });
});
