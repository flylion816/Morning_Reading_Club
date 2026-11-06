const { expect } = require('chai');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../src/server');
const Admin = require('../../src/models/Admin');
const Tenant = require('../../src/models/Tenant');
const { withSystemContext } = require('../../src/utils/tenantContext');
const { createAdminSession } = require('../../src/services/admin-session.service');

describe('Upload route integration after Multer 2 migration', () => {
  it('authenticates an admin, applies tenant scope, stores an allowed image, then removes only the synthetic test file', async function () {
    this.timeout(20000);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const slug = `up-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 7)}`;
    const tenant = await withSystemContext(null, () => Tenant.create({
      slug,
      name: 'Synthetic upload security test',
      wxAppIds: [`wx-${suffix}`],
      status: 'active'
    }));
    const admin = await withSystemContext(tenant._id, () => Admin.create({
      email: `upload-security-${suffix}@example.test`,
      password: 'synthetic-admin-password',
      name: 'Synthetic Upload Admin',
      role: 'platform_superadmin',
      tenantId: null
    }));
    const session = await createAdminSession(admin);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S5sAAAAASUVORK5CYII=', 'base64');
    let uploadedPath;

    try {
      const response = await request(app)
        .post('/api/v1/upload')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .set('X-Active-Tenant', tenant._id.toString())
        .attach('file', png, { filename: 'synthetic.png', contentType: 'image/png' });

      expect(response.status).to.equal(200);
      expect(response.body.data.url).to.match(new RegExp(`^/uploads/tenants/${slug}/`));
      expect(response.body.data.mimetype).to.equal('image/png');
      uploadedPath = path.resolve(__dirname, '../../uploads/tenants', slug, response.body.data.filename);
      expect(fs.existsSync(uploadedPath)).to.equal(true);
    } finally {
      if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
      const tenantDir = path.resolve(__dirname, '../../uploads/tenants', slug);
      if (fs.existsSync(tenantDir) && fs.readdirSync(tenantDir).length === 0) fs.rmdirSync(tenantDir);
      await withSystemContext(null, () => Promise.all([
        Admin.deleteOne({ _id: admin._id }).exec(),
        Tenant.deleteOne({ _id: tenant._id }).exec()
      ]));
    }
  });
});
