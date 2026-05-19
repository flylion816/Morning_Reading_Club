const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Audit Service', () => {
  let sandbox;
  let saveStub;
  let withSystemContextStub;
  let getCurrentTenantIdStub;
  let AuditService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    saveStub = sandbox.stub().resolves();
    withSystemContextStub = sandbox.stub().callsFake((tenantId, fn) => fn());
    getCurrentTenantIdStub = sandbox.stub().returns(null);

    function AuditLogStub(doc) {
      Object.assign(this, doc);
      this.save = saveStub;
    }

    AuditLogStub.insertMany = sandbox.stub().resolves([]);
    AuditLogStub.find = sandbox.stub();
    AuditLogStub.countDocuments = sandbox.stub();
    AuditLogStub.aggregate = sandbox.stub();

    const auditService = proxyquire('../../../src/services/audit.service', {
      '../models/AuditLog': AuditLogStub,
      '../models/Admin': {},
      '../utils/logger': { error: sandbox.stub() },
      '../utils/tenantContext': {
        withSystemContext: withSystemContextStub,
        getCurrentTenantId: getCurrentTenantIdStub
      }
    });

    AuditService = auditService.constructor;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('无当前租户上下文时，应该使用显式 tenantId 写入审计日志', async () => {
    const service = new AuditService();
    const tenantId = 'tenant_123';

    const log = await service.createLog({
      adminId: 'admin_123',
      adminName: 'Admin',
      actionType: 'LOGIN',
      resourceType: 'system',
      tenantId
    });

    expect(log.tenantId).to.equal(tenantId);
    expect(withSystemContextStub.calledWith(tenantId)).to.be.true;
    expect(saveStub.calledOnce).to.be.true;
  });

  it('无显式 tenantId 时，应该保留平台级 bypass 写入', async () => {
    const service = new AuditService();

    await service.createLog({
      adminId: 'admin_123',
      adminName: 'Platform Admin',
      actionType: 'LOGIN',
      resourceType: 'system'
    });

    expect(withSystemContextStub.calledWith(null)).to.be.true;
    expect(saveStub.calledOnce).to.be.true;
  });
});
