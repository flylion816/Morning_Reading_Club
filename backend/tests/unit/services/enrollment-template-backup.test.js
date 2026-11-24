const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { transformDocumentForMySQL } = require('../../../src/services/sync.service');

describe('enrollment template backup', () => {
  const template = {
    _id: '507f1f77bcf86cd799439011',
    tenantId: '507f1f77bcf86cd799439012',
    name: '报名模板',
    fields: [{ key: 'name', required: true }]
  };

  it('preserves templates and enrollment answers in backup snapshots', () => {
    const row = transformDocumentForMySQL('enrollment_templates', template);
    expect(JSON.parse(row.raw_json)).to.deep.equal(template);

    const period = {
      _id: template._id,
      enrollmentTemplateId: template._id,
      enrollmentTemplateSnapshot: template,
      enrollmentTemplateLocked: true
    };
    const periodRow = transformDocumentForMySQL('periods', period);
    expect(periodRow).not.to.have.property('enrollment_template_id');
    expect(periodRow).not.to.have.property('enrollment_template_locked');
    expect(JSON.parse(periodRow.raw_json)).to.deep.equal(period);

    const enrollment = {
      _id: template._id,
      enrollmentTemplateId: template._id,
      enrollmentTemplateSnapshot: template,
      enrollmentAnswers: { name: '书友' }
    };
    const enrollmentRow = transformDocumentForMySQL('enrollments', enrollment);
    expect(enrollmentRow).not.to.have.property('enrollment_template_id');
    expect(enrollmentRow).not.to.have.property('enrollment_answers');
    expect(JSON.parse(enrollmentRow.raw_json)).to.deep.equal(enrollment);
  });

  it('preserves admin session version without copying the database access password', () => {
    const row = transformDocumentForMySQL('admins', {
      _id: template._id,
      sessionVersion: 3,
      password: 'password-hash',
      dbAccessPassword: 'must-not-be-backed-up'
    });
    expect(row).not.to.have.property('session_version');
    expect(row).not.to.have.property('db_access_password');
    expect(JSON.parse(row.raw_json)).to.include({ sessionVersion: 3 });
    expect(JSON.parse(row.raw_json)).not.to.have.property('password');
    expect(JSON.parse(row.raw_json)).not.to.have.property('dbAccessPassword');
  });

  it('creates the missing backup table without replacing existing rows', async () => {
    const connection = { query: sinon.stub().resolves([[]]), release: sinon.spy() };
    const service = proxyquire('../../../src/services/mysql-backup.service', {
      '../config/database': { mysqlPool: { getConnection: async () => connection } },
      '../utils/logger': { warn() {} }
    });

    await service.syncEnrollmentTemplate(template);

    expect(connection.query.firstCall.args[0]).to.match(/CREATE TABLE IF NOT EXISTS enrollment_templates/);
    expect(connection.query.secondCall.args[0]).to.include('ON DUPLICATE KEY UPDATE');
    expect(JSON.parse(connection.query.secondCall.args[1][2])).to.deep.equal(template);
    expect(connection.release.calledOnce).to.equal(true);
  });
});
