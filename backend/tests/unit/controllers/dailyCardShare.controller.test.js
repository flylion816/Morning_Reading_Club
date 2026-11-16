const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const USER_ID = '507f1f77bcf86cd799439011';
const TENANT_ID = '507f1f77bcf86cd799439012';

describe('DailyCardShare Controller', () => {
  let Share;
  let requestWxacode;
  let controller;
  let res;
  let next;

  beforeEach(() => {
    Share = { create: sinon.stub().resolves({}), findOne: sinon.stub() };
    requestWxacode = sinon.stub().resolves('cG5n');
    controller = proxyquire('../../../src/controllers/dailyCardShare.controller', {
      '../models/DailyCardShare': Share,
      '../utils/tenantContext': { getCurrentTenantId: () => TENANT_ID },
      '../services/wxacode.service': { requestWxacode, normalizeEnvVersion: value => value || 'release' },
      '../utils/response': {
        success: data => ({ code: 200, data }),
        errors: { badRequest: message => ({ message }), notFound: message => ({ message }), serviceUnavailable: message => ({ message }) }
      },
      '../utils/logger': { warn: sinon.stub() }
    });
    res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    next = sinon.stub();
  });

  it('保存完整日签快照并生成指向落地页的短码，分享人来自登录态', async () => {
    const quote = '晨读🌅'.repeat(40);
    await controller.createDailyCardShare({
      user: { userId: USER_ID },
      body: { quote, note: '我的话', source: '第三天', periodName: '连接之力', day: 3, dateStr: '2026-11-17', variant: 'paper', envVersion: 'trial', inviterId: '伪造' }
    }, res, next);

    expect(res.statusCode).to.equal(200);
    const saved = Share.create.firstCall.args[0];
    expect(saved).to.include({ tenantId: TENANT_ID, userId: USER_ID, quote, note: '我的话', source: '第三天', periodName: '连接之力', day: 3, variant: 'paper' });
    expect(saved.code).to.match(/^[a-z0-9]{8}$/);
    expect(requestWxacode.firstCall.args[0]).to.include({ scene: `c=${saved.code}`, page: 'pages/landing/landing', envVersion: 'trial' });
    expect(res.body.data.code).to.equal(saved.code);
  });

  it('未登录也可生成日签，不能伪造分享人', async () => {
    await controller.createDailyCardShare({ body: { quote: '留住今天', inviterId: USER_ID } }, res, next);
    expect(Share.create.firstCall.args[0].userId).to.equal(null);
    expect(res.statusCode).to.equal(200);
  });

  it('拒绝超长或非法字段，不请求微信也不写入快照', async () => {
    for (const body of [{ quote: '字'.repeat(121) }, { quote: {} }, { variant: 'other' }, { day: -1 }, { dateStr: '2026/11/17' }]) {
      await controller.createDailyCardShare({ body }, res, next);
      expect(res.statusCode).to.equal(400);
    }
    expect(Share.create.called).to.equal(false);
    expect(requestWxacode.called).to.equal(false);
  });

  it('二维码生成失败时不保存快照，也不返回误导性的通用码', async () => {
    requestWxacode.rejects(new Error('offline'));
    await controller.createDailyCardShare({ body: { quote: '留住今天' } }, res, next);
    expect(res.statusCode).to.equal(503);
    expect(Share.create.called).to.equal(false);
  });

  it('短码冲突时重新生成并保存', async () => {
    Share.create.onFirstCall().rejects({ code: 11000 });
    Share.create.onSecondCall().resolves({});
    await controller.createDailyCardShare({ body: { quote: '留住今天' } }, res, next);
    expect(res.statusCode).to.equal(200);
    expect(Share.create.callCount).to.equal(2);
    expect(requestWxacode.callCount).to.equal(2);
  });

  it('访客按短码读取完整内容与分享人；无效短码返回 404', async () => {
    const quote = '一整段晨读内容'.repeat(12);
    Share.findOne.returns({ lean: async () => ({ userId: USER_ID, quote, note: '我的话', source: '第三天', periodName: '连接之力', day: 3, dateStr: '2026-11-17', variant: 'blank' }) });
    await controller.resolveDailyCardShare({ params: { code: 'ABCD2345' } }, res, next);
    expect(Share.findOne.firstCall.args[0]).to.deep.equal({ code: 'abcd2345' });
    expect(res.body.data).to.include({ inviterId: USER_ID, quote, lessonName: '第三天', periodName: '连接之力', dayNumber: 3, variant: 'blank' });
    await controller.resolveDailyCardShare({ params: { code: 'bad' } }, res, next);
    expect(res.statusCode).to.equal(404);
  });
});
