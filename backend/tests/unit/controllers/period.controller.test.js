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
  let UserStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: {}
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    PeriodStub = {
      findById: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      create: sandbox.stub()
    };

    UserStub = {
      find: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    periodController = proxyquire(
      '../../../src/controllers/period.controller',
      {
        '../models/Period': PeriodStub,
        '../models/User': UserStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getPeriodList', () => {
    it('应该返回所有期次列表', async () => {
      req.query = { page: 1, limit: 10 };

      const mockPeriods = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: '期次1',
          status: 'ongoing',
          toObject: sandbox.stub().returnsThis()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          name: '期次2',
          status: 'completed',
          toObject: sandbox.stub().returnsThis()
        }
      ];

      PeriodStub.countDocuments.resolves(2);
      PeriodStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockPeriods)
      });

      await periodController.getPeriodList(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.be.an('array');
    });

    it('应该按status过滤，支持active映射到ongoing', async () => {
      req.query = { page: 1, limit: 10, status: 'active' };

      PeriodStub.countDocuments.resolves(1);
      PeriodStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await periodController.getPeriodList(req, res, next);

      const query = PeriodStub.find.getCall(0).args[0];
      expect(query).to.have.property('status');
      expect(query.status).to.equal('ongoing');
    });

    it('应该返回正确的分页信息', async () => {
      req.query = { page: 2, limit: 10 };

      PeriodStub.countDocuments.resolves(25);
      PeriodStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await periodController.getPeriodList(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.pagination.page).to.equal(2);
      expect(responseData.pagination.total).to.equal(25);
    });
  });

  describe('getPeriodDetail', () => {
    it('应该返回期次详情', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      const mockPeriod = {
        _id: periodId,
        name: '2025年第一期',
        status: 'ongoing',
        enrollmentCount: 50,
        maxEnrollment: 100
      };

      PeriodStub.findById.resolves(mockPeriod);

      await periodController.getPeriodDetail(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.name).to.equal('2025年第一期');
    });

    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      PeriodStub.findById.resolves(null);

      await periodController.getPeriodDetail(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('createPeriod (Admin)', () => {
    it('应该创建新期次', async () => {
      req.body = {
        name: '新期次',
        title: '新期次标题',
        description: '新期次描述',
        capacity: 100,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000)
      };

      const mockPeriod = {
        _id: new mongoose.Types.ObjectId(),
        ...req.body,
        status: 'draft',
        enrolledCount: 0
      };

      PeriodStub.create.resolves(mockPeriod);

      await periodController.createPeriod(req, res, next);

      expect(PeriodStub.create.called).to.be.true;
      expect(res.json.called).to.be.true;
    });
  });

  describe('updatePeriod (Admin)', () => {
    it('应该更新期次信息', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.body = { name: '更新的名称', status: 'active' };

      const mockPeriod = {
        _id: periodId,
        name: '原名称',
        status: 'upcoming',
        save: sandbox.stub().resolves()
      };

      PeriodStub.findById.resolves(mockPeriod);

      await periodController.updatePeriod(req, res, next);

      expect(PeriodStub.findById.called).to.be.true;
      expect(mockPeriod.save.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.body = { name: '新名称' };

      PeriodStub.findByIdAndUpdate.resolves(null);

      await periodController.updatePeriod(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('deletePeriod (Admin)', () => {
    it('应该删除空的期次', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      const mockPeriod = { _id: periodId, name: '期次', enrollmentCount: 0 };

      PeriodStub.findById.resolves(mockPeriod);
      PeriodStub.findByIdAndDelete.resolves(mockPeriod);

      await periodController.deletePeriod(req, res, next);

      expect(res.json.called).to.be.true;
      expect(PeriodStub.findByIdAndDelete.called).to.be.true;
    });

    it('应该返回400当期次有报名', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      const mockPeriod = { _id: periodId, name: '期次', enrollmentCount: 5 };

      PeriodStub.findById.resolves(mockPeriod);

      await periodController.deletePeriod(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('已有用户报名');
    });

    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      PeriodStub.findById.resolves(null);

      await periodController.deletePeriod(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

});
