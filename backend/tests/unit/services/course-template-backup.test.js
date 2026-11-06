const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { transformDocumentForMySQL } = require('../../../src/services/sync.service');

describe('course template backup contract', () => {
  const template = { _id: '507f1f77bcf86cd799439011', tenantId: '507f1f77bcf86cd799439012', name: '空间管理', revision: 2, active: false, modules: [{ id: 'intro', name: '观察', type: 'text' }] };

  it('stores the complete template and period/section fields in raw JSON rather than unknown SQL columns', () => {
    const row = transformDocumentForMySQL('course_templates', template);
    expect(JSON.parse(row.raw_json)).to.deep.equal(template);
    const period = { _id: template._id, courseTemplateSnapshot: template, courseTemplateLocked: true };
    const periodRow = transformDocumentForMySQL('periods', period);
    expect(periodRow).not.to.have.property('course_template_snapshot');
    expect(periodRow).not.to.have.property('course_template_locked');
    expect(JSON.parse(periodRow.raw_json)).to.deep.equal(period);
    const section = { _id: template._id, courseTemplateSnapshot: template, courseModuleValues: { intro: '观察内容' } };
    const sectionRow = transformDocumentForMySQL('sections', section);
    expect(sectionRow).not.to.have.property('course_module_values');
    expect(JSON.parse(sectionRow.raw_json)).to.deep.equal(section);
  });

  it('uses a non-destructive schema creation and releases the connection after a failed backup', async () => {
    const connection = { query: sinon.stub().resolves([[]]), release: sinon.spy() };
    const service = proxyquire('../../../src/services/mysql-backup.service', {
      '../config/database': { mysqlPool: { getConnection: async () => connection } },
      '../utils/logger': { warn() {} }
    });
    await service.syncCourseTemplate(template);
    expect(connection.query.firstCall.args[0]).to.match(/CREATE TABLE IF NOT EXISTS course_templates/);
    expect(connection.query.secondCall.args[1][2]).to.equal(JSON.stringify(template));
    expect(connection.release.calledOnce).to.equal(true);
    connection.query.resetBehavior(); connection.query.rejects(new Error('unavailable'));
    try { await service.syncCourseTemplate(template); } catch (error) { expect(error.message).to.equal('unavailable'); }
    expect(connection.release.callCount).to.equal(2);
  });
});
