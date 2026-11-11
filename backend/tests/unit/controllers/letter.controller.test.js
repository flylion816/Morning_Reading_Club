const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Letter Controller', () => {
  let sandbox;
  let controller;
  let LetterStub;
  let PeriodStub;
  let access;
  let req;
  let res;
  let next;
  let clock;

  const PID = 'a'.repeat(24);
  const LID = 'b'.repeat(24);
  const period = {
    _id: PID,
    name: '第一期',
    startDate: new Date('2026-11-30T16:00:00.000Z'),
    endDate: new Date('2026-12-22T16:00:00.000Z')
  };
  const leanOf = v => ({ select: () => ({ lean: async () => v }) });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers({ now: new Date('2026-12-02T02:00:00Z'), toFake: ['Date'] });
    LetterStub = function (data) {
      Object.assign(this, { status: 'draft' }, data);
      this._id = LID;
      this.save = LetterStub.saveImpl ? LetterStub.saveImpl : sandbox.stub().resolves(this);
    };
    LetterStub.findOne = sandbox.stub();
    LetterStub.find = sandbox.stub();
    LetterStub.updateOne = sandbox.stub().resolves({ matchedCount: 1 });
    PeriodStub = { findById: sandbox.stub().returns(leanOf(period)), find: sandbox.stub().returns(leanOf([period])) };
    access = {
      ensurePeriodCommunityAccess: sandbox.stub().resolves(true),
      getCommunityAccessiblePeriodIds: sandbox.stub().resolves([PID])
    };
    controller = proxyquire('../../../src/controllers/letter.controller', {
      '../models/Letter': LetterStub,
      '../models/Period': PeriodStub,
      '../utils/logger': { error: sandbox.stub() },
      '../services/community-access.service': access,
      '../services/letter-delivery.service': require('../../../src/services/letter-delivery.service.js')
    });
    req = { user: { id: 'u1' }, params: { periodId: PID, id: LID }, body: {} };
    res = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
    next = sandbox.stub();
  });

  afterEach(() => {
    clock.restore();
    sandbox.restore();
  });

  const body = () => res.json.firstCall.args[0];

  it('没有信时返回 none 且可写', async () => {
    LetterStub.findOne.resolves(null);
    await controller.getPeriodLetter(req, res, next);
    expect(body().data.status).to.equal('none');
    expect(body().data.canWrite).to.equal(true);
  });

  it('已封存的信不返回内容', async () => {
    LetterStub.findOne.resolves({ _id: LID, status: 'sealed', content: '秘密', stamp: 'leaf' });
    await controller.getPeriodLetter(req, res, next);
    expect(body().data.status).to.equal('sealed');
    expect(body().data).to.not.have.property('content');
    expect(body().data.canWrite).to.equal(false);
  });

  it('保存草稿：超长被拒绝', async () => {
    req.body = { content: 'a'.repeat(2001), stamp: 'dawn' };
    await controller.saveDraft(req, res, next);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('保存草稿：非法邮戳被拒绝', async () => {
    req.body = { content: 'hi', stamp: 'bad' };
    await controller.saveDraft(req, res, next);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('保存草稿：窗口外被拒绝', async () => {
    clock.setSystemTime(new Date('2027-01-10T00:00:00Z'));
    req.body = { content: 'hi', stamp: 'dawn' };
    await controller.saveDraft(req, res, next);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('保存草稿：新建成功', async () => {
    LetterStub.findOne.resolves(null);
    req.body = { content: '你好', stamp: 'book' };
    await controller.saveDraft(req, res, next);
    expect(body().data.status).to.equal('draft');
    expect(body().data.content).to.equal('你好');
    expect(body().data.stamp).to.equal('book');
  });

  it('保存草稿：并发首次保存撞唯一索引时重读后更新', async () => {
    const dup = Object.assign(new Error('dup'), { code: 11000 });
    const existing = { _id: LID, status: 'draft', content: '先到的', stamp: 'dawn', writtenAt: new Date() };
    LetterStub.findOne.onFirstCall().resolves(null).onSecondCall().resolves(existing);
    LetterStub.saveImpl = sandbox.stub().rejects(dup);
    req.body = { content: '后到的', stamp: 'leaf' };
    await controller.saveDraft(req, res, next);
    expect(next.called).to.equal(false);
    expect(LetterStub.updateOne.calledOnce).to.equal(true);
    expect(body().data.content).to.equal('后到的');
  });

  it('保存草稿：更新时已被封存则不覆盖', async () => {
    LetterStub.findOne.resolves({ _id: LID, status: 'draft', content: 'a', stamp: 'dawn', writtenAt: new Date() });
    LetterStub.updateOne.resolves({ matchedCount: 0 });
    req.body = { content: 'b', stamp: 'dawn' };
    await controller.saveDraft(req, res, next);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('保存草稿：已封存不能再改', async () => {
    LetterStub.findOne.resolves({ status: 'sealed' });
    req.body = { content: 'x', stamp: 'dawn' };
    await controller.saveDraft(req, res, next);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('投递：草稿变封存', async () => {
    const letter = { _id: LID, status: 'draft', content: '内容', stamp: 'dawn', save: sandbox.stub().resolves() };
    LetterStub.findOne.resolves(letter);
    await controller.sealLetter(req, res, next);
    expect(letter.status).to.equal('sealed');
    expect(letter.sealedAt).to.be.instanceOf(Date);
  });

  it('投递：窗口关闭后仍可封存已有草稿', async () => {
    clock.setSystemTime(new Date('2027-01-10T00:00:00Z'));
    const letter = { _id: LID, status: 'draft', content: '窗口内写好的信', stamp: 'dawn', save: sandbox.stub().resolves() };
    LetterStub.findOne.resolves(letter);
    await controller.sealLetter(req, res, next);
    expect(letter.status).to.equal('sealed');
    expect(next.called).to.equal(false);
  });

  it('投递：空内容被拒绝', async () => {
    LetterStub.findOne.resolves({ status: 'draft', content: '  ' });
    await controller.sealLetter(req, res, next);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('拆信：未送达不能拆', async () => {
    LetterStub.findOne.resolves({ _id: LID, status: 'sealed' });
    await controller.openLetter(req, res, next);
    expect(res.status.calledWith(403)).to.equal(true);
  });

  it('拆信：送达后记录 openedAt 并返回内容', async () => {
    const letter = { _id: LID, status: 'delivered', content: '给未来', save: sandbox.stub().resolves() };
    LetterStub.findOne.resolves(letter);
    await controller.openLetter(req, res, next);
    expect(letter.status).to.equal('opened');
    expect(letter.openedAt).to.be.instanceOf(Date);
    expect(body().data.content).to.equal('给未来');
  });

  it('拆信：退报名后拒绝访问', async () => {
    access.ensurePeriodCommunityAccess.callsFake(async response => {
      response.status(403).json({ code: 403 });
      return false;
    });
    LetterStub.findOne.resolves({ _id: LID, periodId: PID, status: 'delivered', content: '给未来' });
    await controller.openLetter(req, res, next);
    expect(res.status.calledWith(403)).to.equal(true);
  });

  it('回信：只能回一次', async () => {
    req.body = { reply: '谢谢' };
    LetterStub.findOne.resolves({ _id: LID, status: 'opened', repliedAt: new Date() });
    await controller.replyLetter(req, res, next);
    expect(res.status.calledWith(400)).to.equal(true);
  });

  it('回信：超过 200 字被拒绝，正常则保存', async () => {
    req.body = { reply: 'a'.repeat(201) };
    LetterStub.findOne.resolves({ _id: LID, status: 'opened', repliedAt: null });
    await controller.replyLetter(req, res, next);
    expect(res.status.calledWith(400)).to.equal(true);

    res.status.resetHistory();
    const letter = { _id: LID, status: 'opened', repliedAt: null, content: 'c', save: sandbox.stub().resolves() };
    LetterStub.findOne.resolves(letter);
    req.body = { reply: '  收到  ' };
    await controller.replyLetter(req, res, next);
    expect(letter.reply).to.equal('收到');
  });

  it('mine：只有已拆的信带内容', async () => {
    const sorted = { sort: () => ({ lean: async () => [
      { _id: 'x1', periodId: PID, status: 'sealed', content: 's', stamp: 'dawn' },
      { _id: 'x2', periodId: PID, status: 'opened', content: 'o', stamp: 'leaf', reply: 'r' },
      { _id: 'x3', periodId: 'c'.repeat(24), status: 'opened', content: '不应出现', stamp: 'book' }
    ] }) };
    LetterStub.find.returns(sorted);
    await controller.getMyLetters(req, res, next);
    const list = body().data.list;
    expect(list[0]).to.not.have.property('content');
    expect(list[1].content).to.equal('o');
    expect(list).to.have.length(2);
  });

  it('未报名时不继续', async () => {
    access.ensurePeriodCommunityAccess.resolves(false);
    await controller.getPeriodLetter(req, res, next);
    expect(LetterStub.findOne.called).to.equal(false);
  });

  it('periodDays 优先用期次设置的天数，没设才按起止日期算', () => {
    const start = new Date('2026-11-13T00:00:00+08:00');
    const end = new Date('2026-12-10T00:00:00+08:00');
    const now = new Date('2026-11-13T08:00:00+08:00');
    expect(controller.buildLetterView(null, { startDate: start, endDate: end, totalDays: 23 }, now).periodDays).to.equal(23);
    expect(controller.buildLetterView(null, { startDate: start, endDate: end }, now).periodDays).to.equal(28);
  });
});
