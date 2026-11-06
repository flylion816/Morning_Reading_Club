const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Tenant = require('../../src/models/Tenant');
const Admin = require('../../src/models/Admin');
const Period = require('../../src/models/Period');
const Section = require('../../src/models/Section');
const CourseTemplate = require('../../src/models/CourseTemplate');
const { withSystemContext } = require('../../src/utils/tenantContext');
const { createAdminSession } = require('../../src/services/admin-session.service');

describe('Course templates: real MongoDB and HTTP integration', () => {
  let tenant;
  let token;
  const definition = () => ({ name: '空间管理', modules: [
    { id: 'observe', name: '观察空间', type: 'text' },
    { id: 'lesson', name: '学习内容', type: 'body' },
    { id: 'photo', name: '空间照片', type: 'image' }
  ] });
  const periodBody = (courseTemplateId) => ({ name: '空间管理第一期', title: '空间管理', startDate: '2026-11-01', endDate: '2026-11-23', totalDays: 23, courseTemplateId });
  const api = (method, url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
  async function createTemplate() { const response = await api('post', '/api/v1/course-templates').send(definition()).expect(201); return response.body.data; }
  async function createPeriod(templateId) { const response = await api('post', '/api/v1/periods').send(periodBody(templateId)).expect(201); return response.body.data; }

  before(() => {
    // The runner owns a fresh memory server. Refuse to run against an external DB.
    expect(process.env.NODE_ENV).to.equal('test');
    expect(mongoose.connection.host).to.equal('127.0.0.1');
  });
  beforeEach(async () => {
    const suffix = new mongoose.Types.ObjectId().toHexString();
    tenant = await withSystemContext(null, () => Tenant.create({ name: '模板集成测试', slug: `ct-${suffix}`, wxAppIds: [`wx${suffix.slice(-16)}`] }));
    const admin = await withSystemContext(tenant._id, () => Admin.create({ name: '模板测试管理员', email: `ct-${suffix}@example.test`, password: 'Synthetic-Template-Password-1', role: 'tenant_admin', tenantId: tenant._id }));
    token = (await createAdminSession(admin)).accessToken;
  });

  it('lists the default and tenant templates, validates definitions and rejects unauthenticated requests', async () => {
    await request(app).get('/api/v1/course-templates').expect(401);
    await api('post', '/api/v1/course-templates').send({ ...definition(), modules: [] }).expect(400);
    const template = await createTemplate();
    const list = await api('get', '/api/v1/course-templates').expect(200);
    expect(list.body.data.map(item => item.name)).to.deep.equal(['七个习惯晨读营', '空间管理']);
    expect(template.revision).to.equal(1);
    await api('put', `/api/v1/course-templates/${template._id}`).send({ ...definition(), revision: 1, active: false }).expect(200);
    await api('put', `/api/v1/course-templates/${template._id}`).send({ ...definition(), revision: 1 }).expect(409);
  });

  it('keeps period snapshots stable after edits and deactivation and refuses new bindings to inactive templates', async () => {
    const template = await createTemplate();
    const period = await createPeriod(template._id);
    const changed = definition(); changed.modules[0].name = '新名称';
    await api('put', `/api/v1/course-templates/${template._id}`).send({ ...changed, revision: 1, active: false }).expect(200);
    const detail = await api('get', `/api/v1/periods/${period._id}`).expect(200);
    expect(detail.body.data.courseTemplateSnapshot.modules[0].name).to.equal('观察空间');
    await api('post', '/api/v1/periods').send(periodBody(template._id)).expect(400);
  });

  it('creates, reads and edits custom lessons, keeps the body searchable and tells old clients to update', async () => {
    const template = await createTemplate();
    const period = await createPeriod(template._id);
    const created = await api('post', `/api/v1/periods/${period._id}/sections`).send({ day: 0, title: '整理空间', courseModuleValues: { observe: '观察桌面', lesson: '# 学习整理', photo: '/uploads/tenants/sample/pic.jpg' } }).expect(201);
    const section = created.body.data;
    expect(section.content).to.equal('# 学习整理');
    expect(section.courseTemplateSnapshot.modules[0].name).to.equal('观察空间');
    await request(app).get(`/api/v1/sections/${section._id}`).set('X-Wx-AppId', tenant.wxAppIds[0]).expect(403);
    const readable = await request(app).get(`/api/v1/sections/${section._id}`).set('X-Wx-AppId', tenant.wxAppIds[0]).set('X-Course-Template-Version', '1').expect(200);
    expect(readable.body.data.courseModuleValues.observe).to.equal('观察桌面');
    await api('put', `/api/v1/sections/${section._id}`).send({ courseModuleValues: { unknown: '非法' } }).expect(400);
    await api('put', `/api/v1/sections/${section._id}`).send({ courseModuleValues: { lesson: '更新正文' }, courseTemplateSnapshot: { modules: [] } }).expect(200);
    const reloaded = await api('get', `/api/v1/sections/${section._id}`).expect(200);
    expect(reloaded.body.data.content).to.equal('更新正文');
    expect(reloaded.body.data.courseTemplateSnapshot.modules).to.have.length(3);
    await api('put', `/api/v1/periods/${period._id}`).send({ courseTemplateId: 'seven-habits' }).expect(409);
  });

  it('changes an empty period, locks structure on first lesson and copies snapshot and values', async () => {
    const template = await createTemplate();
    const period = await createPeriod('seven-habits');
    await api('put', `/api/v1/periods/${period._id}`).send({ courseTemplateId: template._id }).expect(200);
    await api('post', `/api/v1/periods/${period._id}/sections`).send({ day: 0, title: '第一课', courseModuleValues: { lesson: '课程正文' } }).expect(201);
    const copy = await api('post', `/api/v1/periods/${period._id}/copy`).send({ ...periodBody(), name: '复制期次' }).expect(201);
    expect(copy.body.data.copiedSectionCount).to.equal(1);
    const copied = await withSystemContext(tenant._id, async () => await Section.findOne({ periodId: copy.body.data.period._id }).lean());
    expect(copied.courseModuleValues.lesson).to.equal('课程正文');
    expect(copy.body.data.period.courseTemplateSnapshot.templateId).to.equal(template._id);
  });

  it('rejects cross-tenant binding and editing without leaking template contents', async () => {
    const otherTenantId = new mongoose.Types.ObjectId();
    const foreign = await withSystemContext(otherTenantId, () => CourseTemplate.create({ ...definition(), tenantId: otherTenantId }));
    await api('post', '/api/v1/periods').send(periodBody(String(foreign._id))).expect(400);
    await api('put', `/api/v1/course-templates/${foreign._id}`).send({ ...definition(), revision: 1 }).expect(404);
    const list = await api('get', '/api/v1/course-templates').expect(200);
    expect(list.body.data).to.have.length(1);
  });

  it('preserves historical lessons without a template or migration', async () => {
    const period = await withSystemContext(tenant._id, () => Period.create({ ...periodBody(), tenantId: tenant._id }));
    const response = await api('post', `/api/v1/periods/${period._id}/sections`).send({ day: 0, title: '历史课程', meditation: '静思原文', content: '历史正文' }).expect(201);
    const detail = await request(app).get(`/api/v1/sections/${response.body.data._id}`).set('X-Wx-AppId', tenant.wxAppIds[0]).expect(200);
    expect(detail.body.data.meditation).to.equal('静思原文');
    expect(detail.body.data.content).to.equal('历史正文');
    expect(detail.body.data.courseTemplateSnapshot).to.equal(undefined);
  });

  it('restores template, snapshot and values from backup JSON into a fresh temporary database', async () => {
    const template = await createTemplate();
    const period = await createPeriod(template._id);
    const created = await api('post', `/api/v1/periods/${period._id}/sections`).send({ day: 0, title: '备份验证', courseModuleValues: { lesson: '# 完整正文', observe: '观察内容' } }).expect(201);
    const { transformDocumentForMySQL } = require('../../src/services/sync.service');
    const rows = [
      ['course_templates', template], ['periods', period], ['sections', created.body.data]
    ].map(([collection, doc]) => JSON.parse(transformDocumentForMySQL(collection, doc).raw_json));
    const restored = mongoose.connection.useDb(`template_restore_${new mongoose.Types.ObjectId().toHexString()}`);
    const models = [restored.model('CourseTemplate', CourseTemplate.schema), restored.model('Period', Period.schema), restored.model('Section', Section.schema)];
    await withSystemContext(tenant._id, async () => {
      for (let index = 0; index < rows.length; index += 1) await models[index].create(rows[index]);
      const restoredPeriod = await models[1].findById(period._id).lean();
      const restoredSection = await models[2].findById(created.body.data._id).lean();
      expect(restoredPeriod.courseTemplateSnapshot).to.deep.equal(period.courseTemplateSnapshot);
      expect(restoredSection.courseModuleValues).to.deep.equal({ lesson: '# 完整正文', observe: '观察内容' });
      expect(restoredSection.content).to.equal('# 完整正文');
    });
  });

  it('rejects malformed values before locking or writing and supports courses without a body', async () => {
    const definitionWithoutBody = { name: '实践课', modules: [{ id: 'task', name: '实践任务', type: 'shortText' }] };
    const response = await api('post', '/api/v1/course-templates').send(definitionWithoutBody).expect(201);
    const period = await createPeriod(response.body.data._id);
    await api('post', `/api/v1/periods/${period._id}/sections`).send({ day: 0, title: '错误值', courseModuleValues: { task: '字'.repeat(201) } }).expect(400);
    const beforeCreate = await api('get', `/api/v1/periods/${period._id}`).expect(200);
    expect(beforeCreate.body.data.courseTemplateLocked).not.to.equal(true);
    const created = await api('post', `/api/v1/periods/${period._id}/sections`).send({ day: 0, title: '实践', courseModuleValues: { task: '整理书桌' } }).expect(201);
    expect(created.body.data.content).to.equal('');
    const User = require('../../src/models/User');
    const { generateAccessToken } = require('../../src/utils/jwt');
    const user = await withSystemContext(tenant._id, () => User.create({ tenantId: tenant._id, openid: `ct-${new mongoose.Types.ObjectId()}`, nickname: '模板测试学员' }));
    const userToken = generateAccessToken({ userId: String(user._id), tenantId: String(tenant._id), role: 'user' });
    await request(app).post(`/api/v1/sections/${created.body.data._id}/reading-completion`).set('Authorization', `Bearer ${userToken}`).set('X-Course-Template-Version', '1').send({ durationMs: 2000 }).expect(400);
  });

  it('preserves the period/section template invariant during a concurrent switch and lesson creation', async () => {
    const template = await createTemplate();
    const period = await createPeriod('seven-habits');
    const [change, create] = await Promise.all([
      api('put', `/api/v1/periods/${period._id}`).send({ courseTemplateId: template._id }),
      api('post', `/api/v1/periods/${period._id}/sections`).send({ day: 0, title: '并发创建' })
    ]);
    expect([200, 409]).to.include(change.status);
    expect([201, 409]).to.include(create.status);
    const finalPeriod = (await api('get', `/api/v1/periods/${period._id}`).expect(200)).body.data;
    if (create.status === 201) {
      const sectionSnapshotId = create.body.data.courseTemplateSnapshot?.templateId || 'seven-habits';
      expect(sectionSnapshotId).to.equal(finalPeriod.courseTemplateSnapshot.templateId);
      expect(finalPeriod.courseTemplateLocked).to.equal(true);
    }
  });
});
