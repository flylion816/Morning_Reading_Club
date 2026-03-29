const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const { setupFindChain } = require('../helpers/mock-helpers');
const { buildNextDayStudyReminderPlan } = require('../../../src/utils/study-reminder.utils');
const { getSubscribeSceneConfig } = require('../../../src/config/subscribe-message.config');

describe('Subscribe Message Service', () => {
  let sandbox;
  let subscribeMessageService;
  let EnrollmentStub;
  let UserStub;
  let PeriodStub;
  let SectionStub;
  let SubscribeMessageGrantStub;
  let SubscribeMessageDeliveryStub;
  let loggerStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    UserStub = {
      findById: sandbox.stub()
    };

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
      findOne: sandbox.stub(),
      findOneAndUpdate: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    SubscribeMessageDeliveryStub = {
      create: sandbox.stub().resolves({})
    };

    loggerStub = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub()
    };

    subscribeMessageService = proxyquire(
      '../../../src/services/subscribe-message.service',
      {
        '../models/User': UserStub,
        '../models/Enrollment': EnrollmentStub,
        '../models/Period': PeriodStub,
        '../models/Section': SectionStub,
        '../models/SubscribeMessageGrant': SubscribeMessageGrantStub,
        '../models/SubscribeMessageDelivery': SubscribeMessageDeliveryStub,
        '../utils/logger': loggerStub,
        axios: {
          get: sandbox.stub(),
          post: sandbox.stub()
        }
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should cap comment grants at target 50', async () => {
    const userId = new mongoose.Types.ObjectId();
    const sceneConfig = getSubscribeSceneConfig('comment_received');

    SubscribeMessageGrantStub.findOne.resolves({ availableCount: 49 });
    SubscribeMessageGrantStub.findOneAndUpdate.resolves({ availableCount: 50 });
    SubscribeMessageGrantStub.find.returns(setupFindChain(sandbox, []));

    await subscribeMessageService.recordUserGrantResults(userId, [
      {
        scene: 'comment_received',
        templateId: sceneConfig.templateId,
        result: 'accept'
      }
    ]);

    const update = SubscribeMessageGrantStub.findOneAndUpdate.firstCall.args[1];
    expect(update.$set.autoTopUpTarget).to.equal(50);
    expect(update.$set.availableCount).to.equal(50);
  });

  it('should schedule next day reminder once and keep it within period', async () => {
    const userId = new mongoose.Types.ObjectId();
    const periodId = new mongoose.Types.ObjectId();
    const sceneConfig = getSubscribeSceneConfig('next_day_study_reminder');
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
    const expectedPlan = buildNextDayStudyReminderPlan({
      period,
      now: new Date('2026-03-29T10:00:00+08:00')
    });

    EnrollmentStub.findOne.returns(setupFindChain(sandbox, enrollment));
    PeriodStub.findById.returns(setupFindChain(sandbox, period));
    SectionStub.findOne.returns(setupFindChain(sandbox, { _id: new mongoose.Types.ObjectId() }));
    SubscribeMessageGrantStub.findOne.resolves({ availableCount: 0 });
    SubscribeMessageGrantStub.findOneAndUpdate.resolves({ availableCount: 1 });

    await subscribeMessageService.recordUserGrantResults(userId, [
      {
        scene: 'next_day_study_reminder',
        templateId: sceneConfig.templateId,
        result: 'accept',
        context: {
          periodId: periodId.toString(),
          sourceAction: 'course_detail_click'
        }
      }
    ]);

    const update = SubscribeMessageGrantStub.findOneAndUpdate.firstCall.args[1];
    expect(update.$set.autoTopUpTarget).to.equal(1);
    expect(update.$set.availableCount).to.equal(1);
    expect(update.$set.periodId).to.equal(periodId.toString());
    expect(update.$set.sourceAction).to.equal('course_detail_click');
    expect(update.$set.scheduledSendDateKey).to.equal(expectedPlan.sendDateKey);
    expect(update.$set.scheduledSendDate).to.be.instanceOf(Date);
  });

  it('should not overwrite existing next day reminder when out of period range', async () => {
    const userId = new mongoose.Types.ObjectId();
    const periodId = new mongoose.Types.ObjectId();
    const sceneConfig = getSubscribeSceneConfig('next_day_study_reminder');
    const existingGrant = {
      availableCount: 1,
      scheduledSendDate: new Date('2026-03-30T05:45:00+08:00'),
      scheduledSendDateKey: '2026-03-30',
      periodId: periodId.toString()
    };
    const period = {
      _id: periodId,
      startDate: new Date('2026-03-13T00:00:00+08:00'),
      endDate: new Date('2026-03-29T00:00:00+08:00')
    };

    EnrollmentStub.findOne.returns(setupFindChain(sandbox, {
      _id: new mongoose.Types.ObjectId(),
      userId,
      periodId
    }));
    PeriodStub.findById.returns(setupFindChain(sandbox, period));
    SubscribeMessageGrantStub.findOne.resolves(existingGrant);
    SubscribeMessageGrantStub.findOneAndUpdate.resolves(existingGrant);

    await subscribeMessageService.recordUserGrantResults(userId, [
      {
        scene: 'next_day_study_reminder',
        templateId: sceneConfig.templateId,
        result: 'accept',
        context: {
          periodId: periodId.toString(),
          sourceAction: 'course_detail_click'
        }
      }
    ]);

    const update = SubscribeMessageGrantStub.findOneAndUpdate.firstCall.args[1];
    expect(update.$set.availableCount).to.be.undefined;
    expect(update.$set.scheduledSendDate).to.be.undefined;
    expect(update.$set.scheduledSendDateKey).to.be.undefined;
  });

  it('should expose auto top up target and scheduled send date in states', async () => {
    const userId = new mongoose.Types.ObjectId();
    const grant = {
      scene: 'next_day_study_reminder',
      availableCount: 1,
      scheduledSendDate: new Date('2026-03-30T05:45:00+08:00'),
      scheduledSendDateKey: '2026-03-30',
      retryAt: null,
      retryCount: 0,
      context: {
        periodId: 'period_1',
        sourceAction: 'course_detail_click'
      },
      lastResult: 'accept'
    };

    SubscribeMessageGrantStub.find.returns(setupFindChain(sandbox, [grant]));

    const result = await subscribeMessageService.getUserSubscriptionStates(userId);

    const nextDayScene = result.scenes.find(item => item.scene === 'next_day_study_reminder');
    expect(nextDayScene.autoTopUpTarget).to.equal(1);
    expect(nextDayScene.scheduledSendDate).to.deep.equal(grant.scheduledSendDate);
    expect(nextDayScene.periodId).to.equal('period_1');
    expect(nextDayScene.sourceAction).to.equal('course_detail_click');
  });
});
