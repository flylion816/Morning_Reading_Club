const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const USER_ID = '507f1f77bcf86cd799439011';
const INVITER_ID = '507f1f77bcf86cd799439012';
const ADMIN_ID = '507f1f77bcf86cd799439013';
const LEAD_ID = '507f1f77bcf86cd799439014';

function chain(result) {
  const q = {
    select: () => q,
    sort: () => q,
    skip: () => q,
    limit: () => q,
    lean: async () => result,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return q;
}

describe('NewcomerLead Controller', () => {
  let Lead;
  let User;
  let Enrollment;
  let createNotification;
  let LandingStat;
  let controller;
  let res;

  const validBody = () => ({
    reason: '想找人一起读',
    note: '',
    phone: '13800000000',
    agreed: true,
    consentVersion: 'newcomer-consent-v1',
    inviterId: INVITER_ID,
    sourceType: 'daily_card'
  });

  beforeEach(() => {
    Lead = {
      LEAD_STATUSES: ['pending', 'contacted', 'talked', 'connected', 'declined'],
      SOURCE_TYPES: ['daily_card', 'quote_card', 'keepsake', 'invite', 'other'],
      findOne: sinon.stub().returns(chain(null)),
      create: sinon.stub().callsFake(async data => ({ _id: LEAD_ID, ...data })),
      findOneAndUpdate: sinon.stub().returns(chain(null)),
      exists: sinon.stub().resolves(null),
      find: sinon.stub().returns(chain([])),
      countDocuments: sinon.stub().resolves(0),
      aggregate: sinon.stub().resolves([]),
      findById: sinon.stub().returns(chain(null))
    };
    User = {
      find: sinon.stub().returns(chain([])),
      findById: sinon.stub().returns(chain({ _id: INVITER_ID, nickname: '阿泰', status: 'active' })),
      updateOne: sinon.stub().resolves({})
    };
    Enrollment = { findOne: sinon.stub().returns(chain(null)) };
    createNotification = sinon.stub().resolves();
    LandingStat = { updateOne: sinon.stub().resolves({}), find: sinon.stub().returns(chain([])) };

    controller = proxyquire('../../../src/controllers/newcomerLead.controller', {
      mongoose: require('mongoose'),
      '../models/NewcomerLead': Lead,
      '../models/User': User,
      '../models/Enrollment': Enrollment,
      '../models/LandingStat': LandingStat,
      '../utils/tenantContext': { getCurrentTenantId: () => 'tenant_1' },
      '../utils/logger': { error: () => {}, warn: () => {}, info: () => {} },
      './notification.controller': { createNotification }
    });
    res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
  });

  describe('submitLead', () => {
    it('原因、手机号、授权缺一不可', async () => {
      const cases = [
        { reason: '' },
        { phone: '12345' },
        { agreed: false },
        { consentVersion: 'old' }
      ];
      for (const patch of cases) {
        res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
        await controller.submitLead({ user: { userId: USER_ID }, body: { ...validBody(), ...patch } }, res, sinon.stub());
        expect(res.status.calledWith(400), JSON.stringify(patch)).to.equal(true);
      }
      expect(Lead.create.called).to.equal(false);
    });

    it('已报名的书友不再留言', async () => {
      Enrollment.findOne.returns(chain({ _id: 'e1' }));
      await controller.submitLead({ user: { userId: USER_ID }, body: validBody() }, res, sinon.stub());
      expect(res.status.calledWith(409)).to.equal(true);
      expect(Lead.create.called).to.equal(false);
    });

    it('首次提交：创建线索、记录分享人和授权版本、通知接待组', async () => {
      User.find.returns(chain([{ _id: ADMIN_ID }]));
      await controller.submitLead({ user: { userId: USER_ID }, body: validBody(), wsManager: {} }, res, sinon.stub());

      expect(res.status.calledWith(201)).to.equal(true);
      const created = Lead.create.firstCall.args[0];
      expect(String(created.inviterId)).to.equal(INVITER_ID);
      expect(created.sourceType).to.equal('daily_card');
      expect(created.consentVersion).to.equal('newcomer-consent-v1');
      expect(created.contactBy.getTime()).to.be.greaterThan(Date.now() + 2 * 24 * 3600 * 1000);
      expect(createNotification.calledTwice).to.equal(true);
      expect(createNotification.firstCall.args[0]).to.equal(ADMIN_ID);
      expect(createNotification.firstCall.args[1]).to.equal('newcomer_lead');
    });

    it('通知分享人：有人通过你分享的日签留言了，不透露对方是谁；自己分享给自己、分享人停用时不通知', async () => {
      User.find.returns(chain([{ _id: ADMIN_ID }]));
      await controller.submitLead({ user: { userId: USER_ID }, body: validBody(), wsManager: {} }, res, sinon.stub());
      const call = createNotification.getCalls().find(c => c.args[1] === 'newcomer_shared');
      expect(call.args[0]).to.equal(INVITER_ID);
      expect(call.args[2]).to.include('你分享的日签');
      expect(call.args[3]).to.not.include('138');
      expect(call.args[3]).to.not.include(USER_ID);
      expect(call.args[4]).to.not.have.property('senderId');

      createNotification.resetHistory();
      await controller.submitLead({ user: { userId: USER_ID }, body: { ...validBody(), inviterId: USER_ID }, wsManager: {} }, res, sinon.stub());
      expect(createNotification.getCalls().some(c => c.args[1] === 'newcomer_shared')).to.equal(false);

      createNotification.resetHistory();
      Lead.findOne.returns(chain(null));
      User.findById.returns(chain({ _id: INVITER_ID, status: 'banned' }));
      await controller.submitLead({ user: { userId: USER_ID }, body: validBody(), wsManager: {} }, res, sinon.stub());
      expect(createNotification.getCalls().some(c => c.args[1] === 'newcomer_shared')).to.equal(false);
    });

    it('通知分享人失败不影响新书友提交', async () => {
      createNotification.callsFake(async (id, type) => { if (type === 'newcomer_shared') throw new Error('x'); });
      await controller.submitLead({ user: { userId: USER_ID }, body: validBody(), wsManager: {} }, res, sinon.stub());
      expect(res.status.calledWith(201)).to.equal(true);
    });

    it('分享人是自己时不记录分享人', async () => {
      await controller.submitLead(
        { user: { userId: USER_ID }, body: { ...validBody(), inviterId: USER_ID } },
        res,
        sinon.stub()
      );
      expect(Lead.create.firstCall.args[0].inviterId).to.equal(null);
    });

    it('返回给新书友的手机号是脱敏的', async () => {
      await controller.submitLead({ user: { userId: USER_ID }, body: validBody() }, res, sinon.stub());
      const lead = res.json.firstCall.args[0].data.lead;
      expect(lead.phoneMasked).to.equal('138****0000');
      expect(lead.phone).to.equal(undefined);
    });

    it('接待人已经在跟进时不允许再覆盖', async () => {
      Lead.findOne.returns(chain({ _id: LEAD_ID, status: 'contacted' }));
      await controller.submitLead({ user: { userId: USER_ID }, body: validBody() }, res, sinon.stub());
      expect(res.status.calledWith(409)).to.equal(true);
    });

    it('已认领但还没联系时只能改手机号', async () => {
      const existing = {
        _id: LEAD_ID,
        status: 'pending',
        assigneeId: ADMIN_ID,
        reason: '原来的原因',
        phone: '13900000000',
        save: sinon.stub().resolves()
      };
      Lead.findOne.returns(chain(existing));
      await controller.submitLead(
        { user: { userId: USER_ID }, body: { ...validBody(), reason: '改一个原因' } },
        res,
        sinon.stub()
      );
      expect(existing.phone).to.equal('13800000000');
      expect(existing.reason).to.equal('原来的原因');
      expect(Lead.create.called).to.equal(false);
    });

    it('通知接待组失败不影响提交', async () => {
      User.find.returns(chain([{ _id: ADMIN_ID }]));
      createNotification.rejects(new Error('ws down'));
      await controller.submitLead({ user: { userId: USER_ID }, body: validBody() }, res, sinon.stub());
      expect(res.status.calledWith(201)).to.equal(true);
    });
  });

  describe('getLanding', () => {
    it('访客：返回分享人公开信息，没有线索', async () => {
      await controller.getLanding({ query: { inviterId: INVITER_ID } }, res, sinon.stub());
      const data = res.json.firstCall.args[0].data;
      expect(data.inviter.nickname).to.equal('阿泰');
      expect(data.viewer).to.deep.equal({ isLoggedIn: false, isMember: false, lead: null });
      expect(Lead.findOne.called).to.equal(false);
    });

    it('分享人不存在或无效时当作没有分享人', async () => {
      User.findById.returns(chain(null));
      await controller.getLanding({ query: { inviterId: INVITER_ID } }, res, sinon.stub());
      expect(res.json.firstCall.args[0].data.inviter).to.equal(null);

      res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
      await controller.getLanding({ query: { inviterId: 'bad' } }, res, sinon.stub());
      expect(res.json.firstCall.args[0].data.inviter).to.equal(null);
    });

    it('已登录且已报名：标记为老书友', async () => {
      Enrollment.findOne.returns(chain({ _id: 'e1' }));
      await controller.getLanding({ query: {}, user: { userId: USER_ID } }, res, sinon.stub());
      expect(res.json.firstCall.args[0].data.viewer.isMember).to.equal(true);
    });
  });

  describe('接待组', () => {
    const admin = { _id: ADMIN_ID, nickname: '泰君' };

    it('详情：未认领的接待人只能看到脱敏手机号', async () => {
      Lead.findById.returns(
        chain({
          _id: LEAD_ID,
          userId: USER_ID,
          status: 'pending',
          phone: '13800000000',
          assigneeId: null,
          followUps: []
        })
      );
      await controller.getLeadDetail({ params: { leadId: LEAD_ID }, mobileAdmin: admin }, res, sinon.stub());
      const lead = res.json.firstCall.args[0].data.lead;
      expect(lead.phone).to.equal('');
      expect(lead.phoneMasked).to.equal('138****0000');
      expect(lead.isAssignee).to.equal(false);
    });

    it('详情：认领人本人能看到完整手机号', async () => {
      Lead.findById.returns(
        chain({
          _id: LEAD_ID,
          userId: USER_ID,
          status: 'pending',
          phone: '13800000000',
          assigneeId: ADMIN_ID,
          followUps: []
        })
      );
      await controller.getLeadDetail({ params: { leadId: LEAD_ID }, mobileAdmin: admin }, res, sinon.stub());
      expect(res.json.firstCall.args[0].data.lead.phone).to.equal('13800000000');
    });

    it('认领：只更新还没有接待人的线索，已被认领返回 409', async () => {
      Lead.exists.resolves({ _id: LEAD_ID });
      await controller.claimLead({ params: { leadId: LEAD_ID }, mobileAdmin: admin }, res, sinon.stub());
      expect(Lead.findOneAndUpdate.firstCall.args[0]).to.deep.include({ assigneeId: null });
      expect(res.status.calledWith(409)).to.equal(true);
    });

    it('认领：线索不存在返回 404', async () => {
      await controller.claimLead({ params: { leadId: LEAD_ID }, mobileAdmin: admin }, res, sinon.stub());
      expect(res.status.calledWith(404)).to.equal(true);
    });

    it('更新状态：只允许认领人，并追加跟进记录', async () => {
      Lead.findOneAndUpdate.returns(chain({ _id: LEAD_ID, status: 'contacted' }));
      await controller.updateLeadStatus(
        { params: { leadId: LEAD_ID }, body: { status: 'contacted', note: '已加微信' }, mobileAdmin: admin },
        res,
        sinon.stub()
      );
      const [filter, update] = Lead.findOneAndUpdate.firstCall.args;
      expect(String(filter.assigneeId)).to.equal(ADMIN_ID);
      expect(update.$set.status).to.equal('contacted');
      expect(update.$push.followUps.note).to.equal('已加微信');
    });

    it('更新状态：不是认领人返回 403；非法状态返回 400', async () => {
      Lead.exists.resolves({ _id: LEAD_ID });
      await controller.updateLeadStatus(
        { params: { leadId: LEAD_ID }, body: { status: 'talked' }, mobileAdmin: admin },
        res,
        sinon.stub()
      );
      expect(res.status.calledWith(403)).to.equal(true);

      res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
      await controller.updateLeadStatus(
        { params: { leadId: LEAD_ID }, body: { status: 'pending' }, mobileAdmin: admin },
        res,
        sinon.stub()
      );
      expect(res.status.calledWith(400)).to.equal(true);
    });

    describe('接待组身份', () => {
      const run = async user => {
        User.findById.returns(chain(user));
        const next = sinon.stub();
        const request = { user: { userId: ADMIN_ID } };
        await controller.requireReceptionist(request, res, next);
        return { next, request };
      };

      it('后台配置过的管理员放行，并把身份交给后续接口', async () => {
        const { next, request } = await run({
          _id: ADMIN_ID,
          role: 'admin',
          status: 'active',
          isNewcomerReceptionist: true
        });
        expect(next.calledOnce).to.equal(true);
        expect(String(request.mobileAdmin._id)).to.equal(ADMIN_ID);
      });

      it('没被配置的管理员返回 403，看不到任何线索', async () => {
        const { next } = await run({ _id: ADMIN_ID, role: 'admin', status: 'active', isNewcomerReceptionist: false });
        expect(next.called).to.equal(false);
        expect(res.status.calledWith(403)).to.equal(true);
      });

      it('被取消管理员或被禁用的人，即使旧标记还在也不放行', async () => {
        for (const user of [
          { _id: ADMIN_ID, role: 'user', status: 'active', isNewcomerReceptionist: true },
          { _id: ADMIN_ID, role: 'admin', status: 'banned', isNewcomerReceptionist: true }
        ]) {
          res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
          const { next } = await run(user);
          expect(next.called).to.equal(false);
          expect(res.status.calledWith(403)).to.equal(true);
        }
      });

      it('入口判断：接待组为 true，其他人为 false', async () => {
        User.findById.returns(chain({ role: 'admin', status: 'active', isNewcomerReceptionist: true }));
        await controller.getAccess({ user: { userId: ADMIN_ID } }, res, sinon.stub());
        expect(res.json.firstCall.args[0].data.isReceptionist).to.equal(true);

        res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
        User.findById.returns(chain({ role: 'admin', status: 'active', isNewcomerReceptionist: false }));
        await controller.getAccess({ user: { userId: ADMIN_ID } }, res, sinon.stub());
        expect(res.json.firstCall.args[0].data.isReceptionist).to.equal(false);
      });
    });
  });

  describe('落地页访问计数与统计', () => {
    it('只有第一次加载（view=1）才计数，静默刷新不算；按天、分享人、来源累加', async () => {
      await controller.getLanding({ query: { inviterId: INVITER_ID, src: 'daily_card', view: '1' } }, res, sinon.stub());
      await new Promise(resolve => setImmediate(resolve));
      expect(LandingStat.updateOne.calledOnce).to.equal(true);
      const [filter, update, options] = LandingStat.updateOne.firstCall.args;
      expect(String(filter.inviterId)).to.equal(INVITER_ID);
      expect(filter.sourceType).to.equal('daily_card');
      expect(filter.dayKey).to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(update).to.deep.equal({ $inc: { views: 1 } });
      expect(options.upsert).to.equal(true);

      LandingStat.updateOne.resetHistory();
      await controller.getLanding({ query: { inviterId: INVITER_ID } }, res, sinon.stub());
      await new Promise(resolve => setImmediate(resolve));
      expect(LandingStat.updateOne.called).to.equal(false);
    });

    it('计数失败不影响落地页；来源不认识时记为 other', async () => {
      LandingStat.updateOne.rejects(new Error('db'));
      await controller.getLanding({ query: { src: '乱写', view: '1' } }, res, sinon.stub());
      expect(res.json.calledOnce).to.equal(true);
      expect(LandingStat.updateOne.firstCall.args[0].sourceType).to.equal('other');
    });

    it('统计：访问次数、留言数、转化率、带来留言最多的分享人', async () => {
      LandingStat.find.returns(chain([{ views: 40 }, { views: 60 }]));
      Lead.find.returns(chain([{ inviterId: INVITER_ID }, { inviterId: INVITER_ID }, { inviterId: null }, { inviterId: null }]));
      User.find.returns(chain([{ _id: INVITER_ID, nickname: '阿泰' }]));
      await controller.getStats({ query: { days: '7' } }, res, sinon.stub());
      expect(res.json.firstCall.args[0].data).to.deep.equal({
        days: 7,
        views: 100,
        leads: 4,
        fromShares: 2,
        conversion: 4,
        topInviters: [{ nickname: '阿泰', leads: 2 }]
      });
    });

    it('没有访问时转化率为 null；天数限制在 1 到 90', async () => {
      await controller.getStats({ query: { days: '999' } }, res, sinon.stub());
      const data = res.json.firstCall.args[0].data;
      expect(data.days).to.equal(90);
      expect(data.conversion).to.equal(null);
    });
  });
});
