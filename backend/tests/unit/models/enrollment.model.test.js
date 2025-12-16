/**
 * Enrollment Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Enrollment = require('../../../src/models/Enrollment');

describe('Enrollment Model', () => {
  let userId;
  let periodId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
    userId = new mongoose.Types.ObjectId();
    periodId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await Enrollment.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的报名记录', async () => {
      const enrollment = await Enrollment.create({
        userId,
        periodId
      });

      expect(enrollment._id).to.exist;
      expect(enrollment.userId.toString()).to.equal(userId.toString());
      expect(enrollment.periodId.toString()).to.equal(periodId.toString());
    });

    it('应该使用默认值', async () => {
      const enrollment = await Enrollment.create({
        userId,
        periodId
      });

      expect(enrollment.status).to.equal('active');
      expect(enrollment.paymentStatus).to.equal('free');
      expect(enrollment.paymentAmount).to.equal(0);
      expect(enrollment.enrolledAt).to.be.instanceof(Date);
    });

    it('应该在缺少userId时抛出验证错误', async () => {
      try {
        await Enrollment.create({ periodId });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('userId');
      }
    });

    it('应该在缺少periodId时抛出验证错误', async () => {
      try {
        await Enrollment.create({ userId });
        expect.fail('应该抛出验证错误');
      } catch (err) {
        expect(err.message).to.include('periodId');
      }
    });

    it('应该接受有效的status值', async () => {
      const statuses = ['active', 'completed', 'withdrawn'];
      for (const status of statuses) {
        const enrollment = await Enrollment.create({
          userId: new mongoose.Types.ObjectId(),
          periodId: new mongoose.Types.ObjectId(),
          status
        });
        expect(enrollment.status).to.equal(status);
      }
    });

    it('应该接受有效的paymentStatus值', async () => {
      const paymentStatuses = ['pending', 'paid', 'refunded', 'free'];
      for (const paymentStatus of paymentStatuses) {
        const enrollment = await Enrollment.create({
          userId: new mongoose.Types.ObjectId(),
          periodId: new mongoose.Types.ObjectId(),
          paymentStatus
        });
        expect(enrollment.paymentStatus).to.equal(paymentStatus);
      }
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索报名数据', async () => {
      const enrollment = await Enrollment.create({
        userId,
        periodId,
        status: 'active',
        paymentStatus: 'paid',
        paymentAmount: 99.99
      });

      const retrieved = await Enrollment.findById(enrollment._id);
      expect(retrieved.status).to.equal('active');
      expect(retrieved.paymentStatus).to.equal('paid');
      expect(retrieved.paymentAmount).to.equal(99.99);
    });

    it('应该更新报名数据', async () => {
      const enrollment = await Enrollment.create({
        userId,
        periodId,
        status: 'active'
      });

      enrollment.status = 'completed';
      await enrollment.save();

      const updated = await Enrollment.findById(enrollment._id);
      expect(updated.status).to.equal('completed');
    });

    it('应该支持按userId和periodId查询', async () => {
      const u1 = new mongoose.Types.ObjectId();
      const p1 = new mongoose.Types.ObjectId();

      await Enrollment.create({ userId: u1, periodId: p1 });
      await Enrollment.create({ userId: u1, periodId: new mongoose.Types.ObjectId() });

      const enrollments = await Enrollment.find({ userId: u1, periodId: p1 });
      expect(enrollments).to.have.lengthOf(1);
    });
  });

  describe('Field Constraints', () => {
    it('应该验证paymentAmount最小值', async () => {
      try {
        await Enrollment.create({
          userId,
          periodId,
          paymentAmount: -1
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('paymentAmount');
      }
    });

    it('应该接受paymentAmount为0', async () => {
      const enrollment = await Enrollment.create({
        userId,
        periodId,
        paymentAmount: 0
      });

      expect(enrollment.paymentAmount).to.equal(0);
    });
  });

  describe('Timestamps', () => {
    it('应该自动设置enrolledAt', async () => {
      const enrollment = await Enrollment.create({
        userId,
        periodId
      });

      expect(enrollment.enrolledAt).to.be.instanceof(Date);
    });

    it('应该自动创建createdAt和updatedAt', async () => {
      const enrollment = await Enrollment.create({
        userId,
        periodId
      });

      expect(enrollment.createdAt).to.exist;
      expect(enrollment.updatedAt).to.exist;
    });
  });
});
