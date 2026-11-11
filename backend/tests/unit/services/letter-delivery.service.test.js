const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const period = {
  _id: 'p1',
  startDate: new Date('2026-11-30T16:00:00.000Z'), // 12-01 东八区
  endDate: new Date('2026-12-22T16:00:00.000Z') // 12-23 东八区
};

describe('Letter Delivery Service', () => {
  let sandbox;
  let service;
  let LetterStub;
  let PeriodStub;
  let createNotificationStub;
  let contexts;

  const chain = rows => {
    const c = { sort: () => c, limit: () => c, select: () => c, lean: async () => rows };
    return c;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    contexts = [];
    LetterStub = { find: sandbox.stub(), updateOne: sandbox.stub().resolves({ modifiedCount: 1 }) };
    PeriodStub = { find: sandbox.stub().returns(chain([period])) };
    createNotificationStub = sandbox.stub().resolves({});
    service = proxyquire('../../../src/services/letter-delivery.service', {
      'node-cron': { schedule: sandbox.stub() },
      '../models/Letter': LetterStub,
      '../models/Period': PeriodStub,
      '../utils/logger': { info: sandbox.stub(), error: sandbox.stub() },
      '../utils/tenantContext': {
        withSystemContext: (tenantId, fn) => {
          contexts.push(tenantId);
          return fn();
        }
      },
      '../controllers/notification.controller': { createNotification: createNotificationStub }
    });
  });

  afterEach(() => sandbox.restore());

  it('送达时间是结束日东八区 6:00', () => {
    expect(service.computeDeliverAt(period).toISOString()).to.equal('2026-12-22T22:00:00.000Z');
  });

  it('写信窗口是开营前 3 天到开营后第 7 天', () => {
    const w = service.computeWriteWindow(period);
    expect(w.from.toISOString()).to.equal('2026-11-27T16:00:00.000Z');
    expect(w.to.toISOString()).to.equal('2026-12-08T15:59:59.000Z');
  });

  it('到点的封存信被标记送达并创建通知', async () => {
    LetterStub.find.returns(
      chain([{ _id: 'l1', tenantId: 't1', userId: 'u1', periodId: 'p1', sealedAt: new Date('2026-11-30T02:00:00Z') }])
    );
    const result = await service.deliverDueLetters({ now: new Date('2026-12-22T22:30:00Z') });
    expect(result.delivered).to.equal(1);
    expect(LetterStub.updateOne.firstCall.args[0]).to.deep.equal({ _id: 'l1', status: 'sealed' });
    expect(createNotificationStub.firstCall.args.slice(0, 4)).to.deep.equal([
      'u1',
      'letter_delivered',
      '有一封信到了',
      '23 天前你写给今天的自己'
    ]);
    expect(contexts).to.include('t1');
  });

  it('未到送达时间的信不处理', async () => {
    LetterStub.find.returns(chain([{ _id: 'l1', tenantId: 't1', userId: 'u1', periodId: 'p1', sealedAt: new Date() }]));
    const result = await service.deliverDueLetters({ now: new Date('2026-12-22T21:00:00Z') });
    expect(result.delivered).to.equal(0);
    expect(LetterStub.updateOne.called).to.equal(false);
  });

  it('已被其它实例送达（未修改）时不重复通知', async () => {
    LetterStub.updateOne.resolves({ modifiedCount: 0 });
    LetterStub.find.returns(chain([{ _id: 'l1', tenantId: 't1', userId: 'u1', periodId: 'p1', sealedAt: new Date() }]));
    const result = await service.deliverDueLetters({ now: new Date('2026-12-23T00:00:00Z') });
    expect(result.delivered).to.equal(0);
    expect(createNotificationStub.calledOnce).to.equal(true);
    expect(createNotificationStub.firstCall.args[4]).to.include({ upsertExisting: true });
  });

  it('通知创建失败时保留 sealed，下一轮可以重试', async () => {
    LetterStub.find.returns(
      chain([{ _id: 'l1', tenantId: 't1', userId: 'u1', periodId: 'p1', sealedAt: new Date('2026-11-30T02:00:00Z') }])
    );
    createNotificationStub.resolves(null);
    const failed = await service.deliverDueLetters({ now: new Date('2026-12-22T22:30:00Z') });
    expect(failed.delivered).to.equal(0);
    expect(LetterStub.updateOne.called).to.equal(false);

    createNotificationStub.resolves({ _id: 'n1' });
    const retried = await service.deliverDueLetters({ now: new Date('2026-12-22T22:40:00Z') });
    expect(retried.delivered).to.equal(1);
    expect(LetterStub.updateOne.calledOnce).to.equal(true);
  });

  it('超过固定回看周期的逾期信仍会扫描', async () => {
    LetterStub.find.returns(
      chain([{ _id: 'old', tenantId: 't1', userId: 'u1', periodId: 'p1', sealedAt: new Date('2026-11-30T02:00:00Z') }])
    );
    const result = await service.deliverDueLetters({ now: new Date('2027-03-01T00:00:00Z') });
    expect(result.scanned).to.equal(1);
    expect(PeriodStub.find.firstCall.args[0].endDate).to.deep.equal({ $lte: new Date('2027-03-02T00:00:00Z') });
  });

  it('分批处理直到取完，且只查已到期期次', async () => {
    const mk = i => ({ _id: `l${i}`, tenantId: 't1', userId: 'u', periodId: 'p1', sealedAt: new Date('2026-12-01') });
    const first = Array.from({ length: 500 }, (_, i) => mk(i));
    LetterStub.find.onFirstCall().returns(chain(first)).onSecondCall().returns(chain([mk(900)]));
    const result = await service.deliverDueLetters({ now: new Date('2026-12-23T00:00:00Z') });
    expect(result.scanned).to.equal(501);
    expect(LetterStub.find.secondCall.args[0]._id).to.deep.equal({ $gt: 'l499' });
    expect(LetterStub.find.firstCall.args[0].periodId).to.deep.equal({ $in: ['p1'] });
  });

  it('没有到期期次或期次没有结束日时不查信', async () => {
    PeriodStub.find.returns(chain([{ _id: 'p9' }]));
    const result = await service.deliverDueLetters({ now: new Date('2026-12-23T00:00:00Z') });
    expect(result.scanned).to.equal(0);
    expect(LetterStub.find.called).to.equal(false);
  });

  it('start 重复调用只注册一次定时任务', () => {
    const schedule = sandbox.stub();
    const s = proxyquire('../../../src/services/letter-delivery.service', {
      'node-cron': { schedule },
      '../models/Letter': LetterStub,
      '../models/Period': PeriodStub,
      '../utils/logger': { info: sandbox.stub(), error: sandbox.stub() },
      '../utils/tenantContext': { withSystemContext: (t, fn) => fn() },
      '../controllers/notification.controller': { createNotification: createNotificationStub }
    });
    s.start();
    s.start();
    expect(schedule.calledOnce).to.equal(true);
  });
});
