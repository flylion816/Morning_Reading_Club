const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Wechat JSSDK Service', () => {
  let sandbox;
  let processEnvBackup;
  let axiosStub;
  let service;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    processEnvBackup = { ...process.env };

    process.env.WECHAT_MP_APPID = 'wx-test-appid';
    process.env.WECHAT_MP_SECRET = 'test-secret';
    process.env.WECHAT_JS_ALLOWED_HOSTS = 'wx.shubai01.com,localhost';

    axiosStub = {
      get: sandbox.stub()
    };

    service = proxyquire('../../../src/services/wechat-jssdk.service', {
      axios: axiosStub,
      '../utils/logger': {
        error: sandbox.stub(),
        info: sandbox.stub(),
        warn: sandbox.stub()
      }
    });
  });

  afterEach(() => {
    service.__resetCache();
    sandbox.restore();
    process.env = { ...processEnvBackup };
  });

  it('should reject URLs outside the configured host allowlist', () => {
    expect(() => service.validateShareUrl('https://evil.example.com/page')).to.throw(
      '页面地址域名不允许'
    );
  });

  it('should strip hash fragments before signing', () => {
    const url = service.validateShareUrl(
      'https://wx.shubai01.com/admin/admin-guide/fanren-reading-admin-guide.html?v=1#section'
    );

    expect(url).to.equal(
      'https://wx.shubai01.com/admin/admin-guide/fanren-reading-admin-guide.html?v=1'
    );
  });

  it('should create a JSSDK signature and cache token and ticket responses', async () => {
    axiosStub.get.onFirstCall().resolves({
      data: {
        access_token: 'access-token',
        expires_in: 7200
      }
    });
    axiosStub.get.onSecondCall().resolves({
      data: {
        errcode: 0,
        ticket: 'jsapi-ticket',
        expires_in: 7200
      }
    });

    const first = await service.createJssdkSignature(
      'https://wx.shubai01.com/admin/admin-guide/fanren-reading-admin-guide.html?v=1'
    );
    const second = await service.createJssdkSignature(
      'https://wx.shubai01.com/admin/admin-guide/fanren-reading-admin-guide.html?v=1'
    );

    expect(first).to.include({
      appId: 'wx-test-appid',
      url: 'https://wx.shubai01.com/admin/admin-guide/fanren-reading-admin-guide.html?v=1'
    });
    expect(first.signature).to.match(/^[a-f0-9]{40}$/);
    expect(second.signature).to.match(/^[a-f0-9]{40}$/);
    expect(axiosStub.get.calledTwice).to.equal(true);
  });
});
