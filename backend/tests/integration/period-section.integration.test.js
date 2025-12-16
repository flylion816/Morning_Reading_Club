/**
 * Period 和 Section 业务流程集成测试
 * 测试期次和课节的完整管理流程
 */

const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;
let Period;
let Section;
let Admin;

describe('Period & Section Integration - 期次和课节管理', () => {
  before(async function () {
    this.timeout(60000);

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    Period = require('../../src/models/Period');
    Section = require('../../src/models/Section');
    Admin = require('../../src/models/Admin');

    app = require('../../src/server');
  });

  after(async function () {
    this.timeout(30000);
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Period.deleteMany({});
    await Section.deleteMany({});
    await Admin.deleteMany({});
  });

  describe('GET /api/v1/periods - 查询期次', () => {
    beforeEach(async () => {
      // 创建多个期次
      const periods = [
        {
          name: '第一季',
          title: '第一季标题',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
          status: 'completed'
        },
        {
          name: '第二季',
          title: '第二季标题',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2025-06-30'),
          status: 'ongoing'
        },
        {
          name: '第三季',
          title: '第三季标题',
          startDate: new Date('2025-07-01'),
          endDate: new Date('2025-09-30'),
          status: 'not_started'
        }
      ];

      await Period.insertMany(periods);
    });

    it('应该能够查询所有期次', async () => {
      const res = await request(app)
        .get('/api/v1/periods');

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.lengthOf(3);
    });

    it('应该能够按状态筛选期次', async () => {
      const res = await request(app)
        .get('/api/v1/periods?status=active');

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0]).to.have.property('status', 'active');
    });

    it('应该支持分页查询', async () => {
      const res = await request(app)
        .get('/api/v1/periods?page=1&limit=2');

      expect(res.status).to.equal(200);
      expect(res.body.data.length).to.be.at.most(2);
      expect(res.body.pagination).to.have.property('totalPages');
    });

    it('应该按开始日期排序', async () => {
      const res = await request(app)
        .get('/api/v1/periods');

      const dates = res.body.data.map(p => new Date(p.startDate));
      expect(dates[0] <= dates[1]).to.be.true;
      expect(dates[1] <= dates[2]).to.be.true;
    });
  });

  describe('GET /api/v1/periods/:id/sections - 查询期次的课节', () => {
    let periodId;

    beforeEach(async () => {
      // 创建期次
      const period = await Period.create({
        name: '测试期次',
        title: '测试期次标题',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      periodId = period._id;

      // 创建课节
      const sections = [
        {
          periodId,
          title: '第1课 - 认识自我',
          day: 1,
          order: 1,
          duration: 20
        },
        {
          periodId,
          title: '第2课 - 设定目标',
          day: 2,
          order: 2,
          duration: 25
        },
        {
          periodId,
          title: '第3课 - 行动计划',
          day: 3,
          order: 3,
          duration: 22
        }
      ];

      await Section.insertMany(sections);
    });

    it('应该能够查询期次的所有课节', async () => {
      const res = await request(app)
        .get(`/api/v1/periods/${periodId}/sections`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.lengthOf(3);
    });

    it('课节应该按顺序排列', async () => {
      const res = await request(app)
        .get(`/api/v1/periods/${periodId}/sections`);

      const orders = res.body.data.map(s => s.order);
      expect(orders).to.deep.equal([1, 2, 3]);
    });

    it('应该包含正确的课节信息', async () => {
      const res = await request(app)
        .get(`/api/v1/periods/${periodId}/sections`);

      const section = res.body.data[0];
      expect(section).to.have.property('title');
      expect(section).to.have.property('day');
      expect(section).to.have.property('order');
      expect(section).to.have.property('duration');
    });

    it('应该支持按日期范围查询', async () => {
      const res = await request(app)
        .get(`/api/v1/periods/${periodId}/sections?startDay=1&endDay=2`);

      expect(res.status).to.equal(200);
      expect(res.body.data.length).to.be.at.most(2);
    });
  });

  describe('GET /api/v1/sections/:id - 获取课节详情', () => {
    let sectionId;
    let periodId;

    beforeEach(async () => {
      const period = await Period.create({
        name: '详情测试期次',
        title: '详情测试期次标题',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      periodId = period._id;

      const section = await Section.create({
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

    it('应该能够获取课节的完整信息', async () => {
      const res = await request(app)
        .get(`/api/v1/sections/${sectionId}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('_id', sectionId.toString());
      expect(res.body.data).to.have.property('title');
      expect(res.body.data).to.have.property('description');
      expect(res.body.data).to.have.property('content');
    });

    it('课节应该包含关联的期次信息', async () => {
      const res = await request(app)
        .get(`/api/v1/sections/${sectionId}`);

      expect(res.body.data).to.have.property('periodId');
    });

    it('不存在的课节应该返回 404', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/v1/sections/${fakeId}`);

      expect(res.status).to.equal(404);
    });
  });

  describe('Admin 管理期次和课节', () => {
    let adminToken;

    beforeEach(async () => {
      // 创建管理员账户
      const admin = await Admin.create({
        email: 'admin@test.com',
        password: 'admin123456',
        name: '管理员'
      });

      // 登录获取 token
      const res = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123456'
        });

      adminToken = res.body.data.accessToken;
    });

    describe('POST /api/v1/admin/periods - 创建期次', () => {
      it('管理员应该能够创建新期次', async () => {
        const res = await request(app)
          .post('/api/v1/admin/periods')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: '新期次',
            startDate: '2025-10-01',
            endDate: '2025-12-31',
            description: '新期次描述'
          });

        expect(res.status).to.equal(201);
        expect(res.body.data).to.have.property('_id');
        expect(res.body.data).to.have.property('name', '新期次');
        expect(res.body.data).to.have.property('status', 'upcoming');
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
        const period = await Period.create({
          name: '待更新期次',
          title: '待更新期次标题',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ongoing'
        });

        periodId = period._id;
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

      it('应该能够更改期次状态', async () => {
        const res = await request(app)
          .put(`/api/v1/admin/periods/${periodId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'completed'
          });

        expect(res.status).to.equal(200);
        expect(res.body.data).to.have.property('status', 'completed');
      });
    });

    describe('POST /api/v1/admin/sections - 创建课节', () => {
      let periodId;

      beforeEach(async () => {
        const period = await Period.create({
          name: '课节期次',
          title: '课节期次标题',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ongoing'
        });

        periodId = period._id;
      });

      it('管理员应该能够创建课节', async () => {
        const res = await request(app)
          .post('/api/v1/admin/sections')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            periodId,
            title: '新课节',
            day: 1,
            order: 1,
            duration: 20,
            description: '新课节描述'
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
            // 缺少 day, order, duration
          });

        expect(res.status).to.equal(400);
      });
    });

    describe('PUT /api/v1/admin/sections/:id - 更新课节', () => {
      let sectionId;

      beforeEach(async () => {
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
          order: 1,
          duration: 20
        });

        sectionId = section._id;
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
          order: 1,
          duration: 20
        });

        sectionId = section._id;
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

        const deleted = await Section.findById(sectionId);
        expect(deleted).to.be.null;
      });
    });
  });

  describe('完整的期次和课节管理流程', () => {
    it('管理员应该能够完成期次和课节的完整管理流程', async () => {
      // 1. 创建管理员
      const admin = await Admin.create({
        email: 'admin@workflow.com',
        password: 'admin123456'
      });

      // 2. 管理员登录
      const loginRes = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'admin@workflow.com',
          password: 'admin123456'
        });

      const adminToken = loginRes.body.data.accessToken;

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
            order: i,
            duration: 20 + i * 5
          });

        sections.push(res.body.data._id);
      }

      // 5. 查询期次的所有课节
      const getSectionsRes = await request(app)
        .get(`/api/v1/periods/${periodId}/sections`);

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
        .get(`/api/v1/periods/${periodId}/sections`);

      expect(finalSectionsRes.body.data).to.have.lengthOf(2);
    });
  });
});
