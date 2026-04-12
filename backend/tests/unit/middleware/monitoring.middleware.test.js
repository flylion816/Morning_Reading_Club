const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Monitoring Middleware', () => {
  let sandbox;
  let redisManagerStub;
  let alertingStub;
  let loggerStub;
  let monitoringModule;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    redisManagerStub = {
      incr: sandbox.stub().resolves(1),
      expire: sandbox.stub().resolves(1),
      zAdd: sandbox.stub().resolves(1),
      get: sandbox.stub().resolves('0'),
      zCard: sandbox.stub().resolves(0),
    };

    alertingStub = {
      trigger: sandbox.stub().resolves(),
    };

    loggerStub = {
      error: sandbox.stub(),
      warn: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub(),
    };

    monitoringModule = proxyquire('../../../src/middleware/monitoring', {
      '../utils/redis': redisManagerStub,
      '../utils/alerting': alertingStub,
      '../utils/logger': loggerStub,
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('应该跳过扫描路径的指标记录', async () => {
    await monitoringModule.recordMetrics({
      endpoint: '/api/sonicos/tfa',
      method: 'GET',
      statusCode: 404,
      duration: 12,
    });

    expect(redisManagerStub.incr.called).to.equal(false);
    expect(redisManagerStub.expire.called).to.equal(false);
    expect(redisManagerStub.zAdd.called).to.equal(false);
  });

  it('应该记录真实业务 API 的请求计数', async () => {
    await monitoringModule.recordMetrics({
      endpoint: '/api/v1/periods',
      method: 'GET',
      statusCode: 200,
      duration: 25,
    });

    const incrKeys = redisManagerStub.incr.getCalls().map(call => call.args[0]);
    expect(incrKeys.some(key => key.startsWith('metrics:count:'))).to.equal(true);
    expect(incrKeys.some(key => key.startsWith('metrics:hour_count:'))).to.equal(true);
    expect(redisManagerStub.zAdd.calledOnce).to.equal(true);
  });

  it('应该只为真实业务 API 的错误增加错误计数', async () => {
    await monitoringModule.recordMetrics({
      endpoint: '/api/v1/payments',
      method: 'POST',
      statusCode: 404,
      duration: 18,
    });

    const incrKeys = redisManagerStub.incr.getCalls().map(call => call.args[0]);
    expect(incrKeys.some(key => key.startsWith('metrics:errors:'))).to.equal(true);
    expect(incrKeys.some(key => key.startsWith('metrics:hour_errors:'))).to.equal(true);
  });

  it('应该忽略401认证错误的错误计数', async () => {
    await monitoringModule.recordMetrics({
      endpoint: '/api/v1/users/me',
      method: 'GET',
      statusCode: 401,
      duration: 15,
    });

    const incrKeys = redisManagerStub.incr.getCalls().map(call => call.args[0]);
    expect(incrKeys.some(key => key.startsWith('metrics:count:'))).to.equal(true);
    expect(incrKeys.some(key => key.startsWith('metrics:errors:'))).to.equal(false);
    expect(incrKeys.some(key => key.startsWith('metrics:hour_errors:'))).to.equal(false);
  });
});
