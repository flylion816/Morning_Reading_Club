/**
 * Audit Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Audit Controller', () => {
  let auditController;
  let sandbox;
  let req;
  let res;
  let next;
  let AuditStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = { params: {}, query: {}, user: {} };
    res = {
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    AuditStub = {
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data })
    };

    auditController = proxyquire(
      '../../../src/controllers/audit.controller',
      {
        '../models/Audit': AuditStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getAuditLogs', () => {
    it('应该返回审计日志列表', async () => {
      req.query = { page: 1, limit: 20 };

      AuditStub.countDocuments.resolves(100);
      AuditStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await auditController.getAuditLogs(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
    });
  });

  describe('filterByAction', () => {
    it('应该按操作类型过滤日志', async () => {
      req.query = { page: 1, limit: 20, action: 'create' };

      AuditStub.countDocuments.resolves(50);
      AuditStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await auditController.getAuditLogs(req, res, next);

      const query = AuditStub.find.getCall(0).args[0];
      expect(query).to.have.property('action');
    });
  });

  describe('filterByUser', () => {
    it('应该按用户过滤日志', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.query = { page: 1, limit: 20, userId };

      AuditStub.countDocuments.resolves(30);
      AuditStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await auditController.getAuditLogs(req, res, next);

      const query = AuditStub.find.getCall(0).args[0];
      expect(query).to.have.property('userId');
    });
  });

  describe('filterByDateRange', () => {
    it('应该按日期范围过滤日志', async () => {
      req.query = {
        page: 1,
        limit: 20,
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31'
      };

      AuditStub.countDocuments.resolves(100);
      AuditStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await auditController.getAuditLogs(req, res, next);

      const query = AuditStub.find.getCall(0).args[0];
      expect(query).to.have.property('createdAt');
    });
  });
});
