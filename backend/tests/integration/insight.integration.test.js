/**
 * Insight 业务流程集成测试
 * 测试完整的小凡看见工作流：创建、查询、赞踩、评论
 */

const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;
let User;
let Insight;
let Period;

describe('Insight Integration - 小凡看见业务流程', () => {
  before(async function () {
    this.timeout(60000);

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    User = require('../../src/models/User');
    Insight = require('../../src/models/Insight');
    Period = require('../../src/models/Period');

    app = require('../../src/server');
  });

  after(async function () {
    this.timeout(30000);
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Insight.deleteMany({});
    await Period.deleteMany({});
  });

  describe('POST /api/v1/insights - 创建小凡看见', () => {
    let creatorToken;
    let creatorId;
    let targetUserId;
    let periodId;

    beforeEach(async () => {
      // 创建创建者
      const creatorRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-creator' });

      creatorToken = creatorRes.body.data.accessToken;
      creatorId = creatorRes.body.data.user._id;

      // 创建目标用户
      const targetRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-target' });

      targetUserId = targetRes.body.data.user._id;

      // 创建期次
      const period = await Period.create({
        name: '测试期次',
        title: '测试期次标题',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      periodId = period._id;
    });

    it('应该能够创建小凡看见记录', async () => {
      const res = await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          targetUserId,
          periodId,
          type: 'positive',
          content: '你的打卡很认真！',
          tags: ['认真', '坚持']
        });

      expect(res.status).to.equal(201);
      expect(res.body.data).to.have.property('_id');
      expect(res.body.data).to.have.property('creatorId', creatorId.toString());
      expect(res.body.data).to.have.property('targetUserId', targetUserId.toString());
      expect(res.body.data).to.have.property('content', '你的打卡很认真！');
    });

    it('应该保存到数据库', async () => {
      await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          targetUserId,
          periodId,
          type: 'positive',
          content: '测试内容'
        });

      const insights = await Insight.find({ targetUserId });
      expect(insights).to.have.lengthOf(1);
      expect(insights[0].content).to.equal('测试内容');
    });

    it('缺少必需字段应该返回 400 错误', async () => {
      const res = await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          periodId,
          type: 'positive'
          // 缺少 targetUserId 和 content
        });

      expect(res.status).to.equal(400);
    });

    it('不能给自己创建小凡看见', async () => {
      const res = await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          targetUserId: creatorId,
          periodId,
          type: 'positive',
          content: '不能给自己'
        });

      expect(res.status).to.equal(400);
    });

    it('应该支持不同类型的小凡看见', async () => {
      const types = ['positive', 'inspiring', 'funny', 'thoughtful'];

      for (const type of types) {
        const res = await request(app)
          .post('/api/v1/insights')
          .set('Authorization', `Bearer ${creatorToken}`)
          .send({
            targetUserId,
            periodId,
            type,
            content: `${type} 类型的小凡看见`
          });

        expect(res.status).to.equal(201);
        expect(res.body.data).to.have.property('type', type);
      }
    });
  });

  describe('GET /api/v1/insights - 查询小凡看见', () => {
    let userToken;
    let userId;
    let periodId;
    let insightIds = [];

    beforeEach(async () => {
      // 创建主用户
      const userRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-query-user' });

      userToken = userRes.body.data.accessToken;
      userId = userRes.body.data.user._id;

      // 创建期次
      const period = await Period.create({
        name: '查询测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      periodId = period._id;

      // 创建多个小凡看见
      for (let i = 0; i < 5; i++) {
        // 创建不同的创建者
        const creatorRes = await request(app)
          .post('/api/v1/auth/wechat/login')
          .send({ code: `test-creator-${i}` });

        const creatorToken = creatorRes.body.data.accessToken;

        const res = await request(app)
          .post('/api/v1/insights')
          .set('Authorization', `Bearer ${creatorToken}`)
          .send({
            targetUserId: userId,
            periodId,
            type: 'positive',
            content: `小凡看见 ${i + 1}`
          });

        insightIds.push(res.body.data._id);
      }
    });

    it('应该能够查询当前期次的所有小凡看见', async () => {
      const res = await request(app)
        .get(`/api/v1/insights/period/${periodId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(5);
    });

    it('应该能够查询特定用户的小凡看见', async () => {
      const res = await request(app)
        .get(`/api/v1/insights?targetUserId=${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
    });

    it('应该支持分页查询', async () => {
      const res = await request(app)
        .get(`/api/v1/insights/period/${periodId}?page=1&limit=2`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.length).to.be.at.most(2);
      expect(res.body.pagination).to.have.property('totalPages');
    });

    it('应该能够按类型筛选', async () => {
      const res = await request(app)
        .get(`/api/v1/insights/period/${periodId}?type=positive`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      res.body.data.forEach(insight => {
        expect(insight.type).to.equal('positive');
      });
    });
  });

  describe('PUT /api/v1/insights/:id - 更新小凡看见', () => {
    let creatorToken;
    let targetUserId;
    let periodId;
    let insightId;

    beforeEach(async () => {
      // 创建创建者
      const creatorRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-update-creator' });

      creatorToken = creatorRes.body.data.accessToken;
      const creatorId = creatorRes.body.data.user._id;

      // 创建目标用户
      const targetRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-update-target' });

      targetUserId = targetRes.body.data.user._id;

      // 创建期次
      const period = await Period.create({
        name: '更新测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      periodId = period._id;

      // 创建小凡看见
      const res = await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          targetUserId,
          periodId,
          type: 'positive',
          content: '原始内容'
        });

      insightId = res.body.data._id;
    });

    it('创建者应该能够更新小凡看见', async () => {
      const res = await request(app)
        .put(`/api/v1/insights/${insightId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          content: '更新后的内容'
        });

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('content', '更新后的内容');
    });

    it('其他用户不能更新小凡看见', async () => {
      const otherRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-other-user' });

      const otherToken = otherRes.body.data.accessToken;

      const res = await request(app)
        .put(`/api/v1/insights/${insightId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          content: '不应该能修改'
        });

      expect(res.status).to.equal(403);
    });
  });

  describe('DELETE /api/v1/insights/:id - 删除小凡看见', () => {
    let creatorToken;
    let targetUserId;
    let insightId;

    beforeEach(async () => {
      const creatorRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-delete-creator' });

      creatorToken = creatorRes.body.data.accessToken;

      const targetRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-delete-target' });

      targetUserId = targetRes.body.data.user._id;

      const period = await Period.create({
        name: '删除测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      const res = await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          targetUserId,
          periodId: period._id,
          type: 'positive',
          content: '待删除'
        });

      insightId = res.body.data._id;
    });

    it('创建者应该能够删除小凡看见', async () => {
      const res = await request(app)
        .delete(`/api/v1/insights/${insightId}`)
        .set('Authorization', `Bearer ${creatorToken}`);

      expect(res.status).to.equal(200);
    });

    it('删除后应该从数据库中移除', async () => {
      await request(app)
        .delete(`/api/v1/insights/${insightId}`)
        .set('Authorization', `Bearer ${creatorToken}`);

      const deleted = await Insight.findById(insightId);
      expect(deleted).to.be.null;
    });
  });

  describe('POST /api/v1/insights/:id/like - 赞踩', () => {
    let userToken;
    let userId;
    let insightId;

    beforeEach(async () => {
      // 创建小凡看见的创建者
      const creatorRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-like-creator' });

      const creatorToken = creatorRes.body.data.accessToken;

      // 创建受众用户
      const userRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-like-user' });

      userToken = userRes.body.data.accessToken;
      userId = userRes.body.data.user._id;

      // 创建期次
      const period = await Period.create({
        name: '赞踩测试期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      // 创建小凡看见
      const res = await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          targetUserId: userId,
          periodId: period._id,
          type: 'positive',
          content: '可以赞的小凡看见'
        });

      insightId = res.body.data._id;
    });

    it('应该能够点赞小凡看见', async () => {
      const res = await request(app)
        .post(`/api/v1/insights/${insightId}/like`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'like' });

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('likes');
    });

    it('应该能够取消赞', async () => {
      // 先点赞
      await request(app)
        .post(`/api/v1/insights/${insightId}/like`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'like' });

      // 再取消赞
      const res = await request(app)
        .post(`/api/v1/insights/${insightId}/like`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'unlike' });

      expect(res.status).to.equal(200);
    });
  });

  describe('完整的小凡看见流程', () => {
    it('用户应该能够完成小凡看见的完整生命周期', async () => {
      // 1. 创建两个用户
      const creatorRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-full-creator' });

      const creatorToken = creatorRes.body.data.accessToken;
      const creatorId = creatorRes.body.data.user._id;

      const targetRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-full-target' });

      const targetToken = targetRes.body.data.accessToken;
      const targetId = targetRes.body.data.user._id;

      // 2. 创建期次
      const period = await Period.create({
        name: '完整流程期次',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active'
      });

      // 3. 创建小凡看见
      const createRes = await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          targetUserId: targetId,
          periodId: period._id,
          type: 'positive',
          content: '你的坚持很棒！',
          tags: ['坚持', '优秀']
        });

      const insightId = createRes.body.data._id;
      expect(createRes.status).to.equal(201);

      // 4. 查询目标用户的小凡看见
      const queryRes = await request(app)
        .get(`/api/v1/insights?targetUserId=${targetId}`)
        .set('Authorization', `Bearer ${targetToken}`);

      expect(queryRes.body.data.length).to.be.greaterThan(0);

      // 5. 目标用户对小凡看见点赞
      const likeRes = await request(app)
        .post(`/api/v1/insights/${insightId}/like`)
        .set('Authorization', `Bearer ${targetToken}`)
        .send({ action: 'like' });

      expect(likeRes.status).to.equal(200);

      // 6. 创建者更新小凡看见
      const updateRes = await request(app)
        .put(`/api/v1/insights/${insightId}`)
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          content: '你的坚持真的很棒！'
        });

      expect(updateRes.status).to.equal(200);

      // 7. 删除小凡看见
      const deleteRes = await request(app)
        .delete(`/api/v1/insights/${insightId}`)
        .set('Authorization', `Bearer ${creatorToken}`);

      expect(deleteRes.status).to.equal(200);

      // 8. 验证删除
      const finalQueryRes = await request(app)
        .get(`/api/v1/insights?targetUserId=${targetId}`)
        .set('Authorization', `Bearer ${targetToken}`);

      const stillExists = finalQueryRes.body.data.some(i => i._id === insightId);
      expect(stillExists).to.be.false;
    });
  });
});
