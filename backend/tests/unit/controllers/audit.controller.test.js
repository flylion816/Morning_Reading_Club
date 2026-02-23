/**
 * Audit Controller 单元测试
 */

// Mock the auditService before requiring the controller
jest.mock('../../../src/services/audit.service', () => ({
  getLogs: jest.fn(),
  getAdminLogs: jest.fn(),
  getResourceLogs: jest.fn(),
  getStatistics: jest.fn(),
  exportLogsToCSV: jest.fn(),
  cleanupExpiredLogs: jest.fn(),
  createLog: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../src/utils/response', () => ({
  success: (data, message) => ({ code: 200, message, data }),
  errors: {
    badRequest: (msg) => ({ code: 400, message: msg }),
    notFound: (msg) => ({ code: 404, message: msg }),
    forbidden: (msg) => ({ code: 403, message: msg }),
    internalError: (msg) => ({ code: 500, message: msg })
  }
}));

const auditController = require('../../../src/controllers/audit.controller');
const auditService = require('../../../src/services/audit.service');

describe('Audit Controller', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { role: 'superadmin', id: 'admin123' },
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0')
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn()
    };

    next = jest.fn();

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getLogs', () => {
    it('应该返回审计日志列表', async () => {
      const mockResult = {
        logs: [{ _id: '1', adminId: 'admin1', actionType: 'CREATE' }],
        pagination: { total: 100, page: 1, pageSize: 20 }
      };

      auditService.getLogs.mockResolvedValue(mockResult);
      req.query = { page: 1, pageSize: 20 };

      await auditController.getLogs(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('应该按操作类型过滤日志', async () => {
      const mockResult = { logs: [], pagination: { total: 50, page: 1 } };
      auditService.getLogs.mockResolvedValue(mockResult);
      req.query = { page: 1, pageSize: 20, actionType: 'CREATE' };

      await auditController.getLogs(req, res, next);

      expect(auditService.getLogs.mock.calls[0][0]).toMatchObject({ actionType: 'CREATE' });
    });

    it('应该处理错误', async () => {
      auditService.getLogs.mockRejectedValue(new Error('Service error'));
      req.query = { page: 1, pageSize: 20 };

      await auditController.getLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAdminLogs', () => {
    it('应该返回管理员的操作记录', async () => {
      const mockResult = { logs: [], pagination: { total: 10, page: 1 } };
      auditService.getAdminLogs.mockResolvedValue(mockResult);
      req.params = { adminId: 'admin123' };
      req.query = { page: 1, pageSize: 20 };

      await auditController.getAdminLogs(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getResourceLogs', () => {
    it('应该返回资源的操作记录', async () => {
      const mockResult = { logs: [], pagination: { total: 5, page: 1 } };
      auditService.getResourceLogs.mockResolvedValue(mockResult);
      req.params = { resourceType: 'insights', resourceId: '507f1f77bcf86cd799439011' };
      req.query = { page: 1, pageSize: 20 };

      await auditController.getResourceLogs(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('应该返回操作统计', async () => {
      const mockStats = { totalLogs: 1000, actionTypes: { CREATE: 400 } };
      auditService.getStatistics.mockResolvedValue(mockStats);

      await auditController.getStatistics(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredLogs', () => {
    it('应该清理过期日志（超级管理员）', async () => {
      const mockResult = { deletedCount: 50 };
      auditService.cleanupExpiredLogs.mockResolvedValue(mockResult);
      auditService.createLog.mockResolvedValue({ _id: '1' });

      await auditController.cleanupExpiredLogs(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('应该拒绝非超级管理员清理日志', async () => {
      req.user = { role: 'admin', id: 'admin123' };

      await auditController.cleanupExpiredLogs(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
