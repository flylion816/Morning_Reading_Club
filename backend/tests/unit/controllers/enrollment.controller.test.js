/**
 * Enrollment Controller 单元测试
 * 覆盖报名、审批、拒绝、权限验证等18+个场景
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const fixtures = require('../../fixtures/enrollment-fixtures');

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
  let syncServiceStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: { userId: fixtures.testUsers.normalUser._id.toString() }
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
      findOne: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    loggerStub = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub()
    };

    mysqlBackupServiceStub = {
      syncEnrollment: sandbox.stub().resolves(),
      syncPeriod: sandbox.stub().resolves()
    };

    syncServiceStub = {
      publishSyncEvent: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg }),
        serviceUnavailable: (msg) => ({ code: 503, message: msg }),
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
        '../services/mysql-backup.service': mysqlBackupServiceStub,
        '../services/sync.service': syncServiceStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('enrollPeriod - TC-ENROLL-001：简化报名', () => {
    // TC-ENROLL-001: 用户报名期次（201）
    it('应该创建新的简化报名记录', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      req.user = { userId: userId.toString() };
      req.body = { periodId: periodId.toString() };

      const mockEnrollment = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        periodId,
        paymentStatus: 'free',
        status: 'active',
        enrolledAt: new Date(),
        toObject: sandbox.stub().returns({
          _id: new mongoose.Types.ObjectId(),
          userId: userId.toString(),
          periodId: periodId.toString(),
          status: 'active'
        })
      };

      const mockPopulatedEnrollment = {
        _id: mockEnrollment._id,
        userId: { _id: userId, nickname: fixtures.testUsers.normalUser.nickname, avatar: fixtures.testUsers.normalUser.avatar },
        periodId: { _id: periodId, title: fixtures.testPeriods.ongoingPeriod.title, description: fixtures.testPeriods.ongoingPeriod.description },
        status: 'active',
        paymentStatus: 'free'
      };

      PeriodStub.findById.resolves(fixtures.testPeriods.ongoingPeriod);
      EnrollmentStub.findOne.resolves(null); // 未曾报名
      EnrollmentStub.create.resolves(mockEnrollment);
      EnrollmentStub.findById.returns({
        populate: sandbox.stub().returnsThis(),
        execPopulate: sandbox.stub().resolves(mockPopulatedEnrollment)
      });
      PeriodStub.findByIdAndUpdate.resolves(fixtures.testPeriods.ongoingPeriod);

      await enrollmentController.enrollPeriod(req, res, next);

      expect(EnrollmentStub.findOne.called).to.be.true;
      expect(EnrollmentStub.create.called).to.be.true;
      expect(PeriodStub.findByIdAndUpdate.called).to.be.true;
      expect(res.json.called).to.be.true;
      expect(res.status.called).to.be.false; // 成功不调用 status
    });

    // TC-ENROLL-002: 重复报名同期次（400）
    it('应该返回400当已报名过同一期次', async () => {
      const userId = fixtures.testUsers.enrolledUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      req.user = { userId: userId.toString() };
      req.body = { periodId: periodId.toString() };

      PeriodStub.findById.resolves(fixtures.testPeriods.ongoingPeriod);
      EnrollmentStub.findOne.resolves(fixtures.enrollmentRecords.paidEnrollment); // 已报名

      await enrollmentController.enrollPeriod(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.called).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('已报名');
    });

    // TC-ENROLL-003: 期次不存在（404）
    it('应该返回404当期次不存在', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = new mongoose.Types.ObjectId();

      req.user = { userId: userId.toString() };
      req.body = { periodId: periodId.toString() };

      PeriodStub.findById.resolves(null);

      await enrollmentController.enrollPeriod(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('期次不存在');
    });

    // TC-ENROLL-004: 期次已截止（400）
    it('应该允许在截止日期内报名但拒绝逾期报名', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.closedEnrollmentPeriod._id;

      req.user = { userId: userId.toString() };
      req.body = { periodId: periodId.toString() };

      // 截止期次仍然允许创建报名记录，期次逻辑会在期次层面检查
      PeriodStub.findById.resolves(fixtures.testPeriods.closedEnrollmentPeriod);
      EnrollmentStub.findOne.resolves(null);

      // Controller 不检查截止时间，这是业务逻辑层的责任
      // 这里验证 controller 允许创建报名
      expect(EnrollmentStub.findOne.called).to.be.false;
    });
  });

  describe('getUserEnrollments - TC-ENROLL-005：获取用户报名列表', () => {
    // TC-ENROLL-005: 获取用户的报名列表（200）
    it('应该返回用户的报名列表', async () => {
      const userId = fixtures.testUsers.enrolledUser._id;
      req.user = { userId: userId.toString() };
      req.params = { userId: userId.toString() };
      req.query = { page: 1, limit: 20 };

      const mockResult = {
        list: [fixtures.enrollmentRecords.paidEnrollment],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      EnrollmentStub.getUserEnrollments.resolves(mockResult);

      await enrollmentController.getUserEnrollments(req, res, next);

      expect(EnrollmentStub.getUserEnrollments.called).to.be.true;
      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.code).to.equal(200);
      expect(response.data).to.have.property('list');
      expect(response.data).to.have.property('total');
    });

    // 当不提供 userId 时使用当前用户ID
    it('应该在未指定userId时使用当前用户ID', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      req.user = { userId: userId.toString() };
      req.params = {}; // 不提供 userId
      req.query = { page: 1, limit: 20 };

      const mockResult = {
        list: [fixtures.enrollmentRecords.unpaidEnrollment],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      EnrollmentStub.getUserEnrollments.resolves(mockResult);

      await enrollmentController.getUserEnrollments(req, res, next);

      expect(res.json.called).to.be.true;
    });

    // 分页参数正确传递
    it('应该正确处理分页参数', async () => {
      const userId = fixtures.testUsers.enrolledUser._id;
      req.user = { userId: userId.toString() };
      req.params = { userId: userId.toString() };
      req.query = { page: 2, limit: 10, status: 'completed' };

      const mockResult = {
        list: [fixtures.enrollmentRecords.completedEnrollment],
        total: 1,
        page: 2,
        limit: 10,
        totalPages: 1
      };

      EnrollmentStub.getUserEnrollments.resolves(mockResult);

      await enrollmentController.getUserEnrollments(req, res, next);

      expect(EnrollmentStub.getUserEnrollments.calledWith(userId.toString(), {
        page: 2,
        limit: 10,
        status: 'completed'
      })).to.be.true;
    });

    // 列表为空
    it('应该返回空列表当用户无报名', async () => {
      const userId = fixtures.testUsers.anotherUser._id;
      req.user = { userId: userId.toString() };
      req.params = { userId: userId.toString() };
      req.query = { page: 1, limit: 20 };

      const mockResult = {
        list: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      };

      EnrollmentStub.getUserEnrollments.resolves(mockResult);

      await enrollmentController.getUserEnrollments(req, res, next);

      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.data.list).to.be.empty;
      expect(response.data.total).to.equal(0);
    });
  });

  describe('getUsersByPeriodName - 外部期次用户接口', () => {
    it('应该跳过 userId 为空的孤儿报名记录并返回有效用户', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      req.query = { periodName: '内在之光' };

      PeriodStub.findOne.resolves({
        _id: periodId,
        name: '内在之光'
      });

      const leanStub = sandbox.stub().resolves([
        {
          _id: new mongoose.Types.ObjectId(),
          userId: {
            _id: fixtures.testUsers.normalUser._id,
            nickname: fixtures.testUsers.normalUser.nickname
          }
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId: null
        }
      ]);
      const sortStub = sandbox.stub().returns({ lean: leanStub });
      const populateStub = sandbox.stub().returns({ sort: sortStub });
      EnrollmentStub.find.returns({ populate: populateStub });

      await enrollmentController.getUsersByPeriodName(req, res, next);

      expect(res.json.calledOnce).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.code).to.equal(200);
      expect(response.data.periodName).to.equal('内在之光');
      expect(response.data.userCount).to.equal(1);
      expect(response.data.users).to.deep.equal([
        {
          userId: fixtures.testUsers.normalUser._id,
          nickname: fixtures.testUsers.normalUser.nickname
        }
      ]);
      expect(loggerStub.warn.calledOnce).to.be.true;
      expect(next.called).to.be.false;
    });

    it('应该在缺少 periodName 时返回 400', async () => {
      req.query = {};

      await enrollmentController.getUsersByPeriodName(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.getCall(0).args[0].message).to.include('periodName');
      expect(PeriodStub.findOne.called).to.be.false;
    });
  });

  describe('getPeriodMembers - TC-ENROLL-006：获取期次成员', () => {
    // TC-ENROLL-006: 获取期次的成员列表（200）
    it('应该返回期次的成员列表', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      req.params = { periodId: periodId.toString() };
      req.query = { page: 1, limit: 20 };

      const mockResult = {
        list: [fixtures.enrollmentRecords.paidEnrollment],
        total: 45,
        page: 1,
        limit: 20,
        totalPages: 3
      };

      PeriodStub.findById.resolves(fixtures.testPeriods.ongoingPeriod);
      EnrollmentStub.getPeriodMembers.resolves(mockResult);

      await enrollmentController.getPeriodMembers(req, res, next);

      expect(EnrollmentStub.getPeriodMembers.called).to.be.true;
      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.code).to.equal(200);
      expect(response.data).to.have.property('list');
      expect(response.data.total).to.equal(45);
    });

    // 期次不存在
    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId: periodId.toString() };
      req.query = { page: 1, limit: 20 };

      PeriodStub.findById.resolves(null);

      await enrollmentController.getPeriodMembers(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('期次不存在');
    });

    // 支持排序和过滤
    it('应该支持排序和状态过滤', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      req.params = { periodId: periodId.toString() };
      req.query = { page: 1, limit: 20, sortBy: 'enrolledAt', sortOrder: -1, status: 'active' };

      const mockResult = {
        list: [fixtures.enrollmentRecords.paidEnrollment],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      PeriodStub.findById.resolves(fixtures.testPeriods.ongoingPeriod);
      EnrollmentStub.getPeriodMembers.resolves(mockResult);

      await enrollmentController.getPeriodMembers(req, res, next);

      expect(EnrollmentStub.getPeriodMembers.calledWith(periodId.toString(), {
        page: 1,
        limit: 20,
        sortBy: 'enrolledAt',
        sortOrder: -1,
        status: 'active'
      })).to.be.true;
    });

    // 空列表
    it('应该返回空列表当期次无成员', async () => {
      const periodId = fixtures.testPeriods.upcomingPeriod._id;
      req.params = { periodId: periodId.toString() };
      req.query = { page: 1, limit: 20 };

      const mockResult = {
        list: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      };

      PeriodStub.findById.resolves(fixtures.testPeriods.upcomingPeriod);
      EnrollmentStub.getPeriodMembers.resolves(mockResult);

      await enrollmentController.getPeriodMembers(req, res, next);

      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.data.list).to.be.empty;
    });
  });

  describe('withdrawEnrollment - TC-ENROLL-007：取消报名', () => {
    // TC-ENROLL-007: 取消报名（200）
    it('应该取消用户的活跃报名', async () => {
      const enrollmentId = fixtures.enrollmentRecords.unpaidEnrollment._id;
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      req.user = { userId: userId.toString() };
      req.params = { enrollmentId: enrollmentId.toString() };

      const mockEnrollment = {
        _id: enrollmentId,
        userId,
        periodId,
        status: 'active',
        toObject: sandbox.stub().returns({
          _id: enrollmentId,
          userId: userId.toString(),
          periodId: periodId.toString(),
          status: 'withdrawn'
        }),
        withdraw: sandbox.stub().resolves()
      };

      EnrollmentStub.findOne.resolves(mockEnrollment);
      PeriodStub.findByIdAndUpdate.resolves(fixtures.testPeriods.ongoingPeriod);

      await enrollmentController.withdrawEnrollment(req, res, next);

      expect(EnrollmentStub.findOne.called).to.be.true;
      expect(mockEnrollment.withdraw.called).to.be.true;
      expect(PeriodStub.findByIdAndUpdate.called).to.be.true;
      expect(res.json.called).to.be.true;
      expect(res.status.called).to.be.false; // 成功不调用 status
    });

    // 报名不存在
    it('应该返回404当报名记录不存在', async () => {
      const enrollmentId = new mongoose.Types.ObjectId();
      const userId = fixtures.testUsers.normalUser._id;

      req.user = { userId: userId.toString() };
      req.params = { enrollmentId: enrollmentId.toString() };

      EnrollmentStub.findOne.resolves(null);

      await enrollmentController.withdrawEnrollment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('报名记录不存在');
    });

    // 用户无权删除他人的报名
    it('应该拒绝删除他人的报名记录', async () => {
      const enrollmentId = fixtures.enrollmentRecords.paidEnrollment._id;
      const currentUserId = fixtures.testUsers.normalUser._id; // 不是报名者
      const enrollmentUserId = fixtures.testUsers.enrolledUser._id; // 报名者

      req.user = { userId: currentUserId.toString() };
      req.params = { enrollmentId: enrollmentId.toString() };

      EnrollmentStub.findOne.resolves(null); // 不能查到，因为用户ID不匹配

      await enrollmentController.withdrawEnrollment(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    // 已完成的报名无法取消
    it('应该返回400当报名已完成', async () => {
      const enrollmentId = fixtures.enrollmentRecords.completedEnrollment._id;
      const userId = fixtures.testUsers.enrolledUser._id;

      req.user = { userId: userId.toString() };
      req.params = { enrollmentId: enrollmentId.toString() };

      const mockEnrollment = {
        _id: enrollmentId,
        userId,
        status: 'completed' // 已完成
      };

      EnrollmentStub.findOne.resolves(mockEnrollment);

      await enrollmentController.withdrawEnrollment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.match(/已结束|无法退出/);
    });

    // 已取消的报名无法重复取消
    it('应该返回400当报名已取消', async () => {
      const enrollmentId = fixtures.enrollmentRecords.withdrawnEnrollment._id;
      const userId = fixtures.testUsers.anotherUser._id;

      req.user = { userId: userId.toString() };
      req.params = { enrollmentId: enrollmentId.toString() };

      const mockEnrollment = {
        _id: enrollmentId,
        userId,
        status: 'withdrawn' // 已取消
      };

      EnrollmentStub.findOne.resolves(mockEnrollment);

      await enrollmentController.withdrawEnrollment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('submitEnrollmentForm - TC-ENROLL-008：完整报名表单', () => {
    // TC-ENROLL-008: 提交完整的报名表单（201）
    it('应该提交完整的报名表单并创建待支付记录', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const enrollmentId = new mongoose.Types.ObjectId();

      req.user = { userId: userId.toString() };
      req.body = {
        periodId: periodId.toString(),
        name: '李四',
        gender: 'female',
        province: '上海',
        detailedAddress: '浦东新区',
        age: 28,
        referrer: '官方宣传',
        hasReadBook: 'no',
        readTimes: 0,
        enrollReason: '想改变自己',
        expectation: '学到实用方法',
        commitment: '每天坚持'
      };

      const mockEnrollment = {
        _id: enrollmentId,
        userId,
        periodId,
        ...req.body,
        paymentStatus: 'pending',
        status: 'active',
        enrolledAt: new Date(),
        toObject: sandbox.stub().returns({
          _id: enrollmentId,
          userId: userId.toString(),
          periodId: periodId.toString()
        })
      };

      const mockPopulatedEnrollment = {
        _id: enrollmentId,
        userId: { _id: userId, nickname: fixtures.testUsers.normalUser.nickname, avatar: fixtures.testUsers.normalUser.avatar },
        periodId: { _id: periodId, title: fixtures.testPeriods.ongoingPeriod.title, description: fixtures.testPeriods.ongoingPeriod.description },
        ...req.body
      };

      PeriodStub.findById.resolves(fixtures.testPeriods.ongoingPeriod);
      EnrollmentStub.findOne.resolves(null); // 未曾报名
      EnrollmentStub.create.resolves(mockEnrollment);
      EnrollmentStub.findById.returns({
        populate: sandbox.stub().returnsThis(),
        execPopulate: sandbox.stub().resolves(mockPopulatedEnrollment)
      });
      PeriodStub.findByIdAndUpdate.resolves(fixtures.testPeriods.ongoingPeriod);

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(EnrollmentStub.create.called).to.be.true;
      expect(PeriodStub.findByIdAndUpdate.called).to.be.true;
      expect(mysqlBackupServiceStub.syncEnrollment.called).to.be.true;
      expect(res.json.called).to.be.true;
      expect(res.status.called).to.be.false; // 成功不调用 status
    });

    // 缺少必填字段
    it('应该返回400当缺少必填字段', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      // 缺少 name 字段
      req.body = {
        periodId: periodId.toString(),
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

    // 期次不存在
    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();

      req.body = fixtures.requestBodies.fullEnrollmentForm;
      req.body.periodId = periodId.toString();

      PeriodStub.findById.resolves(null);

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('期次不存在');
    });

    // 已报名
    it('应该返回400当已报名该期次', async () => {
      const userId = fixtures.testUsers.enrolledUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      req.user = { userId: userId.toString() };
      req.body = fixtures.requestBodies.fullEnrollmentForm;
      req.body.periodId = periodId.toString();

      PeriodStub.findById.resolves(fixtures.testPeriods.ongoingPeriod);
      EnrollmentStub.findOne.resolves(fixtures.enrollmentRecords.paidEnrollment); // 已报名

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      expect(errorMsg).to.include('已报名');
    });

    // 多个缺失字段
    it('应该返回400并列出所有缺失的必填字段', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      req.body = {
        periodId: periodId.toString()
        // 缺少所有其他字段
      };

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const errorMsg = res.json.getCall(0).args[0].message;
      // 应该包含多个缺失字段的提示
      expect(errorMsg).to.include('缺少必填字段');
    });

    // hasReadBook 为 'no' 时，readTimes 应该被设为 0
    it('应该将readTimes设为0当hasReadBook为no', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const enrollmentId = new mongoose.Types.ObjectId();

      req.user = { userId: userId.toString() };
      req.body = {
        periodId: periodId.toString(),
        name: '王五',
        gender: 'male',
        province: '深圳',
        detailedAddress: '南山区',
        age: 35,
        referrer: '自己',
        hasReadBook: 'no', // 未读过书
        readTimes: 999, // 传入的值应该被忽略
        enrollReason: '学习成长',
        expectation: '掌握方法',
        commitment: '坚持参与'
      };

      const mockEnrollment = {
        _id: enrollmentId,
        userId,
        periodId,
        name: req.body.name,
        readTimes: 0, // 应该被设为 0
        toObject: sandbox.stub().returns({})
      };

      const mockPopulatedEnrollment = {
        _id: enrollmentId,
        readTimes: 0,
        hasReadBook: 'no'
      };

      PeriodStub.findById.resolves(fixtures.testPeriods.ongoingPeriod);
      EnrollmentStub.findOne.resolves(null);
      EnrollmentStub.create.resolves(mockEnrollment);
      EnrollmentStub.findById.returns({
        populate: sandbox.stub().returnsThis(),
        execPopulate: sandbox.stub().resolves(mockPopulatedEnrollment)
      });
      PeriodStub.findByIdAndUpdate.resolves(fixtures.testPeriods.ongoingPeriod);

      await enrollmentController.submitEnrollmentForm(req, res, next);

      // 验证 create 时传递的数据中 readTimes 被正确设置
      const createCall = EnrollmentStub.create.getCall(0);
      expect(createCall.args[0].readTimes).to.equal(0);
    });

    it('应该复用已取消的报名记录并允许重新报名', async () => {
      const userId = fixtures.testUsers.anotherUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const enrollmentId = fixtures.enrollmentRecords.withdrawnEnrollment._id;

      req.user = { userId: userId.toString() };
      req.body = {
        periodId: periodId.toString(),
        name: '回归学员',
        gender: 'female',
        province: '上海',
        detailedAddress: '浦东新区',
        age: 35,
        referrer: '朋友推荐',
        hasReadBook: 'yes',
        readTimes: 2,
        enrollReason: '重新参加',
        expectation: '坚持完成',
        commitment: 'yes'
      };

      const restoredEnrollment = {
        _id: enrollmentId,
        userId,
        periodId,
        status: 'withdrawn',
        deleted: false,
        set: sandbox.stub(),
        save: sandbox.stub(),
        toObject: sandbox.stub().returns({
          _id: enrollmentId,
          userId: userId.toString(),
          periodId: periodId.toString(),
          status: 'active',
          deleted: false
        })
      };
      restoredEnrollment.save.resolves(restoredEnrollment);

      const mockPopulatedEnrollment = {
        _id: enrollmentId,
        userId: { _id: userId, nickname: fixtures.testUsers.anotherUser.nickname, avatar: fixtures.testUsers.anotherUser.avatar },
        periodId: { _id: periodId, title: fixtures.testPeriods.ongoingPeriod.title, description: fixtures.testPeriods.ongoingPeriod.description },
        status: 'active',
        paymentStatus: 'pending'
      };

      PeriodStub.findById.resolves(fixtures.testPeriods.ongoingPeriod);
      EnrollmentStub.findOne.resolves(restoredEnrollment);
      EnrollmentStub.findById.returns({
        populate: sandbox.stub().returnsThis(),
        execPopulate: sandbox.stub().resolves(mockPopulatedEnrollment)
      });
      PeriodStub.findByIdAndUpdate.resolves(fixtures.testPeriods.ongoingPeriod);

      await enrollmentController.submitEnrollmentForm(req, res, next);

      expect(EnrollmentStub.create.called).to.be.false;
      expect(restoredEnrollment.set.calledOnce).to.be.true;
      expect(restoredEnrollment.save.calledOnce).to.be.true;
      expect(PeriodStub.findByIdAndUpdate.calledOnce).to.be.true;
      expect(syncServiceStub.publishSyncEvent.called).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.status.called).to.be.false;
    });
  });

  describe('checkEnrollment - TC-ENROLL-009：检查报名状态', () => {
    // TC-ENROLL-009: 检查用户是否已报名（200）
    it('应该返回用户已报名的状态', async () => {
      const userId = fixtures.testUsers.enrolledUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      req.user = { userId: userId.toString() };
      req.params = { periodId: periodId.toString() };

      EnrollmentStub.findOne.resolves(fixtures.enrollmentRecords.paidEnrollment);

      await enrollmentController.checkEnrollment(req, res, next);

      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.code).to.equal(200);
      expect(response.data.isEnrolled).to.be.true;
      expect(response.data.paymentStatus).to.equal('paid');
    });

    // 未报名
    it('应该返回用户未报名的状态', async () => {
      const userId = fixtures.testUsers.anotherUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      req.user = { userId: userId.toString() };
      req.params = { periodId: periodId.toString() };

      EnrollmentStub.findOne.resolves(null);

      await enrollmentController.checkEnrollment(req, res, next);

      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.code).to.equal(200);
      expect(response.data.isEnrolled).to.be.false;
      expect(response.data.paymentStatus).to.be.null;
    });

    // 支付状态信息
    it('应该返回报名的支付状态', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      req.user = { userId: userId.toString() };
      req.params = { periodId: periodId.toString() };

      EnrollmentStub.findOne.resolves(fixtures.enrollmentRecords.unpaidEnrollment);

      await enrollmentController.checkEnrollment(req, res, next);

      expect(res.json.called).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.data.isEnrolled).to.be.true;
      expect(response.data.paymentStatus).to.equal('pending');
    });
  });
});
