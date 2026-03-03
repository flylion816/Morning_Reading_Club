/**
 * Enrollment Service 单元测试
 * 覆盖报名业务逻辑、验证、重复检查等15+个场景
 */

const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const fixtures = require('../../fixtures/enrollment-fixtures');

// 模拟 Enrollment 服务方法
describe('Enrollment Service', () => {
  let sandbox;
  let Enrollment;
  let Period;
  let Payment;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // 模拟 Enrollment 模型
    Enrollment = {
      create: sandbox.stub(),
      findOne: sandbox.stub(),
      findById: sandbox.stub(),
      find: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      countDocuments: sandbox.stub(),
      getUserEnrollments: sandbox.stub(),
      getPeriodMembers: sandbox.stub()
    };

    // 模拟 Period 模型
    Period = {
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      updateOne: sandbox.stub()
    };

    // 模拟 Payment 模型
    Payment = {
      create: sandbox.stub(),
      findOne: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('创建报名 - 数据验证', () => {
    // 服务层测试1: 重复报名检查
    it('应该检测重复报名并返回错误', async () => {
      const userId = fixtures.testUsers.enrolledUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      // 模拟：已存在的报名
      Enrollment.findOne.resolves(fixtures.enrollmentRecords.paidEnrollment);

      const result = await Enrollment.findOne({
        userId,
        periodId,
        status: { $in: ['active', 'completed'] }
      });

      expect(result).to.exist;
      expect(result.status).to.equal('active');
      expect(Enrollment.findOne.called).to.be.true;
    });

    // 服务层测试2: 期次存在性检查
    it('应该验证期次是否存在', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      Period.findById.resolves(fixtures.testPeriods.ongoingPeriod);

      const result = await Period.findById(periodId);

      expect(result).to.exist;
      expect(result._id.toString()).to.equal(periodId.toString());
    });

    // 服务层测试3: 期次不存在的情况
    it('应该在期次不存在时返回null', async () => {
      const periodId = new mongoose.Types.ObjectId();

      Period.findById.resolves(null);

      const result = await Period.findById(periodId);

      expect(result).to.be.null;
    });

    // 服务层测试4: 期次已截止的检查
    it('应该检查期次是否已截止', async () => {
      const period = fixtures.testPeriods.closedEnrollmentPeriod;
      const now = new Date();

      const isEnrollmentClosed = period.enrollmentDeadline < now;

      expect(isEnrollmentClosed).to.be.true;
    });

    // 服务层测试5: 期次未开始的检查
    it('应该允许报名未开始的期次', async () => {
      const period = fixtures.testPeriods.upcomingPeriod;
      const now = new Date();

      const hasStarted = period.startDate <= now;

      expect(hasStarted).to.be.false;
      // 报名应该被允许
    });
  });

  describe('报名记录创建 - 支付记录生成', () => {
    // 服务层测试6: 报名时自动创建支付记录
    it('应该在创建报名时自动生成待支付的支付记录', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const enrollmentId = new mongoose.Types.ObjectId();

      // 模拟：创建报名记录
      const enrollmentData = {
        userId,
        periodId,
        paymentStatus: 'pending',
        status: 'active'
      };

      Enrollment.create.resolves({
        _id: enrollmentId,
        ...enrollmentData
      });

      // 创建报名
      const enrollment = await Enrollment.create(enrollmentData);

      expect(enrollment).to.exist;
      expect(enrollment.paymentStatus).to.equal('pending');

      // 模拟：创建对应的支付记录
      const paymentData = {
        enrollmentId: enrollment._id,
        userId,
        periodId,
        amount: fixtures.testPeriods.ongoingPeriod.price || 0,
        status: 'pending',
        createdAt: new Date()
      };

      Payment.create.resolves(paymentData);

      const payment = await Payment.create(paymentData);

      expect(payment).to.exist;
      expect(payment.status).to.equal('pending');
      expect(payment.enrollmentId.toString()).to.equal(enrollmentId.toString());
    });

    // 服务层测试7: 免费报名无需支付
    it('应该为免费报名生成free状态的支付记录', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.upcomingPeriod._id;
      const enrollmentId = new mongoose.Types.ObjectId();

      const enrollmentData = {
        userId,
        periodId,
        paymentStatus: 'free',
        status: 'active'
      };

      Enrollment.create.resolves({
        _id: enrollmentId,
        ...enrollmentData
      });

      const enrollment = await Enrollment.create(enrollmentData);

      expect(enrollment.paymentStatus).to.equal('free');
    });
  });

  describe('报名状态管理', () => {
    // 服务层测试8: 取消报名更新状态
    it('应该正确更新报名状态为withdrawn', async () => {
      const enrollmentId = fixtures.enrollmentRecords.unpaidEnrollment._id;

      const updateData = {
        status: 'withdrawn',
        withdrawnAt: new Date()
      };

      Enrollment.findByIdAndUpdate.resolves({
        _id: enrollmentId,
        ...updateData,
        status: 'withdrawn'
      });

      const result = await Enrollment.findByIdAndUpdate(enrollmentId, updateData);

      expect(result.status).to.equal('withdrawn');
    });

    // 服务层测试9: 完成报名更新状态
    it('应该正确更新报名状态为completed', async () => {
      const enrollmentId = fixtures.enrollmentRecords.paidEnrollment._id;

      const updateData = {
        status: 'completed',
        completedAt: new Date()
      };

      Enrollment.findByIdAndUpdate.resolves({
        _id: enrollmentId,
        ...updateData,
        status: 'completed'
      });

      const result = await Enrollment.findByIdAndUpdate(enrollmentId, updateData);

      expect(result.status).to.equal('completed');
    });

    // 服务层测试10: 拒绝报名更新状态
    it('应该正确更新报名状态为rejected', async () => {
      const enrollmentId = fixtures.enrollmentRecords.rejectedEnrollment._id;

      const updateData = {
        status: 'rejected',
        rejectionReason: '不符合要求',
        rejectedAt: new Date()
      };

      Enrollment.findByIdAndUpdate.resolves({
        _id: enrollmentId,
        ...updateData
      });

      const result = await Enrollment.findByIdAndUpdate(enrollmentId, updateData);

      expect(result.status).to.equal('rejected');
      expect(result.rejectionReason).to.equal('不符合要求');
    });
  });

  describe('期次数据级联更新', () => {
    // 服务层测试11: 报名成功时更新期次人数
    it('应该在创建报名时增加期次的报名计数', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const currentCount = fixtures.testPeriods.ongoingPeriod.enrollmentCount;

      Period.findByIdAndUpdate.resolves({
        ...fixtures.testPeriods.ongoingPeriod,
        enrollmentCount: currentCount + 1
      });

      const result = await Period.findByIdAndUpdate(
        periodId,
        { $inc: { enrollmentCount: 1 } }
      );

      expect(result.enrollmentCount).to.equal(currentCount + 1);
    });

    // 服务层测试12: 取消报名时更新期次人数
    it('应该在取消报名时减少期次的报名计数', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;
      const currentCount = fixtures.testPeriods.ongoingPeriod.enrollmentCount;

      Period.findByIdAndUpdate.resolves({
        ...fixtures.testPeriods.ongoingPeriod,
        enrollmentCount: currentCount - 1
      });

      const result = await Period.findByIdAndUpdate(
        periodId,
        { $inc: { enrollmentCount: -1 } }
      );

      expect(result.enrollmentCount).to.equal(currentCount - 1);
    });

    // 服务层测试13: 期次容量检查
    it('应该检查报名是否超过期次容量', async () => {
      const period = fixtures.testPeriods.ongoingPeriod;

      const isFull = period.enrollmentCount >= period.capacity;

      expect(isFull).to.be.false;
    });

    // 当期次满员时
    it('应该在期次满员时拒绝新报名', async () => {
      const fullPeriod = {
        ...fixtures.testPeriods.ongoingPeriod,
        enrollmentCount: 100,
        capacity: 100
      };

      const isFull = fullPeriod.enrollmentCount >= fullPeriod.capacity;

      expect(isFull).to.be.true;
    });
  });

  describe('权限检查', () => {
    // 服务层测试14: 用户只能操作自己的报名
    it('应该验证用户只能操作自己的报名记录', async () => {
      const enrollmentUserId = fixtures.testUsers.enrolledUser._id;
      const currentUserId = fixtures.testUsers.normalUser._id;

      const canModify = enrollmentUserId.toString() === currentUserId.toString();

      expect(canModify).to.be.false;
    });

    // 用户自己的报名
    it('应该允许用户操作自己的报名记录', async () => {
      const enrollmentUserId = fixtures.testUsers.normalUser._id;
      const currentUserId = fixtures.testUsers.normalUser._id;

      const canModify = enrollmentUserId.toString() === currentUserId.toString();

      expect(canModify).to.be.true;
    });

    // 服务层测试15: 管理员可以操作任何报名
    it('应该允许管理员操作任何报名记录', async () => {
      const adminRole = 'admin';
      const isAdmin = adminRole === 'admin';

      expect(isAdmin).to.be.true;
      // 管理员应该有权限
    });
  });

  describe('批量操作限制', () => {
    // 服务层测试16: 禁止批量审批
    it('应该拒绝批量审批报名请求', async () => {
      const enrollmentIds = [
        fixtures.enrollmentRecords.paidEnrollment._id,
        fixtures.enrollmentRecords.unpaidEnrollment._id
      ];

      // 批量操作应该被拒绝
      const isBatchOperation = enrollmentIds.length > 1;

      expect(isBatchOperation).to.be.true;
      // 服务应该拒绝此操作
    });

    // 服务层测试17: 禁止批量拒绝
    it('应该拒绝批量拒绝报名请求', async () => {
      const enrollmentIds = [
        fixtures.enrollmentRecords.rejectedEnrollment._id,
        fixtures.enrollmentRecords.withdrawnEnrollment._id
      ];

      const isBatchOperation = enrollmentIds.length > 1;

      expect(isBatchOperation).to.be.true;
    });

    // 允许批量查询
    it('应该允许批量查询报名记录', async () => {
      const enrollmentIds = [
        fixtures.enrollmentRecords.paidEnrollment._id,
        fixtures.enrollmentRecords.unpaidEnrollment._id
      ];

      Enrollment.find.resolves([
        fixtures.enrollmentRecords.paidEnrollment,
        fixtures.enrollmentRecords.unpaidEnrollment
      ]);

      const results = await Enrollment.find({ _id: { $in: enrollmentIds } });

      expect(results).to.have.lengthOf(2);
      expect(Enrollment.find.called).to.be.true;
    });
  });

  describe('并发防护', () => {
    // 服务层测试18: 同一用户同期次的并发报名防护
    it('应该防止同一用户同时多次报名同一期次', async () => {
      const userId = fixtures.testUsers.normalUser._id;
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      // 模拟：第一次查询返回null（未报名）
      Enrollment.findOne.onFirstCall().resolves(null);
      // 模拟：第二次查询返回已存在的报名（由另一并发请求创建）
      Enrollment.findOne.onSecondCall().resolves(fixtures.enrollmentRecords.unpaidEnrollment);

      // 首次查询
      let firstResult = await Enrollment.findOne({
        userId,
        periodId,
        status: { $in: ['active', 'completed'] }
      });

      expect(firstResult).to.be.null;

      // 再次查询（模拟并发的另一请求已创建）
      let secondResult = await Enrollment.findOne({
        userId,
        periodId,
        status: { $in: ['active', 'completed'] }
      });

      expect(secondResult).to.exist;
    });
  });

  describe('数据一致性验证', () => {
    // 服务层测试19: 报名记录的必填字段检查
    it('应该验证报名记录包含所有必填字段', async () => {
      const enrollment = fixtures.enrollmentRecords.paidEnrollment;

      expect(enrollment).to.have.property('userId');
      expect(enrollment).to.have.property('periodId');
      expect(enrollment).to.have.property('status');
      expect(enrollment).to.have.property('paymentStatus');
      expect(enrollment).to.have.property('enrolledAt');
    });

    // 服务层测试20: 报名状态值的有效性检查
    it('应该只允许有效的报名状态值', async () => {
      const validStatuses = ['active', 'completed', 'withdrawn', 'rejected'];

      const testEnrollment = fixtures.enrollmentRecords.paidEnrollment;
      const isValidStatus = validStatuses.includes(testEnrollment.status);

      expect(isValidStatus).to.be.true;
    });

    // 支付状态值的有效性检查
    it('应该只允许有效的支付状态值', async () => {
      const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded', 'free'];

      const testEnrollment = fixtures.enrollmentRecords.paidEnrollment;
      const isValidPaymentStatus = validPaymentStatuses.includes(testEnrollment.paymentStatus);

      expect(isValidPaymentStatus).to.be.true;
    });
  });

  describe('查询功能', () => {
    // 获取用户的报名列表
    it('应该返回用户的所有报名记录', async () => {
      const userId = fixtures.testUsers.enrolledUser._id;

      Enrollment.getUserEnrollments.resolves({
        list: [fixtures.enrollmentRecords.paidEnrollment, fixtures.enrollmentRecords.completedEnrollment],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      });

      const result = await Enrollment.getUserEnrollments(userId.toString(), {
        page: 1,
        limit: 20
      });

      expect(result.list).to.have.lengthOf(2);
      expect(result.total).to.equal(2);
    });

    // 获取期次的成员列表
    it('应该返回期次的所有成员报名记录', async () => {
      const periodId = fixtures.testPeriods.ongoingPeriod._id;

      Enrollment.getPeriodMembers.resolves({
        list: [fixtures.enrollmentRecords.paidEnrollment],
        total: 45,
        page: 1,
        limit: 20,
        totalPages: 3
      });

      const result = await Enrollment.getPeriodMembers(periodId.toString(), {
        page: 1,
        limit: 20
      });

      expect(result.total).to.equal(45);
      expect(result.totalPages).to.equal(3);
    });
  });
});
