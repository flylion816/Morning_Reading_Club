const { expect } = require('chai');
const crypto = require('crypto');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const paymentService = require('../../../src/services/payment.service');

describe('WeChat Pay configuration fail-closed behavior', () => {
  const names = ['NODE_ENV', 'WECHAT_APPID', 'WECHAT_MCH_ID', 'WECHAT_API_KEY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));

  afterEach(() => { process.env.NODE_ENV = 'test'; });

  after(() => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });

  it('does not fall back to sample merchant credentials in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WECHAT_APPID;
    delete process.env.WECHAT_MCH_ID;
    delete process.env.WECHAT_API_KEY;
    expect(() => paymentService.mergeWechatPayConfig()).to.throw(/must come from configured tenant or environment secrets/);
  });


  it('verifies a signed V2 order-query response and rejects a modified signature', async () => {
    const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
    const key = 'Synthetic-WeChat-Pay-Key-0123456789';
    process.env.NODE_ENV = 'production';
    process.env.WECHAT_APPID = 'synthetic-app';
    process.env.WECHAT_MCH_ID = '1234567890';
    process.env.WECHAT_API_KEY = key;

    function sign(fields) {
      const canonical = `${Object.keys(fields)
        .filter(field => fields[field] !== '' && fields[field] !== null && fields[field] !== undefined)
        .sort()
        .map(field => `${field}=${fields[field]}&`)
        .join('')  }key=${key}`;
      return crypto.createHash('md5').update(canonical).digest('hex').toUpperCase();
    }
    const fields = {
      return_code: 'SUCCESS', result_code: 'SUCCESS', appid: 'synthetic-app', mch_id: '1234567890',
      out_trade_no: 'synthetic-order', transaction_id: 'synthetic-transaction', total_fee: '9900',
      fee_type: 'CNY', trade_state: 'SUCCESS'
    };
    const toXml = values => `<xml>${Object.entries(values).map(([field, value]) => `<${field}><![CDATA[${value}]]></${field}>`).join('')}</xml>`;
    const signed = { ...fields, sign: sign(fields) };
    const axiosStub = { post: sinon.stub().resolves({ data: toXml(signed) }) };
    const service = proxyquire('../../../src/services/payment.service', {
      axios: axiosStub,
      '../models/Tenant': {},
      '../utils/logger': { warn: () => {}, error: () => {}, info: () => {} }
    });

    try {
      const verified = await service.queryOrder('synthetic-order');
      expect(verified).to.include({ verified: true, providerState: 'SUCCESS', appId: 'synthetic-app', merchantId: '1234567890', orderNo: 'synthetic-order', amount: 9900, currency: 'CNY', transactionId: 'synthetic-transaction' });
      expect(axiosStub.post.firstCall.args[0]).to.equal('https://api.mch.weixin.qq.com/pay/orderquery');

      axiosStub.post.resolves({ data: toXml({ ...signed, total_fee: '1' }) });
      const tampered = await service.queryOrder('synthetic-order');
      expect(tampered).to.include({ verified: false, reason: 'provider_signature_invalid' });
    } finally {
      for (const name of names) {
        if (original[name] === undefined) delete process.env[name];
        else process.env[name] = original[name];
      }
    }
  });

  it('accepts complete per-tenant provider credentials without using global demo values', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.WECHAT_APPID;
    delete process.env.WECHAT_MCH_ID;
    delete process.env.WECHAT_API_KEY;
    const config = paymentService.mergeWechatPayConfig({ appId: 'synthetic-app', mchId: '1234567890', apiKey: 'synthetic-api-key' });
    expect(config).to.include({ appId: 'synthetic-app', mchId: '1234567890', apiKey: 'synthetic-api-key' });
  });
});
