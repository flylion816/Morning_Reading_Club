const { expect } = require('chai');

const {
  isTrackedApiPath,
  shouldCountAsError,
} = require('../../../src/utils/monitoring-rules');

describe('Monitoring Rules Utils', () => {
  it('应该识别真实业务 API 路径', () => {
    expect(isTrackedApiPath('/api/v1/periods')).to.equal(true);
    expect(isTrackedApiPath('/api/v1/periods/123')).to.equal(true);
    expect(isTrackedApiPath('/api/v1/auth/admin/login')).to.equal(true);
    expect(isTrackedApiPath('/api/v1/health')).to.equal(true);
  });

  it('应该忽略明显的扫描路径', () => {
    expect(isTrackedApiPath('/api/sonicos/tfa')).to.equal(false);
    expect(isTrackedApiPath('/api/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php')).to.equal(false);
    expect(isTrackedApiPath('/')).to.equal(false);
    expect(isTrackedApiPath('/favicon.ico')).to.equal(false);
  });

  it('应该只统计真实业务 API 的 4xx/5xx 为错误', () => {
    expect(shouldCountAsError({
      endpoint: '/api/v1/payments',
      statusCode: 404,
    })).to.equal(true);

    expect(shouldCountAsError({
      endpoint: '/api/v1/users/me',
      statusCode: 401,
    })).to.equal(false);

    expect(shouldCountAsError({
      endpoint: '/api/sonicos/auth',
      statusCode: 404,
    })).to.equal(false);
  });
});
