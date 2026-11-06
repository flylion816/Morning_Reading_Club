const { expect } = require('chai');
const { getCorsOptions } = require('../../../src/config/cors');

describe('CORS configuration for security maintenance headers', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAdminUrl = process.env.ADMIN_URL;

  after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAdminUrl === undefined) delete process.env.ADMIN_URL;
    else process.env.ADMIN_URL = previousAdminUrl;
  });

  it('allows the active admin origin and required headers in preflight', done => {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_URL = 'https://admin.example.test';
    const options = getCorsOptions();
    options.origin('https://admin.example.test', error => {
      try {
        expect(error).to.equal(null);
        const headers = options.allowedHeaders.map(header => header.toLowerCase());
        [
          'x-active-tenant',
          'x-admin-maintenance-proof',
          'x-destructive-confirmation',
          'x-tenant-slug',
          'x-wx-appid',
          'x-integration-key-id',
          'x-integration-timestamp',
          'x-integration-nonce',
          'x-integration-signature'
        ].forEach(header => expect(headers).to.include(header));
        done();
      } catch (assertionError) {
        done(assertionError);
      }
    });
  });
});
