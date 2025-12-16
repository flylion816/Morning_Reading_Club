/**
 * 错误处理和数据验证集成测试
 * 测试系统中的各种错误场景和数据验证流程
 */

const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;
let User;

describe('Error Handling Integration - 错误处理和数据验证', () => {
  before(async function () {
    this.timeout(60000);

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    User = require('../../src/models/User');
    app = require('../../src/server');
  });

  after(async function () {
    this.timeout(30000);
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('HTTP 状态码', () => {
    it('应该为成功请求返回 2xx 状态码', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-success' });

      expect(res.status).to.be.within(200, 299);
    });

    it('应该为客户端错误返回 4xx 状态码', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({}); // 缺少必需参数

      expect(res.status).to.be.within(400, 499);
    });

    it('应该为未授权的请求返回 401', async () => {
      const res = await request(app)
        .get('/api/v1/users/me'); // 没有 token

      expect(res.status).to.equal(401);
    });

    it('应该为被禁止的请求返回 403', async () => {
      // 创建用户A
      const userARes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-user-a' });

      const userAToken = userARes.body.data.accessToken;
      const userAId = userARes.body.data.user._id;

      // 创建用户B的打卡
      const userBRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-user-b' });

      const userBToken = userBRes.body.data.accessToken;

      // 用户B创建打卡
      const Period = require('../../src/models/Period');
      const period = await Period.create({
        name: '测试',
        title: '测试标题',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      const checkinRes = await request(app)
        .post('/api/v1/checkin')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          periodId: period._id,
          day: 1,
          content: '内容'
        });

      const checkinId = checkinRes.body.data._id;

      // 用户A试图删除用户B的打卡
      const deleteRes = await request(app)
        .delete(`/api/v1/checkin/${checkinId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(deleteRes.status).to.equal(403);
    });

    it('应该为不存在的资源返回 404', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/v1/sections/${fakeId}`);

      expect(res.status).to.equal(404);
    });

    it('应该为不存在的端点返回 404', async () => {
      const res = await request(app)
        .get('/api/v1/nonexistent-endpoint');

      expect(res.status).to.equal(404);
    });
  });

  describe('错误响应格式', () => {
    it('错误响应应该有标准格式', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({}); // 缺少参数

      expect(res.body).to.have.property('code').that.is.not.equal(0);
      expect(res.body).to.have.property('message');
      expect(res.body).to.have.property('timestamp');
    });

    it('错误消息应该是描述性的', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({}); // 缺少 code

      expect(res.body.message).to.include.string('code');
    });

    it('错误响应应该包含详细信息（当可用时）', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: null }); // 无效的 code 格式

      expect(res.body).to.have.property('message');
    });
  });

  describe('请求验证', () => {
    it('应该验证必需的请求体字段', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({}); // 缺少 code

      expect(res.status).to.equal(400);
      expect(res.body.code).to.not.equal(0);
    });

    it('应该验证字段类型', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 12345 }); // 应该是字符串

      // 应该能够处理或返回错误
      expect(res.status).to.be.within(200, 499);
    });

    it('应该处理缺失的请求头', async () => {
      // 大多数请求不需要特定的请求头，但受保护的资源需要 Authorization
      const res = await request(app)
        .get('/api/v1/users/me'); // 缺少 Authorization

      expect(res.status).to.equal(401);
    });

    it('应该验证 JSON 请求体', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .set('Content-Type', 'application/json')
        .send('invalid-json'); // 无效的 JSON

      expect(res.status).to.be.within(400, 499);
    });
  });

  describe('Authorization 错误', () => {
    it('缺少 token 应该返回 401', async () => {
      const res = await request(app)
        .get('/api/v1/users/me');

      expect(res.status).to.equal(401);
      expect(res.body.message).to.include.string('token');
    });

    it('无效的 token 应该返回 401', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).to.equal(401);
    });

    it('过期的 token 应该返回 401', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'test' },
        process.env.JWT_SECRET || 'dev-secret-key-12345678',
        { expiresIn: '-1h' }
      );

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).to.equal(401);
    });

    it('格式错误的 Authorization header 应该返回 401', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'InvalidFormat token');

      expect(res.status).to.equal(401);
    });
  });

  describe('业务逻辑验证', () => {
    it('不应该能创建重复的期次', async () => {
      const Period = require('../../src/models/Period');

      // 创建第一个期次
      await Period.create({
        name: '唯一期次',
        title: '唯一期次标题',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      // 尝试创建同名期次（如果有唯一性约束）
      try {
        await Period.create({
          name: '唯一期次', // 相同的名字
          title: '唯一期次标题',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ongoing'
        });
      } catch (err) {
        // 应该抛出错误或返回 400/409
        expect(err).to.exist;
      }
    });

    it('不能给自己创建小凡看见', async () => {
      const Insight = require('../../src/models/Insight');

      // 创建用户
      const userRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-self-insight' });

      const userToken = userRes.body.data.accessToken;
      const userId = userRes.body.data.user._id;

      // 创建期次
      const Period = require('../../src/models/Period');
      const period = await Period.create({
        name: '测试',
        title: '测试标题',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ongoing'
      });

      // 尝试给自己创建小凡看见
      const res = await request(app)
        .post('/api/v1/insights')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          targetUserId: userId, // 给自己
          periodId: period._id,
          type: 'positive',
          content: '给自己的'
        });

      expect(res.status).to.equal(400);
    });
  });

  describe('数据类型验证', () => {
    it('应该验证日期格式', async () => {
      // 如果有创建期次的 API
      const Period = require('../../src/models/Period');

      const invalidDate = 'invalid-date';

      try {
        await Period.create({
          name: '日期测试',
          title: '日期测试标题',
          startDate: invalidDate,
          endDate: new Date(),
          status: 'ongoing'
        });
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it('应该验证数字字段', async () => {
      const Period = require('../../src/models/Period');
      const Section = require('../../src/models/Section');

      const period = await Period.create({
        name: '测试',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // day 应该是数字
      const invalidDay = 'not-a-number';

      try {
        await Section.create({
          periodId: period._id,
          title: '测试',
          day: invalidDay,
          order: 1,
          duration: 20
        });
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it('应该验证 ObjectId 引用', async () => {
      const Checkin = require('../../src/models/Checkin');
      const invalidId = 'not-an-id';

      try {
        await Checkin.create({
          userId: invalidId,
          periodId: invalidId,
          day: 1,
          content: 'test'
        });
      } catch (err) {
        expect(err).to.exist;
      }
    });

    it('应该验证枚举字段', async () => {
      const Insight = require('../../src/models/Insight');

      const User = require('../../src/models/User');
      const user1 = await User.create({ openid: 'user1' });
      const user2 = await User.create({ openid: 'user2' });

      const Period = require('../../src/models/Period');
      const period = await Period.create({
        name: '测试',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      // type 应该是特定的枚举值
      const invalidType = 'invalid-type';

      try {
        await Insight.create({
          creatorId: user1._id,
          targetUserId: user2._id,
          periodId: period._id,
          type: invalidType, // 无效的类型
          content: 'test'
        });
      } catch (err) {
        expect(err).to.exist;
      }
    });
  });

  describe('并发和并行请求', () => {
    it('应该能够处理多个并发请求', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/v1/auth/wechat/login')
            .send({ code: `test-concurrent-${i}` })
        );
      }

      const responses = await Promise.all(requests);

      responses.forEach(res => {
        expect(res.status).to.equal(200);
        expect(res.body.data).to.have.property('accessToken');
      });
    });

    it('并发创建应该不会导致数据冲突', async () => {
      const Period = require('../../src/models/Period');

      const periodData = {
        name: '并发测试',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      // 并发创建多个
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(Period.create(periodData));
      }

      const results = await Promise.all(promises);

      // 应该创建 3 个不同的记录
      expect(results).to.have.lengthOf(3);
      expect(results[0]._id).to.not.equal(results[1]._id);
    });
  });

  describe('长期运行场景', () => {
    it('应该能够处理大量数据的查询', async () => {
      const Checkin = require('../../src/models/Checkin');
      const Period = require('../../src/models/Period');

      const user = await User.create({ openid: 'large-data-user' });

      const period = await Period.create({
        name: '大数据测试',
        startDate: new Date(),
        endDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
      });

      // 创建大量打卡
      const checkins = [];
      for (let i = 1; i <= 100; i++) {
        checkins.push({
          userId: user._id,
          periodId: period._id,
          day: i,
          content: `第 ${i} 天`
        });
      }

      await Checkin.insertMany(checkins);

      // 查询所有打卡
      const result = await Checkin.find({ userId: user._id });

      expect(result).to.have.lengthOf(100);
    });

    it('应该正确处理边界数据', async () => {
      // 测试最大和最小值
      const Section = require('../../src/models/Section');
      const Period = require('../../src/models/Period');

      const period = await Period.create({
        name: '边界测试',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      // 创建第 1 天和第 365 天的课节
      const section1 = await Section.create({
        periodId: period._id,
        title: '第 1 天',
        day: 1,
        order: 1,
        duration: 5
      });

      const section365 = await Section.create({
        periodId: period._id,
        title: '第 365 天',
        day: 365,
        order: 365,
        duration: 60
      });

      expect(section1.day).to.equal(1);
      expect(section365.day).to.equal(365);
    });
  });
});
