const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Tenant = require('../../src/models/Tenant');
const Period = require('../../src/models/Period');
const Section = require('../../src/models/Section');
const User = require('../../src/models/User');
const Enrollment = require('../../src/models/Enrollment');
const { generateAccessToken } = require('../../src/utils/jwt');
const { withSystemContext } = require('../../src/utils/tenantContext');

describe('Period reading access: section search', () => {
  let tenant;
  let openPeriod;
  let enrolledPeriod;
  let user;

  before(() => {
    expect(process.env.NODE_ENV).to.equal('test');
    expect(mongoose.connection.host).to.equal('127.0.0.1');
  });

  beforeEach(async () => {
    const suffix = new mongoose.Types.ObjectId().toHexString();
    tenant = await withSystemContext(null, () => Tenant.create({
      name: '课程搜索权限测试',
      slug: `search-${suffix}`,
      wxAppIds: [`wx${suffix.slice(-16)}`]
    }));

    ({ openPeriod, enrolledPeriod, user } = await withSystemContext(tenant._id, async () => {
      const periods = await Period.create([
        {
          tenantId: tenant._id,
          name: '公开阅读期次',
          title: '公开阅读期次',
          readingAccess: 'open',
          isPublished: true,
          startDate: new Date('2026-11-01T00:00:00+08:00'),
          endDate: new Date('2026-11-30T00:00:00+08:00')
        },
        {
          tenantId: tenant._id,
          name: '报名后阅读期次',
          title: '报名后阅读期次',
          readingAccess: 'enrolled',
          isPublished: true,
          startDate: new Date('2026-11-01T00:00:00+08:00'),
          endDate: new Date('2026-11-30T00:00:00+08:00')
        }
      ]);
      await Section.create([
        {
          tenantId: tenant._id,
          periodId: periods[0]._id,
          day: 0,
          title: '公开课程',
          content: '公开搜索关键词'
        },
        {
          tenantId: tenant._id,
          periodId: periods[1]._id,
          day: 0,
          title: '受限课程',
          content: '受限搜索关键词'
        }
      ]);
      const createdUser = await User.create({
        tenantId: tenant._id,
        openid: `search-user-${suffix}`,
        nickname: '搜索权限用户'
      });
      return {
        openPeriod: periods[0],
        enrolledPeriod: periods[1],
        user: createdUser
      };
    }));
  });

  function search(periodId, keyword, token) {
    const requestBuilder = request(app)
      .get('/api/v1/sections/search')
      .query({ periodId: String(periodId), keyword })
      .set('X-Wx-AppId', tenant.wxAppIds[0]);
    return token ? requestBuilder.set('Authorization', `Bearer ${token}`) : requestBuilder;
  }

  it('allows an anonymous reader to search a published open period without returning正文', async () => {
    const response = await search(openPeriod._id, '公开搜索关键词').expect(200);
    expect(response.body.data.list).to.have.length(1);
    expect(response.body.data.list[0]).to.include({ title: '公开课程' });
    expect(response.body.data.list[0]).not.to.have.property('content');
  });

  it('blocks an anonymous search against a period that requires enrollment', async () => {
    const response = await search(enrolledPeriod._id, '受限搜索关键词').expect(403);
    expect(response.body.message).to.equal('请先报名后学习');
  });

  it('blocks an authenticated user without an effective enrollment', async () => {
    const token = generateAccessToken({
      userId: String(user._id),
      tenantId: String(tenant._id),
      role: 'user'
    });
    await search(enrolledPeriod._id, '受限搜索关键词', token).expect(403);

    await withSystemContext(tenant._id, () => Enrollment.create({
      tenantId: tenant._id,
      userId: user._id,
      periodId: enrolledPeriod._id,
      name: '搜索权限用户',
      phone: '13800000000',
      status: 'active',
      paymentStatus: 'free',
      paymentAmount: 0
    }));

    const allowed = await search(enrolledPeriod._id, '受限搜索关键词', token).expect(200);
    expect(allowed.body.data.list).to.have.length(1);
  });
});
