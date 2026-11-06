const { expect } = require('chai');
const path = require('path');
const { spawnSync } = require('child_process');
const Admin = require('../../src/models/Admin');
const { withSystemContext } = require('../../src/utils/tenantContext');
const { ensureFirstPlatformAdmin } = require('../../scripts/init-superadmin');
const { resetAdminCredentials } = require('../../scripts/reset-admin-password');

describe('Controlled administrator bootstrap and password recovery scripts', () => {
  const backendRoot = path.resolve(__dirname, '../..');

  function runScript(relativePath, env) {
    return spawnSync(process.execPath, [path.join(backendRoot, relativePath)], {
      cwd: backendRoot,
      encoding: 'utf8',
      timeout: 20000,
      env: { ...process.env, NODE_ENV: 'production', ...env }
    });
  }

  it('creates only the missing admin and leaves an existing admin unchanged', async function () {
    this.timeout(30000);
    const email = `bootstrap-${Date.now()}@example.test`;
    const firstPassword = 'Synthetic-First-Admin-Pass-1';
    const secondPassword = 'Synthetic-Second-Admin-Pass-2';
    const first = await withSystemContext(null, () => ensureFirstPlatformAdmin(Admin, {
      email,
      name: 'Synthetic bootstrap account',
      password: firstPassword,
      dbAccessPassword: 'Synthetic-Db-Access-Pass-3'
    }));
    expect(first.created).to.equal(true);
    const repeated = await withSystemContext(null, () => ensureFirstPlatformAdmin(Admin, {
      email,
      name: 'Replacement must not overwrite',
      password: secondPassword,
      dbAccessPassword: 'Synthetic-Second-Db-Access-4'
    }));
    expect(repeated.created).to.equal(false);
    expect(repeated.admin.email).to.equal(email);

    const admin = await withSystemContext(null, async () => await Admin.findOne({ email }).select('+password').exec());
    expect(await admin.comparePassword(firstPassword)).to.equal(true);
    expect(await admin.comparePassword(secondPassword)).to.equal(false);
    expect(await withSystemContext(null, () => Admin.countDocuments({ email }))).to.equal(1);
  });

  it('resets only the selected admin, increments the revocation version and returns no passwords', async () => {
    const email = `reset-${Date.now()}@example.test`;
    const originalPassword = 'Synthetic-Original-Admin-Pass-4';
    const nextPassword = 'Synthetic-Next-Admin-Pass-5';
    const admin = await withSystemContext(null, () => Admin.create({
      email,
      password: originalPassword,
      name: 'Synthetic reset target',
      role: 'platform_superadmin'
    }));
    const previousVersion = admin.sessionVersion;

    const result = await withSystemContext(null, () => resetAdminCredentials(
      Admin,
      email,
      nextPassword,
      'Synthetic-Next-Db-Access-6'
    ));
    expect(result).to.deep.equal({ email, name: 'Synthetic reset target', role: 'platform_superadmin' });
    expect(JSON.stringify(result)).not.to.include(nextPassword);

    const reloaded = await withSystemContext(null, async () => await Admin.findById(admin._id).select('+password +dbAccessPassword').exec());
    expect(await reloaded.comparePassword(nextPassword)).to.equal(true);
    expect(reloaded.sessionVersion).to.equal(previousVersion + 1);
  });
});
