const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();

describe('Section external podcast routes', () => {
  let sandbox;
  let controller;
  let multerSingle;
  let authScopes;
  let authAllows;

  function buildApp() {
    const multerStub = () => ({
      single: () => (req, res, next) => {
        multerSingle();
        next();
      }
    });
    multerStub.diskStorage = () => ({});
    const pass = (req, res, next) => next();

    const router = proxyquire('../../../src/routes/section.routes', {
      multer: multerStub,
      '../middleware/auth': { authMiddleware: pass, optionalAuthMiddleware: pass, adminMiddleware: pass },
      '../middleware/adminAuth': { adminAuthMiddleware: pass, optionalAdminAuthMiddleware: pass },
      '../middleware/tenantContext': {
        userTenantContext: pass,
        adminTenantContext: pass,
        publicTenantContext: pass,
        optionalUserOrPublicTenantContext: pass,
        optionalAdminOrPublicTenantContext: pass
      },
      '../middleware/ratelimit': { externalIntegrationRateLimit: pass },
      '../middleware/externalIntegrationAuth': {
        externalIntegrationAuth: scope => {
          authScopes.push(scope);
          return (req, res, next) => (authAllows ? next() : res.status(401).json({ code: 401 }));
        }
      },
      '../controllers/section.controller': controller,
      '../utils/tenantContext': { getCurrentTenantId: () => 'tenant_1' },
      '../utils/tenantSlug': { resolveTenantSlug: async () => 'test-tenant' }
    });
    const app = express();
    app.use(express.json());
    app.use('/sections', router);
    return app;
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    authScopes = [];
    authAllows = false;
    multerSingle = sandbox.stub();
    const ok = (req, res) => res.json({ code: 0 });
    controller = new Proxy({}, {
      get: (target, name) => {
        target[name] = target[name] || sandbox.spy(ok);
        return target[name];
      }
    });
  });

  afterEach(() => sandbox.restore());

  it('两个播客外部接口都要求 podcast:write 签名', () => {
    buildApp();
    expect(authScopes.filter(scope => scope === 'podcast:write')).to.have.length(2);
  });

  it('未签名的 sync-podcast 返回 401 且不修改课节', async () => {
    const app = buildApp();
    const res = await request(app).post('/sections/external/sync-podcast').send({ sessionId: 'x', podcastUrl: 'https://evil' });
    expect(res.status).to.equal(401);
    expect(controller.syncPodcast.called).to.equal(false);
  });

  it('未签名的 upload-podcast 返回 401 且文件不落盘', async () => {
    const app = buildApp();
    const res = await request(app).post('/sections/external/upload-podcast');
    expect(res.status).to.equal(401);
    expect(multerSingle.called).to.equal(false);
    expect(controller.uploadPodcast.called).to.equal(false);
  });

  it('签名通过后才进入上传和同步逻辑', async () => {
    authAllows = true;
    const app = buildApp();
    await request(app).post('/sections/external/upload-podcast').expect(200);
    await request(app).post('/sections/external/sync-podcast').send({ sessionId: 'x' }).expect(200);
    expect(multerSingle.calledOnce).to.equal(true);
    expect(controller.uploadPodcast.calledOnce).to.equal(true);
    expect(controller.syncPodcast.calledOnce).to.equal(true);
  });
});
