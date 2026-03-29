const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Admin Subscription Debug Controller', () => {
  let sandbox;
  let controller;
  let req;
  let res;
  let next;
  let serviceStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    req = { body: {}, params: {}, query: {}, user: {} };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    serviceStub = {
      buildSubscriptionDebugDataset: sandbox.stub(),
      getSubscriptionDebugUserDetail: sandbox.stub()
    };

    controller = proxyquire('../../../src/controllers/admin-subscription.controller', {
      'mongoose': mongoose,
      '../utils/response': {
        success: (data, message) => ({ code: 0, message, data }),
        errors: {
          badRequest: message => ({ code: 400, message }),
          notFound: message => ({ code: 404, message })
        }
      },
      '../utils/logger': {
        error: sandbox.stub()
      },
      '../services/admin-subscription-debug.service': serviceStub
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should return debug list with success wrapper', async () => {
    const payload = {
      list: [{ user: { _id: 'u1' } }],
      summary: { totalUsers: 1 },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      sceneDefinitions: []
    };
    serviceStub.buildSubscriptionDebugDataset.resolves(payload);
    req.query = { page: '1' };

    await controller.getSubscriptionGrantList(req, res, next);

    expect(serviceStub.buildSubscriptionDebugDataset.calledOnce).to.be.true;
    const response = res.json.getCall(0).args[0];
    expect(response.code).to.equal(0);
    expect(response.data.list).to.deep.equal(payload.list);
  });

  it('should reject invalid user id for detail', async () => {
    req.params = { userId: 'invalid-id' };

    await controller.getSubscriptionGrantDetail(req, res, next);

    expect(res.status.calledWith(400)).to.be.true;
    expect(serviceStub.getSubscriptionDebugUserDetail.called).to.be.false;
  });

  it('should return detail when user exists', async () => {
    req.params = { userId: new mongoose.Types.ObjectId().toString() };
    serviceStub.getSubscriptionDebugUserDetail.resolves({
      user: { _id: req.params.userId, nickname: '用户A' },
      sceneStates: [],
      summary: {}
    });

    await controller.getSubscriptionGrantDetail(req, res, next);

    expect(res.json.calledOnce).to.be.true;
    const response = res.json.getCall(0).args[0];
    expect(response.data.user.nickname).to.equal('用户A');
  });
});
