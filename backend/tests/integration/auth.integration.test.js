/**
 * Auth 流程集成测试
 * 测试完整的认证工作流：登录 → token 获取 → token 刷新 → 使用 token 访问受保护资源
 */

const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;
let User;

describe('Auth Integration - 认证流程', () => {
  before(async function () {
    this.timeout(60000);

    // 启动内存 MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // 连接到内存数据库
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // 导入 User 模型
    User = require('../../src/models/User');

    // 创建 Express 应用
    app = require('../../src/server');
  });

  after(async function () {
    this.timeout(30000);
    // 断开数据库连接
    await mongoose.disconnect();
    // 关闭内存 MongoDB
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // 清空数据库
    await User.deleteMany({});
  });

  describe('POST /api/v1/auth/wechat/login', () => {
    it('应该能够使用微信 code 进行登录', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-12345' });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('code', 0);
      expect(res.body.data).to.have.property('accessToken');
      expect(res.body.data).to.have.property('refreshToken');
      expect(res.body.data).to.have.property('expiresIn', 7200);
      expect(res.body.data.user).to.have.property('_id');
      expect(res.body.data.user).to.have.property('openid');
    });

    it('登录成功后应该在数据库中创建用户', async () => {
      await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-12345' });

      const users = await User.find({});
      expect(users).to.have.lengthOf(1);
      expect(users[0]).to.have.property('openid');
    });

    it('相同的微信 openid 再次登录应该返回同一个用户', async () => {
      // 第一次登录
      const res1 = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-same' });

      const userId1 = res1.body.data.user._id;

      // 第二次登录（相同 code）
      const res2 = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-same' });

      const userId2 = res2.body.data.user._id;

      // 应该是同一个用户
      expect(userId1).to.equal(userId2);

      // 数据库中应该只有一个用户
      const users = await User.find({});
      expect(users).to.have.lengthOf(1);
    });

    it('缺少 code 参数应该返回错误', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({});

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('code').that.is.not.equal(0);
    });

    it('响应中的 token 应该是有效的 JWT', async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-jwt' });

      const token = res.body.data.accessToken;

      // Token 应该有 3 部分（header.payload.signature）
      expect(token.split('.')).to.have.lengthOf(3);
    });
  });

  describe('POST /api/v1/auth/refresh - Token 刷新', () => {
    let refreshToken;
    let userId;

    beforeEach(async () => {
      // 先进行登录获取 refresh token
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-refresh' });

      refreshToken = res.body.data.refreshToken;
      userId = res.body.data.user._id;
    });

    it('应该能够使用 refresh token 获得新的 access token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('code', 0);
      expect(res.body.data).to.have.property('accessToken');
      expect(res.body.data).to.have.property('refreshToken');
      expect(res.body.data).to.have.property('expiresIn', 7200);
    });

    it('新的 access token 应该能够访问受保护的资源', async () => {
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      const newAccessToken = refreshRes.body.data.accessToken;

      // 使用新 token 访问受保护资源
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('_id', userId);
    });

    it('缺少 refreshToken 参数应该返回错误', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('code').that.is.not.equal(0);
    });

    it('无效的 refresh token 应该返回 401 错误', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' });

      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('code').that.is.not.equal(0);
    });

    it('过期的 refresh token 应该返回 401 错误', async () => {
      // 生成一个过期的 token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId, openid: 'test' },
        process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-87654321',
        { expiresIn: '-1h' } // 已过期
      );

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: expiredToken });

      expect(res.status).to.equal(401);
    });
  });

  describe('使用 Token 访问受保护的资源', () => {
    let accessToken;
    let userId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-protected' });

      accessToken = res.body.data.accessToken;
      userId = res.body.data.user._id;
    });

    it('带有有效 token 应该能够访问 /api/v1/users/me', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property('_id', userId);
    });

    it('没有 token 应该返回 401 错误', async () => {
      const res = await request(app)
        .get('/api/v1/users/me');

      expect(res.status).to.equal(401);
    });

    it('格式错误的 Authorization header 应该返回 401 错误', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `InvalidFormat ${accessToken}`);

      expect(res.status).to.equal(401);
    });

    it('无效的 token 应该返回 401 错误', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).to.equal(401);
    });

    it('过期的 token 应该返回 401 错误', async () => {
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId, openid: 'test' },
        process.env.JWT_SECRET || 'dev-secret-key-12345678',
        { expiresIn: '-1h' }
      );

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).to.equal(401);
    });
  });

  describe('完整的登录流程', () => {
    it('用户应该能够完成登录 → 刷新 → 访问资源的流程', async () => {
      // 1. 用户登录
      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-complete-flow' });

      expect(loginRes.status).to.equal(200);
      const { accessToken, refreshToken, user } = loginRes.body.data;
      const userId = user._id;

      // 2. 使用 access token 访问受保护资源
      const getRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).to.equal(200);
      expect(getRes.body.data._id).to.equal(userId);

      // 3. 刷新 token
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).to.equal(200);
      const newAccessToken = refreshRes.body.data.accessToken;

      // 4. 使用新的 access token 访问资源
      const getRes2 = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(getRes2.status).to.equal(200);
      expect(getRes2.body.data._id).to.equal(userId);
    });

    it('登录后的用户应该能够更新个人信息', async () => {
      // 1. 登录
      const loginRes = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({ code: 'test-code-update-profile' });

      const accessToken = loginRes.body.data.accessToken;

      // 2. 更新个人信息
      const updateRes = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          nickname: '新用户名',
          avatar: 'https://example.com/avatar.jpg'
        });

      expect(updateRes.status).to.equal(200);
      expect(updateRes.body.data).to.have.property('nickname', '新用户名');

      // 3. 验证更新后的数据
      const getRes = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.body.data).to.have.property('nickname', '新用户名');
    });
  });
});
