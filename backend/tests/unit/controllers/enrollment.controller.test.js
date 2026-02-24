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
  let loggerStub;
  let mysqlBackupServiceStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: { userId: new mongoose.Types.ObjectId().toString() }
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    EnrollmentStub = {
      create: sandbox.stub(),
      findOne: sandbox.stub(),
      findById: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      getUserEnrollments: sandbox.stub(),
      getPeriodMembers: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    loggerStub = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub()
    };

    mysqlBackupServiceStub = {
      syncEnrollment: sandbox.stub().resolves(),
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

    enrollmentController = proxyquire(
      '../../../src/controllers/enrollment.controller',
      {
        '../models/Enrollment': EnrollmentStub,
        '../models/User': UserStub,
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

  describe('enrollPeriod', () => {
    it('应该创建新的报名记录', async () => {
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.body = { periodId };

      const mockPeriod = { _id: periodId, enrolledCount: 10, capacity: 100 };
      const mockUser = { _id: userId };
      const enrollmentId = new mongoose.Types.ObjectId();
      const mockEnrollment = { _id: enrollmentId, userId, periodId, enrolledAt: new Date() };
      const mockPopulatedEnrollment = {
        _id: enrollmentId,
        userId: { _id: userId, nickname: 'test', avatar: '' },
        periodId: { _id: periodId, title: 'test', description: '' },
        enrolledAt: new Date()
      };

      PeriodStub.findById.resolves(mockPeriod);
      PeriodStub.findByIdAndUpdate.resolves(mockPeriod);
      UserStub.findById.resolves(mockUser);
      EnrollmentStub.findOne.resolves(null);
      EnrollmentStub.create.resolves(mockEnrollment);
      EnrollmentStub.findById.returns({
        populate: sandbox.stub().returnsThis(),
        execPopulate: sandbox.stub().resolves(mockPopulatedEnrollment)
      });

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
      const periodId = new mongoose.Types.ObjectId();
      req.user = { userId: userId.toString() };
      req.params = { userId: userId.toString() };
      req.query = { page: 1, limit: 10 };

      const mockEnrollments = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId: userId.toString(),
          periodId: {
            _id: periodId,
            title: 'test period',
            description: 'test',
            startDate: new Date(),
            endDate: new Date(),
            coverImage: ''
          },
          enrolledAt: new Date(),
          status: 'active',
          paymentStatus: 'unpaid'
        }
      ];

      EnrollmentStub.getUserEnrollments.resolves({
        list: mockEnrollments,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
      });

      await enrollmentController.getUserEnrollments(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getPeriodMembers', () => {
    it('应该返回期次的成员列表', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 10 };

      const mockPeriod = { _id: periodId, title: 'test', description: '' };
      const mockEnrollments = [
        {
          _id: new mongoose.Types.ObjectId(),
          periodId,
          userId: { _id: userId, nickname: 'test user', avatar: '' },
          enrolledAt: new Date(),
          status: 'active'
        }
      ];

      PeriodStub.findById.resolves(mockPeriod);
      EnrollmentStub.getPeriodMembers.resolves({
        list: mockEnrollments,
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
      });

      await enrollmentController.getPeriodMembers(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
    });
  });

  describe('withdrawEnrollment', () => {
    it('应该取消用户的报名', async () => {
      const enrollmentId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();

      req.user = { userId };
      req.params = { enrollmentId };

      const mockEnrollment = {
        _id: enrollmentId,
        userId,
        periodId,
        status: 'active',
        withdraw: sandbox.stub().resolves()
      };

      EnrollmentStub.findOne.resolves(mockEnrollment);
      PeriodStub.findByIdAndUpdate.resolves({ _id: periodId });

      await enrollmentController.withdrawEnrollment(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回404当报名不存在', async () => {
      const enrollmentId = new mongoose.Types.ObjectId();
      req.user = { userId: new mongoose.Types.ObjectId() };
      req.params = { enrollmentId };

      EnrollmentStub.findOne.resolves(null);

      await enrollmentController.withdrawEnrollment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('submitEnrollmentForm', () => {
    it('应该提交完整的报名表单', async () => {
      const userId = req.user.userId;
      const periodId = new mongoose.Types.ObjectId();
      const enrollmentId = new mongoose.Types.ObjectId();

      req.body = {
        periodId,
        name: '张三',
        gender: 'male',
        province: '北京',
        detailedAddress: '朝阳区',
        age: 30,
        referrer: '朋友推荐',
        hasReadBook: 'yes',
        readTimes: 5,
        enrollReason: '想提升自己',
        expectation: '获得成长',
        commitment: '坚持学习'
      };

      const mockPeriod = { _id: periodId, name: '第一期' };
      const mockEnrollment = {
        _id: enrollmentId,
        userId,
        periodId,
        ...req.body,
        paymentStatus: 'pending',
        status: 'active'
      };
      const mockPopulatedEnrollment = {
        _id: enrollmentId,
        userId: { _id: userId, nickname: '用户', avatar: '' },
        periodId: { _id: periodId, title: '期次', description: '' },
        ...req.body
      };

      PeriodStub.findById.resolves(mockPeriod);
      EnrollmentStub.findOne.resolves(null); // 未曾报名
      EnrollmentStub.create.resolves(mockEnrollment);
      EnrollmentStub.findById.returns({
        populate: sandbox.stub().returnsThis(),
        resolves: sandbox.stub().resolves(mockPopulatedEnrollment)
      });
      PeriodStub.findByIdAndUpdate.resolves();

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(res.json.called).to.be.true;
      expect(EnrollmentStub.create.called).to.be.true;
      expect(PeriodStub.findByIdAndUpdate.called).to.be.true;
      expect(mysqlBackupServiceStub.syncEnrollment.called).to.be.true;
    });

    it('应该返回400当缺少必填字段', async () => {
      const periodId = new mongoose.Types.ObjectId();

      // 缺少 name 字段
      req.body = {
        periodId,
        gender: 'male',
        province: '北京',
        detailedAddress: '朝阳区',
        age: 30,
        referrer: '朋友推荐',
        hasReadBook: 'yes',
        enrollReason: '想提升自己',
        expectation: '获得成长',
        commitment: '坚持学习'
      };

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('name');
    });

    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();

      req.body = {
        periodId,
        name: '张三',
        gender: 'male',
        province: '北京',
        detailedAddress: '朝阳区',
        age: 30,
        referrer: '朋友推荐',
        hasReadBook: 'yes',
        readTimes: 5,
        enrollReason: '想提升自己',
        expectation: '获得成长',
        commitment: '坚持学习'
      };

      PeriodStub.findById.resolves(null);

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该返回400当已报名该期次', async () => {
      const userId = req.user.userId;
      const periodId = new mongoose.Types.ObjectId();

      req.body = {
        periodId,
        name: '张三',
        gender: 'male',
        province: '北京',
        detailedAddress: '朝阳区',
        age: 30,
        referrer: '朋友推荐',
        hasReadBook: 'yes',
        readTimes: 5,
        enrollReason: '想提升自己',
        expectation: '获得成长',
        commitment: '坚持学习'
      };

      const mockPeriod = { _id: periodId, name: '第一期' };
      const existingEnrollment = { _id: new mongoose.Types.ObjectId(), userId, periodId, status: 'active' };

      PeriodStub.findById.resolves(mockPeriod);
      EnrollmentStub.findOne.resolves(existingEnrollment);

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('已报名');
    });
  });
});
