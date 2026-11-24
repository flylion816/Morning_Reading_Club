const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('enrollment template backup controller', () => {
  let controller;
  let templateModel;
  let backupService;
  let connection;
  let response;
  const template = {
    _id: '507f1f77bcf86cd799439011',
    tenantId: '507f1f77bcf86cd799439012',
    name: '报名模板'
  };

  beforeEach(() => {
    const emptyModel = { find: sinon.stub().resolves([]) };
    const adminModel = { find: sinon.stub().returns({ select: sinon.stub().resolves([]) }) };
    templateModel = {
      find: sinon.stub().resolves([template]),
      replaceOne: sinon.stub().resolves({})
    };
    backupService = { syncEnrollmentTemplate: sinon.stub().resolves() };
    connection = {
      query: sinon.stub().callsFake(async query => (
        query.includes('FROM enrollment_templates') ? [[{ raw_json: JSON.stringify(template) }]] : [[]]
      )),
      release: sinon.spy()
    };
    response = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
    controller = proxyquire('../../../src/controllers/backup.controller', {
      '../models/User': emptyModel,
      '../models/Admin': adminModel,
      '../models/Period': emptyModel,
      '../models/CourseTemplate': emptyModel,
      '../models/EnrollmentTemplate': templateModel,
      '../models/Section': emptyModel,
      '../models/Checkin': emptyModel,
      '../models/Enrollment': emptyModel,
      '../models/Payment': emptyModel,
      '../models/Insight': emptyModel,
      '../models/InsightRequest': emptyModel,
      '../models/Comment': emptyModel,
      '../models/Notification': emptyModel,
      '../config/database': { mysqlPool: { getConnection: async () => connection } },
      '../utils/response': { success: data => ({ data }), errors: { serverError: message => ({ message }) } },
      '../utils/logger': { info() {}, warn() {}, error() {} },
      '../utils/tenantContext': { withSystemContext: async (tenant, callback) => callback() },
      '../services/mysql-backup.service': backupService,
      '../services/sync.service': { publishSyncEvent() {} },
      '../services/mongo-mysql-sync-filter.service': {
        buildSyncReferenceContext: async () => ({}),
        filterDocumentsForMysqlSync: (name, documents) => ({ syncableDocs: documents, skippedDocs: [] })
      }
    });
  });

  it('includes enrollment templates in a full backup', async () => {
    await controller.fullSync({}, response, sinon.spy());

    expect(backupService.syncEnrollmentTemplate.calledOnceWith(template)).to.equal(true);
    expect(response.json.firstCall.args[0].data.syncResults.enrollment_templates).to.equal(1);
  });

  it('includes saved enrollment templates in the restore mapping', async () => {
    await controller.recoverMysqlToMongo({}, response);

    expect(templateModel.replaceOne.calledOnceWith({ _id: template._id }, template, { upsert: true })).to.equal(true);
    expect(response.json.firstCall.args[0].data.recoverResults.enrollment_templates).to.equal(1);
  });
});
