const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Tenant Context Middleware', () => {
  let sandbox;
  let req;
  let res;
  let next;
  let TenantStub;
  let runWithTenantStub;
  let publicTenantContext;
  let fanrenTenant;
  let starryTenant;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    fanrenTenant = {
      _id: new mongoose.Types.ObjectId(),
      slug: 'fanren',
      wxAppIds: ['wx2b9a3c1d5e4195f8'],
      wechatLogin: { appId: 'wx2b9a3c1d5e4195f8' }
    };
    starryTenant = {
      _id: new mongoose.Types.ObjectId(),
      slug: 'starry',
      wxAppIds: ['wx9cd59e2c89880289'],
      wechatLogin: { appId: 'wx9cd59e2c89880289' }
    };

    req = {
      path: '/external/create',
      method: 'POST',
      _headers: {},
      header(name) {
        return this._headers[String(name).toLowerCase()];
      }
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    TenantStub = {
      findByWxAppId: sandbox.stub(),
      findOne: sandbox.stub()
    };
    TenantStub.findByWxAppId.withArgs('wx2b9a3c1d5e4195f8').resolves(fanrenTenant);
    TenantStub.findByWxAppId.withArgs('wx9cd59e2c89880289').resolves(starryTenant);
    TenantStub.findOne.callsFake((query) => {
      const tenantsBySlug = {
        fanren: fanrenTenant,
        starry: starryTenant
      };
      return {
        lean: sandbox.stub().resolves(tenantsBySlug[query.slug] || null)
      };
    });

    runWithTenantStub = sandbox.stub().callsFake((ctx, fn) => fn());

    ({ publicTenantContext } = proxyquire('../../../src/middleware/tenantContext', {
      '../models/Tenant': TenantStub,
      '../utils/tenantContext': {
        runWithTenant: runWithTenantStub,
        withSystemContext: sandbox.stub()
      },
      '../utils/logger': {
        debug: sandbox.stub(),
        warn: sandbox.stub()
      }
    }));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should resolve public tenant context by X-Tenant-Slug', async () => {
    req._headers['x-tenant-slug'] = 'fanren';

    await publicTenantContext(req, res, next);

    expect(next.calledOnce).to.equal(true);
    expect(req._resolvedTenantId.toString()).to.equal(fanrenTenant._id.toString());
    expect(runWithTenantStub.getCall(0).args[0].tenantId.toString()).to.equal(fanrenTenant._id.toString());
    expect(TenantStub.findByWxAppId.called).to.equal(false);
  });

  it('should keep resolving public tenant context by legacy X-Wx-AppId', async () => {
    req._headers['x-wx-appid'] = 'wx2b9a3c1d5e4195f8';

    await publicTenantContext(req, res, next);

    expect(next.calledOnce).to.equal(true);
    expect(req._resolvedTenantId.toString()).to.equal(fanrenTenant._id.toString());
    expect(TenantStub.findByWxAppId.calledWith('wx2b9a3c1d5e4195f8')).to.equal(true);
  });

  it('should reject conflicting X-Tenant-Slug and X-Wx-AppId', async () => {
    req._headers['x-tenant-slug'] = 'fanren';
    req._headers['x-wx-appid'] = 'wx9cd59e2c89880289';

    await publicTenantContext(req, res, next);

    expect(res.status.calledWith(400)).to.equal(true);
    expect(res.json.getCall(0).args[0].message).to.equal('X-Tenant-Slug 与 X-Wx-AppId 指向不同租户');
    expect(next.called).to.equal(false);
    expect(runWithTenantStub.called).to.equal(false);
  });
});
