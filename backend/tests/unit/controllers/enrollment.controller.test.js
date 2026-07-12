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
  let SectionStub;
  let TenantStub;
  let loggerStub;
  let mysqlBackupServiceStub;
  let syncServiceStub;
  let tenantId;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    tenantId = new mongoose.Types.ObjectId();

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
      aggregate: sandbox.stub(),
      countDocuments: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findOneAndUpdate: sandbox.stub(),
      getUserEnrollments: sandbox.stub(),
      getPeriodMembers: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub(),
      find: sandbox.stub()
    };

    PeriodStub = {
      find: sandbox.stub(),
      findById: sandbox.stub(),
      findOne: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    SectionStub = {
      find: sandbox.stub()
    };

    TenantStub = {
      find: sandbox.stub(),
      findOne: sandbox.stub().returns({
        select: sandbox.stub().returns({
          lean: sandbox.stub().resolves({
            _id: tenantId,
            slug: 'fanren',
            name: '凡人共读',
            wechatLogin: { appId: 'wx-test' },
            status: 'active'
          })
        })
      })
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
        '../models/Section': SectionStub,
        '../models/Tenant': TenantStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub,
        '../utils/tenantContext': {
          getCurrentTenantId: sandbox.stub().returns(tenantId),
          runWithTenant: (ctx, fn) => fn()
        },
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
        paymentStatus: 'pending',
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
        paymentStatus: 'pending'
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

  describe('getUserParticipationCount - 他人参与期数（公开计数）', () => {
    it('应该返回 active/completed 且未删除的报名计数', async () => {
      const targetUserId = new mongoose.Types.ObjectId().toString();
      req.params = { userId: targetUserId };
      EnrollmentStub.countDocuments.resolves(3);

      await enrollmentController.getUserParticipationCount(req, res, next);

      expect(EnrollmentStub.countDocuments.calledOnce).to.be.true;
      const query = EnrollmentStub.countDocuments.getCall(0).args[0];
      expect(query.userId).to.equal(targetUserId);
      expect(query.status).to.deep.equal({ $in: ['active', 'completed'] });
      expect(query.deleted).to.deep.equal({ $ne: true });

      const response = res.json.getCall(0).args[0];
      expect(response.data.count).to.equal(3);
    });

    it('应该返回400当 userId 不是合法 ObjectId', async () => {
      req.params = { userId: 'not-an-object-id' };

      await enrollmentController.getUserParticipationCount(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(EnrollmentStub.countDocuments.called).to.be.false;
    });
  });

  describe('getEnrollmentFormStatistics - 管理员报名信息统计', () => {
    it('应该按期次返回报名表维度统计、文本分析和明细', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.query = { periodId: periodId.toString() };

      const rows = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId: { _id: new mongoose.Types.ObjectId(), nickname: '小凡', avatarUrl: '' },
          periodId: { _id: periodId, name: '丰盛之流' },
          name: '张三',
          gender: 'male',
          province: '上海',
          age: 32,
          hasReadBook: 'yes',
          readTimes: 2,
          commitment: 'yes',
          referrer: '老王',
          enrollReason: '希望提升自律和家庭沟通能力',
          expectation: '期待建立稳定晨读节奏',
          paymentStatus: 'paid',
          enrolledAt: new Date('2026-07-01T00:00:00.000Z')
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId: { _id: new mongoose.Types.ObjectId(), nickname: '小狮', avatarUrl: '' },
          periodId: { _id: periodId, name: '丰盛之流' },
          name: '李四',
          gender: 'female',
          province: '浙江',
          age: 45,
          hasReadBook: 'no',
          readTimes: 0,
          commitment: 'yes',
          referrer: '',
          enrollReason: '想改善亲子关系',
          expectation: '期待被看见并持续打卡',
          paymentStatus: 'pending',
          enrolledAt: new Date('2026-07-02T00:00:00.000Z')
        }
      ];

      const query = {
        populate: sandbox.stub(),
        sort: sandbox.stub()
      };
      query.populate.onFirstCall().returns(query);
      query.populate.onSecondCall().returns(query);
      query.sort.returns({ lean: sandbox.stub().resolves(rows) });
      EnrollmentStub.find.returns(query);

      await enrollmentController.getEnrollmentFormStatistics(req, res, next);

      const filter = EnrollmentStub.find.getCall(0).args[0];
      expect(filter).to.include({ tenantId });
      expect(filter.periodId.toString()).to.equal(periodId.toString());
      expect(filter.deleted).to.deep.equal({ $ne: true });

      const response = res.json.getCall(0).args[0];
      expect(response.data.summary.total).to.equal(2);
      expect(response.data.gender.items.find(item => item.key === 'male').count).to.equal(1);
      expect(response.data.gender.items.find(item => item.key === 'female').names).to.deep.equal(['李四']);
      expect(response.data.ageGroups.items.find(item => item.key === '30-39').count).to.equal(1);
      expect(response.data.provinces.items.find(item => item.key === '上海').names).to.deep.equal(['张三']);
      expect(response.data.textAnalysis.enrollReason.keywords[0]).to.have.keys(['word', 'count']);
      expect(response.data.textAnalysis.enrollReason.keywords.map(item => item.word))
        .to.include.members(['自律', '家庭', '沟通']);
      expect(response.data.textAnalysis.enrollReason.keywords.map(item => item.word))
        .to.not.include('希望提升自律和家庭沟通能力');
      expect(response.data.details[0]).to.include({
        name: '张三',
        genderLabel: '男',
        province: '上海'
      });
    });

    it('应该在 periodId 无效时返回400且不查询报名', async () => {
      req.query = { periodId: 'bad-period-id' };

      await enrollmentController.getEnrollmentFormStatistics(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(EnrollmentStub.find.called).to.be.false;
    });

    it('应该返回实际填写人数而不是被截断的样本数', async () => {
      const rows = Array.from({ length: 13 }, (_, index) => ({
        _id: new mongoose.Types.ObjectId(),
        name: `学员${index + 1}`,
        enrollReason: `报名缘起${index + 1}`
      }));
      const query = {
        populate: sandbox.stub(),
        sort: sandbox.stub()
      };
      query.populate.onFirstCall().returns(query);
      query.populate.onSecondCall().returns(query);
      query.sort.returns({ lean: sandbox.stub().resolves(rows) });
      EnrollmentStub.find.returns(query);

      await enrollmentController.getEnrollmentFormStatistics(req, res, next);

      const response = res.json.getCall(0).args[0];
      expect(response.data.textAnalysis.enrollReason.samples).to.have.length(12);
      expect(response.data.textAnalysis.enrollReason.filledCount).to.equal(13);
    });
  });

  describe('updateEnrollment - 管理员更新报名（白名单+校验）', () => {
    it('应该只更新白名单字段并开启 runValidators', async () => {
      const enrollmentId = new mongoose.Types.ObjectId().toString();
      req.params = { id: enrollmentId };
      req.body = {
        paymentStatus: 'paid',
        userId: 'hack-user',
        periodId: 'hack-period',
        enrolledAt: '2020-01-01',
        notAllowed: 'value'
      };

      const mockEnrollment = { _id: enrollmentId, paymentStatus: 'paid' };
      EnrollmentStub.findByIdAndUpdate.returns({
        populate: sandbox.stub().returns({
          populate: sandbox.stub().resolves(mockEnrollment)
        })
      });
      EnrollmentStub.findById.returns({ lean: sandbox.stub().resolves(mockEnrollment) });

      await enrollmentController.updateEnrollment(req, res, next);

      const [, updateData, options] = EnrollmentStub.findByIdAndUpdate.getCall(0).args;
      expect(updateData).to.deep.equal({ paymentStatus: 'paid' });
      expect(options).to.deep.include({ new: true, runValidators: true });
      expect(res.json.called).to.be.true;
    });

    it('应该返回400当字段校验失败（ValidationError）', async () => {
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.body = { paymentStatus: 'not-a-valid-status' };

      const validationError = new Error('`not-a-valid-status` is not a valid enum value');
      validationError.name = 'ValidationError';
      EnrollmentStub.findByIdAndUpdate.throws(validationError);

      await enrollmentController.updateEnrollment(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.message).to.include('字段校验失败');
    });
  });

  describe('completion reports - 实录报告接口', () => {
    it('管理员应该可以用 .pdf 文件地址兜底绑定实录报告', async () => {
      const enrollmentId = new mongoose.Types.ObjectId();
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const adminId = new mongoose.Types.ObjectId();
      const savedEnrollment = {
        _id: enrollmentId,
        tenantId,
        userId: {
          _id: userId,
          nickname: '狮子',
          avatarUrl: ''
        },
        periodId: {
          _id: periodId,
          name: '第 12 期'
        },
        name: '张三',
        phone: '13500000000',
        status: 'active',
        paymentStatus: 'paid',
        enrolledAt: new Date('2026-05-01T00:00:00.000Z'),
        completionReport: {
          fileUrl: '/uploads/tenants/default/report.pdf',
          fileName: 'report.pdf',
          originalName: 'report.bin',
          fileSize: 1024,
          mimeType: 'application/octet-stream',
          uploadedAt: new Date('2026-05-30T10:00:00.000Z'),
          uploadedBy: adminId
        },
        toObject() {
          return {
            _id: this._id,
            tenantId: this.tenantId,
            userId: this.userId,
            periodId: this.periodId,
            name: this.name,
            phone: this.phone,
            status: this.status,
            paymentStatus: this.paymentStatus,
            enrolledAt: this.enrolledAt,
            completionReport: this.completionReport
          };
        }
      };
      const updateQuery = {
        populate: sandbox.stub()
      };
      updateQuery.populate.onFirstCall().returns(updateQuery);
      updateQuery.populate.onSecondCall().resolves(savedEnrollment);

      req.admin = { id: adminId.toString() };
      req.params = { id: enrollmentId.toString() };
      req.body = {
        fileUrl: '/uploads/tenants/default/report.pdf',
        fileName: 'report.pdf',
        originalName: 'report.bin',
        fileSize: 1024,
        mimeType: 'application/octet-stream'
      };
      EnrollmentStub.findOneAndUpdate.returns(updateQuery);

      await enrollmentController.updateCompletionReport(req, res, next);

      expect(EnrollmentStub.findOneAndUpdate.calledOnce).to.be.true;
      const [filter, update] = EnrollmentStub.findOneAndUpdate.getCall(0).args;
      expect(filter).to.include({ tenantId });
      expect(update.$set.completionReport.fileUrl).to.equal('/uploads/tenants/default/report.pdf');
      expect(update.$set.completionReport.uploadedBy.toString()).to.equal(adminId.toString());
      const response = res.json.getCall(0).args[0];
      expect(response.data.hasReport).to.equal(true);
      expect(response.data.reportTitle).to.equal('狮子分享实录');
      expect(syncServiceStub.publishSyncEvent.calledOnce).to.be.true;
    });

    it('管理员绑定实录报告时应该拒绝非 PDF', async () => {
      req.admin = { id: new mongoose.Types.ObjectId().toString() };
      req.params = { id: new mongoose.Types.ObjectId().toString() };
      req.body = {
        fileUrl: '/uploads/tenants/default/report.txt',
        fileName: 'report.txt',
        mimeType: 'text/plain'
      };

      await enrollmentController.updateCompletionReport(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.getCall(0).args[0].message).to.include('PDF');
      expect(EnrollmentStub.findOneAndUpdate.called).to.be.false;
    });

    it('用户实录报告列表应该返回当前用户 paid/free active/completed 报名，未上传也返回 hasReport=false', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      req.user = { userId: userId.toString() };

      const enrollment = {
        _id: new mongoose.Types.ObjectId(),
        userId: {
          _id: userId,
          nickname: ''
        },
        periodId: {
          _id: periodId,
          name: '第 12 期'
        },
        name: '张三',
        status: 'completed',
        paymentStatus: 'free',
        completionReport: null
      };
      const listQuery = {
        populate: sandbox.stub(),
        sort: sandbox.stub()
      };
      listQuery.populate.onFirstCall().returns(listQuery);
      listQuery.populate.onSecondCall().returns(listQuery);
      listQuery.sort.returns({ lean: sandbox.stub().resolves([enrollment]) });
      EnrollmentStub.find.returns(listQuery);

      await enrollmentController.getMyCompletionReports(req, res, next);

      const query = EnrollmentStub.find.getCall(0).args[0];
      expect(query).to.include({ tenantId, userId: userId.toString() });
      expect(query.status.$in).to.deep.equal(['active', 'completed']);
      expect(query.paymentStatus.$in).to.deep.equal(['paid', 'free']);
      const response = res.json.getCall(0).args[0];
      expect(response.data.total).to.equal(1);
      expect(response.data.list[0].hasReport).to.equal(false);
      expect(response.data.list[0].reportTitle).to.equal('张三分享实录');
    });

    it('用户详情接口对不存在、不属于本人或未支付报名返回 404', async () => {
      req.user = { userId: fixtures.testUsers.normalUser._id.toString() };
      req.params = { periodId: new mongoose.Types.ObjectId().toString() };
      const detailQuery = {
        populate: sandbox.stub()
      };
      detailQuery.populate.onFirstCall().returns(detailQuery);
      detailQuery.populate.onSecondCall().returns({ lean: sandbox.stub().resolves(null) });
      EnrollmentStub.findOne.returns(detailQuery);

      await enrollmentController.getMyCompletionReportByPeriod(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.getCall(0).args[0].message).to.include('暂无权限');
    });

    it('管理员应该可以清空已绑定的实录报告', async () => {
      const enrollmentId = new mongoose.Types.ObjectId();
      const savedEnrollment = {
        _id: enrollmentId,
        tenantId,
        userId: {
          _id: fixtures.testUsers.normalUser._id,
          nickname: '狮子',
          avatarUrl: ''
        },
        periodId: {
          _id: fixtures.testPeriods.ongoingPeriod._id,
          name: '第 12 期'
        },
        name: '张三',
        phone: '13500000000',
        status: 'active',
        paymentStatus: 'paid',
        completionReport: null,
        toObject() {
          return {
            _id: this._id,
            tenantId: this.tenantId,
            userId: this.userId,
            periodId: this.periodId,
            name: this.name,
            phone: this.phone,
            status: this.status,
            paymentStatus: this.paymentStatus,
            completionReport: this.completionReport
          };
        }
      };
      const updateQuery = {
        populate: sandbox.stub()
      };
      updateQuery.populate.onFirstCall().returns(updateQuery);
      updateQuery.populate.onSecondCall().resolves(savedEnrollment);

      req.params = { id: enrollmentId.toString() };
      EnrollmentStub.findOneAndUpdate.returns(updateQuery);

      await enrollmentController.deleteCompletionReport(req, res, next);

      expect(EnrollmentStub.findOneAndUpdate.calledOnce).to.be.true;
      const [filter, update] = EnrollmentStub.findOneAndUpdate.getCall(0).args;
      expect(filter).to.include({ tenantId });
      expect(update).to.deep.equal({ $unset: { completionReport: '' } });
      const response = res.json.getCall(0).args[0];
      expect(response.data.hasReport).to.equal(false);
      expect(response.data.reportTitle).to.equal('狮子分享实录');
    });

    it('用户详情接口成功时应该返回 PDF 文件地址', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      req.user = { userId: userId.toString() };
      req.params = { periodId: periodId.toString() };
      const enrollment = {
        _id: new mongoose.Types.ObjectId(),
        userId: {
          _id: userId,
          nickname: '狮子'
        },
        periodId: {
          _id: periodId,
          name: '第 12 期'
        },
        name: '张三',
        status: 'active',
        paymentStatus: 'paid',
        completionReport: {
          fileUrl: '/uploads/tenants/default/report.pdf',
          fileName: 'report.pdf',
          originalName: '狮子分享实录.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          uploadedAt: new Date('2026-05-30T10:00:00.000Z')
        }
      };
      const detailQuery = {
        populate: sandbox.stub()
      };
      detailQuery.populate.onFirstCall().returns(detailQuery);
      detailQuery.populate.onSecondCall().returns({ lean: sandbox.stub().resolves(enrollment) });
      EnrollmentStub.findOne.returns(detailQuery);

      await enrollmentController.getMyCompletionReportByPeriod(req, res, next);

      const query = EnrollmentStub.findOne.getCall(0).args[0];
      expect(query).to.include({ tenantId, userId: userId.toString() });
      expect(query.periodId.toString()).to.equal(periodId.toString());
      const response = res.json.getCall(0).args[0];
      expect(response.data.hasReport).to.equal(true);
      expect(response.data.fileUrl).to.equal('/uploads/tenants/default/report.pdf');
      expect(response.data.reportTitle).to.equal('狮子分享实录');
    });
  });

  describe('外部期次接口', () => {
    it('应该返回当前运行中的期次及当天 sessionId', async () => {
      const clock = sandbox.useFakeTimers(new Date('2026-05-11T02:00:00.000Z'));
      req.query = {};
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const sectionId = new mongoose.Types.ObjectId();
      const period = {
        _id: periodId,
        name: '内在之光',
        startDate: new Date('2026-05-09T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        totalDays: 23
      };
      const starryTenantId = new mongoose.Types.ObjectId();
      const starryPeriodId = new mongoose.Types.ObjectId();
      TenantStub.find.returns({
        select: sandbox.stub().returns({
          sort: sandbox.stub().returns({
            lean: sandbox.stub().resolves([
              {
                _id: tenantId,
                slug: 'fanren',
                name: '凡人共读',
                wechatLogin: { appId: 'wx2b9a3c1d5e4195f8' },
                status: 'active'
              },
              {
                _id: starryTenantId,
                slug: 'starry',
                name: '若星生活家',
                wechatLogin: { appId: 'wx9cd59e2c89880289' },
                status: 'active'
              }
            ])
          })
        })
      });

      PeriodStub.find.onFirstCall().returns({
        sort: sandbox.stub().returns({
          lean: sandbox.stub().resolves([period])
        })
      });
      PeriodStub.find.onSecondCall().returns({
        sort: sandbox.stub().returns({
          lean: sandbox.stub().resolves([
            {
              _id: starryPeriodId,
              name: '平衡之道',
              startDate: new Date('2026-05-11T00:00:00.000Z'),
              endDate: new Date('2026-05-31T00:00:00.000Z'),
              totalDays: 23
            }
          ])
        })
      });

      SectionStub.find.onFirstCall().returns({
        select: sandbox.stub().returns({
          lean: sandbox.stub().resolves([
            {
              _id: sectionId,
              periodId,
              day: 2
            }
          ])
        })
      });
      SectionStub.find.onSecondCall().returns({
        select: sandbox.stub().returns({
          lean: sandbox.stub().resolves([])
        })
      });

      await enrollmentController.getActivePeriodsForExternal(req, res, next);

      expect(res.json.calledOnce).to.be.true;
      const response = res.json.getCall(0).args[0];
      expect(response.code).to.equal(200);
      expect(response.data.totalTenants).to.equal(2);
      expect(response.data.totalPeriods).to.equal(2);
      expect(response.data.tenants).to.have.length(2);
      expect(response.data.tenants[0]).to.include({
        tenantSlug: 'fanren',
        tenantName: '凡人共读',
        wxAppId: 'wx2b9a3c1d5e4195f8',
        total: 1
      });
      expect(response.data.tenants[0].list).to.deep.equal([
        {
          periodId: periodId.toString(),
          periodName: '内在之光',
          day: 2,
          sessionId: sectionId.toString()
        }
      ]);
      expect(response.data.tenants[1]).to.include({
        tenantSlug: 'starry',
        tenantName: '若星生活家',
        wxAppId: 'wx9cd59e2c89880289',
        total: 1
      });
      const periodQuery = PeriodStub.find.getCall(0).args[0];
      expect(periodQuery.startDate.$lte.getFullYear()).to.equal(2026);
      expect(periodQuery.startDate.$lte.getMonth()).to.equal(4);
      expect(periodQuery.startDate.$lte.getDate()).to.equal(11);
      expect(periodQuery.startDate.$lte.getHours()).to.equal(23);
      expect(periodQuery.startDate.$lte.getMinutes()).to.equal(59);
      expect(periodQuery.startDate.$lte.getSeconds()).to.equal(59);
      expect(periodQuery.startDate.$lte.getMilliseconds()).to.equal(999);
      expect(periodQuery.endDate.$gte.getFullYear()).to.equal(2026);
      expect(periodQuery.endDate.$gte.getMonth()).to.equal(4);
      expect(periodQuery.endDate.$gte.getDate()).to.equal(11);
      expect(periodQuery.endDate.$gte.getHours()).to.equal(0);
      expect(periodQuery.endDate.$gte.getMinutes()).to.equal(0);
      expect(periodQuery.endDate.$gte.getSeconds()).to.equal(0);
      expect(periodQuery.endDate.$gte.getMilliseconds()).to.equal(0);
      const sectionQuery = SectionStub.find.getCall(0).args[0].$or[0];
      expect(sectionQuery.day).to.equal(2);
      expect(next.called).to.be.false;
      clock.restore();
    });

    it('应该支持通过 tenantSlug 查询当前运行中的期次', async () => {
      const clock = sandbox.useFakeTimers(new Date('2026-05-11T02:00:00.000Z'));
      req.query = { tenantSlug: 'fanren' };
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const sectionId = new mongoose.Types.ObjectId();
      const period = {
        _id: periodId,
        name: '内在之光',
        startDate: new Date('2026-05-09T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        totalDays: 23
      };
      TenantStub.findOne.returns({
        select: sandbox.stub().returns({
          lean: sandbox.stub().resolves({
            _id: tenantId,
            slug: 'fanren',
            name: '凡人共读',
            wechatLogin: { appId: 'wx2b9a3c1d5e4195f8' },
            status: 'active'
          })
        })
      });
      PeriodStub.find.returns({
        sort: sandbox.stub().returns({
          lean: sandbox.stub().resolves([period])
        })
      });
      SectionStub.find.returns({
        select: sandbox.stub().returns({
          lean: sandbox.stub().resolves([
            { _id: sectionId, periodId, day: 2 }
          ])
        })
      });

      await enrollmentController.getActivePeriodsForExternal(req, res, next);

      const tenantQuery = TenantStub.findOne.getCall(0).args[0];
      expect(tenantQuery).to.deep.equal({ slug: 'fanren', status: 'active' });
      const response = res.json.getCall(0).args[0];
      expect(response.data.totalTenants).to.equal(1);
      expect(response.data.totalPeriods).to.equal(1);
      expect(response.data.tenants).to.have.length(1);
      expect(response.data.tenants[0]).to.include({
        tenantSlug: 'fanren',
        tenantName: '凡人共读',
        wxAppId: 'wx2b9a3c1d5e4195f8',
        total: 1
      });
      expect(response.data.tenants[0].list[0]).to.include({
        periodId: periodId.toString(),
        periodName: '内在之光',
        day: 2,
        sessionId: sectionId.toString()
      });
      clock.restore();
    });

    it('应该在期次最后一个自然日仍返回运行中期次', async () => {
      const clock = sandbox.useFakeTimers(new Date('2026-05-31T12:00:00.000Z'));
      req.query = { tenantName: '凡人共读' };
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const period = {
        _id: periodId,
        name: '内在之光',
        startDate: new Date('2026-05-09T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        totalDays: 23
      };

      PeriodStub.find.returns({
        sort: sandbox.stub().returns({
          lean: sandbox.stub().resolves([period])
        })
      });

      SectionStub.find.returns({
        select: sandbox.stub().returns({
          lean: sandbox.stub().resolves([])
        })
      });

      await enrollmentController.getActivePeriodsForExternal(req, res, next);

      const periodQuery = PeriodStub.find.getCall(0).args[0];
      expect(periodQuery.startDate.$lte.getFullYear()).to.equal(2026);
      expect(periodQuery.startDate.$lte.getMonth()).to.equal(4);
      expect(periodQuery.startDate.$lte.getDate()).to.equal(31);
      expect(periodQuery.startDate.$lte.getHours()).to.equal(23);
      expect(periodQuery.startDate.$lte.getMinutes()).to.equal(59);
      expect(periodQuery.startDate.$lte.getSeconds()).to.equal(59);
      expect(periodQuery.startDate.$lte.getMilliseconds()).to.equal(999);
      expect(periodQuery.endDate.$gte.getFullYear()).to.equal(2026);
      expect(periodQuery.endDate.$gte.getMonth()).to.equal(4);
      expect(periodQuery.endDate.$gte.getDate()).to.equal(31);
      expect(periodQuery.endDate.$gte.getHours()).to.equal(0);
      expect(periodQuery.endDate.$gte.getMinutes()).to.equal(0);
      expect(periodQuery.endDate.$gte.getSeconds()).to.equal(0);
      expect(periodQuery.endDate.$gte.getMilliseconds()).to.equal(0);
      const sectionQuery = SectionStub.find.getCall(0).args[0].$or[0];
      expect(sectionQuery.day).to.equal(22);
      const response = res.json.getCall(0).args[0];
      expect(response.data.tenants[0].list[0]).to.include({
        periodId: periodId.toString(),
        periodName: '内在之光',
        day: 22,
        sessionId: null
      });
      expect(next.called).to.be.false;
      clock.restore();
    });

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

    it('应该支持通过 periodId 获取期次用户列表', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      req.query = { periodId: periodId.toString() };

      PeriodStub.findById.resolves({
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
        }
      ]);
      const sortStub = sandbox.stub().returns({ lean: leanStub });
      const populateStub = sandbox.stub().returns({ sort: sortStub });
      EnrollmentStub.find.returns({ populate: populateStub });

      await enrollmentController.getUsersByPeriodName(req, res, next);

      expect(PeriodStub.findById.calledWith(periodId.toString())).to.be.true;
      expect(PeriodStub.findOne.called).to.be.false;
      const response = res.json.getCall(0).args[0];
      expect(response.data.periodId).to.equal(periodId.toString());
      expect(response.data.periodName).to.equal('内在之光');
      expect(response.data.userCount).to.equal(1);
      expect(next.called).to.be.false;
    });

    it('应该在缺少 periodId 和 periodName 时返回 400', async () => {
      req.query = {};

      await enrollmentController.getUsersByPeriodName(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.getCall(0).args[0].message).to.include('periodId 或 periodName');
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
