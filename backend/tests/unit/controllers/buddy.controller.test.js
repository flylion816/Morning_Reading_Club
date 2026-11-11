const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('buddy.controller', () => {
  let service;
  let createNotification;
  let controller;
  let res;
  const req = { user: { id: 'u2' }, params: { periodId: 'p1' }, wsManager: {} };

  beforeEach(() => {
    service = {
      getState: sinon.stub(),
      join: sinon.stub(),
      cancel: sinon.stub(),
      leave: sinon.stub(),
      nudge: sinon.stub()
    };
    createNotification = sinon.stub().resolves();
    res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
    controller = proxyquire('../../../src/controllers/buddy.controller', {
      '../utils/response': {
        success: data => ({ code: 0, data }),
        errors: {
          badRequest: m => ({ code: 400, message: m }),
          forbidden: m => ({ code: 403, message: m }),
          notFound: m => ({ code: 404, message: m }),
          serverError: m => ({ code: 500, message: m })
        }
      },
      '../utils/logger': { error: () => {}, warn: () => {} },
      '../services/buddy.service': service,
      './notification.controller': { createNotification }
    });
  });

  it('getBuddyState 返回服务层状态', async () => {
    service.getState.resolves({ state: 'none' });
    await controller.getBuddyState(req, res);
    expect(service.getState.calledWith('u2', 'p1')).to.equal(true);
    expect(res.json.firstCall.args[0].data).to.deep.equal({ state: 'none' });
  });

  it('nudgeBuddy 给读伴发一条 buddy_nudge 站内通知', async () => {
    service.nudge.resolves({ buddyUserId: 'u1', senderName: '小二', state: { state: 'paired' } });
    await controller.nudgeBuddy(req, res);
    const args = createNotification.firstCall.args;
    expect(args.slice(0, 4)).to.deep.equal(['u1', 'buddy_nudge', '你的读伴轻拍了你一下', '小二在等你一起读']);
    expect(res.json.firstCall.args[0].data).to.deep.equal({ state: 'paired' });
  });

  it('通知失败不影响轻拍结果', async () => {
    service.nudge.resolves({ buddyUserId: 'u1', senderName: '小二', state: { state: 'paired' } });
    createNotification.rejects(new Error('x'));
    await controller.nudgeBuddy(req, res);
    expect(res.json.firstCall.args[0].code).to.equal(0);
  });

  it('业务错误按状态码返回，不泄露内部异常', async () => {
    const err = new Error('TA 今天已经读过了');
    Object.assign(err, { isBuddyError: true, kind: 'badRequest', status: 400 });
    service.nudge.rejects(err);
    await controller.nudgeBuddy(req, res);
    expect(res.status.calledWith(400)).to.equal(true);
    expect(res.json.firstCall.args[0].message).to.equal('TA 今天已经读过了');
    expect(createNotification.called).to.equal(false);

    service.join.rejects(new Error('db down'));
    await controller.joinBuddy(req, res);
    expect(res.status.calledWith(500)).to.equal(true);
  });
});
