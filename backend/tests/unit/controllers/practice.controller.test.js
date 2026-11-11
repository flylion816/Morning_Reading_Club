const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

const chain = value => {
  const q = { select: () => q, sort: () => q, lean: () => Promise.resolve(value) };
  return q;
};

describe('Practice Controller', () => {
  let sandbox;
  let req;
  let res;
  let PracticeStub;
  let PeriodStub;
  let SectionStub;
  let accessStub;
  let controller;
  const periodId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // 2026-11-11 10:00 东八区：期次 11-02 开始，第 2 周
    sandbox.useFakeTimers({ now: new Date('2026-11-11T02:00:00Z'), toFake: ['Date'] });
    req = { params: { periodId }, body: {}, user: { id: new mongoose.Types.ObjectId().toString() } };
    res = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
    PracticeStub = { findOne: sandbox.stub(), find: sandbox.stub(), create: sandbox.stub() };
    PeriodStub = {
      findById: sandbox.stub().returns(
        chain({ startDate: new Date('2026-11-01T16:00:00Z'), endDate: new Date('2026-11-23T16:00:00Z') })
      )
    };
    SectionStub = { find: sandbox.stub().returns(chain([])) };
    accessStub = sandbox.stub().resolves(true);
    controller = proxyquire('../../../src/controllers/practice.controller', {
      '../models/Practice': PracticeStub,
      '../models/Period': PeriodStub,
      '../models/Section': SectionStub,
      '../services/community-access.service': { ensurePeriodCommunityAccess: accessStub },
      '../utils/logger': { warn: sandbox.stub(), error: sandbox.stub(), info: sandbox.stub() }
    });
  });

  afterEach(() => sandbox.restore());

  const body = () => res.json.firstCall.args[0].data;

  it('未报名时不返回数据', async () => {
    accessStub.callsFake(async r => {
      r.status(403).json({ code: 403 });
      return false;
    });
    await controller.getCurrent(req, res);
    expect(res.status.calledWith(403)).to.equal(true);
    expect(PracticeStub.findOne.called).to.equal(false);
  });

  it('期次未开始返回 active:false', async () => {
    sandbox.clock.setSystemTime(new Date('2026-10-20T02:00:00Z'));
    await controller.getCurrent(req, res);
    expect(body()).to.deep.equal({ active: false });
  });

  it('期次已结束返回 active:false', async () => {
    sandbox.clock.setSystemTime(new Date('2026-12-30T02:00:00Z'));
    await controller.getCurrent(req, res);
    expect(body()).to.deep.equal({ active: false });
  });

  it('未设定时返回建议：去标签取第一句、去重、最多 3 条', async () => {
    PracticeStub.findOne.returns(chain(null));
    SectionStub.find.returns(
      chain([
        { day: 8, action: '<p>先听完再开口。然后复述</p>' },
        { day: 9, action: '先听完再开口。' },
        { day: 10, action: '今天夸一个人！' },
        { day: 11, action: '' },
        { day: 12, action: '睡前写三行' },
        { day: 13, action: '多余的一条' }
      ])
    );
    await controller.getCurrent(req, res);
    const data = body();
    expect(data.weekIndex).to.equal(2);
    expect(data.weekRange).to.deep.equal({ from: '2026-11-09', to: '2026-11-15' });
    expect(data.practice).to.equal(null);
    expect(data.suggestions).to.deep.equal(['先听完再开口', '今天夸一个人', '睡前写三行']);
  });

  it('已设定时返回今天与本周记录，且不含失败类字样', async () => {
    PracticeStub.findOne.returns(
      chain({
        _id: 'p1',
        text: '先听完再开口',
        logs: [
          { date: '2026-11-09', done: true, note: '' },
          { date: '2026-11-11', done: false, note: '太忙' }
        ]
      })
    );
    await controller.getCurrent(req, res);
    const data = body();
    expect(data.practice).to.deep.equal({ id: 'p1', text: '先听完再开口' });
    expect(data.today).to.deep.equal({ date: '2026-11-11', done: false, note: '太忙' });
    expect(data.logs).to.have.length(2);
    expect(data.suggestions).to.deep.equal([]);
    expect(JSON.stringify(res.json.firstCall.args[0])).to.not.match(/失败|中断/);
  });

  it('建议只取已发布且不晚于今天的课程', async () => {
    PracticeStub.findOne.returns(chain(null));
    await controller.getCurrent(req, res);
    const filter = SectionStub.find.firstCall.args[0];
    expect(filter.isPublished).to.equal(true);
    expect(filter.day).to.deep.equal({ $gte: 8, $lte: 10 });
  });

  it('建议不会超过可保存的 30 字上限', async () => {
    PracticeStub.findOne.returns(chain(null));
    SectionStub.find.returns(chain([{ day: 8, action: '这是一条超过三十个字的实修建议，用来验证前后端边界一致并且不会提交失败' }]));
    await controller.getCurrent(req, res);
    expect(body().suggestions[0]).to.have.length(30);
  });

  it('setCurrent 并发撞唯一索引时重读后更新', async () => {
    const doc = { _id: 'p1', text: '旧', save: sandbox.stub().resolves() };
    PracticeStub.findOne.onFirstCall().resolves(null).onSecondCall().resolves(doc);
    PracticeStub.create.rejects(Object.assign(new Error('dup'), { code: 11000 }));
    req.body = { text: '新的行动' };
    await controller.setCurrent(req, res);
    expect(doc.text).to.equal('新的行动');
    expect(doc.save.calledOnce).to.equal(true);
    expect(res.status.called).to.equal(false);
  });

  it('setCurrent 校验空与超长', async () => {
    req.body = { text: '  ' };
    await controller.setCurrent(req, res);
    expect(res.status.calledWith(400)).to.equal(true);
    res.status.resetHistory();
    req.body = { text: 'a'.repeat(31) };
    await controller.setCurrent(req, res);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('setCurrent 本周已有则修改，没有则创建', async () => {
    const doc = { _id: 'p1', text: '旧', save: sandbox.stub().resolves() };
    PracticeStub.findOne.resolves(doc);
    req.body = { text: '新的行动' };
    await controller.setCurrent(req, res);
    expect(doc.text).to.equal('新的行动');
    expect(doc.save.calledOnce).to.equal(true);

    PracticeStub.findOne.resolves(null);
    PracticeStub.create.resolves({ _id: 'p2', text: '新的行动' });
    res.json.resetHistory();
    await controller.setCurrent(req, res);
    expect(PracticeStub.create.firstCall.args[0]).to.include({ weekIndex: 2, text: '新的行动' });
  });

  it('logToday 本周没有实修时返回 400', async () => {
    PracticeStub.findOne.resolves(null);
    req.body = { done: true };
    await controller.logToday(req, res);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('logToday 参数校验', async () => {
    req.body = { done: 'yes' };
    await controller.logToday(req, res);
    expect(res.status.calledWith(400)).to.equal(true);
    res.status.resetHistory();
    req.body = { done: true, note: 'a'.repeat(61) };
    await controller.logToday(req, res);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('logToday 新增并在当天可改', async () => {
    const doc = { logs: [], save: sandbox.stub().resolves() };
    PracticeStub.findOne.resolves(doc);
    req.body = { done: false, note: '今天太累' };
    await controller.logToday(req, res);
    expect(doc.logs).to.deep.equal([{ date: '2026-11-11', done: false, note: '今天太累' }]);
    req.body = { done: true, note: '' };
    await controller.logToday(req, res);
    expect(doc.logs).to.have.length(1);
    expect(doc.logs[0].done).to.equal(true);
  });

  it('getHistory 返回各周只读记录', async () => {
    PracticeStub.find.returns(
      chain([
        { _id: 'p2', weekIndex: 2, text: 'B', logs: [{ date: '2026-11-10', done: true, note: '' }] },
        { _id: 'p1', weekIndex: 1, text: 'A', logs: [] }
      ])
    );
    await controller.getHistory(req, res);
    const data = body();
    expect(data.weeks[0].weekRange).to.deep.equal({ from: '2026-11-09', to: '2026-11-15' });
    expect(data.weeks[1].weekRange.from).to.equal('2026-11-02');
    expect(data.weeks[0].logs[0].done).to.equal(true);
  });
});
