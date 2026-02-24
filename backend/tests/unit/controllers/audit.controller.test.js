/**
 * Audit Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Audit Controller', () => {
  let auditController;
  let sandbox;
  let req;
  let res;
  let next;
  let auditServiceStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: { role: 'superadmin', id: 'admin123' },
      ip: '192.168.1.1',
      get: sandbox.stub().returns('Mozilla/5.0')
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis(),
      setHeader: sandbox.stub(),
      send: sandbox.stub()
    };

    next = sandbox.stub();

    auditServiceStub = {
      getLogs: sandbox.stub(),
      getAdminLogs: sandbox.stub(),
      getResourceLogs: sandbox.stub(),
      getStatistics: sandbox.stub(),
      exportLogsToCSV: sandbox.stub(),
      cleanupExpiredLogs: sandbox.stub(),
      createLog: sandbox.stub()
    };

    const loggerStub = {
      warn: sandbox.stub(),
      error: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg }),
        internalError: (msg) => ({ code: 500, message: msg })
      }
    };

    auditController = proxyquire(
      '../../../src/controllers/audit.controller',
      {
        '../services/audit.service': auditServiceStub,
        '../utils/logger': loggerStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getLogs', () => {
    it('应该返回审计日志列表', async () => {
      const mockResult = {
        logs: [{ _id: '1', adminId: 'admin1', actionType: 'CREATE' }],
        pagination: { total: 100, page: 1, pageSize: 20 }
      };

      auditServiceStub.getLogs.resolves(mockResult);
      req.query = { page: 1, pageSize: 20 };

      await auditController.getLogs(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该按操作类型过滤日志', async () => {
      const mockResult = { logs: [], pagination: { total: 50, page: 1 } };
      auditServiceStub.getLogs.resolves(mockResult);
      req.query = { page: 1, pageSize: 20, actionType: 'CREATE' };

      await auditController.getLogs(req, res, next);

      expect(auditServiceStub.getLogs.calledOnce).to.be.true;
    });

    it('应该处理错误', async () => {
      auditServiceStub.getLogs.rejects(new Error('Service error'));
      req.query = { page: 1, pageSize: 20 };

      await auditController.getLogs(req, res, next);

      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.called).to.be.true;
    });
  });

  describe('getAdminLogs', () => {
    it('应该返回管理员的操作记录', async () => {
      const mockResult = { logs: [], pagination: { total: 0, page: 1 } };
      auditServiceStub.getAdminLogs.resolves(mockResult);
      req.params = { adminId: 'admin123' };
      req.query = { page: 1, pageSize: 20 };

      await auditController.getAdminLogs(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getResourceLogs', () => {
    it('应该返回资源的操作记录', async () => {
      const mockResult = { logs: [], pagination: { total: 0, page: 1 } };
      auditServiceStub.getResourceLogs.resolves(mockResult);
      req.query = { page: 1, pageSize: 20, resourceType: 'User', resourceId: 'user123' };

      await auditController.getResourceLogs(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getStatistics', () => {
    it('应该返回审计统计数据', async () => {
      const mockResult = { total: 1000, byActionType: {} };
      auditServiceStub.getStatistics.resolves(mockResult);

      await auditController.getStatistics(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });
});
