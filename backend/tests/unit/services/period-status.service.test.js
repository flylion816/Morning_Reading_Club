const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Period Status Service', () => {
  let sandbox;
  let service;
  let PeriodStub;
  let publishSyncEventStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    PeriodStub = {
      find: sandbox.stub()
    };
    publishSyncEventStub = sandbox.stub();

    service = proxyquire('../../../src/services/period-status.service', {
      '../models/Period': PeriodStub,
      '../utils/logger': {
        info: sandbox.stub(),
        error: sandbox.stub()
      },
      './sync.service': {
        publishSyncEvent: publishSyncEventStub
      },
      'node-cron': {
        schedule: sandbox.stub()
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('应该按上海日期计算期次状态', () => {
    const status = service.calculatePeriodStatus(
      {
        startDate: new Date('2026-05-08T16:00:00.000Z'),
        endDate: new Date('2026-05-30T16:00:00.000Z')
      },
      new Date('2026-05-10T08:00:00.000Z')
    );

    expect(status).to.equal('ongoing');
  });

  it('应该将数据库中过期的状态写回正确值并发布同步事件', async () => {
    const period = {
      _id: { toString: () => 'period-1' },
      name: '秩序之锚',
      status: 'not_started',
      startDate: new Date('2026-05-08T16:00:00.000Z'),
      endDate: new Date('2026-05-30T16:00:00.000Z'),
      save: sandbox.stub().resolves(),
      toObject: sandbox.stub().returns({ _id: 'period-1', status: 'ongoing' })
    };

    PeriodStub.find.returns({
      select: sandbox.stub().resolves([period])
    });

    const result = await service.syncAllPeriodsStatus({
      now: new Date('2026-05-10T08:00:00.000Z')
    });

    expect(period.status).to.equal('ongoing');
    expect(period.save.calledOnce).to.equal(true);
    expect(publishSyncEventStub.calledOnce).to.equal(true);
    expect(result.updatedCount).to.equal(1);
    expect(result.updates[0]).to.include({
      periodId: 'period-1',
      oldStatus: 'not_started',
      newStatus: 'ongoing'
    });
  });

  it('状态已正确时不应该写库或发布同步事件', async () => {
    const period = {
      _id: { toString: () => 'period-1' },
      name: '秩序之锚',
      status: 'ongoing',
      startDate: new Date('2026-05-08T16:00:00.000Z'),
      endDate: new Date('2026-05-30T16:00:00.000Z'),
      save: sandbox.stub().resolves(),
      toObject: sandbox.stub().returns({ _id: 'period-1', status: 'ongoing' })
    };

    PeriodStub.find.returns({
      select: sandbox.stub().resolves([period])
    });

    const result = await service.syncAllPeriodsStatus({
      now: new Date('2026-05-10T08:00:00.000Z')
    });

    expect(period.save.called).to.equal(false);
    expect(publishSyncEventStub.called).to.equal(false);
    expect(result.updatedCount).to.equal(0);
  });
});
