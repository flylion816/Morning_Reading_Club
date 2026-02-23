/**
 * Enrollment Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Enrollment Controller', () => {
  let enrollmentController;
  let sandbox;
  let req;
  let res;
  let next;
  let EnrollmentStub;
  let UserStub;
  let PeriodStub;

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

    EnrollmentStub = {
      create: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      findById: sandbox.stub(),
      countDocuments: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    enrollmentController = proxyquire(
      '../../../src/controllers/enrollment.controller',
      {
        '../models/Enrollment': EnrollmentStub,
        '../models/User': UserStub,
        '../models/Period': PeriodStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('enrollPeriod', () => {
    it('应该创建新的报名记录', async () => {
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = { periodId };

      const mockPeriod = { _id: periodId, enrolledCount: 10, capacity: 100 };
      const mockUser = { _id: userId };
      const mockEnrollment = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        periodId,
        enrolledAt: new Date(),
        populate: sandbox.stub().returnsThis()
      };

      PeriodStub.findById.resolves(mockPeriod);
      UserStub.findById.resolves(mockUser);
      EnrollmentStub.findOne.resolves(null);
      EnrollmentStub.create.resolves(mockEnrollment);
      EnrollmentStub.findById.returns({
        populate: sandbox.stub().returnsThis()
      });
      PeriodStub.findByIdAndUpdate.resolves(mockPeriod);

      await enrollmentController.enrollPeriod(req, res, next);

      expect(EnrollmentStub.create.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回400当已报名过', async () => {
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = { periodId };

      const mockPeriod = { _id: periodId };
      const mockUser = { _id: userId };
      const existingEnrollment = { userId, periodId };

      PeriodStub.findById.resolves(mockPeriod);
      UserStub.findById.resolves(mockUser);
      EnrollmentStub.findOne.resolves(existingEnrollment);

      await enrollmentController.enrollPeriod(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该返回404当期次不存在', async () => {
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = { periodId };

      PeriodStub.findById.resolves(null);

      await enrollmentController.enrollPeriod(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getUserEnrollments', () => {
    it('应该返回用户的报名列表', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.query = { page: 1, limit: 10 };

      const mockEnrollments = [
        { _id: new mongoose.Types.ObjectId(), userId, periodId: new mongoose.Types.ObjectId() }
      ];

      EnrollmentStub.countDocuments.resolves(1);
      EnrollmentStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockEnrollments)
      });

      await enrollmentController.getUserEnrollments(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
    });
  });

  describe('getPeriodEnrollments', () => {
    it('应该返回期次的报名列表', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 10 };

      const mockEnrollments = [
        { _id: new mongoose.Types.ObjectId(), periodId, userId: new mongoose.Types.ObjectId() }
      ];

      EnrollmentStub.countDocuments.resolves(1);
      EnrollmentStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockEnrollments)
      });

      await enrollmentController.getPeriodEnrollments(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.pagination).to.have.property('total');
    });
  });

  describe('getEnrollmentStats', () => {
    it('应该返回报名统计', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };

      EnrollmentStub.countDocuments.resolves(50);

      const mockPeriod = { _id: periodId, capacity: 100 };
      PeriodStub.findById.resolves(mockPeriod);

      await enrollmentController.getEnrollmentStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('enrolledCount');
      expect(responseData.data).to.have.property('capacity');
    });
  });

  describe('cancelEnrollment', () => {
    it('应该取消用户的报名', async () => {
      const enrollmentId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { enrollmentId };

      const mockEnrollment = { _id: enrollmentId, userId, periodId };
      const mockPeriod = { _id: periodId, enrolledCount: 10 };

      EnrollmentStub.findById.resolves(mockEnrollment);
      EnrollmentStub.findByIdAndDelete.resolves(mockEnrollment);
      PeriodStub.findById.resolves(mockPeriod);
      PeriodStub.findByIdAndUpdate.resolves(mockPeriod);

      await enrollmentController.cancelEnrollment(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回404当报名不存在', async () => {
      const enrollmentId = new mongoose.Types.ObjectId();
      req.user = { userId: new mongoose.Types.ObjectId() };
      req.params = { enrollmentId };

      EnrollmentStub.findById.resolves(null);

      await enrollmentController.cancelEnrollment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });
});
