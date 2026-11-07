const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

describe('security alert service', () => {
  let sandbox;
  let redis;
  let alerting;
  let service;
  let counts;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    counts = new Map();
    redis = {
      incr: sandbox.stub().callsFake(async key => {
        const next = (counts.get(key) || 0) + 1;
        counts.set(key, next);
        return next;
      }),
      expire: sandbox.stub().resolves(1)
    };
    alerting = { trigger: sandbox.stub().resolves() };
    service = proxyquire('../../../src/services/security-alert.service', {
      '../utils/redis': redis,
      '../utils/alerting': alerting
    });
  });

  afterEach(() => sandbox.restore());

  it('triggers repeated admin login failures at the configured threshold', async () => {
    for (let index = 0; index < 5; index += 1) {
      await service.record('admin_login_failure', 'sensitive-subject', {
        endpoint: '/auth/admin/login?x=1',
        detail: 'wrong password'
      });
    }

    expect(redis.incr.callCount).to.equal(5);
    expect(redis.expire.calledOnce).to.equal(true);
    expect(alerting.trigger.calledOnce).to.equal(true);
    const alert = alerting.trigger.firstCall.args[0];
    expect(alert.type).to.equal('ADMIN_LOGIN_FAILURE');
    expect(alert.severity).to.equal('HIGH');
    expect(alert.endpoint).to.equal('/auth/admin/login');
    expect(alert.message).to.contain('count=5');
    expect(alert.message).to.not.contain('sensitive-subject');
  });

  it('triggers immediate critical payment mismatch alerts', async () => {
    const result = await service.record(
      'payment_verification_mismatch',
      'payment-id',
      { endpoint: '/payments/confirm', detail: 'callback payment mismatch' }
    );

    expect(result).to.deep.equal({ triggered: true, count: 1 });
    expect(alerting.trigger.calledOnce).to.equal(true);
    expect(alerting.trigger.firstCall.args[0].severity).to.equal('CRITICAL');
  });

  it('rejects unknown alert types without leaking subject data', async () => {
    let error;
    try {
      await service.record('unknown_type', 'subject');
    } catch (caught) {
      error = caught;
    }
    expect(error?.message).to.match(/^Unknown security alert type: unknown_type$/);
    expect(alerting.trigger.called).to.equal(false);
  });

  it('wires the required security events into production handlers', () => {
    const fs = require('fs');
    const path = require('path');
    const sourceRoot = path.join(__dirname, '../../../src');
    const wiring = {
      'controllers/admin.controller.js': ['admin_login_failure', 'admin_account_rejected'],
      'controllers/payment.controller.js': ['payment_verification_mismatch'],
      'middleware/errorHandler.js': ['cross_tenant_denial'],
      'middleware/ratelimit.js': ['external_rate_limit'],
      'middleware/monitoring.js': ['large_data_read'],
      'middleware/externalIntegrationAuth.js': [
        'revoked_external_key',
        'unknown_external_key'
      ]
    };

    for (const [file, eventTypes] of Object.entries(wiring)) {
      const source = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
      for (const eventType of eventTypes) expect(source).to.contain(`'${eventType}'`);
    }
  });
});
