const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Administrator access and live-session validation', () => {
  let sandbox;
  let jwt;
  let adminAuth;
  let Admin;
  let AdminSession;
  let req;
  let res;
  let next;

  function queryReturning(value) {
    const query = {
      select: sandbox.stub(),
      lean: sandbox.stub(),
      exec: sandbox.stub().resolves(value)
    };
    query.select.returns(query);
    query.lean.returns(query);
    return query;
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    const decoded = {
      iss: 'morning-reading',
      aud: 'admin-api',
      tokenType: 'admin_access',
      sub: 'admin-1',
      sid: 'session-1',
      role: 'tenant_admin',
      tenantId: 'tenant-1',
      sessionVersion: 3
    };
    jwt = { verifyAdminAccessToken: sandbox.stub().returns(decoded), verifyAdminMaintenanceToken: sandbox.stub() };
    Admin = { findById: sandbox.stub() };
    AdminSession = { findOne: sandbox.stub() };
    const logger = { error: sandbox.stub() };
    adminAuth = proxyquire('../../../src/middleware/adminAuth', {
      '../models/Admin': Admin,
      '../models/AdminSession': AdminSession,
      '../utils/jwt': jwt,
      '../utils/logger': logger
    });
    Admin.findById.returns(queryReturning({
      _id: 'admin-1', name: '管理员', email: 'admin@example.com', role: 'tenant_admin',
      permissions: ['periods:read'], status: 'active', tenantId: 'tenant-1', sessionVersion: 3
    }));
    AdminSession.findOne.returns(queryReturning({ sessionId: 'session-1', revokedAt: null }));
    req = { headers: { authorization: 'Bearer synthetic-token' } };
    res = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
    next = sandbox.stub();
  });

  afterEach(() => sandbox.restore());

  it('accepts an access token only after matching its current active administrator and session', async () => {
    await adminAuth.adminAuthMiddleware(req, res, next);
    expect(next.calledOnce).to.equal(true);
    expect(req.admin).to.include({ id: 'admin-1', role: 'tenant_admin', tenantId: 'tenant-1' });
    expect(req.admin.permissions).to.deep.equal(['periods:read']);
    expect(AdminSession.findOne.calledOnce).to.equal(true);
  });

  it('rejects a role claim that no longer matches the current administrator record', async () => {
    jwt.verifyAdminAccessToken.returns({ ...jwt.verifyAdminAccessToken(), role: 'platform_superadmin' });
    await adminAuth.adminAuthMiddleware(req, res, next);
    expect(res.status.calledWith(401)).to.equal(true);
    expect(next.called).to.equal(false);
  });

  it('rejects missing or disabled administrators and revoked sessions', async () => {
    for (const [admin, session] of [
      [null, { sessionId: 'session-1' }],
      [{ _id: 'admin-1', status: 'inactive', role: 'tenant_admin', tenantId: 'tenant-1', sessionVersion: 3 }, { sessionId: 'session-1' }],
      [{ _id: 'admin-1', status: 'active', role: 'tenant_admin', tenantId: 'tenant-1', sessionVersion: 3 }, null]
    ]) {
      Admin.findById.returns(queryReturning(admin));
      AdminSession.findOne.returns(queryReturning(session));
      const localRes = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
      const localNext = sandbox.stub();
      await adminAuth.adminAuthMiddleware(req, localRes, localNext);
      expect(localRes.status.calledWith(401)).to.equal(true);
      expect(localNext.called).to.equal(false);
    }
  });

  it('rejects a session after the stored session version or tenant has changed', async () => {
    Admin.findById.returns(queryReturning({
      _id: 'admin-1', status: 'active', role: 'tenant_admin', tenantId: 'tenant-2', sessionVersion: 4
    }));
    await adminAuth.adminAuthMiddleware(req, res, next);
    expect(res.status.calledWith(401)).to.equal(true);
    expect(next.called).to.equal(false);
  });

  it('fails closed when current account/session state cannot be loaded', async () => {
    Admin.findById.returns({ select: () => ({ lean: () => ({ exec: async () => { throw new Error('database unavailable'); } }) }) });
    await adminAuth.adminAuthMiddleware(req, res, next);
    expect(res.status.calledWith(503)).to.equal(true);
    expect(next.called).to.equal(false);
  });

  it('does not give tenant_admin an implicit bypass of explicit permissions', () => {
    req.admin = { id: 'admin-1', role: 'tenant_admin', permissions: [] };
    const localNext = sandbox.stub();
    adminAuth.requirePermission('database:write')(req, res, localNext);
    expect(res.status.calledWith(403)).to.equal(true);
    expect(localNext.called).to.equal(false);
  });

  it('keeps platform role checks explicit', () => {
    req.admin = { id: 'admin-1', role: 'platform_superadmin', permissions: [] };
    const localNext = sandbox.stub();
    adminAuth.requirePermission('database:write')(req, res, localNext);
    expect(localNext.calledOnce).to.equal(true);
  });
});
