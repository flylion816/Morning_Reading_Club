const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Fail-closed rate limiting', () => {
  let sandbox;
  let middlewareModule;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    middlewareModule = proxyquire('../../../src/middleware/ratelimit', {
      '../utils/redis': { isConnected: false, client: null },
      '../utils/response': { errors: { serverError: message => ({ code: 503, message }), tooManyRequests: message => ({ code: 429, message }) } },
      '../utils/logger': { error: sandbox.stub(), warn: sandbox.stub() },
      '../utils/tenantContext': { getCurrentTenantId: () => null }
    });
  });

  afterEach(() => sandbox.restore());

  it('uses an isolated in-memory bucket in tests and rejects over-limit requests', async () => {
    const rateLimit = middlewareModule.rateLimitMiddleware({
      windowMs: 60000, maxRequests: 1, keyGenerator: () => 'test-only:admin-login:unique', failClosed: true
    });
    const makeRequest = () => ({ ip: '127.0.0.1', path: '/auth/admin/login' });
    const makeResponse = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, set(name, value) { this.headers[name] = value; return this; } });
    const nextFirst = sandbox.stub();
    const firstResponse = makeResponse();
    await rateLimit(makeRequest(), firstResponse, nextFirst);
    expect(nextFirst.calledOnce).to.equal(true);

    const nextSecond = sandbox.stub();
    const secondResponse = makeResponse();
    await rateLimit(makeRequest(), secondResponse, nextSecond);
    expect(secondResponse.statusCode).to.equal(429);
    expect(nextSecond.called).to.equal(false);
  });

  it('fails closed outside tests when Redis is unavailable', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const rateLimit = middlewareModule.rateLimitMiddleware({ failClosed: true });
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      const next = sandbox.stub();
      await rateLimit({ ip: '127.0.0.1', path: '/auth/admin/login' }, res, next);
      expect(res.statusCode).to.equal(503);
      expect(next.called).to.equal(false);
    } finally {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;
    }
  });
});
