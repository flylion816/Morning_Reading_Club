const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Tenant = require('../../src/models/Tenant');
const User = require('../../src/models/User');
const Period = require('../../src/models/Period');
const Section = require('../../src/models/Section');
const Enrollment = require('../../src/models/Enrollment');
const { withSystemContext } = require('../../src/utils/tenantContext');
const { generateAccessToken } = require('../../src/utils/jwt');

describe('随喜记：实际接口与租户、报名权限', function () {
  this.timeout(30000);
  let tenant;
  let otherTenant;
  let owner;
  let anotherUser;
  let token;
  let anotherToken;
  let foreignToken;
  let periods;
  let sections;

  before(async () => {
    expect(process.env.NODE_ENV).to.equal('test');
    expect(mongoose.connection.host).to.equal('127.0.0.1');
    const suffix = new mongoose.Types.ObjectId().toHexString();
    tenant = await Tenant.create({ name: '随喜测试', slug: `joy-${suffix}` });
    otherTenant = await Tenant.create({ name: '另一租户', slug: `jy2-${suffix}` });
    await withSystemContext(null, async () => {
      owner = await User.create({ tenantId: tenant._id, openid: `joy-owner-${suffix}` });
      anotherUser = await User.create({ tenantId: tenant._id, openid: `joy-other-${suffix}` });
      const foreignUser = await User.create({ tenantId: otherTenant._id, openid: `joy-foreign-${suffix}` });
      token = generateAccessToken({ userId: String(owner._id), tenantId: String(tenant._id) });
      anotherToken = generateAccessToken({ userId: String(anotherUser._id), tenantId: String(tenant._id) });
      foreignToken = generateAccessToken({ userId: String(foreignUser._id), tenantId: String(otherTenant._id) });

      const makePeriod = async (name, options = {}) => Period.create({
        tenantId: options.tenantId || tenant._id,
        name,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-23'),
        readingAccess: options.readingAccess || 'enrolled',
        isPublished: options.isPublished !== false,
        visibilityType: options.visibilityType || 'all',
        visibleUserIds: options.visibleUserIds || []
      });
      periods = {
        active: await makePeriod('有效期次'),
        completed: await makePeriod('已完成期次'),
        pending: await makePeriod('待支付期次'),
        refunded: await makePeriod('退款期次'),
        withdrawn: await makePeriod('退出期次'),
        deleted: await makePeriod('删除报名期次'),
        open: await makePeriod('公开但未报名', { readingAccess: 'open' }),
        unpublished: await makePeriod('未发布期次', { isPublished: false }),
        invisible: await makePeriod('不可见期次', { readingAccess: 'open', visibilityType: 'specific' }),
        foreign: await makePeriod('其他租户期次', { tenantId: otherTenant._id })
      };
      const enroll = (period, options = {}) => Enrollment.create({
        tenantId: tenant._id,
        userId: owner._id,
        periodId: period._id,
        status: options.status || 'active',
        paymentStatus: options.paymentStatus || 'paid',
        deleted: Boolean(options.deleted)
      });
      await enroll(periods.active);
      await enroll(periods.completed, { status: 'completed', paymentStatus: 'free' });
      await enroll(periods.pending, { paymentStatus: 'pending' });
      await enroll(periods.refunded, { paymentStatus: 'refunded' });
      await enroll(periods.withdrawn, { status: 'withdrawn' });
      await enroll(periods.deleted, { deleted: true });
      await enroll(periods.unpublished);
      await enroll(periods.invisible);
      // 模拟错误的跨租户报名引用，期次仍不能被当前租户读取。
      await enroll(periods.foreign);
      sections = {
        active: await Section.create({
          tenantId: tenant._id, periodId: periods.active._id, day: 1, title: '品德成功论', isPublished: true
        }),
        unpublished: await Section.create({
          tenantId: tenant._id, periodId: periods.active._id, day: 2, title: '未发布课节', isPublished: false
        }),
        completed: await Section.create({
          tenantId: tenant._id, periodId: periods.completed._id, day: 1, title: '另一课程', isPublished: true
        }),
        foreign: await Section.create({
          tenantId: otherTenant._id, periodId: periods.foreign._id, day: 1, title: '其他租户课程', isPublished: true
        })
      };
    });
  });

  const auth = (method, path, accessToken) =>
    request(app)[method](path).set('Authorization', `Bearer ${accessToken}`);

  it('所有入口都要求用户认证', async () => {
    await request(app).get('/api/v1/joy-notes').expect(401);
    await request(app).get('/api/v1/joy-notes/periods').expect(401);
    await request(app).post('/api/v1/joy-notes').send({ content: '一句话' }).expect(401);
  });

  it('仅列出本人有效报名且有阅读权限的本租户期次与已发布课程', async () => {
    const result = await auth('get', '/api/v1/joy-notes/periods', token).expect(200);
    expect(result.body.data.list.map(item => item.id).sort()).to.deep.equal(
      [String(periods.active._id), String(periods.completed._id)].sort()
    );
    const courseResult = await auth('get', `/api/v1/joy-notes/periods/${periods.active._id}/sections`, token).expect(200);
    expect(courseResult.body.data.list.map(item => item.id)).to.deep.equal([String(sections.active._id)]);
    await auth('get', `/api/v1/joy-notes/periods/${periods.open._id}/sections`, token).expect(403);
    await auth('get', `/api/v1/joy-notes/periods/${periods.foreign._id}/sections`, token).expect(403);
  });

  it('后端拒绝伪造的无权期次、错误课程和未发布课程', async () => {
    for (const period of [
      periods.pending, periods.refunded, periods.withdrawn, periods.deleted,
      periods.open, periods.unpublished, periods.invisible, periods.foreign
    ]) {
      await auth('post', '/api/v1/joy-notes', token)
        .send({ content: '不能关联', periodId: String(period._id) }).expect(403);
    }
    for (const section of [sections.completed, sections.unpublished, sections.foreign]) {
      await auth('post', '/api/v1/joy-notes', token)
        .send({ content: '不匹配的课程', periodId: String(periods.active._id), sectionId: String(section._id) })
        .expect(400);
    }
    await auth('post', '/api/v1/joy-notes', token)
      .send({ content: '没有期次的课程', sectionId: String(sections.active._id) }).expect(400);
    await auth('post', '/api/v1/joy-notes', token).send({ content: '  ' }).expect(400);
    await auth('post', '/api/v1/joy-notes', token).send({ content: '长'.repeat(3001) }).expect(400);
    const created = await auth('post', '/api/v1/joy-notes', token)
      .send({ content: '原来的私人记录' }).expect(201);
    const id = created.body.data.id;
    await auth('put', `/api/v1/joy-notes/${id}`, token)
      .send({ content: '不能篡改', periodId: String(periods.pending._id) }).expect(403);
    await auth('put', `/api/v1/joy-notes/${id}`, token).send({
      content: '不能用其他期的课程',
      periodId: String(periods.active._id),
      sectionId: String(sections.completed._id)
    }).expect(400);
    const list = await auth('get', '/api/v1/joy-notes', token).expect(200);
    expect(list.body.data.list.find(item => item.id === id))
      .to.include({ content: '原来的私人记录', periodId: null, sectionId: null });
  });

  it('可不关联直接记录，再关联有效期次、筛选、修改和删除', async () => {
    const created = await auth('post', '/api/v1/joy-notes', token)
      .send({ content: '  晨读里的一句话 🌱\n第二行  ' }).expect(201);
    const id = created.body.data.id;
    expect(created.body.data.content).to.equal('晨读里的一句话 🌱\n第二行');
    await auth('put', `/api/v1/joy-notes/${id}`, token).send({
      content: '改写后的想法',
      periodId: String(periods.active._id),
      sectionId: String(sections.active._id)
    }).expect(200);
    const list = await auth('get', `/api/v1/joy-notes?periodId=${periods.active._id}`, token).expect(200);
    expect(list.headers['cache-control']).to.include('no-store');
    const row = list.body.data.list.find(item => item.id === id);
    expect(row).to.include({ content: '改写后的想法', periodName: '有效期次', sectionTitle: '品德成功论' });
    await auth('delete', `/api/v1/joy-notes/${id}`, token).expect(200);
    await auth('put', `/api/v1/joy-notes/${id}`, token).send({ content: '删除后' }).expect(404);
  });

  it('其他用户与其他租户无法读取、修改或删除本人的记录', async () => {
    const created = await auth('post', '/api/v1/joy-notes', token)
      .send({ content: '仅本人可见' }).expect(201);
    const id = created.body.data.id;
    for (const otherToken of [anotherToken, foreignToken]) {
      const list = await auth('get', '/api/v1/joy-notes', otherToken).expect(200);
      expect(list.body.data.list.some(item => item.id === id)).to.equal(false);
      await auth('put', `/api/v1/joy-notes/${id}`, otherToken).send({ content: '越权修改' }).expect(404);
      await auth('delete', `/api/v1/joy-notes/${id}`, otherToken).expect(404);
    }
  });

  it('小程序页面通过真实服务完成记录、关联、筛选、编辑与删除', async () => {
    const oldWx = global.wx;
    const oldPage = global.Page;
    const oldGetCurrentPages = global.getCurrentPages;
    const storage = new Map();
    const messages = [];
    storage.set('wx2b9a3c1d5e4195f8:token', token);
    global.wx = {
      getStorageSync: key => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: key => storage.delete(key),
      showToast: value => messages.push(value.title),
      showModal: options => options.success({ confirm: true }),
      pageScrollTo: () => {},
      request: options => {
        const pathname = new URL(options.url).pathname;
        let call = request(app)[options.method.toLowerCase()](pathname).set(options.header);
        call = options.method === 'GET' ? call.query(options.data) : call.send(options.data);
        call.then(response => options.success({
          statusCode: response.status,
          data: response.body,
          header: response.headers
        })).catch(error => options.fail({ errMsg: error.message }));
      }
    };
    global.getCurrentPages = () => [];
    let definition;
    global.Page = value => { definition = value; };
    try {
      const pagePath = require.resolve('../../../miniprogram/pages/joy-notes/joy-notes');
      delete require.cache[pagePath];
      require(pagePath);
      const page = {
        ...definition,
        data: JSON.parse(JSON.stringify(definition.data)),
        setData(update, callback) {
          this.data = { ...this.data, ...update };
          if (callback) callback();
        }
      };
      await page.loadPeriods();
      expect(page.data.periods.map(item => item.id)).to.include(String(periods.active._id));
      expect(page.data.periods.map(item => item.id)).not.to.include(String(periods.pending._id));

      page.onContentInput({ detail: { value: '随手留下的一句话' } });
      await page.save();
      expect(page.data.list.some(item => item.content === '随手留下的一句话')).to.equal(true);

      await page.openAssociation();
      const index = page.data.sheetPeriodOptions.findIndex(item => item.id === String(periods.active._id));
      page.onSheetPeriodChange({ detail: { value: String(index) } });
      const deadline = Date.now() + 3000;
      while (page.data.sheetLoading && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(page.data.sheetLoading).to.equal(false);
      expect(page.data.sheetSections.map(item => item.id)).to.include(String(sections.active._id));
      page.selectSection({ currentTarget: { dataset: { id: String(sections.active._id) } } });
      page.finishAssociation();
      page.onContentInput({ detail: { value: '绑定期次和课程的记录' } });
      await page.save();
      const linked = page.data.list.find(item => item.content === '绑定期次和课程的记录');
      expect(linked.sourceLabel).to.equal('有效期次 · 第 1 天 · 品德成功论');

      const filter = page.data.filterOptions.findIndex(item => item.id === String(periods.active._id));
      page.onFilterChange({ detail: { value: String(filter) } });
      await page.loadList(true);
      expect(page.data.list.map(item => item.content)).to.include('绑定期次和课程的记录');
      expect(page.data.list.map(item => item.content)).not.to.include('随手留下的一句话');

      page.startEdit({ currentTarget: { dataset: { id: linked._id } } });
      page.onContentInput({ detail: { value: '修改后的随喜记' } });
      await page.save();
      expect(page.data.list.some(item => item.content === '修改后的随喜记')).to.equal(true);
      await page.deleteNote(linked._id);
      expect(page.data.list.some(item => item._id === linked._id)).to.equal(false);

      page.setData({ content: '权限失效时保留的输入', draftPeriodId: String(periods.pending._id) });
      await page.save();
      expect(page.data.content).to.equal('权限失效时保留的输入');
      expect(messages).to.include('只能关联已报名且有权限的期次');
    } finally {
      global.wx = oldWx;
      global.Page = oldPage;
      global.getCurrentPages = oldGetCurrentPages;
    }
  });

  it('报名失效后保留本人内容但隐藏来源，不能重新绑定该期', async () => {
    const created = await auth('post', '/api/v1/joy-notes', token).send({
      content: '不丢失的个人笔记',
      periodId: String(periods.active._id),
      sectionId: String(sections.active._id)
    }).expect(201);
    const id = created.body.data.id;
    await withSystemContext(null, async () => await Enrollment.updateOne(
      { tenantId: tenant._id, userId: owner._id, periodId: periods.active._id },
      { $set: { paymentStatus: 'refunded' } }
    ));
    const list = await auth('get', '/api/v1/joy-notes', token).expect(200);
    const row = list.body.data.list.find(item => item.id === id);
    expect(row).to.include({
      content: '不丢失的个人笔记', sourceUnavailable: true, periodName: '', sectionTitle: ''
    });
    await auth('put', `/api/v1/joy-notes/${id}`, token).send({
      content: '仍可编辑自己的文字',
      periodId: String(periods.active._id),
      sectionId: String(sections.active._id)
    }).expect(200);
    await auth('post', '/api/v1/joy-notes', token).send({
      content: '不能再绑定',
      periodId: String(periods.active._id)
    }).expect(403);
  });
});
