const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('HomeConfig Controller', () => {
  let sandbox;
  let req;
  let res;
  let HomeConfigStub;
  let controller;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = {
      body: {},
      _resolvedTenantId: 'tenant-1'
    };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    HomeConfigStub = {
      findOne: sandbox.stub(),
      create: sandbox.stub()
    };

    controller = proxyquire('../../../src/controllers/homeConfig.controller', {
      '../models/HomeConfig': HomeConfigStub,
      '../utils/tenantContext': {
        getCurrentTenantId: () => 'tenant-1'
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('公开端点缺少配置时创建默认顺序', async () => {
    const saved = {
      sections: [
        'recentActivities',
        'todayTask',
        'zaichang',
        'myCheckins',
        'xiaofanInsights',
        'insightRequests'
      ]
    };
    HomeConfigStub.findOne.resolves(null);
    HomeConfigStub.create.resolves(saved);

    await controller.getPublicHomeConfig(req, res);

    expect(HomeConfigStub.create.calledOnce).to.equal(true);
    const payload = res.json.getCall(0).args[0];
    expect(payload.code).to.equal(0);
    expect(payload.data.sections).to.deep.equal(saved.sections);
    expect(payload.data.items[0].label).to.equal('近期活动');
  });

  it('管理端拒绝未选择租户的读取', async () => {
    req._resolvedTenantId = null;

    await controller.getAdminHomeConfig(req, res);

    expect(res.status.calledWith(400)).to.equal(true);
    expect(HomeConfigStub.findOne.called).to.equal(false);
  });

  it('管理端拒绝缺失板块的保存', async () => {
    req.body.sections = ['todayTask', 'zaichang'];

    await controller.updateAdminHomeConfig(req, res);

    expect(res.status.calledWith(400)).to.equal(true);
    expect(HomeConfigStub.findOne.called).to.equal(false);
  });

  it('管理端保存有效顺序', async () => {
    const config = {
      sections: [],
      save: sandbox.stub().resolves()
    };
    const sections = [
      'todayTask',
      'recentActivities',
      'zaichang',
      'myCheckins',
      'xiaofanInsights',
      'insightRequests'
    ];
    req.body.sections = sections;
    HomeConfigStub.findOne.resolves(config);

    await controller.updateAdminHomeConfig(req, res);

    expect(config.sections).to.deep.equal(sections);
    expect(config.save.called).to.equal(true);
    const payload = res.json.getCall(0).args[0];
    expect(payload.message).to.equal('保存成功');
    expect(payload.data.sections).to.deep.equal(sections);
  });
});
