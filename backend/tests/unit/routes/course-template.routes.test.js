const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();

describe('course template routes', () => {
  let model;
  let tenant;
  let authenticated;
  let adminRole;
  let app;
  const valid = {
    name: '空间管理',
    modules: [{ id: 'intro', name: '观察空间', type: 'text' }]
  };
  const id = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    tenant = '507f1f77bcf86cd799439012';
    adminRole = 'tenant_admin';
    authenticated = true;
    model = {
      find: sinon.stub().returns({ sort: () => ({ lean: async () => [] }) }),
      create: sinon.stub().callsFake(async data => ({ _id: id, ...data })),
      findOneAndUpdate: sinon.stub().returns({ lean: async () => null }),
      exists: sinon.stub().resolves(null)
    };
    const router = proxyquire('../../../src/routes/course-template.routes', {
      '../models/CourseTemplate': model,
      '../services/sync.service': { publishSyncEvent: sinon.stub() },
      '../middleware/adminAuth': {
        adminAuthMiddleware: (req, res, next) => {
          if (!authenticated) return res.sendStatus(401);
          req.admin = { role: adminRole };
          return next();
        }
      },
      '../middleware/tenantContext': {
        adminTenantContext: (req, res, next) => { req.resolvedTenantId = tenant; next(); }
      }
    });
    app = express();
    app.use(express.json());
    app.use('/templates', router);
  });

  it('requires authentication and an active tenant', async () => {
    authenticated = false;
    await request(app).get('/templates').expect(401);
    authenticated = true;
    tenant = null;
    await request(app).get('/templates').expect(403);
    expect(model.find.called).to.equal(false);
  });

  it('lets a platform administrator browse the built-in template before selecting a tenant', async () => {
    adminRole = 'platform_superadmin';
    tenant = null;
    const response = await request(app).get('/templates').expect(200);
    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0].id).to.equal('seven-habits');
    expect(model.find.called).to.equal(false);
  });

  it('still blocks writes for a platform administrator without a selected tenant', async () => {
    adminRole = 'platform_superadmin';
    tenant = null;
    await request(app).post('/templates').send(valid).expect(403);
    expect(model.create.called).to.equal(false);
  });

  it('lists a built-in template scoped to the active tenant', async () => {
    const response = await request(app).get('/templates').expect(200);
    expect(response.body.data[0].id).to.equal('seven-habits');
    expect(model.find.firstCall.args[0]).to.deep.equal({ tenantId: tenant });
  });

  it('validates and creates only permitted fields in the active tenant', async () => {
    await request(app).post('/templates').send({ ...valid, extensions: { duration: false, closingVideo: true, podcast: false }, tenantId: 'other', revision: 999 }).expect(201);
    const saved = model.create.firstCall.args[0];
    expect(saved.tenantId).to.equal(tenant);
    expect(saved.extensions).to.deep.equal({ duration: false, closingVideo: true, podcast: false });
    expect(saved).not.to.have.property('revision');
    await request(app).post('/templates').send({ ...valid, modules: [] }).expect(400);
    expect(model.create.calledOnce).to.equal(true);
  });

  it('enforces optimistic concurrency and tenant-scoped lookups', async () => {
    model.exists.resolves({ _id: id });
    await request(app).put(`/templates/${id}`).send({ ...valid, revision: 1 }).expect(409);
    expect(model.findOneAndUpdate.firstCall.args[0]).to.deep.equal({ _id: id, tenantId: tenant, revision: 1 });
    model.exists.resolves(null);
    await request(app).put(`/templates/${id}`).send({ ...valid, revision: 1 }).expect(404);
    await request(app).put('/templates/seven-habits').send({ ...valid, revision: 1 }).expect(404);
  });

  it('saves the requested state with an atomic version increment', async () => {
    model.findOneAndUpdate.returns({ lean: async () => ({ _id: id, revision: 2, active: false }) });
    const response = await request(app).put(`/templates/${id}`)
      .send({ ...valid, revision: 1, active: false }).expect(200);
    const [filter, update, options] = model.findOneAndUpdate.firstCall.args;
    expect(filter).to.deep.equal({ _id: id, tenantId: tenant, revision: 1 });
    expect(update.$set.active).to.equal(false);
    expect(update.$inc.revision).to.equal(1);
    expect(options.runValidators).to.equal(true);
    expect(response.body.data.revision).to.equal(2);
  });

  it('rejects malformed versions and non-boolean status without writing', async () => {
    await request(app).put(`/templates/${id}`).send({ ...valid, revision: '1' }).expect(400);
    await request(app).put(`/templates/${id}`).send({ ...valid, revision: 1, active: 'false' }).expect(400);
    expect(model.findOneAndUpdate.called).to.equal(false);
  });
});
