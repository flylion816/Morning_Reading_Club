const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const mongoose = require('mongoose');
const axios = require('axios');
const app = require('../../src/app');
const Tenant = require('../../src/models/Tenant');
const User = require('../../src/models/User');
const Period = require('../../src/models/Period');
const Section = require('../../src/models/Section');
const Enrollment = require('../../src/models/Enrollment');
const JoyNote = require('../../src/models/JoyNote');
const JoyNoteShare = require('../../src/models/JoyNoteShare');
const subscribeMessageService = require('../../src/services/subscribe-message.service');
const { withSystemContext } = require('../../src/utils/tenantContext');
const { generateAccessToken } = require('../../src/utils/jwt');

describe('随喜 / 觉察分享：开启、权限、停止、小程序码', function () {
  this.timeout(30000);
  let tenant;
  let otherTenant;
  let owner;
  let member;
  let outsider;
  let foreign;
  let tokens;
  let period;
  let section;

  const mk = async (suffix, doc) => User.create({ tenantId: doc.tenantId, openid: `share-${doc.key}-${suffix}`, nickname: doc.nickname });

  before(async () => {
    expect(process.env.NODE_ENV).to.equal('test');
    const suffix = new mongoose.Types.ObjectId().toHexString();
    tenant = await Tenant.create({ name: '分享测试', slug: `sh-${suffix}` });
    otherTenant = await Tenant.create({ name: '另一租户', slug: `sh2-${suffix}` });
    await withSystemContext(null, async () => {
      owner = await mk(suffix, { tenantId: tenant._id, key: 'owner', nickname: '狮子' });
      member = await mk(suffix, { tenantId: tenant._id, key: 'member', nickname: '本期书友' });
      outsider = await mk(suffix, { tenantId: tenant._id, key: 'outsider', nickname: '营外书友' });
      foreign = await mk(suffix, { tenantId: otherTenant._id, key: 'foreign', nickname: '外租户' });
      const tokenOf = (user, t) => generateAccessToken({ userId: String(user._id), tenantId: String(t._id) });
      tokens = {
        owner: tokenOf(owner, tenant),
        member: tokenOf(member, tenant),
        outsider: tokenOf(outsider, tenant),
        foreign: tokenOf(foreign, otherTenant)
      };
      period = await Period.create({
        tenantId: tenant._id,
        name: '第 12 期',
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-23'),
        readingAccess: 'enrolled',
        isPublished: true,
        visibilityType: 'all'
      });
      for (const user of [owner, member]) {
        await Enrollment.create({
          tenantId: tenant._id, userId: user._id, periodId: period._id, status: 'active', paymentStatus: 'paid'
        });
      }
      section = await Section.create({
        tenantId: tenant._id, periodId: period._id, day: 5, title: '知彼解己', isPublished: true
      });
    });
  });

  const as = (method, path, who = 'owner') => request(app)[method](path).set('Authorization', `Bearer ${tokens[who]}`);
  const rawShare = noteId => withSystemContext(null, async () => await JoyNoteShare.findOne({ noteId }).lean());

  const makeNote = async (extra = {}, who = 'owner') =>
    (await as('post', '/api/v1/joy-notes', who).send({ content: '一句触动的话', ...extra }).expect(201)).body.data.id;
  const makeLinked = (extra = {}) => makeNote({ periodId: String(period._id), sectionId: String(section._id), ...extra });
  const share = (noteId, body = {}, who = 'owner') => as('post', '/api/v1/joy-note-shares', who).send({ noteId, ...body });

  describe('开启与取回', () => {
    it('所有入口都要求登录', async () => {
      const id = await makeNote();
      await request(app).post('/api/v1/joy-note-shares').send({ noteId: id }).expect(401);
      await request(app).get('/api/v1/joy-note-shares/abcd2345').expect(401);
      await request(app).get(`/api/v1/joy-note-shares/note/${id}`).expect(401);
      await request(app).delete(`/api/v1/joy-note-shares/note/${id}`).expect(401);
      await request(app).post('/api/v1/joy-note-shares/abcd2345/qrcode').expect(401);
    });

    it('作者开启：返回 8 位分享码；关联了期次默认「本期书友」，没关联期次只能是「登录的书友」', async () => {
      const linked = await makeLinked();
      const created = await share(linked).expect(200);
      expect(created.body.data).to.include({ audience: 'period', active: true, created: true, periodLinked: true });
      expect(created.body.data.code).to.match(/^[a-z0-9]{8}$/);

      const free = await makeNote();
      const freeShare = await share(free, { audience: 'period' }).expect(200);
      expect(freeShare.body.data).to.include({ audience: 'login', periodLinked: false });
    });

    it('重复开启沿用同一个码（created 为 false）；可以改分享范围', async () => {
      const id = await makeLinked();
      const first = (await share(id).expect(200)).body.data;
      const again = (await share(id).expect(200)).body.data;
      expect(again).to.include({ code: first.code, created: false, audience: 'period' });
      const widened = (await share(id, { audience: 'login' }).expect(200)).body.data;
      expect(widened).to.include({ code: first.code, audience: 'login', created: false });
    });

    it('只有作者能开启；记录不存在、id 不对、范围不对都被拒绝', async () => {
      const id = await makeLinked();
      await share(id, {}, 'member').expect(404);
      await share(id, {}, 'foreign').expect(404);
      await share('not-an-id').expect(404);
      await share(String(new mongoose.Types.ObjectId())).expect(404);
      await share(id, { audience: 'everyone' }).expect(400);
    });

    it('随喜和觉察都能分享', async () => {
      const joy = await makeNote({ title: '标题', contentHtml: '<p><strong>粗</strong></p>' });
      const aware = (await as('post', '/api/v1/joy-notes').send({ kind: 'awareness', awareness: { facts: '事实', choice: '小动作' } }).expect(201)).body.data.id;
      await share(joy).expect(200);
      await share(aware).expect(200);
    });

    it('状态：没分享时 active 为 false；分享中带码和范围', async () => {
      const id = await makeLinked();
      const before = (await as('get', `/api/v1/joy-note-shares/note/${id}`).expect(200)).body.data;
      expect(before).to.include({ active: false, periodLinked: true });
      const { code } = (await share(id).expect(200)).body.data;
      const after = (await as('get', `/api/v1/joy-note-shares/note/${id}`).expect(200)).body.data;
      expect(after).to.include({ active: true, code, audience: 'period' });
      await as('get', `/api/v1/joy-note-shares/note/${id}`, 'member').expect(404);
    });
  });

  describe('读这一页：登录与权限', () => {
    it('作者自己可以看，能看到期次和课程、回访状态', async () => {
      const id = await as('post', '/api/v1/joy-notes').send({
        kind: 'awareness', periodId: String(period._id), sectionId: String(section._id), awareness: { facts: '事实', choice: '小动作' }
      }).expect(201).then(res => res.body.data.id);
      const { code } = (await share(id).expect(200)).body.data;
      const view = (await as('get', `/api/v1/joy-note-shares/${code}`).expect(200)).body.data;
      expect(view).to.include({ isOwner: true, kind: 'awareness', periodName: '第 12 期', sectionTitle: '知彼解己', day: 5 });
      expect(view.awareness.revisit).to.include({ status: 'pending' });
    });

    it('本期书友可以看；内容、标题、格式、作者昵称齐全，没有回访状态和用户 ID', async () => {
      const id = await makeLinked({ title: '一页标题', contentHtml: '<p>今天<span style="color:#dc2626">重点</span></p>' });
      const { code } = (await share(id).expect(200)).body.data;
      const view = (await as('get', `/api/v1/joy-note-shares/${code}`, 'member').expect(200)).body.data;
      expect(view).to.include({
        isOwner: false, kind: 'joy', title: '一页标题', content: '今天重点', periodName: '第 12 期', sectionTitle: '知彼解己', day: 5
      });
      expect(view.contentHtml).to.contain('color:#dc2626');
      expect(view.author.nickname).to.equal('狮子');
      expect(JSON.stringify(view)).to.not.contain(String(owner._id));
    });

    it('觉察：本期书友读到看感问择，但看不到回访状态', async () => {
      const id = await as('post', '/api/v1/joy-notes').send({
        kind: 'awareness',
        periodId: String(period._id),
        title: '早晨',
        awareness: { factsHtml: '<p><strong>粗体事实</strong></p>', feelings: ['着急'], asks: [{ question: '问', answer: '答' }], choice: '择' }
      }).expect(201).then(res => res.body.data.id);
      const { code } = (await share(id).expect(200)).body.data;
      const view = (await as('get', `/api/v1/joy-note-shares/${code}`, 'member').expect(200)).body.data;
      expect(view.kind).to.equal('awareness');
      expect(view.awareness).to.include({ facts: '粗体事实', choice: '择' });
      expect(view.awareness.factsHtml).to.contain('strong');
      expect(view.awareness.feelings).to.deep.equal(['着急']);
      expect(view.awareness).to.not.have.property('revisit');
    });

    it('没登录：401；不是本期书友：403（范围是本期书友时）；其他租户：404', async () => {
      const id = await makeLinked();
      const { code } = (await share(id).expect(200)).body.data;
      await request(app).get(`/api/v1/joy-note-shares/${code}`).expect(401);
      const denied = await as('get', `/api/v1/joy-note-shares/${code}`, 'outsider').expect(403);
      expect(JSON.stringify(denied.body)).to.not.contain('一句触动的话');
      await as('get', `/api/v1/joy-note-shares/${code}`, 'foreign').expect(404);
    });

    it('范围是「所有登录的书友」：营外书友也能看内容，但看不到期次名和课程名', async () => {
      const id = await makeLinked();
      const { code } = (await share(id, { audience: 'login' }).expect(200)).body.data;
      const view = (await as('get', `/api/v1/joy-note-shares/${code}`, 'outsider').expect(200)).body.data;
      expect(view).to.include({ content: '一句触动的话', periodName: '', sectionTitle: '', isOwner: false });
      expect(view.day).to.equal(null);
    });

    it('没关联期次的记录：登录的书友都能看', async () => {
      const id = await makeNote();
      const { code } = (await share(id).expect(200)).body.data;
      await as('get', `/api/v1/joy-note-shares/${code}`, 'outsider').expect(200);
    });

    it('开启时是「本期书友」，之后作者取消了期次关联：非作者不再放行', async () => {
      const id = await makeLinked();
      const { code } = (await share(id).expect(200)).body.data;
      await as('get', `/api/v1/joy-note-shares/${code}`, 'member').expect(200);
      await as('put', `/api/v1/joy-notes/${id}`).send({ content: '一句触动的话', periodId: null, sectionId: null }).expect(200);
      await as('get', `/api/v1/joy-note-shares/${code}`, 'member').expect(403);
      await as('get', `/api/v1/joy-note-shares/${code}`).expect(200);
    });

    it('分享码格式不对、不存在：404', async () => {
      await as('get', '/api/v1/joy-note-shares/ABC').expect(404);
      await as('get', '/api/v1/joy-note-shares/zzzzzzzz').expect(404);
    });

    it('作者被停用后，分享打不开', async () => {
      const id = await makeNote({}, 'owner');
      const { code } = (await share(id).expect(200)).body.data;
      await as('get', `/api/v1/joy-note-shares/${code}`, 'outsider').expect(200);
      await withSystemContext(null, async () => await User.updateOne({ _id: owner._id }, { $set: { status: 'banned' } }));
      await as('get', `/api/v1/joy-note-shares/${code}`, 'outsider').expect(404);
      await withSystemContext(null, async () => await User.updateOne({ _id: owner._id }, { $set: { status: 'active' } }));
      await as('get', `/api/v1/joy-note-shares/${code}`, 'outsider').expect(200);
    });
  });

  describe('停止分享、再分享、删除', () => {
    it('停止分享后旧链接立即失效；再分享换一个新码，旧码仍然失效', async () => {
      const id = await makeLinked();
      const first = (await share(id).expect(200)).body.data;
      await as('get', `/api/v1/joy-note-shares/${first.code}`, 'member').expect(200);

      const stopped = await as('delete', `/api/v1/joy-note-shares/note/${id}`).expect(200);
      expect(stopped.body.data.active).to.equal(false);
      await as('get', `/api/v1/joy-note-shares/${first.code}`, 'member').expect(404);
      await as('get', `/api/v1/joy-note-shares/${first.code}`).expect(404);
      expect((await as('get', `/api/v1/joy-note-shares/note/${id}`).expect(200)).body.data.active).to.equal(false);

      const second = (await share(id).expect(200)).body.data;
      expect(second.created).to.equal(true);
      expect(second.code).to.not.equal(first.code);
      await as('get', `/api/v1/joy-note-shares/${first.code}`, 'member').expect(404);
      await as('get', `/api/v1/joy-note-shares/${second.code}`, 'member').expect(200);
      // 一条记录始终只有一条分享
      expect(await withSystemContext(null, async () => await JoyNoteShare.countDocuments({ noteId: id }))).to.equal(1);
    });

    it('停止分享：只有作者能操作；没有分享时也不报错', async () => {
      const id = await makeNote();
      await as('delete', `/api/v1/joy-note-shares/note/${id}`, 'member').expect(404);
      await as('delete', `/api/v1/joy-note-shares/note/${id}`).expect(200);
    });

    it('删除记录：分享一起删除，链接失效', async () => {
      const id = await makeLinked();
      const { code } = (await share(id).expect(200)).body.data;
      await as('delete', `/api/v1/joy-notes/${id}`).expect(200);
      expect(await rawShare(id)).to.equal(null);
      await as('get', `/api/v1/joy-note-shares/${code}`, 'member').expect(404);
    });
  });

  describe('小程序码', () => {
    let postStub;
    let tokenStub;

    beforeEach(() => {
      postStub = sinon.stub(axios, 'post').resolves({ headers: { 'content-type': 'image/png' }, data: Buffer.from('fake-png') });
      tokenStub = sinon.stub(subscribeMessageService, 'getAccessToken').resolves('access-token');
    });

    afterEach(() => {
      postStub.restore();
      tokenStub.restore();
    });

    it('作者生成：scene 只带分享码，直达分享页；同一个码 6 小时内走缓存', async () => {
      const id = await makeLinked();
      const { code } = (await share(id).expect(200)).body.data;
      const result = (await as('post', `/api/v1/joy-note-shares/${code}/qrcode`).send({ envVersion: 'trial' }).expect(200)).body.data;
      expect(result.imageBase64).to.equal(Buffer.from('fake-png').toString('base64'));
      const [url, body] = postStub.firstCall.args;
      expect(url).to.contain('getwxacodeunlimit?access_token=access-token');
      expect(body).to.include({ scene: `s=${code}`, page: 'pages/joy-notes/shared/shared', check_path: false, env_version: 'trial' });
      expect(body.scene.length).to.be.at.most(32);
      await as('post', `/api/v1/joy-note-shares/${code}/qrcode`).send({ envVersion: 'trial' }).expect(200);
      expect(postStub.callCount).to.equal(1);
    });

    it('只有作者能生成；停止分享后不能生成；码不对不能生成', async () => {
      const id = await makeLinked();
      const { code } = (await share(id).expect(200)).body.data;
      await as('post', `/api/v1/joy-note-shares/${code}/qrcode`, 'member').send({}).expect(404);
      await as('post', '/api/v1/joy-note-shares/ABC/qrcode').send({}).expect(404);
      await as('delete', `/api/v1/joy-note-shares/note/${id}`).expect(200);
      await as('post', `/api/v1/joy-note-shares/${code}/qrcode`).send({}).expect(404);
      expect(postStub.called).to.equal(false);
    });

    it('微信生成失败：返回 503，前端退回通用小程序码', async () => {
      const id = await makeLinked();
      const { code } = (await share(id).expect(200)).body.data;
      postStub.resolves({ headers: { 'content-type': 'application/json' }, data: Buffer.from('{"errcode":41030}') });
      await as('post', `/api/v1/joy-note-shares/${code}/qrcode`).send({ envVersion: 'release' }).expect(503);
    });
  });
});
