/**
 * Period Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Period Controller', () => {
  let periodController;
  let sandbox;
  let req;
  let res;
  let next;
  let PeriodStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = { body: {}, params: {}, query: {}, user: {} };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    PeriodStub = {
      create: sandbox.stub(),
      findById: sandbox.stub(),
      find: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    // Mock logger
    const loggerStub = {
      warn: sandbox.stub(),
      error: sandbox.stub(),
      info: sandbox.stub(),
      debug: sandbox.stub()
    };

    // Mock mysqlBackupService
    const mysqlBackupServiceStub = {
      syncPeriod: sandbox.stub().resolves()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg }),
        serverError: (msg) => ({ code: 500, message: msg })
      }
    };

    periodController = proxyquire(
      '../../../src/controllers/period.controller',
      {
        '../models/Period': PeriodStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub,
        '../services/mysql-backup.service': mysqlBackupServiceStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getPeriodList', () => {
    it('应该返回所有期次列表', async () => {
      const mockPeriods = [
        { _id: new mongoose.Types.ObjectId(), name: '期次1', status: 'ongoing', toObject: function() { return this; } }
      ];

      const chainableMock = {};
      chainableMock.sort = sandbox.stub().returnsThis();
      chainableMock.skip = sandbox.stub().returnsThis();
      chainableMock.limit = sandbox.stub().returnsThis();
      chainableMock.select = sandbox.stub().resolves(mockPeriods);

      PeriodStub.countDocuments.resolves(1);
      PeriodStub.find.returns(chainableMock);

      req.query = { page: 1, limit: 10 };

      await periodController.getPeriodList(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getPeriodDetail', () => {
    it('应该返回期次详情', async () => {
      const periodId = new mongoose.Types.ObjectId();

      const mockPeriod = {
        _id: periodId,
        name: '期次1',
        status: 'active'
      };

      let populateCount = 0;
      const chainableMock = {};
      chainableMock.populate = sandbox.stub().callsFake(function() {
        populateCount++;
        if (populateCount === 1) {
          return chainableMock;
        }
        return Promise.resolve(mockPeriod);
      });

      PeriodStub.findById.returns(chainableMock);

      req.params = { periodId };

      await periodController.getPeriodDetail(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();

      PeriodStub.findById.resolves(null);

      req.params = { periodId };

      await periodController.getPeriodDetail(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('createPeriod', () => {
    it('应该创建新期次', async () => {
      const mockPeriod = {
        _id: new mongoose.Types.ObjectId(),
        name: '新期次',
        status: 'pending'
      };

      PeriodStub.create.resolves(mockPeriod);

      req.body = { name: '新期次', startDate: new Date(), endDate: new Date() };

      await periodController.createPeriod(req, res, next);

      expect(res.status.calledWith(201)).to.be.true;
    });
  });

  describe('updatePeriod', () => {
    it('应该更新期次信息', async () => {
      const periodId = new mongoose.Types.ObjectId();

      const mockPeriod = {
        _id: periodId,
        name: '更新后的期次',
        save: sandbox.stub().resolves()
      };

      PeriodStub.findById.resolves(mockPeriod);

      req.params = { periodId };
      req.body = { name: '更新后的期次' };

      await periodController.updatePeriod(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();

      PeriodStub.findById.resolves(null);

      req.params = { periodId };
      req.body = { name: '更新' };

      await periodController.updatePeriod(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('deletePeriod', () => {
    it('应该删除期次', async () => {
      const periodId = new mongoose.Types.ObjectId();

      PeriodStub.findByIdAndDelete.resolves({ _id: periodId });

      req.params = { periodId };

      await periodController.deletePeriod(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });
});
