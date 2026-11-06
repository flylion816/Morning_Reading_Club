const { expect } = require('chai');

const { requireAdminOrigin } = (() => ({ requireAdminOrigin: require('../../../src/middleware/requireAdminOrigin') }))();

function request(origin, protocol = 'https', host = 'admin.example.test') {
  return { protocol, get(name) { return name === 'origin' ? origin : host; } };
}

function response() {
  return { code: 200, status(status) { this.code = status; return this; }, json(body) { this.body = body; return this; } };
}

describe('Administrator same-origin guard', () => {
  const oldEnv = { nodeEnv: process.env.NODE_ENV, adminUrl: process.env.ADMIN_URL, origins: process.env.ADMIN_ALLOWED_ORIGINS };
  beforeEach(() => { process.env.NODE_ENV = 'production'; delete process.env.ADMIN_URL; delete process.env.ADMIN_ALLOWED_ORIGINS; });
  afterEach(() => { process.env.NODE_ENV = 'test'; });
  after(() => {
    if (oldEnv.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnv.nodeEnv;
    if (oldEnv.adminUrl === undefined) delete process.env.ADMIN_URL; else process.env.ADMIN_URL = oldEnv.adminUrl;
    if (oldEnv.origins === undefined) delete process.env.ADMIN_ALLOWED_ORIGINS; else process.env.ADMIN_ALLOWED_ORIGINS = oldEnv.origins;
  });

  it('accepts the exact host origin', () => {
    const res = response();
    let passed = false;
    requireAdminOrigin(request('https://admin.example.test'), res, () => { passed = true; });
    expect(passed).to.equal(true);
    expect(res.code).to.equal(200);
  });

  it('rejects cross-origin, missing, and malformed origins', () => {
    for (const origin of ['https://evil.example', undefined, 'not an origin']) {
      const res = response();
      let passed = false;
      requireAdminOrigin(request(origin), res, () => { passed = true; });
      expect(res.code).to.equal(403);
      expect(passed).to.equal(false);
    }
  });

  it('accepts an explicitly configured administrator origin and local Vite origin outside production', () => {
    process.env.ADMIN_URL = 'https://admin.example.test';
    process.env.NODE_ENV = 'production';
    let configured = false;
    requireAdminOrigin(request('https://admin.example.test'), response(), () => { configured = true; });
    expect(configured).to.equal(true);

    process.env.NODE_ENV = 'development';
    let local = false;
    requireAdminOrigin(request('http://localhost:5173', 'http', 'localhost:3000'), response(), () => { local = true; });
    expect(local).to.equal(true);
  });
});
