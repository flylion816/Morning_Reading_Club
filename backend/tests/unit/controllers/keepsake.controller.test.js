const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Keepsake Controller', () => {
  let access;
  let svc;
  let controller;
  let res;

  beforeEach(() => {
    access = { findCommunityEnrollment: sinon.stub() };
    svc = { getPeriodKeepsake: sinon.stub() };
    controller = proxyquire('../../../src/controllers/keepsake.controller', {
      mongoose: require('mongoose'),
      '../services/community-access.service': access,
      '../services/keepsake.service': svc,
      '../utils/logger': { error: () => {} }
    });
    res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
  });

  it('非法 periodId 返回 400', async () => {
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: 'bad' } }, res);
    expect(res.status.calledWith(400)).to.equal(true);
    expect(access.findCommunityEnrollment.called).to.equal(false);
  });

  it('未报名返回 403', async () => {
    access.findCommunityEnrollment.resolves(null);
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' } }, res);
    expect(res.status.calledWith(403)).to.equal(true);
    expect(svc.getPeriodKeepsake.called).to.equal(false);
  });

  it('只用登录用户的 id 取数据', async () => {
    access.findCommunityEnrollment.resolves({});
    svc.getPeriodKeepsake.resolves({ ready: true });
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' }, query: { userId: 'other' } }, res);
    expect(svc.getPeriodKeepsake.calledWith('u1', '507f1f77bcf86cd799439011')).to.equal(true);
    expect(res.json.firstCall.args[0].data.ready).to.equal(true);
  });

  it('期次不存在返回 404，异常返回 500', async () => {
    access.findCommunityEnrollment.resolves({});
    svc.getPeriodKeepsake.resolves(null);
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' } }, res);
    expect(res.status.calledWith(404)).to.equal(true);
    svc.getPeriodKeepsake.rejects(new Error('x'));
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' } }, res);
    expect(res.status.calledWith(500)).to.equal(true);
  });
});
