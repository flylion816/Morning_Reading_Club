/**
 * Auth Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Auth Controller', () => {
  let authController;
  let sandbox;
  let req;
  let res;
  let next;
  let UserStub;
  let jwtStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // 创建 mock 对象
    req = {
      body: {},
      user: {}
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    // 创建 Stub
    UserStub = {
      findById: sandbox.stub(),
      findOne: sandbox.stub(),
      create: sandbox.stub()
    };

    jwtStub = {
      generateTokens: sandbox.stub(),
      verifyRefreshToken: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg }),
        serverError: (msg) => ({ code: 500, message: msg })
      }
    };

    const loggerStub = {
      info: sandbox.stub(),
      error: sandbox.stub()
    };

    // 使用 proxyquire 注入 stub
    authController = proxyquire(
      '../../../src/controllers/auth.controller',
      {
        '../models/User': UserStub,
        '../utils/jwt': jwtStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('wechatLogin', () => {
    it('应该在缺少code参数时返回400错误', async () => {
      req.body = {};

      await authController.wechatLogin(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该在开发环境下使用固定的测试用户', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      req.body = { code: 'test_code' };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        openid: 'test_openid',
        nickname: '测试用户',
        avatar: '🦁',
        role: 'user',
        status: 'active',
        save: sandbox.stub().resolves()
      };

      UserStub.findById.resolves(mockUser);
      jwtStub.generateTokens.returns({
        accessToken: 'token123',
        refreshToken: 'refresh123',
        expiresIn: 3600
      });

      await authController.wechatLogin(req, res, next);

      expect(UserStub.findById.called).to.be.true;

      process.env.NODE_ENV = originalEnv;
    });

    it('应该为新用户创建账户', async () => {
      req.body = { code: 'test_code' };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        openid: 'mock_user_001',
        nickname: '微信用户',
        avatar: '🦁',
        role: 'user',
        status: 'active',
        lastLoginAt: new Date()
      };

      UserStub.findOne.resolves(null);
      UserStub.create.resolves(mockUser);
      jwtStub.generateTokens.returns({
        accessToken: 'token123',
        refreshToken: 'refresh123',
        expiresIn: 3600
      });

      await authController.wechatLogin(req, res, next);

      expect(UserStub.findOne.called).to.be.true;
      expect(UserStub.create.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该为现有用户更新最后登录时间', async () => {
      req.body = { code: 'test_user_atai' };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        openid: 'mock_user_001',
        nickname: '测试用户',
        avatar: '🦁',
        role: 'user',
        status: 'active',
        lastLoginAt: new Date('2025-01-01'),
        save: sandbox.stub().resolves()
      };

      UserStub.findOne.resolves(mockUser);
      jwtStub.generateTokens.returns({
        accessToken: 'token123',
        refreshToken: 'refresh123',
        expiresIn: 3600
      });

      await authController.wechatLogin(req, res, next);

      expect(mockUser.save.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该在响应中包含用户信息和令牌', async () => {
      req.body = { code: 'test_code' };

      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        openid: 'mock_user_001',
        nickname: '测试用户',
        avatar: '🦁',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'user',
        status: 'active',
        save: sandbox.stub().resolves()
      };

      UserStub.findOne.resolves(mockUser);
      jwtStub.generateTokens.returns({
        accessToken: 'token123',
        refreshToken: 'refresh123',
        expiresIn: 3600
      });

      await authController.wechatLogin(req, res, next);

      expect(res.json.called).to.be.true;
      const jsonCall = res.json.getCall(0);
      if (jsonCall) {
        const responseData = jsonCall.args[0];
        expect(responseData.code).to.equal(200);
        expect(responseData.data).to.have.property('accessToken');
        expect(responseData.data).to.have.property('user');
        expect(responseData.data.user).to.have.property('_id');
        expect(responseData.data.user).to.have.property('openid');
      }
    });

    it('应该捕获错误并传递给next middleware', async () => {
      req.body = { code: 'test_code' };

      UserStub.findOne.rejects(new Error('Database error'));

      await authController.wechatLogin(req, res, next);

      expect(next.called).to.be.true;
    });
  });

  describe('refreshToken', () => {
    it('应该在缺少refreshToken时返回400错误', async () => {
      req.body = {};

      await authController.refreshToken(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该返回新的accessToken', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.body = { refreshToken: 'valid_refresh_token' };

      const mockUser = {
        _id: userId,
        status: 'active'
      };

      jwtStub.verifyRefreshToken.returns({ userId });
      UserStub.findById.resolves(mockUser);
      jwtStub.generateTokens.returns({
        accessToken: 'new_token123',
        refreshToken: 'new_refresh123',
        expiresIn: 3600
      });

      await authController.refreshToken(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('accessToken');
    });

    it('应该在用户不存在时返回404错误', async () => {
      req.body = { refreshToken: 'valid_refresh_token' };

      const userId = new mongoose.Types.ObjectId();
      jwtStub.verifyRefreshToken.returns({ userId });
      UserStub.findById.resolves(null);

      await authController.refreshToken(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该在用户被禁用时返回403错误', async () => {
      req.body = { refreshToken: 'valid_refresh_token' };

      const userId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: userId,
        status: 'inactive'
      };

      jwtStub.verifyRefreshToken.returns({ userId });
      UserStub.findById.resolves(mockUser);

      await authController.refreshToken(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });

    it('应该返回正确的expiresIn字段', async () => {
      req.body = { refreshToken: 'valid_refresh_token' };

      const userId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: userId,
        status: 'active'
      };

      jwtStub.verifyRefreshToken.returns({ userId });
      UserStub.findById.resolves(mockUser);
      jwtStub.generateTokens.returns({
        accessToken: 'token123',
        refreshToken: 'refresh123',
        expiresIn: 3600
      });

      await authController.refreshToken(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('expiresIn');
      expect(responseData.data.expiresIn).to.equal(3600);
    });
  });
});
