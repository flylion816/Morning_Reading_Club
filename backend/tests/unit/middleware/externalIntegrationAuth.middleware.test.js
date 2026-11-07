const { expect } = require('chai');
const crypto = require('crypto');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('External integration HMAC authentication', () => {
  const tenantId = '64f1b2c3d4e5f67890123456';
  const clientSecret = 'external-test-secret-not-for-production';
  let sandbox;
  let now;
  let setNxEx;
  let middleware;
  let encryptedSecret;
  let securityAlerts;
  let keyRecord;
  let query;
  let originalEncryptionKey;

  function sign(req, timestamp, nonce) {
    const message = [req.method.toUpperCase(), req.originalUrl, timestamp, nonce, JSON.stringify(req.body)].join('\n');
    return crypto.createHmac('sha256', clientSecret).update(message).digest('hex');
  }

  function makeRequest(overrides = {}) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const req = {
      method: 'POST',
      originalUrl: '/api/v1/insights/external/create?source=automation',
      body: { periodId: 'p1', targetUserId: 'u1', content: 'signed content' },
      headers: {},
      get(name) { return this.headers[name.toLowerCase()]; }
    };
    req.headers['x-integration-key-id'] = 'n8n-prod';
    req.headers['x-integration-timestamp'] = timestamp;
    req.headers['x-integration-nonce'] = 'nonce_0123456789abcdef';
    Object.assign(req, overrides);
    if (!overrides.skipSignature) {
      req.headers['x-integration-signature'] = sign(req, req.headers['x-integration-timestamp'], req.headers['x-integration-nonce']);
    }
    return req;
  }

  function makeResponse() {
    return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    originalEncryptionKey = process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY;
    process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const credentials = require('../../../src/services/external-integration-credentials.service');
    encryptedSecret = credentials.encryptIntegrationSecret(clientSecret);
    keyRecord = { keyId: 'n8n-prod', encryptedSecret, status: 'active', scopes: ['insight:write'] };
    query = { select: sandbox.stub(), lean: sandbox.stub(), exec: sandbox.stub().resolves(keyRecord) };
    query.select.returns(query);
    query.lean.returns(query);
    const keyModel = { findOne: sandbox.stub().returns(query) };
    const redis = { setNxEx: sandbox.stub().resolves(true) };
    securityAlerts = { recordQuietly: sandbox.stub() };
    setNxEx = redis.setNxEx;
    const tenantContext = {
      getCurrentTenantId: () => tenantId,
      withSystemContext: (_tenant, fn) => fn()
    };
    const loaded = proxyquire('../../../src/middleware/externalIntegrationAuth', {
      '../models/ExternalIntegrationKey': keyModel,
      '../utils/tenantContext': tenantContext,
      '../services/external-integration-credentials.service': credentials,
      '../utils/redis': redis,
      '../services/security-alert.service': securityAlerts
    });
    middleware = loaded.externalIntegrationAuth('insight:write');
    now = Date.now;
  });

  afterEach(() => {
    if (now) Date.now = now;
    if (originalEncryptionKey === undefined) delete process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY;
    else process.env.EXTERNAL_API_KEY_ENCRYPTION_KEY = originalEncryptionKey;
    sandbox.restore();
  });

  it('accepts a valid tenant-bound signed request once', async () => {
    const req = makeRequest();
    const res = makeResponse();
    const next = sandbox.stub();
    await middleware(req, res, next);
    expect(next.calledOnce).to.equal(true);
    expect(req.externalIntegration).to.deep.equal({ keyId: 'n8n-prod', tenantId, scope: 'insight:write' });
    expect(setNxEx.calledOnce).to.equal(true);
  });

  it('rejects an invalid signature before consuming a replay nonce', async () => {
    const req = makeRequest();
    req.headers['x-integration-signature'] = '0'.repeat(64);
    const res = makeResponse();
    const next = sandbox.stub();
    await middleware(req, res, next);
    expect(res.statusCode).to.equal(401);
    expect(setNxEx.called).to.equal(false);
    expect(next.called).to.equal(false);
  });

  it('alerts and rejects a revoked integration key', async () => {
    keyRecord.status = 'revoked';
    const req = makeRequest();
    const res = makeResponse();
    const next = sandbox.stub();
    await middleware(req, res, next);

    expect(res.statusCode).to.equal(401);
    expect(next.called).to.equal(false);
    expect(securityAlerts.recordQuietly.calledOnce).to.equal(true);
    expect(securityAlerts.recordQuietly.firstCall.args[0]).to.equal('revoked_external_key');
  });

  it('alerts and rejects an unknown integration key', async () => {
    query.exec.resolves(null);
    const req = makeRequest();
    const res = makeResponse();
    const next = sandbox.stub();
    await middleware(req, res, next);

    expect(res.statusCode).to.equal(401);
    expect(securityAlerts.recordQuietly.calledOnce).to.equal(true);
    expect(securityAlerts.recordQuietly.firstCall.args[0]).to.equal('unknown_external_key');
  });

  it('rejects a stale timestamp', async () => {
    const req = makeRequest({ skipSignature: true });
    req.headers['x-integration-timestamp'] = String(Math.floor(Date.now() / 1000) - 301);
    const res = makeResponse();
    const next = sandbox.stub();
    await middleware(req, res, next);
    expect(res.statusCode).to.equal(401);
    expect(setNxEx.called).to.equal(false);
  });

  it('rejects a replayed nonce', async () => {
    setNxEx.resolves(false);
    const req = makeRequest();
    const res = makeResponse();
    const next = sandbox.stub();
    await middleware(req, res, next);
    expect(res.statusCode).to.equal(401);
    expect(next.called).to.equal(false);
  });

  it('fails closed when replay protection is unavailable', async () => {
    setNxEx.rejects(new Error('Redis unavailable'));
    const req = makeRequest();
    const res = makeResponse();
    const next = sandbox.stub();
    await middleware(req, res, next);
    expect(res.statusCode).to.equal(503);
    expect(next.called).to.equal(false);
  });
});
