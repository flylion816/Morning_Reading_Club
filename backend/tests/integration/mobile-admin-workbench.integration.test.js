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
const CommunityActivity = require('../../src/models/CommunityActivity');
const ActivityRegistration = require('../../src/models/ActivityRegistration');

describe('Mobile Admin Workbench Integration', () => {
  let tenantId;
  let adminToken;
  let normalToken;
  let adminUser;
  let normalUser;
  let period;
  let activity;

  async function clearData() {
    await withSystemContext(null, async () => {
      await Promise.all([
        ActivityRegistration.deleteMany({}),
        CommunityActivity.deleteMany({}),
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
        openid: 'admin-workbench-openid',
        nickname: '管理员',
        phone: '13564053520',
        role: 'admin',
        status: 'active'
      })
    );
    normalUser = await withSystemContext(tenantId, () =>
      User.create({
        openid: 'normal-workbench-openid',
        nickname: '狮子学员',
        phone: '15000998787',
        role: 'user',
        status: 'active',
        totalCheckinDays: 9
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
        paymentAmount: 9900,
        paidAt: new Date('2026-06-02T09:05:00+08:00'),
        name: '狮子报名',
        phone: '15000998787'
      });
      await Payment.create({
        enrollmentId: enrollment._id,
        userId: normalUser._id,
        periodId: period._id,
        amount: 9900,
        paymentMethod: 'wechat',
        status: 'completed',
        paidAt: new Date('2026-06-02T09:05:00+08:00'),
        orderNo: 'ORDER_WORKBENCH_ENROLLMENT'
      });
      activity = await CommunityActivity.create({
        tenantId,
        title: '线下共读会',
        type: 'chat',
        startTime: new Date('2026-06-28T20:00:00+08:00'),
        status: 'published',
        isPaid: true,
        price: 1200
      });
      const registration = await ActivityRegistration.create({
        tenantId,
        activityId: activity._id,
        userId: normalUser._id,
        registeredAt: new Date('2026-06-27T10:00:00+08:00'),
        status: 'registered',
        paymentStatus: 'paid',
        paidAmount: 1200,
        reminderGranted: true
      });
      const activityPayment = await Payment.create({
        registrationId: registration._id,
        userId: normalUser._id,
        amount: 1200,
        paymentMethod: 'wechat',
        status: 'completed',
        paidAt: new Date('2026-06-27T10:05:00+08:00'),
        orderNo: 'ORDER_WORKBENCH_ACTIVITY'
      });
      registration.paymentId = activityPayment._id;
      await registration.save();
    });

    adminToken = generateTokens(adminUser).accessToken;
    normalToken = generateTokens(normalUser).accessToken;
  });

  after(async () => {
    await clearData();
  });

  it('allows admins to search users and see compact summaries', async () => {
    const res = await request(app)
      .get('/api/v1/mobile-admin/workbench/users')
      .query({ q: '狮子', page: 1, pageSize: 20 })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.code).to.equal(0);
    expect(res.body.data.list).to.have.length(1);
    expect(res.body.data.list[0].nickname).to.equal('狮子学员');
    expect(res.body.data.list[0].phoneMasked).to.equal('150****8787');
    expect(res.body.data.list[0].summary.enrollmentCount).to.equal(1);
    expect(res.body.data.list[0].summary.activityRegistrationCount).to.equal(1);
  });

  it('returns selected user enrollments and activity registrations', async () => {
    const res = await request(app)
      .get(`/api/v1/mobile-admin/workbench/users/${normalUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.data.user.nickname).to.equal('狮子学员');
    expect(res.body.data.enrollments[0].periodName).to.equal('第八期');
    expect(res.body.data.enrollments[0].latestPayment.status).to.equal('completed');
    expect(res.body.data.activityRegistrations[0].activity.title).to.equal('线下共读会');
    expect(res.body.data.activityRegistrations[0].payment.status).to.equal('completed');
  });

  it('returns activity list and registrations', async () => {
    const activityRes = await request(app)
      .get('/api/v1/mobile-admin/workbench/activities')
      .query({ q: '共读' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(activityRes.status).to.equal(200);
    expect(activityRes.body.data.list[0].registrationCount).to.equal(1);
    expect(activityRes.body.data.list[0].paidCount).to.equal(1);

    const registrationRes = await request(app)
      .get(`/api/v1/mobile-admin/workbench/activities/${activity._id}/registrations`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(registrationRes.status).to.equal(200);
    expect(registrationRes.body.data.activity.title).to.equal('线下共读会');
    expect(registrationRes.body.data.list[0].user.nickname).to.equal('狮子学员');
    expect(registrationRes.body.data.list[0].payment.status).to.equal('completed');
  });

  it('rejects normal mini program users', async () => {
    const res = await request(app)
      .get('/api/v1/mobile-admin/workbench/users')
      .query({ q: '狮子' })
      .set('Authorization', `Bearer ${normalToken}`);

    expect(res.status).to.equal(403);
    expect(res.body.code).to.equal(403);
  });
});
