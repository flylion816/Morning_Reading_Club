/**
 * Enrollment → Payment 完整流程集成测试
 * 测试业务流程：报名 → 支付初始化 → 支付确认 → 数据一致性
 * 验证关键场景：
 * - TC-ENROLL-003: 完整报名流程
 * - TC-PAYMENT-002: 支付确认和状态更新
 */

const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;
let User;
let Enrollment;
let Payment;
let Period;

describe('Enrollment → Payment 完整流程集成测试', () => {
  before(async function() {
    this.timeout(60000);

    // MongoDB已通过setup.js全局初始化
    if (mongoose.connection.readyState === 0) {
      mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }

    // 导入模型
    User = require('../../src/models/User');
    Enrollment = require('../../src/models/Enrollment');
    Payment = require('../../src/models/Payment');
    Period = require('../../src/models/Period');

    // 创建 Express 应用
    app = require('../../src/server');
  });

  after(async function() {
    this.timeout(30000);
    // 仅清空集合，不断开连接（由setup.js管理）
    try {
      await User.deleteMany({});
      await Enrollment.deleteMany({});
      await Payment.deleteMany({});
      await Period.deleteMany({});
    } catch (err) {
      console.log('Error clearing collections:', err.message);
    }
  });

  let testUser;
  let testPeriod;
  let testEnrollment;
  let testPayment;
  let authToken;

  beforeEach(async () => {
    // ✅ 清空数据库（仅单条删除）
    await User.deleteMany({});
    await Enrollment.deleteMany({});
    await Payment.deleteMany({});
    await Period.deleteMany({});

    // ✅ 创建测试用户
    const userRes = await request(app)
      .post('/api/v1/auth/wechat/login')
      .send({ code: 'test-code-' + Date.now() });

    testUser = userRes.body.data.user;
    authToken = userRes.body.data.accessToken;

    // ✅ 创建测试期次（价格单位是分，9900分 = 99.00元）
    testPeriod = await Period.create({
      name: '测试期次-' + Date.now(),
      title: '测试期次标题',
      description: '测试期次描述',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 23), // 23天后结束
      price: 9900, // 99.00元
      status: 'ongoing',
      isPublished: true
    });

    // 重置test变量
    testEnrollment = null;
    testPayment = null;
  });

  afterEach(async () => {
    // ✅ 单条删除清理（防止数据污染）
    if (testEnrollment) {
      try {
        await Enrollment.findByIdAndDelete(testEnrollment._id);
      } catch (err) {
        // 可能已被删除
      }
    }

    if (testPayment) {
      try {
        await Payment.findByIdAndDelete(testPayment._id);
      } catch (err) {
        // 可能已被删除
      }
    }

    if (testPeriod) {
      try {
        await Period.findByIdAndDelete(testPeriod._id);
      } catch (err) {
        // 可能已被删除
      }
    }

    if (testUser) {
      try {
        await User.findByIdAndDelete(testUser._id);
      } catch (err) {
        // 可能已被删除
      }
    }
  });

  describe('场景1: 完整报名→支付→数据一致性流程', () => {
    it('应该完成报名→待支付→支付成功的完整流程', async () => {
      // ===== 步骤1: 用户报名期次 =====
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      expect(enrollRes.status).to.equal(200);
      expect(enrollRes.body.data).to.have.property('_id');
      expect(enrollRes.body.data).to.have.property('status', 'active');
      expect(enrollRes.body.data).to.have.property('paymentStatus', 'free');

      testEnrollment = enrollRes.body.data;
      const enrollmentId = testEnrollment._id;

      // ===== 步骤2: 验证期次的报名人数增加 =====
      let updatedPeriod = await Period.findById(testPeriod._id);
      expect(updatedPeriod.enrollmentCount).to.equal(1);

      // ===== 步骤3: 初始化支付（创建订单） =====
      const paymentInitRes = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enrollmentId: enrollmentId,
          paymentMethod: 'mock', // 使用模拟支付
          amount: 9900 // 99.00元
        });

      expect(paymentInitRes.status).to.equal(200);
      expect(paymentInitRes.body.data).to.have.property('paymentId');
      expect(paymentInitRes.body.data).to.have.property('orderNo');
      expect(paymentInitRes.body.data).to.have.property('status', 'completed'); // mock支付直接成功

      testPayment = { _id: paymentInitRes.body.data.paymentId };

      // ===== 步骤4: 验证报名状态自动更新 =====
      const checkRes = await request(app)
        .get(`/api/v1/enrollments/check/${testPeriod._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(checkRes.status).to.equal(200);
      expect(checkRes.body.data).to.have.property('isEnrolled', true);
      expect(checkRes.body.data).to.have.property('paymentStatus', 'paid');

      // ===== 步骤5: 验证数据库一致性 =====
      const dbEnrollment = await Enrollment.findById(enrollmentId);
      expect(dbEnrollment).to.exist;
      expect(dbEnrollment.status).to.equal('active');
      expect(dbEnrollment.paymentStatus).to.equal('paid');

      const dbPayment = await Payment.findById(testPayment._id);
      expect(dbPayment).to.exist;
      expect(dbPayment.status).to.equal('completed');
      expect(dbPayment.enrollmentId.toString()).to.equal(enrollmentId.toString());

      // ===== 步骤6: 验证期次数据完整性 =====
      updatedPeriod = await Period.findById(testPeriod._id);
      expect(updatedPeriod.enrollmentCount).to.equal(1);
    });
  });

  describe('场景2: 支付状态管理', () => {
    it('应该防止对同一报名的重复支付', async () => {
      // 创建报名
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      testEnrollment = enrollRes.body.data;
      const enrollmentId = testEnrollment._id;

      // 第一次初始化支付（模拟支付直接成功）
      const pay1 = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enrollmentId: enrollmentId,
          paymentMethod: 'mock',
          amount: 9900
        });

      expect(pay1.status).to.equal(200);
      testPayment = { _id: pay1.body.data.paymentId };

      // 验证报名状态为已支付
      const checkRes1 = await request(app)
        .get(`/api/v1/enrollments/check/${testPeriod._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(checkRes1.body.data.paymentStatus).to.equal('paid');

      // 尝试再次支付，应该返回错误
      const pay2 = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enrollmentId: enrollmentId,
          paymentMethod: 'mock',
          amount: 9900
        });

      // 第二次支付应该失败（已支付无法再支付）
      expect(pay2.status).to.equal(400);
      expect(pay2.body.message).to.include('完成支付'); // 验证错误信息包含"完成支付"
    });

    it('应该返回存在的待支付订单而非创建新订单', async () => {
      // 创建报名（默认paymentStatus为free）
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      testEnrollment = enrollRes.body.data;
      const enrollmentId = testEnrollment._id;

      // 第一次初始化支付（使用真实微信支付）
      const pay1 = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enrollmentId: enrollmentId,
          paymentMethod: 'wechat',
          amount: 9900
        });

      expect(pay1.status).to.equal(200);
      const paymentId1 = pay1.body.data.paymentId;
      testPayment = { _id: paymentId1 };

      // 第二次初始化支付（应该返回同一个订单）
      const pay2 = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enrollmentId: enrollmentId,
          paymentMethod: 'wechat',
          amount: 9900
        });

      expect(pay2.status).to.equal(200);
      expect(pay2.body.data.paymentId).to.equal(paymentId1); // 应该是同一个支付ID
      expect(pay2.body.data.message).to.include('订单已存在');
    });
  });

  describe('场景3: 期次截止和报名限制', () => {
    it('应该允许在进行中的期次报名', async () => {
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      expect(enrollRes.status).to.equal(200);
      testEnrollment = enrollRes.body.data;
      expect(testEnrollment.status).to.equal('active');
    });

    it('应该防止重复报名同一期次', async () => {
      // 第一次报名
      const enrollRes1 = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      expect(enrollRes1.status).to.equal(200);
      testEnrollment = enrollRes1.body.data;

      // 第二次报名同一期次
      const enrollRes2 = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      expect(enrollRes2.status).to.equal(400);
      expect(enrollRes2.body.message).to.include('已报名');
    });
  });

  describe('场景4: 多用户并发报名', () => {
    it('应该支持多用户同时报名同一期次，数据一致性正确', async () => {
      // 创建第二个用户
      const user2Res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-user2-' + Date.now() });

      const user2 = user2Res.body.data.user;
      const user2Token = user2Res.body.data.accessToken;

      // 用户1报名
      const enroll1 = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      expect(enroll1.status).to.equal(200);
      testEnrollment = enroll1.body.data;

      // 用户2报名
      const enroll2 = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ periodId: testPeriod._id });

      expect(enroll2.status).to.equal(200);
      const user2Enrollment = enroll2.body.data;

      // 验证期次报名人数为2
      const updatedPeriod = await Period.findById(testPeriod._id);
      expect(updatedPeriod.enrollmentCount).to.equal(2);

      // 验证两个报名记录都在数据库中
      const enrollments = await Enrollment.find({ periodId: testPeriod._id });
      expect(enrollments).to.have.lengthOf(2);

      // ✅ 单条清理第二个用户数据
      await Enrollment.findByIdAndDelete(user2Enrollment._id);
      await User.findByIdAndDelete(user2._id);
    });
  });

  describe('场景5: 用户报名列表查询', () => {
    it('应该返回用户的所有报名信息', async () => {
      // 报名到期次
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      testEnrollment = enrollRes.body.data;

      // 查询用户的报名列表
      const listRes = await request(app)
        .get('/api/v1/enrollments/user')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).to.equal(200);
      expect(listRes.body.data).to.have.property('list');
      expect(listRes.body.data.list).to.have.lengthOf.at.least(1);

      // 验证返回的报名包含期次信息
      const enrollment = listRes.body.data.list[0];
      expect(enrollment).to.have.property('periodId');
      expect(enrollment).to.have.property('status');
      expect(enrollment).to.have.property('paymentStatus');
    });
  });

  describe('场景6: 支付查询', () => {
    it('应该能够查询支付记录列表', async () => {
      // 报名并支付
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      testEnrollment = enrollRes.body.data;

      const payRes = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enrollmentId: testEnrollment._id,
          paymentMethod: 'mock',
          amount: 9900
        });

      testPayment = { _id: payRes.body.data.paymentId };

      // 查询支付记录
      const listRes = await request(app)
        .get('/api/v1/payments/user')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).to.equal(200);
      expect(listRes.body.data).to.have.property('list');
      expect(listRes.body.data.list.length).to.be.at.least(1);

      // 验证返回的支付信息
      const payment = listRes.body.data.list[0];
      expect(payment).to.have.property('status');
      expect(payment).to.have.property('amount', 9900);
      expect(payment).to.have.property('isPaid', true);
    });

    it('应该能够查询单条支付状态', async () => {
      // 报名并支付
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      testEnrollment = enrollRes.body.data;

      const payRes = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enrollmentId: testEnrollment._id,
          paymentMethod: 'mock',
          amount: 9900
        });

      const paymentId = payRes.body.data.paymentId;
      testPayment = { _id: paymentId };

      // 查询支付状态
      const statusRes = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusRes.status).to.equal(200);
      expect(statusRes.body.data).to.have.property('status', 'completed');
      expect(statusRes.body.data).to.have.property('amount', 9900);
      expect(statusRes.body.data).to.have.property('orderNo');
    });
  });

  describe('场景7: 错误处理', () => {
    it('应该在期次不存在时返回错误', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: fakeId });

      expect(enrollRes.status).to.equal(404);
      expect(enrollRes.body.message).to.include('期次不存在');
    });

    it('应该在报名记录不存在时返回支付错误', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const payRes = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enrollmentId: fakeId,
          paymentMethod: 'mock',
          amount: 9900
        });

      expect(payRes.status).to.equal(404);
      expect(payRes.body.message).to.include('报名记录不存在');
    });

    it('应该在缺少必填字段时返回错误', async () => {
      // 尝试支付时缺少enrollmentId，由于enrollmentId为undefined，查找不到返回404
      const payRes = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentMethod: 'mock', amount: 9900 }); // 缺少enrollmentId

      expect(payRes.status).to.equal(404); // 缺少enrollmentId时查找不到报名记录
      expect(payRes.body.message).to.include('报名记录不存在');
    });

    it('应该在未认证时拒绝访问', async () => {
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .send({ periodId: testPeriod._id }); // 缺少Authorization header

      expect(enrollRes.status).to.equal(401);
    });
  });

  describe('场景8: 期次成员列表', () => {
    it('应该返回期次的成员列表（包含報名信息）', async () => {
      // 用户报名
      const enrollRes = await request(app)
        .post('/api/v1/enrollments/simple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ periodId: testPeriod._id });

      testEnrollment = enrollRes.body.data;

      // 查询成员列表
      const memberRes = await request(app)
        .get(`/api/v1/enrollments/period/${testPeriod._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(memberRes.status).to.equal(200);
      expect(memberRes.body.data).to.have.property('list');
      expect(memberRes.body.data.list).to.have.lengthOf.at.least(1);

      // 验证返回的成员信息
      const member = memberRes.body.data.list[0];
      expect(member).to.have.property('userId');
      expect(member).to.have.property('status');
      expect(member).to.have.property('enrolledAt');
    });
  });
});
