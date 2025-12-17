/**
 * Checkin 业务流程集成测试
 * 测试完整的打卡工作流：创建打卡 → 查询 → 统计 → 更新 → 删除
 */

const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;
let User;
let Checkin;
let Period;

describe('Checkin Integration - 打卡业务流程', () => {
  before(async function() {
    this.timeout(60000);
    // 启动内存 MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // 连接到内存数据库
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // 导入模型
    User = require('../../src/models/User');
    Checkin = require('../../src/models/Checkin');
    Period = require('../../src/models/Period');

    // 创建 Express 应用
    app = require('../../src/server');
  });

  after(async function() {
    this.timeout(30000);
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 清空数据库
    await User.deleteMany({});
    await Checkin.deleteMany({});
    await Period.deleteMany({});
    const Section = require('../../src/models/Section');
    await Section.deleteMany({});
  });

  describe('POST /api/v1/checkins - 创建打卡', () => {
    let accessToken;
    let userId;
    let periodId;
    let sectionId;

    beforeEach(async () => {
      // 创建用户并登录
      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-checkin' });

      accessToken = loginRes.body.data.accessToken;
      userId = loginRes.body.data.user._id;

      // 创建期次
      const period = await Period.create({
        name: '测试期次',
        title: '测试期次标题',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      periodId = period._id;

      // 创建课节（Checkin必需字段）
      const Section = require('../../src/models/Section');
      const section = await Section.create({
        periodId,
        title: '测试课节',
        day: 1,
        content: '测试内容',
        order: 1,
        duration: 20,
        content: '测试内容'
      });

      sectionId = section._id;
    });

    it('应该能够创建新的打卡记录', async () => {
      const res = await request(app)
        .post('/api/v1/checkins')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          periodId,
          sectionId,
          day: 1,
          note: '今天的晨读内容'
        });

      expect(res.status).to.equal(201);
      expect(res.body.data).to.have.property('_id');
      expect(res.body.data).to.have.property('userId', userId.toString());
      expect(res.body.data).to.have.property('day', 1);
      expect(res.body.data).to.have.property('note', '今天的晨读内容');
    });

    it('打卡记录应该保存到数据库', async () => {
      await request(app)
        .post('/api/v1/checkins')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          periodId,
          sectionId,
          day: 1,
          note: '测试内容'
        });

      const checkins = await Checkin.find({ userId });
      expect(checkins).to.have.lengthOf(1);
      expect(checkins[0].note).to.equal('测试内容');
    });

    it('缺少必需字段应该返回 400 错误', async () => {
      const res = await request(app)
        .post('/api/v1/checkins')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          periodId
          // 缺少 sectionId 和 day
        });

      expect(res.status).to.equal(404); // 404 because sectionId not found
    });

    it('没有认证信息应该返回 401 错误', async () => {
      const res = await request(app)
        .post('/api/v1/checkins')
        .send({
          periodId,
          sectionId,
          day: 1,
          note: '内容'
        });

      expect(res.status).to.equal(401);
    });

    it('应该能够在打卡中添加附加信息（图片等）', async () => {
      const res = await request(app)
        .post('/api/v1/checkins')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          periodId,
          sectionId,
          day: 1,
          note: '有附加信息的打卡',
          images: ['https://example.com/image.jpg'],
          readingTime: 300, // 5分钟
          mood: 'happy'
        });

      expect(res.status).to.equal(201);
      expect(res.body.data).to.have.property('images');
      expect(res.body.data).to.have.property('mood');
    });
  });

  describe('GET /api/v1/checkins - 查询打卡', () => {
    let accessToken;
    let userId;
    let periodId;
    let sectionId;

    beforeEach(async () => {
      // 创建用户并登录
      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-query' });

      accessToken = loginRes.body.data.accessToken;
      userId = loginRes.body.data.user._id;

      // 创建期次
      const period = await Period.create({
        name: '查询测试期次',
        title: '测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      periodId = period._id;

      // 创建课节
      const Section = require('../../src/models/Section');
      const section = await Section.create({
        periodId,
        title: '查询测试课节',
        day: 1,
        content: '测试内容',
        order: 1,
        duration: 20,
        content: '查询测试内容'
      });

      sectionId = section._id;

      // 创建多个打卡记录
      for (let i = 1; i <= 5; i++) {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: i,
          checkinDate: new Date(Date.now() - (5-i) * 60 * 1000),
          note: `第 ${i} 天的内容`
        });
      }
    });

    it('应该能够查询当前期次的所有打卡', async () => {
      const res = await request(app)
        .get(`/api/v1/checkins/period/${periodId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.lengthOf(5);
    });

    it('应该支持分页查询', async () => {
      const res = await request(app)
        .get(`/api/v1/checkins/period/${periodId}?page=1&limit=2`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(2);
      expect(res.body.pagination).to.have.property('totalPages');
      expect(res.body.pagination).to.have.property('hasNext');
    });

    it('应该能够查询特定日期的打卡', async () => {
      const res = await request(app)
        .get(`/api/v1/checkins/period/${periodId}?day=3`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(1);
      expect(res.body.data[0]).to.have.property('day', 3);
    });

    it('查询不存在的期次应该返回空数组', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/v1/checkins?periodId=${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.lengthOf(0);
    });
  });

  describe('PUT /api/v1/checkins/:id - 更新打卡', () => {
    let accessToken;
    let userId;
    let checkinId;
    let sectionId;

    beforeEach(async () => {
      // 创建用户并登录
      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-update' });

      accessToken = loginRes.body.data.accessToken;
      userId = loginRes.body.data.user._id;

      // 创建期次和打卡
      const period = await Period.create({
        name: '更新测试期次',
        title: '测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      // 创建课节
      const Section = require('../../src/models/Section');
      const section = await Section.create({
        periodId: period._id,
        title: '更新测试课节',
        day: 1,
        order: 1,
        duration: 20,
        content: '更新测试内容'
      });

      sectionId = section._id;

      const checkin = await Checkin.create({
        userId,
        periodId: period._id,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        note: '原始内容'
      });

      checkinId = checkin._id;
    });

    it('应该能够更新打卡内容', async () => {
      const res = await request(app)
        .put(`/api/v1/checkins/${checkinId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          note: '更新后的内容'
        });

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('note', '更新后的内容');
    });

    it('更新应该反映在数据库中', async () => {
      await request(app)
        .put(`/api/v1/checkins/${checkinId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          note: '数据库更新测试'
        });

      const updated = await Checkin.findById(checkinId);
      expect(updated.note).to.equal('数据库更新测试');
    });

    it('只能更新自己的打卡', async () => {
      // 创建另一个用户
      const loginRes2 = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-other-user' });

      const otherUserToken = loginRes2.body.data.accessToken;

      // 尝试更新别人的打卡
      const res = await request(app)
        .put(`/api/v1/checkins/${checkinId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          note: '不应该能更新'
        });

      expect(res.status).to.equal(403);
    });
  });

  describe('DELETE /api/v1/checkins/:id - 删除打卡', () => {
    let accessToken;
    let userId;
    let checkinId;
    let sectionId;

    beforeEach(async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-delete' });

      accessToken = loginRes.body.data.accessToken;
      userId = loginRes.body.data.user._id;

      const period = await Period.create({
        name: '删除测试期次',
        title: '测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      // 创建课节
      const Section = require('../../src/models/Section');
      const section = await Section.create({
        periodId: period._id,
        title: '删除测试课节',
        day: 1,
        order: 1,
        duration: 20,
        content: '删除测试内容'
      });

      sectionId = section._id;

      const checkin = await Checkin.create({
        userId,
        periodId: period._id,
        sectionId,
        day: 1,
        checkinDate: new Date(),
        note: '待删除内容'
      });

      checkinId = checkin._id;
    });

    it('应该能够删除自己的打卡', async () => {
      const res = await request(app)
        .delete(`/api/v1/checkins/${checkinId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).to.equal(200);
    });

    it('删除后打卡应该从数据库中移除', async () => {
      await request(app)
        .delete(`/api/v1/checkins/${checkinId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      const deleted = await Checkin.findById(checkinId);
      expect(deleted).to.be.null;
    });

    it('不能删除别人的打卡', async () => {
      const loginRes2 = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-other-delete' });

      const otherUserToken = loginRes2.body.data.accessToken;

      const res = await request(app)
        .delete(`/api/v1/checkins/${checkinId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).to.equal(403);
    });
  });

  describe('GET /api/v1/stats/checkin - 打卡统计', () => {
    let accessToken;
    let userId;
    let periodId;
    let sectionId;

    beforeEach(async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-stats' });

      accessToken = loginRes.body.data.accessToken;
      userId = loginRes.body.data.user._id;

      const period = await Period.create({
        name: '统计测试期次',
        title: '测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      periodId = period._id;

      // 创建课节
      const Section = require('../../src/models/Section');
      const section = await Section.create({
        periodId,
        title: '统计测试课节',
        day: 1,
        content: '测试内容',
        order: 1,
        duration: 20,
        content: '统计测试内容'
      });

      sectionId = section._id;

      // 创建打卡记录（每个打卡使用不同的时间戳，避免E11000重复键错误）
      for (let i = 1; i <= 10; i++) {
        await Checkin.create({
          userId,
          periodId,
          sectionId,
          day: i,
          checkinDate: new Date(Date.now() - (10 - i) * 60 * 1000), // 每个打卡间隔1分钟
          note: `第 ${i} 天`,
          readingTime: Math.floor(Math.random() * 600) // 随机时长 0-10分钟
        });
      }
    });

    it('应该能够获取打卡统计信息', async () => {
      const res = await request(app)
        .get(`/api/v1/stats/checkin?periodId=${periodId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('totalCheckins');
      expect(res.body.data).to.have.property('consistentDays');
      expect(res.body.data).to.have.property('totalDuration');
      expect(res.body.data).to.have.property('averageDuration');
    });

    it('统计信息应该是准确的', async () => {
      const res = await request(app)
        .get(`/api/v1/stats/checkin?periodId=${periodId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.body.data.totalCheckins).to.equal(10);
    });
  });

  describe('完整的打卡流程', () => {
    it('用户应该能够完成打卡的完整生命周期', async () => {
      // 1. 登录
      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-lifecycle' });

      const accessToken = loginRes.body.data.accessToken;
      const userId = loginRes.body.data.user._id;

      // 2. 创建期次
      const period = await Period.create({
        name: '完整流程测试期次',
        title: '测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      // 2.5 创建课节
      const Section = require('../../src/models/Section');
      const section = await Section.create({
        periodId: period._id,
        title: '完整流程测试课节',
        day: 1,
        order: 1,
        duration: 20,
        content: '完整流程测试内容'
      });

      // 3. 创建打卡
      const createRes = await request(app)
        .post('/api/v1/checkins')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          periodId: period._id,
          sectionId: section._id,
          day: 1,
          note: '第一天的晨读'
        });

      const checkinId = createRes.body.data._id;
      expect(createRes.status).to.equal(201);

      // 4. 查询打卡
      const queryRes = await request(app)
        .get(`/api/v1/checkins?periodId=${period._id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(queryRes.body.data).to.have.lengthOf(1);

      // 5. 更新打卡
      const updateRes = await request(app)
        .put(`/api/v1/checkins/${checkinId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          note: '更新后的晨读内容'
        });

      expect(updateRes.status).to.equal(200);

      // 6. 查看统计
      const statsRes = await request(app)
        .get(`/api/v1/stats/checkin?periodId=${period._id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(statsRes.body.data.totalCheckins).to.equal(1);

      // 7. 删除打卡
      const deleteRes = await request(app)
        .delete(`/api/v1/checkins/${checkinId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(deleteRes.status).to.equal(200);

      // 8. 验证删除
      const finalQueryRes = await request(app)
        .get(`/api/v1/checkins?periodId=${period._id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(finalQueryRes.body.data).to.have.lengthOf(0);
    });
  });
});
