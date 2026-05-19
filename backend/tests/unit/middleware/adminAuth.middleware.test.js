const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Admin Auth Middleware', () => {
  let sandbox;
  let jwtStub;
  let loggerStub;
  let adminAuthMiddleware;
  let optionalAdminAuthMiddleware;
  let req;
  let res;
  let next;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    jwtStub = {
      verify: sandbox.stub()
    };

    loggerStub = {
      error: sandbox.stub()
    };

    const adminAuth = proxyquire('../../../src/middleware/adminAuth', {
      jsonwebtoken: jwtStub,
      '../utils/logger': loggerStub
    });

    adminAuthMiddleware = adminAuth.adminAuthMiddleware;
    optionalAdminAuthMiddleware = adminAuth.optionalAdminAuthMiddleware;

    req = {
      headers: {
        authorization: 'Bearer token'
      }
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('应该拒绝普通用户 token', () => {
    jwtStub.verify.callsArgWith(2, null, {
      userId: 'user_123',
      role: 'user',
      tenantId: 'tenant_123'
    });

    adminAuthMiddleware(req, res, next);

    expect(res.status.calledWith(403)).to.be.true;
    expect(res.json.calledWithMatch({ code: 403, message: '需要管理员权限' })).to.be.true;
    expect(next.called).to.be.false;
    expect(req.admin).to.be.undefined;
  });

  it('应该拒绝小程序 admin 角色用户 token', () => {
    jwtStub.verify.callsArgWith(2, null, {
      userId: 'user_123',
      role: 'admin',
      tenantId: 'tenant_123'
    });

    adminAuthMiddleware(req, res, next);

    expect(res.status.calledWith(403)).to.be.true;
    expect(next.called).to.be.false;
    expect(req.admin).to.be.undefined;
  });

  it('应该接受管理员 token', () => {
    const decoded = {
      id: 'admin_123',
      role: 'tenant_admin',
      tenantId: 'tenant_123'
    };
    jwtStub.verify.callsArgWith(2, null, decoded);

    adminAuthMiddleware(req, res, next);

    expect(req.admin).to.equal(decoded);
    expect(next.calledOnce).to.be.true;
    expect(res.status.called).to.be.false;
  });

  it('可选管理员认证不应该把普通用户 token 设置为 req.admin', () => {
    jwtStub.verify.callsArgWith(2, null, {
      userId: 'user_123',
      role: 'user',
      tenantId: 'tenant_123'
    });

    optionalAdminAuthMiddleware(req, res, next);

    expect(req.admin).to.be.undefined;
    expect(next.calledOnce).to.be.true;
  });
});
