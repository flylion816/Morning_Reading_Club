const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('security alert middleware integration', () => {
  let sandbox;
  let securityAlerts;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    securityAlerts = { recordQuietly: sandbox.stub() };
  });

  afterEach(() => sandbox.restore());

  it('alerts when a monitored data export exceeds 1MB', () => {
    const logger = { error: sandbox.stub(), warn: sandbox.stub(), info: sandbox.stub(), debug: sandbox.stub() };
    const monitoring = proxyquire('../../../src/middleware/monitoring', {
      '../utils/redis': {
        get: sandbox.stub().resolves(null),
        incr: sandbox.stub().resolves(1),
        expire: sandbox.stub().resolves(1),
        zAdd: sandbox.stub().resolves(1),
        zCard: sandbox.stub().resolves(0)
      },
      '../utils/alerting': { trigger: sandbox.stub().resolves() },
      '../utils/logger': logger,
      '../utils/monitoring-rules': {
        shouldTrackMetrics: () => true,
        shouldCountAsError: () => false
      },
      '../services/security-alert.service': securityAlerts
    });
    const req = { path: '/backup/mongodb/list', method: 'POST', user: null };
    const res = {
      statusCode: 200,
      json(payload) { this.payload = payload; return this; },
      send(payload) { this.payload = payload; return this; }
    };
    const next = sandbox.stub();

    monitoring.monitoringMiddleware({})(req, res, next);
    res.json({ data: 'x'.repeat(1024 * 1024 + 1) });

    expect(next.calledOnce).to.equal(true);
    expect(securityAlerts.recordQuietly.calledOnce).to.equal(true);
    expect(securityAlerts.recordQuietly.firstCall.args[0]).to.equal('large_data_read');
  });

  it('alerts when an external integration exceeds its rate limit', async () => {
    const logger = { error: sandbox.stub(), warn: sandbox.stub() };
    const loaded = proxyquire('../../../src/middleware/ratelimit', {
      '../utils/redis': {
        isConnected: true,
        client: {
          eval: sandbox.stub().resolves([0, 30])
        }
      },
      '../utils/logger': logger,
      '../services/security-alert.service': securityAlerts
    });
    const req = { path: '/insights/external/create', method: 'POST', ip: '203.0.113.10' };
    const res = {
      statusCode: 200,
      set: sandbox.stub(),
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; }
    };

    const middleware = loaded.rateLimitMiddleware({
      windowMs: 60000,
      maxRequests: 30,
      failClosed: true,
      keyGenerator: () => 'ratelimit:external:tenant:key:ip'
    });
    await middleware(req, res, sandbox.stub());

    expect(res.statusCode).to.equal(429);
    expect(securityAlerts.recordQuietly.calledOnce).to.equal(true);
    expect(securityAlerts.recordQuietly.firstCall.args[0]).to.equal('external_rate_limit');
  });

  it('alerts when the tenant boundary rejects a request', () => {
    const errorHandler = proxyquire('../../../src/middleware/errorHandler', {
      '../utils/logger': { error: sandbox.stub() },
      '../services/security-alert.service': securityAlerts
    }).errorHandler;
    const req = {
      path: '/course-templates',
      method: 'POST',
      ip: '203.0.113.11',
      admin: { id: 'admin-id' },
      resolvedTenantId: 'tenant-id'
    };
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; }
    };

    errorHandler(new Error('[tenantPlugin] 查询条件包含非当前租户 tenantId，已拒绝'), req, res, sandbox.stub());

    expect(res.statusCode).to.equal(500);
    expect(res.statusCode).to.equal(500);
    expect(res.payload.code).to.equal(500);
    expect(res.payload.message).to.contain('tenantPlugin');
    expect(securityAlerts.recordQuietly.calledOnce).to.equal(true);
    expect(securityAlerts.recordQuietly.firstCall.args[0]).to.equal('cross_tenant_denial');
  });
});
