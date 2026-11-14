const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const { hashText } = require('../../../src/utils/text-hash');

const oid = () => new mongoose.Types.ObjectId();
const lean = value => ({ lean: () => Promise.resolve(value), select() { return this; } });
function chain(value) {
  const c = {
    select: () => c,
    sort: () => c,
    skip: () => c,
    limit: () => c,
    lean: () => Promise.resolve(value)
  };
  return c;
}

describe('Highlight Controller', () => {
  let sandbox;
  let ctrl;
  let req;
  let res;
  let next;
  let H;
  let S;
  let P;
  let access;
  const userId = oid();
  const sectionId = oid();
  const periodId = oid();

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = { body: {}, params: {}, query: {}, user: { id: userId } };
    res = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
    next = sandbox.stub();
    H = {
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      create: sandbox.stub(),
      deleteOne: sandbox.stub().resolves()
    };
    S = { findById: sandbox.stub().returns(lean({ _id: sectionId, periodId })), find: sandbox.stub() };
    P = { find: sandbox.stub() };
    access = { ensurePeriodCommunityAccess: sandbox.stub().resolves(true) };
    ctrl = proxyquire('../../../src/controllers/highlight.controller', {
      '../models/Highlight': H,
      '../models/Section': S,
      '../models/Period': P,
      '../utils/response': {
        success: (data, message) => ({ code: 200, message, data }),
        errors: {
          badRequest: m => ({ code: 400, message: m }),
          notFound: m => ({ code: 404, message: m })
        }
      },
      '../utils/logger': { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
      '../services/community-access.service': access
    });
  });
  afterEach(() => sandbox.restore());

  describe('createHighlight', () => {
    it('创建摘抄并存规范化原文与哈希', async () => {
      req.body = { sectionId: String(sectionId), text: '  读书  使人充实 ', note: ' 好 ' };
      H.findOne.returns(lean(null));
      H.create.callsFake(async doc => ({ _id: oid(), ...doc }));
      await ctrl.createHighlight(req, res, next);
      const arg = H.create.firstCall.args[0];
      expect(arg.text).to.equal('读书 使人充实');
      expect(arg.textHash).to.equal(hashText('读书 使人充实'));
      expect(arg.note).to.equal('好');
      expect(String(arg.periodId)).to.equal(String(periodId));
    });

    it('重复摘抄返回已有那条', async () => {
      req.body = { sectionId: String(sectionId), text: '一句话' };
      H.findOne.returns(lean({ _id: oid(), text: '一句话', note: 'x' }));
      await ctrl.createHighlight(req, res, next);
      expect(H.create.called).to.equal(false);
      expect(res.json.firstCall.args[0].data.note).to.equal('x');
    });

    it('并发重复（11000）回读已有那条', async () => {
      req.body = { sectionId: String(sectionId), text: '一句话' };
      H.findOne.onFirstCall().returns(lean(null));
      H.findOne.onSecondCall().returns(lean({ _id: oid(), text: '一句话' }));
      H.create.rejects(Object.assign(new Error('dup'), { code: 11000 }));
      await ctrl.createHighlight(req, res, next);
      expect(res.json.firstCall.args[0].code).to.equal(200);
    });

    it('超长原文、超长感想、空文本、课程不存在、未报名都被拒绝', async () => {
      req.body = { sectionId: String(sectionId), text: 'a'.repeat(501) };
      await ctrl.createHighlight(req, res, next);
      expect(res.status.lastCall.args[0]).to.equal(400);

      req.body = { sectionId: String(sectionId), text: 'a', note: 'b'.repeat(201) };
      await ctrl.createHighlight(req, res, next);
      expect(res.status.lastCall.args[0]).to.equal(400);

      req.body = { sectionId: String(sectionId), text: '   ' };
      await ctrl.createHighlight(req, res, next);
      expect(res.status.lastCall.args[0]).to.equal(400);

      S.findById.returns(lean(null));
      req.body = { sectionId: String(sectionId), text: 'a' };
      await ctrl.createHighlight(req, res, next);
      expect(res.status.lastCall.args[0]).to.equal(404);

      S.findById.returns(lean({ periodId }));
      access.ensurePeriodCommunityAccess.callsFake(async r => { r.status(403).json({}); return false; });
      await ctrl.createHighlight(req, res, next);
      expect(H.create.called).to.equal(false);
      expect(res.status.lastCall.args[0]).to.equal(403);
    });
  });

  describe('updateHighlightNote / deleteHighlight', () => {
    it('只改本人的 note', async () => {
      const id = oid();
      const doc = { _id: id, text: 't', note: '', save: sandbox.stub().resolves() };
      H.findOne.resolves(doc);
      req.params.id = String(id);
      req.body = { note: ' 新感想 ', text: '不该被改' };
      await ctrl.updateHighlightNote(req, res, next);
      expect(H.findOne.firstCall.args[0]).to.deep.include({ userId });
      expect(doc.note).to.equal('新感想');
      expect(doc.text).to.equal('t');
    });

    it('他人的摘抄 404', async () => {
      H.findOne.resolves(null);
      req.params.id = String(oid());
      await ctrl.updateHighlightNote(req, res, next);
      expect(res.status.lastCall.args[0]).to.equal(404);
    });

    it('删除本人的', async () => {
      const id = oid();
      H.findOne.returns(lean({ _id: id }));
      req.params.id = String(id);
      await ctrl.deleteHighlight(req, res, next);
      expect(H.deleteOne.firstCall.args[0]).to.deep.equal({ _id: String(id), userId });
    });

    it('删除他人的 404', async () => {
      H.findOne.returns(lean(null));
      req.params.id = String(oid());
      await ctrl.deleteHighlight(req, res, next);
      expect(H.deleteOne.called).to.equal(false);
      expect(res.status.lastCall.args[0]).to.equal(404);
    });
  });

  describe('getMyHighlights', () => {
    it('返回带课程与期次信息的列表和期次筛选', async () => {
      const p2 = oid();
      H.find.onFirstCall().returns(chain([{ periodId }, { periodId }, { periodId: p2 }]));
      H.find.onSecondCall().returns(chain([
        { _id: oid(), periodId, sectionId, text: 't', textHash: 'h', note: '', createdAt: new Date() }
      ]));
      S.find.returns(chain([{ _id: sectionId, title: '第一课', day: 3 }]));
      P.find.returns(chain([{ _id: periodId, name: '一期' }, { _id: p2, name: '二期' }]));
      await ctrl.getMyHighlights(req, res, next);
      const data = res.json.firstCall.args[0].data;
      expect(data.total).to.equal(3);
      expect(data.list[0]).to.include({ sectionTitle: '第一课', day: 3, periodName: '一期' });
      expect(data.periods).to.deep.include({ id: String(periodId), name: '一期', count: 2 });
    });

    it('按期次筛选时 total 为该期数量', async () => {
      req.query.periodId = String(periodId);
      H.find.onFirstCall().returns(chain([{ periodId }, { periodId: oid() }]));
      H.find.onSecondCall().returns(chain([]));
      P.find.returns(chain([]));
      await ctrl.getMyHighlights(req, res, next);
      expect(res.json.firstCall.args[0].data.total).to.equal(1);
      expect(H.find.secondCall.args[0]).to.deep.equal({ userId, periodId: String(periodId) });
    });
  });

  describe('getSectionPopular', () => {
    it('只返回不少于 3 位不同书友的段落，且不含用户标识', async () => {
      const u = [userId, oid(), oid()];
      H.find.returns(chain([
        { userId: u[0], textHash: 'a' }, { userId: u[1], textHash: 'a' }, { userId: u[2], textHash: 'a' },
        { userId: u[0], textHash: 'b' }, { userId: u[1], textHash: 'b' }
      ]));
      req.params.sectionId = String(sectionId);
      await ctrl.getSectionPopular(req, res, next);
      const data = res.json.firstCall.args[0].data;
      expect(data.popular).to.deep.equal([{ textHash: 'a', count: 3 }]);
      expect(data.mine).to.have.members(['a', 'b']);
      expect(JSON.stringify(data)).to.not.include(String(u[1]));
    });

    it('未报名时不返回数据', async () => {
      access.ensurePeriodCommunityAccess.callsFake(async r => { r.status(403).json({}); return false; });
      req.params.sectionId = String(sectionId);
      await ctrl.getSectionPopular(req, res, next);
      expect(H.find.called).to.equal(false);
    });
  });

  it('支持按课节和原文直接取消摘抄', async () => {
    req.body = { sectionId: String(sectionId), text: '  一段摘抄  ' };
    H.deleteOne.resolves({ deletedCount: 1 });
    await ctrl.deleteHighlightByText(req, res, next);
    expect(H.deleteOne.calledWith({
      userId,
      sectionId: String(sectionId),
      textHash: hashText('一段摘抄')
    })).to.equal(true);
    expect(res.json.firstCall.args[0].message).to.equal('已取消摘抄');
  });
});
