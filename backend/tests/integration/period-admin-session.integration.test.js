const { expect } = require('chai');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Tenant = require('../../src/models/Tenant');
const { withSystemContext } = require('../../src/utils/tenantContext');

describe('Period list with an expired administrator session', () => {
  let tenant;

  before(() => {
    expect(process.env.NODE_ENV).to.equal('test');
    expect(mongoose.connection.host).to.equal('127.0.0.1');
  });

  beforeEach(async () => {
    const suffix = new mongoose.Types.ObjectId().toHexString();
    tenant = await withSystemContext(null, () => Tenant.create({
      name: '会话续期测试',
      slug: `ps-${suffix}`,
      wxAppIds: [`wx${suffix.slice(-16)}`]
    }));
  });

  it('returns 401 to allow the dashboard to refresh its expired token', async () => {
    const token = jwt.sign({
      sub: new mongoose.Types.ObjectId().toString(),
      sid: 'expired-test-session',
      role: 'platform_superadmin',
      sessionVersion: 0,
      tokenType: 'admin_access'
    }, process.env.JWT_ADMIN_SECRET, {
      algorithm: 'HS256',
      issuer: 'morning-reading',
      audience: 'admin-api',
      expiresIn: -1
    });
    await request(app).get('/api/v1/periods')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Active-Tenant', String(tenant._id))
      .expect(401);
    await request(app).get('/api/v1/periods')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('still allows anonymous access with the mini program tenant header', async () => {
    await request(app).get('/api/v1/periods')
      .set('X-Wx-AppId', tenant.wxAppIds[0])
      .expect(200);
  });
});
