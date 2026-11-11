const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Keepsake Controller', () => {
  let access;
  let svc;
  let controller;
  let res;

  beforeEach(() => {
    access = { ensurePeriodCommunityAccess: sinon.stub() };
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
    expect(access.ensurePeriodCommunityAccess.called).to.equal(false);
  });

  it('未报名返回 403', async () => {
    access.ensurePeriodCommunityAccess.callsFake(async response => {
      response.status(403).json({ code: 403 });
      return false;
    });
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' } }, res);
    expect(res.status.calledWith(403)).to.equal(true);
    expect(svc.getPeriodKeepsake.called).to.equal(false);
  });

  it('待支付报名也返回 403', async () => {
    access.ensurePeriodCommunityAccess.callsFake(async response => {
      response.status(403).json({ code: 403, message: '当前期次未支付' });
      return false;
    });
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' } }, res);
    expect(res.status.calledWith(403)).to.equal(true);
    expect(svc.getPeriodKeepsake.called).to.equal(false);
  });

  it('只用登录用户的 id 取数据', async () => {
    access.ensurePeriodCommunityAccess.resolves(true);
    svc.getPeriodKeepsake.resolves({ ready: true });
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' }, query: { userId: 'other' } }, res);
    expect(svc.getPeriodKeepsake.calledWith('u1', '507f1f77bcf86cd799439011')).to.equal(true);
    expect(res.json.firstCall.args[0].data.ready).to.equal(true);
  });

  it('期次不存在返回 404，异常返回 500', async () => {
    access.ensurePeriodCommunityAccess.resolves(true);
    svc.getPeriodKeepsake.resolves(null);
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' } }, res);
    expect(res.status.calledWith(404)).to.equal(true);
    svc.getPeriodKeepsake.rejects(new Error('x'));
    await controller.getPeriodKeepsake({ user: { userId: 'u1' }, params: { periodId: '507f1f77bcf86cd799439011' } }, res);
    expect(res.status.calledWith(500)).to.equal(true);
  });
});
