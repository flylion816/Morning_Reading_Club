const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Tenant = require('../../src/models/Tenant');
const Admin = require('../../src/models/Admin');
const EnrollmentTemplate = require('../../src/models/EnrollmentTemplate');
const { withSystemContext } = require('../../src/utils/tenantContext');
const { createAdminSession } = require('../../src/services/admin-session.service');

describe('Enrollment templates: first load in a tenant without templates', () => {
  let tenant;

  before(() => {
    expect(process.env.NODE_ENV).to.equal('test');
    expect(mongoose.connection.host).to.equal('127.0.0.1');
  });

  beforeEach(async () => {
    const suffix = new mongoose.Types.ObjectId().toHexString();
    tenant = await Tenant.create({ slug: `et-${suffix}`, name: '报名模板读取测试' });
  });

  async function tokenFor(role) {
    const suffix = new mongoose.Types.ObjectId().toHexString();
    const admin = await Admin.create({
      email: `et-${suffix}@example.test`, name: '模板测试管理员',
      password: 'Synthetic-Enrollment-Template-Test', role,
      tenantId: role === 'tenant_admin' ? tenant._id : null
    });
    return (await createAdminSession(admin)).accessToken;
  }

  it('loads both built-in templates for a platform administrator with a selected tenant', async () => {
    const token = await tokenFor('platform_superadmin');
    const response = await request(app).get('/api/v1/enrollment-templates')
      .set('Authorization', `Bearer ${token}`).set('X-Active-Tenant', String(tenant._id)).expect(200);
    expect(response.body.data.map(item => item.builtInKey)).to.deep.equal(['simple', 'full']);
    expect(response.body.data.map(item => item.preset)).to.deep.equal(['simple', 'full']);
    expect(response.body.data.map(item => item.builtIn)).to.deep.equal([true, true]);
    for (const item of response.body.data) expect(item.tenantId).to.equal(String(tenant._id));
    const again = await request(app).get('/api/v1/enrollment-templates')
      .set('Authorization', `Bearer ${token}`).set('X-Active-Tenant', String(tenant._id)).expect(200);
    expect(again.body.data.map(item => item._id)).to.deep.equal(response.body.data.map(item => item._id));
    const count = await withSystemContext(tenant._id, async () => await EnrollmentTemplate.countDocuments({}));
    expect(count).to.equal(2);
  });

  it('uses the account tenant for a tenant administrator without a selection header', async () => {
    const token = await tokenFor('tenant_admin');
    const response = await request(app).get('/api/v1/enrollment-templates')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.body.data).to.have.length(2);
    for (const item of response.body.data) expect(item.tenantId).to.equal(String(tenant._id));
  });

  it('rejects a platform administrator without a selected tenant before creating templates', async () => {
    const token = await tokenFor('platform_superadmin');
    const response = await request(app).get('/api/v1/enrollment-templates')
      .set('Authorization', `Bearer ${token}`).expect(403);
    expect(response.body.message).to.equal('请先选择具体租户');
    const count = await withSystemContext(tenant._id, async () => await EnrollmentTemplate.countDocuments({}));
    expect(count).to.equal(0);
  });
});
