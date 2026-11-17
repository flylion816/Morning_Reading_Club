const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('content-security.service 文本检查', () => {
  let axios;
  let tokenService;
  let logger;
  let service;

  const pass = { data: { errcode: 0, errmsg: 'ok', trace_id: 'trace_1', result: { suggest: 'pass', label: 100 } } };
  const verdict = (suggest, label = 20002) => ({ data: { errcode: 0, errmsg: 'ok', trace_id: 'trace_2', result: { suggest, label } } });

  const failure = async promise => {
    try {
      await promise;
    } catch (error) {
      return error;
    }
    return null;
  };

  beforeEach(() => {
    axios = { post: sinon.stub() };
    tokenService = {
      getAccessToken: sinon.stub().resolves('token_1'),
      clearAccessTokenCache: sinon.stub()
    };
    logger = { info: sinon.stub(), warn: sinon.stub() };
    service = proxyquire('../../../src/services/content-security.service', {
      axios,
      './subscribe-message.service': tokenService,
      '../utils/logger': logger
    });
  });

  it('微信判定 pass 才通过；请求用 2.0 版，带上发送者的 openid 和场景', async () => {
    axios.post.resolves(pass);
    const result = await service.checkText({ openid: 'openid_1', content: '今天也在读' });
    expect(result).to.deep.equal({ traceId: 'trace_1' });

    const [url, body, options] = axios.post.firstCall.args;
    expect(url).to.equal('https://api.weixin.qq.com/wxa/msg_sec_check?access_token=token_1');
    expect(body).to.deep.equal({ version: 2, openid: 'openid_1', scene: 2, content: '今天也在读' });
    expect(options.timeout).to.equal(5000);
  });

  it('risky 和 review 都算没通过，日志里不带原文', async () => {
    for (const suggest of ['risky', 'review']) {
      axios.post.resolves(verdict(suggest));
      const error = await failure(service.checkText({ openid: 'openid_1', content: '这是一段不该进日志的原文' }));
      expect(error.code, suggest).to.equal(service.CONTENT_RISKY);
    }
    const logged = JSON.stringify([...logger.info.args, ...logger.warn.args]);
    expect(logged).to.contain('trace_2');
    expect(logged).to.not.contain('不该进日志的原文');
  });

  it('旧版的违规错误码 87014 也算没通过', async () => {
    axios.post.resolves({ data: { errcode: 87014, errmsg: 'risky content' } });
    const error = await failure(service.checkText({ openid: 'openid_1', content: '随便一句' }));
    expect(error.code).to.equal(service.CONTENT_RISKY);
  });

  it('请求出错、超时、返回异常或没有结论，都算服务不可用，不放行', async () => {
    const cases = [
      () => axios.post.rejects(new Error('timeout of 5000ms exceeded')),
      () => tokenService.getAccessToken.rejects(new Error('租户未配置微信 access_token 凭证')),
      () => axios.post.resolves({ data: { errcode: 61010, errmsg: 'user access record timeout' } }),
      () => axios.post.resolves({ data: { errcode: 45009, errmsg: 'reach max api minute quota limit' } }),
      () => axios.post.resolves({ data: { errcode: 0, errmsg: 'ok' } }),
      () => axios.post.resolves({})
    ];
    for (const setup of cases) {
      axios.post.reset();
      tokenService.getAccessToken.reset();
      tokenService.getAccessToken.resolves('token_1');
      setup();
      const error = await failure(service.checkText({ openid: 'openid_1', content: '随便一句' }));
      expect(error && error.code).to.equal(service.CONTENT_CHECK_UNAVAILABLE);
    }
  });

  it('令牌失效（40001 / 42001）时清掉缓存、换新令牌重试一次', async () => {
    for (const errcode of [40001, 42001]) {
      axios.post.reset();
      tokenService.getAccessToken.reset();
      tokenService.clearAccessTokenCache.reset();
      tokenService.getAccessToken.onFirstCall().resolves('old_token');
      tokenService.getAccessToken.onSecondCall().resolves('new_token');
      axios.post.onFirstCall().resolves({ data: { errcode, errmsg: 'invalid credential' } });
      axios.post.onSecondCall().resolves(pass);

      const result = await service.checkText({ openid: 'openid_1', content: '随便一句' });
      expect(result.traceId).to.equal('trace_1');
      expect(tokenService.clearAccessTokenCache.calledOnce).to.equal(true);
      expect(axios.post.secondCall.args[0]).to.contain('access_token=new_token');
    }
  });

  it('重试之后令牌仍然无效，按服务不可用处理，不会无限重试', async () => {
    axios.post.resolves({ data: { errcode: 40001, errmsg: 'invalid credential' } });
    const error = await failure(service.checkText({ openid: 'openid_1', content: '随便一句' }));
    expect(error.code).to.equal(service.CONTENT_CHECK_UNAVAILABLE);
    expect(axios.post.callCount).to.equal(2);
  });

  it('缺少 openid 或内容时不请求微信，按服务不可用处理', async () => {
    for (const input of [{ content: '一句话' }, { openid: '', content: '一句话' }, { openid: 'openid_1' }, { openid: 'openid_1', content: '' }, undefined]) {
      const error = await failure(service.checkText(input));
      expect(error.code, JSON.stringify(input)).to.equal(service.CONTENT_CHECK_UNAVAILABLE);
    }
    expect(axios.post.called).to.equal(false);
  });
});
