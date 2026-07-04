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

  it('公开端点过滤隐藏板块', async () => {
    const config = {
      sections: [
        'recentActivities',
        'todayTask',
        'zaichang',
        'myCheckins',
        'xiaofanInsights',
        'insightRequests'
      ],
      hiddenSections: ['zaichang', 'myCheckins'],
      save: sandbox.stub().resolves()
    };
    HomeConfigStub.findOne.resolves(config);

    await controller.getPublicHomeConfig(req, res);

    const payload = res.json.getCall(0).args[0];
    expect(payload.data.sections).to.deep.equal([
      'recentActivities',
      'todayTask',
      'xiaofanInsights',
      'insightRequests'
    ]);
    expect(payload.data.items.map((item) => item.key)).to.deep.equal([
      'recentActivities',
      'todayTask',
      'xiaofanInsights',
      'insightRequests'
    ]);
  });

  it('管理端读取保留隐藏板块和隐藏状态', async () => {
    const config = {
      sections: [
        'recentActivities',
        'todayTask',
        'zaichang',
        'myCheckins',
        'xiaofanInsights',
        'insightRequests'
      ],
      hiddenSections: ['zaichang'],
      save: sandbox.stub().resolves()
    };
    HomeConfigStub.findOne.resolves(config);

    await controller.getAdminHomeConfig(req, res);

    const payload = res.json.getCall(0).args[0];
    expect(payload.data.sections).to.deep.equal(config.sections);
    expect(payload.data.hiddenSections).to.deep.equal(['zaichang']);
    expect(payload.data.items.find((item) => item.key === 'zaichang')).to.include({
      hidden: true
    });
    expect(payload.data.items.find((item) => item.key === 'todayTask')).to.include({
      hidden: false
    });
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
      hiddenSections: [],
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

  it('管理端保存板块隐藏状态', async () => {
    const config = {
      sections: [],
      hiddenSections: [],
      save: sandbox.stub().resolves()
    };
    req.body.sections = [
      { key: 'todayTask', hidden: true },
      { key: 'recentActivities', hidden: false },
      { key: 'zaichang', hidden: false },
      { key: 'myCheckins', hidden: true },
      { key: 'xiaofanInsights', hidden: false },
      { key: 'insightRequests', hidden: false }
    ];
    HomeConfigStub.findOne.resolves(config);

    await controller.updateAdminHomeConfig(req, res);

    expect(config.sections).to.deep.equal([
      'todayTask',
      'recentActivities',
      'zaichang',
      'myCheckins',
      'xiaofanInsights',
      'insightRequests'
    ]);
    expect(config.hiddenSections).to.deep.equal(['todayTask', 'myCheckins']);
    expect(config.save.called).to.equal(true);
    const payload = res.json.getCall(0).args[0];
    expect(payload.data.hiddenSections).to.deep.equal(['todayTask', 'myCheckins']);
    expect(payload.data.items.find((item) => item.key === 'todayTask')).to.include({
      hidden: true
    });
  });
});
