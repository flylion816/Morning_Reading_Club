/**
 * Period 和 Section 业务流程集成测试
 * 测试期次和课节的完整管理流程
 */

const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { withSystemContext } = require('../../src/utils/tenantContext');

const TEST_WX_APPID = 'wx199d6d332344ed0a';

let app;
let mongoServer;
let Period;
let Section;
let Admin;
let Tenant;
let User;
let ownsMongoConnection = false;

describe('Period & Section Integration - 期次和课节管理', () => {
  before(async function() {
    this.timeout(60000);
    if (mongoose.connection.readyState === 0) {
      mongoServer = await MongoMemoryServer.create();
      ownsMongoConnection = true;
      const mongoUri = mongoServer.getUri();

      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }

    Period = require('../../src/models/Period');
    Section = require('../../src/models/Section');
    Admin = require('../../src/models/Admin');
    Tenant = require('../../src/models/Tenant');
    User = require('../../src/models/User');

    app = require('../../src/server');
  });

  after(async function() {
    this.timeout(30000);
    if (ownsMongoConnection) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await withSystemContext(null, async () => {
      await Period.deleteMany({});
      await Section.deleteMany({});
      await Admin.deleteMany({});
      await Tenant.deleteMany({});
      await User.deleteMany({});
    });
  });

  describe('GET /api/v1/periods - 查询期次', () => {
    let userToken;

    beforeEach(async () => {
      // 创建租户，登录用户获取 token（绕过 adminAuthMiddleware 拦截）
      await withSystemContext(null, async () => {
        await Tenant.create({
          name: '公开测试租户',
          slug: 'public-test-tenant',
          wxAppIds: [TEST_WX_APPID]
        });
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-public-user', wxAppId: TEST_WX_APPID });
      userToken = loginRes.body.data.accessToken;

      // 用用户的 tenantId 创建期次
      const tenantId = loginRes.body.data.user ? await withSystemContext(null, async () => {
        const t = await Tenant.findOne({ wxAppIds: TEST_WX_APPID });
        return t._id;
      }) : null;

      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      await withSystemContext(null, async () => {
        const tenant = await Tenant.findOne({ wxAppIds: TEST_WX_APPID });
        await Period.insertMany([
          {
            tenantId: tenant._id,
            name: '第一季',
            title: '第一季标题',
            startDate: new Date(now - 90 * day),
            endDate: new Date(now - 30 * day),
            status: 'completed',
            isPublished: true
          },
          {
            tenantId: tenant._id,
            name: '第二季',
            title: '第二季标题',
            startDate: new Date(now - 5 * day),
            endDate: new Date(now + 5 * day),
            status: 'ongoing',
            isPublished: true
          },
          {
            tenantId: tenant._id,
            name: '第三季',
            title: '第三季标题',
            startDate: new Date(now + 30 * day),
            endDate: new Date(now + 90 * day),
            status: 'not_started',
            isPublished: true
          }
        ]);
      });
    });

    it('应该能够查询所有期次', async () => {
      const res = await request(app)
        .get('/api/v1/periods')
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.lengthOf(3);
    });

    it('应该能够按状态筛选期次', async () => {
      const res = await request(app)
        .get('/api/v1/periods?status=active')
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0]).to.have.property('status', 'ongoing');
    });

    it('应该支持分页查询', async () => {
      const res = await request(app)
        .get('/api/v1/periods?page=1&limit=2')
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.length).to.be.at.most(2);
      expect(res.body.pagination).to.have.property('totalPages');
    });

    it('应该按开始日期排序', async () => {
      const res = await request(app)
        .get('/api/v1/periods')
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      const dates = res.body.data.map(p => new Date(p.endDate));
      expect(dates[0] >= dates[1]).to.be.true;
      expect(dates[1] >= dates[2]).to.be.true;
    });
  });

  describe('GET /api/v1/periods/:id/sections - 查询期次的课节', () => {
    let periodId;
    let userToken;

    beforeEach(async () => {
      await withSystemContext(null, async () => {
        await Tenant.create({
          name: '课节测试租户',
          slug: 'section-test-tenant',
          wxAppIds: [TEST_WX_APPID]
        });
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-section-user', wxAppId: TEST_WX_APPID });
      userToken = loginRes.body.data.accessToken;

      await withSystemContext(null, async () => {
        const tenant = await Tenant.findOne({ wxAppIds: TEST_WX_APPID });

        const period = await Period.create({
          tenantId: tenant._id,
          name: '测试期次',
          title: '测试期次标题',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ongoing'
        });

        periodId = period._id;

        await Section.insertMany([
          { tenantId: tenant._id, periodId, title: '第1课 - 认识自我', day: 1, order: 1, duration: 20 },
          { tenantId: tenant._id, periodId, title: '第2课 - 设定目标', day: 2, order: 2, duration: 25 },
          { tenantId: tenant._id, periodId, title: '第3课 - 行动计划', day: 3, order: 3, duration: 22 }
        ]);
      });
    });

    it('应该能够查询期次的所有课节', async () => {
      const res = await request(app)
        .get(`/api/v1/sections/period/${periodId}`)
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.lengthOf(3);
    });

    it('课节应该按顺序排列', async () => {
      const res = await request(app)
        .get(`/api/v1/sections/period/${periodId}`)
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      const orders = res.body.data.map(s => s.order);
      expect(orders).to.deep.equal([1, 2, 3]);
    });

    it('应该包含正确的课节信息', async () => {
      const res = await request(app)
        .get(`/api/v1/sections/period/${periodId}`)
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      const section = res.body.data[0];
      expect(section).to.have.property('title');
      expect(section).to.have.property('day');
      expect(section).to.have.property('order');
      expect(section).to.have.property('duration');
    });

    it('应该支持按日期范围查询', async () => {
      const res = await request(app)
        .get(`/api/v1/sections/period/${periodId}?startDay=1&endDay=2`)
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.length).to.be.at.most(2);
    });
  });

  describe('GET /api/v1/sections/:id - 获取课节详情', () => {
    let sectionId;
    let periodId;
    let userToken;

    beforeEach(async () => {
      await withSystemContext(null, async () => {
        await Tenant.create({
          name: '详情测试租户',
          slug: 'detail-test-tenant',
          wxAppIds: [TEST_WX_APPID]
        });
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-detail-user', wxAppId: TEST_WX_APPID });
      userToken = loginRes.body.data.accessToken;

      await withSystemContext(null, async () => {
        const tenant = await Tenant.findOne({ wxAppIds: TEST_WX_APPID });

        const period = await Period.create({
          tenantId: tenant._id,
          name: '详情测试期次',
          title: '详情测试期次标题',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ongoing'
        });

        periodId = period._id;

        const section = await Section.create({
          tenantId: tenant._id,
          periodId,
          title: '详情测试课节',
          day: 1,
          order: 1,
          duration: 20,
          description: '这是一个测试课节',
          content: '课节的详细内容...'
        });

        sectionId = section._id;
      });
    });

    it('应该能够获取课节的完整信息', async () => {
      const res = await request(app)
        .get(`/api/v1/sections/${sectionId}`)
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('_id', sectionId.toString());
      expect(res.body.data).to.have.property('title');
      expect(res.body.data).to.have.property('description');
      expect(res.body.data).to.have.property('content');
    });

    it('课节应该包含关联的期次信息', async () => {
      const res = await request(app)
        .get(`/api/v1/sections/${sectionId}`)
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.body.data).to.have.property('periodId');
    });

    it('不存在的课节应该返回 404', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/v1/sections/${fakeId}`)
        .set('X-Wx-AppId', TEST_WX_APPID)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(404);
    });
  });

  describe('Admin 管理期次和课节', () => {
    let adminToken;
    let adminTenantId; // 共享 tenantId，供嵌套 beforeEach 使用

    beforeEach(async () => {
      await withSystemContext(null, async () => {
        const tenant = await Tenant.create({
          name: '测试租户',
          slug: 'test-tenant-' + Date.now(),
          wxAppIds: [TEST_WX_APPID]
        });
        adminTenantId = tenant._id;

        await Admin.create({
          email: 'admin@test.com',
          password: 'admin123456',
          name: '管理员',
          role: 'tenant_admin',
          tenantId: adminTenantId
        });
      });

      const res = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123456'
        });

      adminToken = res.body.data.token;
    });

    describe('POST /api/v1/admin/periods - 创建期次', () => {
      it('管理员应该能够创建新期次', async () => {
        const res = await request(app)
          .post('/api/v1/admin/periods')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: '新期次',
            title: '新期次标题',
            startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            description: '新期次描述'
          });

        expect(res.status).to.equal(201);
        expect(res.body.data).to.have.property('_id');
        expect(res.body.data).to.have.property('name', '新期次');
        expect(res.body.data).to.have.property('status', 'not_started');
      });

      it('缺少必需字段应该返回 400', async () => {
        const res = await request(app)
          .post('/api/v1/admin/periods')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: '不完整的期次'
            // 缺少 startDate 和 endDate
          });

        expect(res.status).to.equal(400);
      });

      it('非管理员不能创建期次', async () => {
        const res = await request(app)
          .post('/api/v1/admin/periods')
          .send({
            name: '新期次',
            startDate: '2025-10-01',
            endDate: '2025-12-31'
          });

        expect(res.status).to.equal(401);
      });
    });

    describe('PUT /api/v1/admin/periods/:id - 更新期次', () => {
      let periodId;

      beforeEach(async () => {
        // 用 adminTenantId 创建期次，确保 admin 路由能查到
        await withSystemContext(adminTenantId, async () => {
          const period = await Period.create({
            name: '待更新期次',
            title: '待更新期次标题',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'ongoing'
          });
          periodId = period._id;
        });
      });

      it('管理员应该能够更新期次信息', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/periods/${periodId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: '更新后的期次名称'
          });

        expect(res.status).to.equal(200);
        expect(res.body.data).to.have.property('name', '更新后的期次名称');
      });

      it('应该根据日期重新计算期次状态', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/periods/${periodId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          });

        expect(res.status).to.equal(200);
        expect(res.body.data).to.have.property('status', 'completed');
      });
    });

    describe('POST /api/v1/admin/sections - 创建课节', () => {
      let periodId;

      beforeEach(async () => {
        await withSystemContext(adminTenantId, async () => {
          const period = await Period.create({
            name: '课节期次',
            title: '课节期次标题',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'ongoing'
          });
          periodId = period._id;
        });
      });

      it('管理员应该能够创建课节', async () => {
        const res = await request(app)
          .post('/api/v1/admin/sections')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            periodId,
            title: '新课节',
            day: 1,
            content: '新课节内容',
            duration: 20
          });

        expect(res.status).to.equal(201);
        expect(res.body.data).to.have.property('_id');
        expect(res.body.data).to.have.property('title', '新课节');
      });

      it('缺少必需字段应该返回 400', async () => {
        const res = await request(app)
          .post('/api/v1/admin/sections')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            periodId,
            title: '不完整课节'
            // 缺少 day 和 content
          });

        expect(res.status).to.equal(400);
      });
    });

    describe('PUT /api/v1/admin/sections/:id - 更新课节', () => {
      let sectionId;

      beforeEach(async () => {
        await withSystemContext(adminTenantId, async () => {
          const period = await Period.create({
            name: '课节更新期次',
            title: '课节更新期次标题',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'ongoing'
          });
          const section = await Section.create({
            periodId: period._id,
            title: '待更新课节',
            day: 1,
            content: '待更新课节内容',
            duration: 20
          });
          sectionId = section._id;
        });
      });

      it('管理员应该能够更新课节', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/sections/${sectionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: '更新后的课节'
          });

        expect(res.status).to.equal(200);
        expect(res.body.data).to.have.property('title', '更新后的课节');
      });

      it('应该能够更新课节顺序', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/sections/${sectionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            order: 5
          });

        expect(res.status).to.equal(200);
        expect(res.body.data).to.have.property('order', 5);
      });
    });

    describe('DELETE /api/v1/admin/sections/:id - 删除课节', () => {
      let sectionId;

      beforeEach(async () => {
        await withSystemContext(adminTenantId, async () => {
          const period = await Period.create({
            name: '删除课节期次',
            title: '删除课节期次标题',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'ongoing'
          });
          const section = await Section.create({
            periodId: period._id,
            title: '待删除课节',
            day: 1,
            content: '待删除课节内容',
            duration: 20
          });
          sectionId = section._id;
        });
      });

      it('管理员应该能够删除课节', async () => {
        const res = await request(app)
          .delete(`/api/v1/admin/sections/${sectionId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).to.equal(200);
      });

      it('删除后课节应该从数据库移除', async () => {
        await request(app)
          .delete(`/api/v1/admin/sections/${sectionId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        const deleted = await withSystemContext(null, () => Section.findById(sectionId).exec());
        expect(deleted).to.be.null;
      });
    });
  });

  describe('完整的期次和课节管理流程', () => {
    it('管理员应该能够完成期次和课节的完整管理流程', async () => {
      // 1. 创建租户和管理员
      let flowTenantId;
      await withSystemContext(null, async () => {
        const tenant = await Tenant.create({
          name: '流程测试租户',
          slug: 'flow-test-tenant-' + Date.now(),
          wxAppIds: [TEST_WX_APPID]
        });
        flowTenantId = tenant._id;

        await Admin.create({
          name: '管理员',
          email: 'admin@workflow.com',
          password: 'admin123456',
          role: 'tenant_admin',
          tenantId: flowTenantId
        });
      });

      // 2. 管理员登录
      const loginRes = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'admin@workflow.com',
          password: 'admin123456'
        });

      const adminToken = loginRes.body.data.token;

      // 3. 创建期次
      const createPeriodRes = await request(app)
        .post('/api/v1/admin/periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '完整流程期次',
          startDate: '2025-10-01',
          endDate: '2025-12-31'
        });

      const periodId = createPeriodRes.body.data._id;
      expect(createPeriodRes.status).to.equal(201);

      // 4. 创建多个课节
      const sections = [];
      for (let i = 1; i <= 3; i++) {
        const res = await request(app)
          .post('/api/v1/admin/sections')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            periodId,
            title: `第 ${i} 课`,
            day: i,
            content: `第 ${i} 课内容`,
            duration: 20 + i * 5
          });

        sections.push(res.body.data._id);
      }

      // 5. 查询期次的所有课节（用管理员 token，sections 路由支持 optionalAuth）
      const getSectionsRes = await request(app)
        .get(`/api/v1/sections/period/${periodId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getSectionsRes.body.data).to.have.lengthOf(3);

      // 6. 更新期次状态
      const updatePeriodRes = await request(app)
        .put(`/api/v1/admin/periods/${periodId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'ongoing'
        });

      expect(updatePeriodRes.status).to.equal(200);

      // 7. 删除一个课节
      const deleteSectionRes = await request(app)
        .delete(`/api/v1/admin/sections/${sections[2]}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteSectionRes.status).to.equal(200);

      // 8. 验证删除
      const finalSectionsRes = await request(app)
        .get(`/api/v1/sections/period/${periodId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(finalSectionsRes.body.data).to.have.lengthOf(2);
    });
  });
});
