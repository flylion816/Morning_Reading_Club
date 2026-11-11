const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();

// 可链式查询桩：.select/.sort/.skip/.limit 返回自身，.lean() 返回结果
function chain(result) {
  const q = {};
  ['select', 'sort', 'skip', 'limit'].forEach(m => {
    q[m] = sinon.stub().returns(q);
  });
  q.lean = sinon.stub().resolves(result);
  return q;
}

describe('SeenCard Controller', () => {
  let sandbox; let req; let res; let next; let SeenCardStub; let CheckinStub; let UserStub; let SectionStub; let PeriodStub;
  let accessStub; let dispatchStub; let controller; let me; let owner; let checkin;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    me = oid();
    owner = oid();
    checkin = {
      _id: oid(),
      userId: owner,
      periodId: oid(),
      sectionId: oid(),
      isPublic: true
    };
    req = { body: {}, params: { checkinId: String(checkin._id) }, query: {}, user: { id: String(me) } };
    res = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
    next = sandbox.stub();
    SeenCardStub = {
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      create: sandbox.stub(),
      countDocuments: sandbox.stub(),
      findOneAndUpdate: sandbox.stub().resolves(null)
    };
    CheckinStub = { findById: sandbox.stub().resolves(checkin), find: sandbox.stub().returns(chain([])) };
    UserStub = { find: sandbox.stub().returns(chain([])), findById: sandbox.stub().returns(chain({ nickname: '小明' })) };
    SectionStub = { find: sandbox.stub().returns(chain([])) };
    PeriodStub = { find: sandbox.stub().returns(chain([])) };
    accessStub = sandbox.stub().resolves(true);
    dispatchStub = sandbox.stub().resolves();
    controller = proxyquire('../../../src/controllers/seenCard.controller', {
      '../models/SeenCard': SeenCardStub,
      '../models/Checkin': CheckinStub,
      '../models/User': UserStub,
      '../models/Section': SectionStub,
      '../models/Period': PeriodStub,
      '../utils/logger': { warn: sandbox.stub() },
      '../services/user-notification.service': { dispatchNotificationWithSubscribe: dispatchStub },
      '../services/community-access.service': { ensurePeriodCommunityAccess: accessStub }
    });
  });

  afterEach(() => sandbox.restore());

  describe('sendSeen', () => {
    it('拒绝不在预设里的短句', async () => {
      req.body.phrase = '随便写一句';
      await controller.sendSeen(req, res, next);
      expect(res.status.calledWith(400)).to.equal(true);
      expect(SeenCardStub.create.called).to.equal(false);
    });

    it('不能给自己的打卡送', async () => {
      checkin.userId = me;
      req.body.phrase = 'persist';
      await controller.sendSeen(req, res, next);
      expect(res.status.calledWith(400)).to.equal(true);
    });

    it('没有期次社群权限时不送', async () => {
      accessStub.callsFake(async r => {
        r.status(403).json({});
        return false;
      });
      req.body.phrase = 'persist';
      await controller.sendSeen(req, res, next);
      expect(SeenCardStub.create.called).to.equal(false);
    });

    it('私密打卡对任何人（含管理员）都不可送', async () => {
      checkin.isPublic = false;
      req.body.phrase = 'persist';
      SeenCardStub.findOne.resolves(null);
      SeenCardStub.create.resolves({ _id: oid() });
      await controller.sendSeen(req, res, next);
      expect(res.status.calledWith(403)).to.equal(true);
      expect(SeenCardStub.create.called).to.equal(false);

      res.status.resetHistory();
      req.user.role = 'admin';
      await controller.sendSeen(req, res, next);
      expect(res.status.calledWith(403)).to.equal(true);
      expect(SeenCardStub.create.called).to.equal(false);
    });

    it('首次送出创建卡片并通知作者', async () => {
      req.body.phrase = 'touched';
      SeenCardStub.findOne.resolves(null);
      SeenCardStub.create.resolves({ _id: oid() });
      await controller.sendSeen(req, res, next);
      expect(SeenCardStub.create.calledOnce).to.equal(true);
      const arg = dispatchStub.firstCall.args[1];
      expect(arg.notificationType).to.equal('seen_received');
      expect(arg.title).to.equal('有书友看见了你');
      expect(arg.content).to.equal('小明：这句话说到我心里了');
      expect(arg.recipientUserId).to.equal(String(owner));
      expect(arg.data.checkinId).to.equal(String(checkin._id));
      expect(res.json.firstCall.args[0].data.created).to.equal(true);
    });

    it('换短句只更新，不重复通知', async () => {
      req.body.phrase = 'thanks';
      const card = { phrase: 'persist', save: sandbox.stub().resolves() };
      SeenCardStub.findOne.resolves(card);
      await controller.sendSeen(req, res, next);
      expect(card.phrase).to.equal('thanks');
      expect(card.withdrawnAt).to.equal(null);
      expect(card.save.calledOnce).to.equal(true);
      expect(SeenCardStub.create.called).to.equal(false);
      expect(dispatchStub.called).to.equal(false);
    });

    it('撤回后再送：复用原记录、清掉撤回标记、不重复通知', async () => {
      req.body.phrase = 'persist';
      const card = { phrase: 'persist', withdrawnAt: new Date(), save: sandbox.stub().resolves() };
      SeenCardStub.findOne.resolves(card);
      await controller.sendSeen(req, res, next);
      expect(card.withdrawnAt).to.equal(null);
      expect(SeenCardStub.create.called).to.equal(false);
      expect(dispatchStub.called).to.equal(false);
      expect(res.json.firstCall.args[0].data.created).to.equal(false);
    });

    it('通知失败不影响送卡', async () => {
      req.body.phrase = 'metoo';
      SeenCardStub.findOne.resolves(null);
      SeenCardStub.create.resolves({ _id: oid() });
      dispatchStub.rejects(new Error('boom'));
      await controller.sendSeen(req, res, next);
      expect(next.called).to.equal(false);
      expect(res.json.calledOnce).to.equal(true);
    });
  });

  describe('withdrawSeen', () => {
    it('只按本人 id 软删除（写入 withdrawnAt）', async () => {
      await controller.withdrawSeen(req, res, next);
      const [filter, update] = SeenCardStub.findOneAndUpdate.firstCall.args;
      expect(filter).to.deep.equal({
        checkinId: req.params.checkinId,
        userId: String(me),
        withdrawnAt: null
      });
      expect(update.$set.withdrawnAt).to.be.instanceOf(Date);
      expect(res.json.calledOnce).to.equal(true);
    });
  });

  describe('getCheckinSeen', () => {
    it('汇总计数、我的短句和最近 5 位', async () => {
      const mk = (userId, phrase) => ({ userId, phrase, createdAt: new Date() });
      const cards = [mk(me, 'persist'), mk(oid(), 'persist'), mk(oid(), 'metoo'), mk(oid(), 'thanks'), mk(oid(), 'thanks'), mk(oid(), 'touched'), mk(oid(), 'touched')];
      SeenCardStub.find.returns(chain(cards));
      await controller.getCheckinSeen(req, res, next);
      const {data} = res.json.firstCall.args[0];
      expect(data.total).to.equal(7);
      expect(data.counts).to.deep.equal({ persist: 2, touched: 2, thanks: 2, metoo: 1 });
      expect(data.mine).to.equal('persist');
      expect(data.recent).to.have.length(5);
    });

    it('作者本人可看自己打卡，无需再校验权限', async () => {
      checkin.userId = me;
      SeenCardStub.find.returns(chain([]));
      await controller.getCheckinSeen(req, res, next);
      expect(accessStub.called).to.equal(false);
      expect(res.json.firstCall.args[0].data.mine).to.equal(null);
    });
  });

  describe('getSeenSummary', () => {
    it('超过 50 个返回 400', async () => {
      req.body.checkinIds = Array.from({ length: 51 }, () => String(oid()));
      await controller.getSeenSummary(req, res, next);
      expect(res.status.calledWith(400)).to.equal(true);
    });

    it('返回每篇的 total 和 mine', async () => {
      const a = oid();
      const b = oid();
      req.body.checkinIds = [String(a), String(b)];
      CheckinStub.find.returns(chain([
        { _id: a, userId: owner, isPublic: true },
        { _id: b, userId: owner, isPublic: true }
      ]));
      SeenCardStub.find.returns(chain([
        { checkinId: a, userId: me, phrase: 'metoo' },
        { checkinId: a, userId: oid(), phrase: 'persist' }
      ]));
      await controller.getSeenSummary(req, res, next);
      const {data} = res.json.firstCall.args[0];
      expect(data[String(a)]).to.deep.equal({ total: 2, mine: 'metoo' });
      expect(data[String(b)]).to.deep.equal({ total: 0, mine: null });
      expect(SeenCardStub.find.firstCall.args[0].withdrawnAt).to.equal(null);
    });

    it('他人的私密打卡一律 0，本人的私密打卡可见，且只查询一次打卡', async () => {
      const priv = oid();
      const mineP = oid();
      req.body.checkinIds = [String(priv), String(mineP)];
      CheckinStub.find.returns(chain([
        { _id: priv, userId: owner, isPublic: false },
        { _id: mineP, userId: me, isPublic: false }
      ]));
      SeenCardStub.find.returns(chain([{ checkinId: mineP, userId: oid(), phrase: 'thanks' }]));
      await controller.getSeenSummary(req, res, next);
      const { data } = res.json.firstCall.args[0];
      expect(data[String(priv)]).to.deep.equal({ total: 0, mine: null });
      expect(data[String(mineP)]).to.deep.equal({ total: 1, mine: null });
      expect(CheckinStub.find.calledOnce).to.equal(true);
      const ids = SeenCardStub.find.firstCall.args[0].checkinId.$in.map(String);
      expect(ids).to.deep.equal([String(mineP)]);
    });

    it('打卡都不可见时不查看见卡', async () => {
      const priv = oid();
      req.body.checkinIds = [String(priv)];
      CheckinStub.find.returns(chain([{ _id: priv, userId: owner, isPublic: false }]));
      await controller.getSeenSummary(req, res, next);
      expect(SeenCardStub.find.called).to.equal(false);
    });
  });

  describe('getReceivedSeen', () => {
    it('返回带送卡人、课程标题和期次名的列表', async () => {
      const sender = oid();
      const card = { _id: oid(), checkinId: checkin._id, sectionId: checkin.sectionId, periodId: checkin.periodId, userId: sender, phrase: 'persist', createdAt: new Date() };
      const q = chain([card]);
      SeenCardStub.find.returns(q);
      SeenCardStub.countDocuments.resolves(1);
      UserStub.find.returns(chain([{ _id: sender, nickname: '小红', avatarUrl: 'a.png' }]));
      SectionStub.find.returns(chain([{ _id: checkin.sectionId, title: '第一天' }]));
      PeriodStub.find.returns(chain([{ _id: checkin.periodId, name: '七个习惯第一期' }]));
      req.query = { page: '1', limit: '10' };
      await controller.getReceivedSeen(req, res, next);
      expect(SeenCardStub.find.firstCall.args[0]).to.deep.equal({ receiverId: String(me), withdrawnAt: null });
      const {data} = res.json.firstCall.args[0];
      expect(data.total).to.equal(1);
      expect(data.list[0]).to.include({ nickname: '小红', phrase: 'persist', courseTitle: '第一天', periodName: '七个习惯第一期' });
    });
  });
});
