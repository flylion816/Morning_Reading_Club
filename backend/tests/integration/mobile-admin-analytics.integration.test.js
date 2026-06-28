const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { generateTokens } = require('../../src/utils/jwt');
const { withSystemContext } = require('../../src/utils/tenantContext');
const User = require('../../src/models/User');
const Period = require('../../src/models/Period');
const Enrollment = require('../../src/models/Enrollment');
const Payment = require('../../src/models/Payment');
const UserActivity = require('../../src/models/UserActivity');

describe('Mobile Admin Analytics Integration', () => {
  let tenantId;
  let adminToken;
  let normalToken;
  let period;
  let adminUser;
  let normalUser;
  let outsideUser;

  async function clearData() {
    await withSystemContext(null, async () => {
      await Promise.all([
        UserActivity.deleteMany({}),
        Payment.deleteMany({}),
        Enrollment.deleteMany({}),
        Period.deleteMany({}),
        User.deleteMany({})
      ]);
    });
  }

  beforeEach(async () => {
    await clearData();
    tenantId = new mongoose.Types.ObjectId();

    adminUser = await withSystemContext(tenantId, () =>
      User.create({
        openid: 'admin-openid',
        nickname: '管理员',
        phone: '13564053520',
        role: 'admin',
        status: 'active'
      })
    );
    normalUser = await withSystemContext(tenantId, () =>
      User.create({
        openid: 'normal-openid',
        nickname: '普通用户',
        phone: '15000998787',
        role: 'user',
        status: 'active'
      })
    );
    outsideUser = await withSystemContext(tenantId, () =>
      User.create({
        openid: 'outside-openid',
        nickname: '未报名用户',
        phone: '15000111111',
        role: 'user',
        status: 'active'
      })
    );
    period = await withSystemContext(tenantId, () =>
      Period.create({
        name: '第八期',
        startDate: new Date('2026-06-01T00:00:00+08:00'),
        endDate: new Date('2026-06-23T23:59:59+08:00'),
        isPublished: true
      })
    );

    await withSystemContext(tenantId, async () => {
      const enrollment = await Enrollment.create({
        userId: normalUser._id,
        periodId: period._id,
        enrolledAt: new Date('2026-06-02T09:00:00+08:00'),
        paymentStatus: 'paid',
        status: 'active',
        paymentAmount: 9900
      });
      await Payment.create({
        enrollmentId: enrollment._id,
        userId: normalUser._id,
        periodId: period._id,
        amount: 9900,
        paymentMethod: 'wechat',
        status: 'completed',
        paidAt: new Date('2026-06-02T09:05:00+08:00'),
        orderNo: 'ORDER_TEST_ENROLLMENT'
      });
      await Payment.create({
        registrationId: new mongoose.Types.ObjectId(),
        userId: normalUser._id,
        amount: 1200,
        paymentMethod: 'wechat',
        status: 'completed',
        paidAt: new Date('2026-06-02T10:00:00+08:00'),
        orderNo: 'ORDER_TEST_ACTIVITY'
      });
      await UserActivity.create({
        userId: normalUser._id,
        action: 'app_open',
        actionDate: '2026-06-02',
        occurredAt: new Date('2026-06-02T08:00:00+08:00'),
        periodId: null
      });
      await UserActivity.create({
        userId: normalUser._id,
        action: 'own_insight_view',
        actionDate: '2026-06-02',
        occurredAt: new Date('2026-06-02T08:05:00+08:00'),
        periodId: period._id
      });
      await UserActivity.create({
        userId: outsideUser._id,
        action: 'app_open',
        actionDate: '2026-06-02',
        occurredAt: new Date('2026-06-02T08:10:00+08:00'),
        periodId: null
      });
    });

    adminToken = generateTokens(adminUser).accessToken;
    normalToken = generateTokens(normalUser).accessToken;
  });

  after(async () => {
    await clearData();
  });

  it('allows mini program admins to view overview with revenue split', async () => {
    const res = await request(app)
      .get('/api/v1/mobile-admin/analytics/overview')
      .query({
        startDate: '2026-06-01',
        endDate: '2026-06-03'
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.code).to.equal(0);
    expect(res.body.data.summary.totalEnrollments).to.equal(1);
    expect(res.body.data.summary.enrollmentRevenue).to.equal(9900);
    expect(res.body.data.summary.activityRevenue).to.equal(1200);
    expect(res.body.data.summary.totalRevenue).to.equal(11100);
  });

  it('supports period filtering and activity user details', async () => {
    const res = await request(app)
      .get('/api/v1/mobile-admin/analytics/activity')
      .query({
        startDate: '2026-06-01',
        endDate: '2026-06-03',
        periodId: period._id.toString()
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.data.filters.periodId).to.equal(period._id.toString());
    expect(res.body.data.trend.find(row => row.date === '2026-06-02').app_open).to.equal(1);
    expect(res.body.data.trend.find(row => row.date === '2026-06-02').activeUserCount).to.equal(1);
    expect(res.body.data.details[0].phone).to.equal('15000998787');
  });

  it('rejects normal mini program users', async () => {
    const res = await request(app)
      .get('/api/v1/mobile-admin/analytics/overview')
      .query({
        startDate: '2026-06-01',
        endDate: '2026-06-03'
      })
      .set('Authorization', `Bearer ${normalToken}`);

    expect(res.status).to.equal(403);
    expect(res.body.code).to.equal(403);
  });
});
