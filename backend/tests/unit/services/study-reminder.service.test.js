const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const { setupFindChain } = require('../helpers/mock-helpers');
const {
  buildNextDayStudyReminderPlan,
  buildScheduledStudyReminderPlan,
  getShanghaiDateKey
} = require('../../../src/utils/study-reminder.utils');

describe('Study Reminder Service', () => {
  let sandbox;
  let studyReminderService;
  let EnrollmentStub;
  let PeriodStub;
  let SectionStub;
  let SubscribeMessageGrantStub;
  let subscribeMessageServiceStub;
  let loggerStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    EnrollmentStub = {
      findOne: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub()
    };

    SectionStub = {
      findOne: sandbox.stub()
    };

    SubscribeMessageGrantStub = {
      find: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub().resolves({})
    };

    subscribeMessageServiceStub = {
      sendSceneMessage: sandbox.stub()
    };

    loggerStub = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub()
    };

    studyReminderService = proxyquire(
      '../../../src/services/study-reminder.service',
      {
        '../models/Enrollment': EnrollmentStub,
        '../models/Period': PeriodStub,
        '../models/Section': SectionStub,
        '../models/SubscribeMessageGrant': SubscribeMessageGrantStub,
        './subscribe-message.service': subscribeMessageServiceStub,
        '../utils/logger': loggerStub,
        'node-cron': {
          schedule: sandbox.stub()
        },
        '../config/subscribe-message.config': require('../../../src/config/subscribe-message.config')
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should calculate next day reminder within period and block after last day', () => {
    const period = {
      startDate: new Date('2026-03-13T00:00:00+08:00'),
      endDate: new Date('2026-04-04T00:00:00+08:00')
    };

    const inRange = buildNextDayStudyReminderPlan({
      period,
      now: new Date('2026-03-29T10:00:00+08:00')
    });
    const outOfRange = buildNextDayStudyReminderPlan({
      period,
      now: new Date('2026-04-04T10:00:00+08:00')
    });

    expect(inRange.status).to.equal('ok');
    expect(inRange.sendDateKey).to.equal('2026-03-30');
    expect(outOfRange.status).to.equal('out_of_range');
  });

  it('should build scheduled send plan based on actual send date', () => {
    const period = {
      startDate: new Date('2026-03-13T00:00:00+08:00'),
      endDate: new Date('2026-04-04T00:00:00+08:00')
    };
    const sendDate = new Date('2026-03-30T05:45:00+08:00');

    const plan = buildScheduledStudyReminderPlan({ period, sendDate });

    expect(plan.status).to.equal('ok');
    expect(plan.sendDateKey).to.equal(getShanghaiDateKey(sendDate));
    expect(plan.dayIndex).to.equal(17);
  });

  it('should send reminder and clear grant after success', async () => {
    const userId = new mongoose.Types.ObjectId();
    const periodId = new mongoose.Types.ObjectId();
    const sendDate = new Date(Date.now() - 60 * 1000);
    const scheduledPlan = buildScheduledStudyReminderPlan({
      period: {
        startDate: new Date('2026-03-13T00:00:00+08:00'),
        endDate: new Date('2026-04-04T00:00:00+08:00')
      },
      sendDate
    });
    const grant = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      periodId: periodId.toString(),
      availableCount: 1,
      scheduledSendDate: sendDate,
      scheduledSendDateKey: scheduledPlan.sendDateKey,
      retryAt: null,
      retryCount: 0,
      context: {
        periodId: periodId.toString(),
        sourceAction: 'course_detail_click'
      }
    };
    const period = {
      _id: periodId,
      startDate: new Date('2026-03-13T00:00:00+08:00'),
      endDate: new Date('2026-04-04T00:00:00+08:00')
    };
    const enrollment = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      periodId
    };
    const section = {
      _id: new mongoose.Types.ObjectId(),
      title: '第十八天 晨读任务',
      day: scheduledPlan.dayIndex
    };

    SubscribeMessageGrantStub.find.returns(setupFindChain(sandbox, [grant]));
    EnrollmentStub.findOne.returns(setupFindChain(sandbox, enrollment));
    PeriodStub.findById.returns(setupFindChain(sandbox, period));
    SectionStub.findOne.returns(setupFindChain(sandbox, section));
    subscribeMessageServiceStub.sendSceneMessage.resolves({ status: 'sent' });

    const summary = await studyReminderService.sendDueNextDayStudyReminders();

    expect(summary.sent).to.equal(1);
    expect(subscribeMessageServiceStub.sendSceneMessage.calledOnce).to.be.true;
    expect(SubscribeMessageGrantStub.findByIdAndUpdate.called).to.be.true;
    const update = SubscribeMessageGrantStub.findByIdAndUpdate.firstCall.args[1];
    expect(update.$set.availableCount).to.equal(0);
    expect(update.$set.scheduledSendDate).to.equal(null);
    expect(update.$set.retryAt).to.equal(null);
  });

  it('should queue one retry on temporary failure and clear after retry attempt', async () => {
    const userId = new mongoose.Types.ObjectId();
    const periodId = new mongoose.Types.ObjectId();
    const sendDate = new Date(Date.now() - 60 * 1000);
    const scheduledPlan = buildScheduledStudyReminderPlan({
      period: {
        startDate: new Date('2026-03-13T00:00:00+08:00'),
        endDate: new Date('2026-04-04T00:00:00+08:00')
      },
      sendDate
    });
    const grant = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      periodId: periodId.toString(),
      availableCount: 1,
      scheduledSendDate: sendDate,
      scheduledSendDateKey: scheduledPlan.sendDateKey,
      retryAt: null,
      retryCount: 0,
      context: {
        periodId: periodId.toString(),
        sourceAction: 'course_detail_click'
      }
    };
    const period = {
      _id: periodId,
      startDate: new Date('2026-03-13T00:00:00+08:00'),
      endDate: new Date('2026-04-04T00:00:00+08:00')
    };
    const enrollment = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      periodId
    };
    const section = {
      _id: new mongoose.Types.ObjectId(),
      title: '第十八天 晨读任务',
      day: scheduledPlan.dayIndex
    };

    SubscribeMessageGrantStub.find.returns(setupFindChain(sandbox, [grant]));
    EnrollmentStub.findOne.returns(setupFindChain(sandbox, enrollment));
    PeriodStub.findById.returns(setupFindChain(sandbox, period));
    SectionStub.findOne.returns(setupFindChain(sandbox, section));
    subscribeMessageServiceStub.sendSceneMessage.resolves({ status: 'failed' });

    const initialSummary = await studyReminderService.sendDueNextDayStudyReminders({ attemptType: 'scheduled' });
    expect(initialSummary.retryQueued).to.equal(1);
    expect(SubscribeMessageGrantStub.findByIdAndUpdate.called).to.be.true;

    SubscribeMessageGrantStub.findByIdAndUpdate.resetHistory();
    subscribeMessageServiceStub.sendSceneMessage.resetHistory();
    subscribeMessageServiceStub.sendSceneMessage.resolves({ status: 'failed' });

    const retrySummary = await studyReminderService.sendDueNextDayStudyReminders({ attemptType: 'retry' });

    expect(retrySummary.failed).to.equal(1);
    expect(SubscribeMessageGrantStub.findByIdAndUpdate.called).to.be.true;
    const retryUpdate = SubscribeMessageGrantStub.findByIdAndUpdate.firstCall.args[1];
    expect(retryUpdate.$set.availableCount).to.equal(0);
    expect(retryUpdate.$set.retryAt).to.equal(null);
  });
});
