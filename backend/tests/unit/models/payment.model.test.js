/**
 * Payment Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Payment = require('../../../src/models/Payment');

describe('Payment Model', () => {
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
    await Payment.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的支付记录', async () => {
      const payment = await Payment.create({
        userId,
        periodId,
        amount: 99.99,
        paymentMethod: 'wechat'
      });

      expect(payment._id).to.exist;
      expect(payment.userId.toString()).to.equal(userId.toString());
      expect(payment.amount).to.equal(99.99);
      expect(payment.status).to.equal('pending');
    });

    it('应该使用默认值', async () => {
      const payment = await Payment.create({
        userId: new mongoose.Types.ObjectId(),
        periodId: new mongoose.Types.ObjectId(),
        amount: 50,
        paymentMethod: 'wechat'
      });

      expect(payment.status).to.equal('pending');
      expect(payment.transactionId).to.be.null;
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索支付数据', async () => {
      const payment = await Payment.create({
        userId,
        periodId,
        amount: 99.99,
        paymentMethod: 'wechat',
        status: 'completed'
      });

      const retrieved = await Payment.findById(payment._id);
      expect(retrieved.amount).to.equal(99.99);
      expect(retrieved.status).to.equal('completed');
    });

    it('应该支持按userId查询', async () => {
      const u1 = new mongoose.Types.ObjectId();
      const p = new mongoose.Types.ObjectId();

      await Payment.create({
        userId: u1,
        periodId: p,
        amount: 50,
        paymentMethod: 'wechat'
      });

      await Payment.create({
        userId: u1,
        periodId: p,
        amount: 99,
        paymentMethod: 'alipay'
      });

      const payments = await Payment.find({ userId: u1 });
      expect(payments).to.have.lengthOf(2);
    });
  });

  describe('Field Constraints', () => {
    it('应该验证amount最小值', async () => {
      try {
        await Payment.create({
          userId,
          periodId,
          amount: -1,
          paymentMethod: 'wechat'
        });
        expect.fail('应该抛出最小值验证错误');
      } catch (err) {
        expect(err.message).to.include('amount');
      }
    });
  });

  describe('Timestamps', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const payment = await Payment.create({
        userId,
        periodId,
        amount: 50,
        paymentMethod: 'wechat'
      });

      expect(payment.createdAt).to.exist;
      expect(payment.updatedAt).to.exist;
    });
  });
});
