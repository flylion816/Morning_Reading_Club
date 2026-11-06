const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Administrator session rotation', () => {
  let sandbox;
  let AdminSession;
  let jwt;
  let sessionService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    AdminSession = {
      create: sandbox.stub().resolves(),
      findOneAndUpdate: sandbox.stub(),
      updateOne: sandbox.stub().resolves({ modifiedCount: 1 })
    };
    jwt = {
      generateAdminAccessToken: sandbox.stub().callsFake((_admin, sessionId) => `access-${sessionId}`),
      generateAdminRefreshToken: sandbox.stub().callsFake((_admin, sessionId, jti) => `refresh-${sessionId}-${jti}`),
      ADMIN_REFRESH_TTL_SECONDS: 604800
    };
    sessionService = proxyquire('../../../src/services/admin-session.service', {
      '../models/AdminSession': AdminSession,
      '../utils/jwt': jwt
    });
  });

  afterEach(() => sandbox.restore());

  it('creates a server-side session storing only a one-way refresh-JTI digest', async () => {
    const admin = { _id: new mongoose.Types.ObjectId(), tenantId: new mongoose.Types.ObjectId(), role: 'platform_superadmin', sessionVersion: 4 };
    const tokens = await sessionService.createAdminSession(admin);
    const record = AdminSession.create.firstCall.args[0];
    expect(record.adminId.toString()).to.equal(admin._id.toString());
    expect(record.sessionVersion).to.equal(4);
    expect(record.refreshJtiHash).to.match(/^[a-f0-9]{64}$/);
    expect(tokens.refreshToken).to.include(tokens.sessionId);
    expect(record.refreshJtiHash).not.to.equal(tokens.refreshToken);
  });

  it('rotates the refresh digest using a compare-and-swap filter', async () => {
    AdminSession.findOneAndUpdate.resolves({ sessionId: 'session-1' });
    const admin = { _id: 'admin-1', tenantId: null, role: 'superadmin', sessionVersion: 2 };
    const previousJti = 'jti-previous';
    const result = await sessionService.rotateAdminSession(admin, {
      sid: 'session-1', sub: 'admin-1', jti: previousJti, sessionVersion: 2
    });
    const [filter, update] = AdminSession.findOneAndUpdate.firstCall.args;
    expect(filter.refreshJtiHash).to.equal(sessionService.digestJti(previousJti));
    expect(filter.sessionVersion).to.equal(2);
    expect(update.$set.refreshJtiHash).not.to.equal(filter.refreshJtiHash);
    expect(result.accessToken).to.equal('access-session-1');
  });

  it('does not issue tokens after a refresh token has already been rotated', async () => {
    AdminSession.findOneAndUpdate.resolves(null);
    const result = await sessionService.rotateAdminSession(
      { _id: 'admin-1', role: 'superadmin', sessionVersion: 1 },
      { sid: 'session-1', sub: 'admin-1', jti: 'replayed-jti', sessionVersion: 1 }
    );
    expect(result).to.equal(null);
    expect(jwt.generateAdminAccessToken.called).to.equal(false);
  });

  it('sets a bounded HttpOnly SameSite cookie and can clear it with matching path options', () => {
    const res = { cookie: sandbox.stub(), clearCookie: sandbox.stub() };
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      sessionService.setRefreshCookie(res, 'test-cookie');
      sessionService.clearRefreshCookie(res);
    } finally {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;
    }
    expect(res.cookie.firstCall.args[0]).to.equal('adminRefreshToken');
    expect(res.cookie.firstCall.args[2]).to.include({ httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth/admin' });
    expect(res.clearCookie.firstCall.args[1]).to.include({ httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth/admin' });
    expect(res.clearCookie.firstCall.args[1]).not.to.have.property('maxAge');
  });
});
