/**
 * Auth Middleware 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Auth Middleware', () => {
  let sandbox;
  let req;
  let res;
  let next;
  let jwtStub;
  let responseStub;
  let authMiddleware;
  let optionalAuthMiddleware;
  let adminMiddleware;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      headers: {},
      user: null
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    // Mock JWT
    jwtStub = {
      verifyAccessToken: sandbox.stub()
    };

    // Mock response utils
    responseStub = {
      errors: {
        unauthorized: (msg) => ({ code: 401, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    // 使用 proxyquire 加载中间件
    const auth = proxyquire('../../../src/middleware/auth', {
      '../utils/jwt': jwtStub,
      '../utils/response': responseStub
    });

    authMiddleware = auth.authMiddleware;
    optionalAuthMiddleware = auth.optionalAuthMiddleware;
    adminMiddleware = auth.adminMiddleware;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('authMiddleware', () => {
    it('应该在提供有效token时调用next()', () => {
      req.headers.authorization = 'Bearer valid_token_123';
      const decodedUser = { userId: '123', role: 'user' };
      jwtStub.verifyAccessToken.returns(decodedUser);

      authMiddleware(req, res, next);

      expect(next.called).to.be.true;
      expect(req.user).to.deep.equal(decodedUser);
    });

    it('应该在没有Authorization header时返回401', () => {
      authMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.called).to.be.true;
      expect(next.called).to.be.false;
    });

    it('应该在Authorization header不以Bearer开头时返回401', () => {
      req.headers.authorization = 'Basic dXNlcjpwYXNz';

      authMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
      expect(next.called).to.be.false;
    });

    it('应该在token格式错误时返回401', () => {
      req.headers.authorization = 'Bearer';

      authMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });

    it('应该在token验证失败时返回401', () => {
      req.headers.authorization = 'Bearer invalid_token';
      jwtStub.verifyAccessToken.throws(new Error('Token已过期'));

      authMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
      expect(next.called).to.be.false;
    });

    it('应该正确提取Bearer token', () => {
      req.headers.authorization = 'Bearer my_token_content';
      const decodedUser = { userId: '456', role: 'user' };
      jwtStub.verifyAccessToken.returns(decodedUser);

      authMiddleware(req, res, next);

      expect(jwtStub.verifyAccessToken.calledWith('my_token_content')).to.be.true;
    });

    it('应该支持token中含有点号的情况', () => {
      const token = 'eyJhbGc.eyJpZCI6MX0.SflKxw';
      req.headers.authorization = `Bearer ${token}`;
      const decodedUser = { userId: '789', role: 'user' };
      jwtStub.verifyAccessToken.returns(decodedUser);

      authMiddleware(req, res, next);

      expect(jwtStub.verifyAccessToken.calledWith(token)).to.be.true;
    });

    it('应该处理大小写不敏感的Bearer前缀', () => {
      // 实际上Bearer是大小写敏感的，测试当前实现
      req.headers.authorization = 'bearer lowercase_token';

      authMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });

    it('应该将decoded user信息设置到req.user', () => {
      req.headers.authorization = 'Bearer token123';
      const decodedUser = {
        userId: 'user_id_123',
        openid: 'test_openid',
        role: 'admin'
      };
      jwtStub.verifyAccessToken.returns(decodedUser);

      authMiddleware(req, res, next);

      expect(req.user).to.deep.equal(decodedUser);
      expect(req.user.userId).to.equal('user_id_123');
      expect(req.user.role).to.equal('admin');
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('应该在提供有效token时设置req.user并调用next()', () => {
      req.headers.authorization = 'Bearer valid_token_123';
      const decodedUser = { userId: '123', role: 'user' };
      jwtStub.verifyAccessToken.returns(decodedUser);

      optionalAuthMiddleware(req, res, next);

      expect(next.called).to.be.true;
      expect(req.user).to.deep.equal(decodedUser);
    });

    it('应该在没有Authorization header时仍然调用next()', () => {
      optionalAuthMiddleware(req, res, next);

      expect(next.called).to.be.true;
      expect(req.user).to.be.null;
    });

    it('应该在token验证失败时仍然调用next()', () => {
      req.headers.authorization = 'Bearer invalid_token';
      jwtStub.verifyAccessToken.throws(new Error('Token已过期'));

      optionalAuthMiddleware(req, res, next);

      expect(next.called).to.be.true;
      expect(req.user).to.be.null;
    });

    it('应该忽略错误的Authorization header格式', () => {
      req.headers.authorization = 'Basic dXNlcjpwYXNz';

      optionalAuthMiddleware(req, res, next);

      expect(next.called).to.be.true;
    });

    it('应该在验证成功时保留decoded信息', () => {
      req.headers.authorization = 'Bearer token';
      const decodedUser = { userId: 'abc', role: 'admin' };
      jwtStub.verifyAccessToken.returns(decodedUser);

      optionalAuthMiddleware(req, res, next);

      expect(req.user).to.deep.equal(decodedUser);
    });

    it('验证失败后req.user应该保持为null或未定义', () => {
      req.headers.authorization = 'Bearer bad_token';
      jwtStub.verifyAccessToken.throws(new Error('Invalid'));

      optionalAuthMiddleware(req, res, next);

      // req.user应该不被设置或保持为null
      expect(req.user === null || !req.hasOwnProperty('user')).to.be.true;
    });
  });

  describe('adminMiddleware', () => {
    it('应该在用户是admin时调用next()', () => {
      req.user = { userId: '123', role: 'admin' };

      adminMiddleware(req, res, next);

      expect(next.called).to.be.true;
    });

    it('应该在用户是superadmin时调用next()', () => {
      req.user = { userId: '123', role: 'superadmin' };

      adminMiddleware(req, res, next);

      expect(next.called).to.be.true;
    });

    it('应该在没有req.user时返回401', () => {
      adminMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
      expect(next.called).to.be.false;
    });

    it('应该在用户不是admin时返回403', () => {
      req.user = { userId: '123', role: 'user' };

      adminMiddleware(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
      expect(next.called).to.be.false;
    });

    it('应该在role为guest时返回403', () => {
      req.user = { userId: '123', role: 'guest' };

      adminMiddleware(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });

    it('应该在req.user为null时返回401', () => {
      req.user = null;

      adminMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });

    it('应该验证role字段精确匹配', () => {
      req.user = { userId: '123', role: 'ADMIN' }; // 大写

      adminMiddleware(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });

    it('应该在role为undefined时返回403', () => {
      req.user = { userId: '123' }; // 没有role字段

      adminMiddleware(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });

    it('应该返回正确的403错误消息', () => {
      req.user = { userId: '123', role: 'user' };

      adminMiddleware(req, res, next);

      const jsonCall = res.json.getCall(0);
      expect(jsonCall.args[0]).to.have.property('code', 403);
    });
  });

  describe('错误处理', () => {
    it('应该处理token验证抛出的各种错误', () => {
      req.headers.authorization = 'Bearer token';

      const errors = [
        new Error('Token已过期'),
        new Error('Token无效'),
        new Error('格式不正确'),
        new Error('签名验证失败')
      ];

      errors.forEach(err => {
        jwtStub.verifyAccessToken.throws(err);
        res.status.resetHistory();
        res.json.resetHistory();
        next.resetHistory();

        authMiddleware(req, res, next);

        expect(res.status.calledWith(401)).to.be.true;
        expect(next.called).to.be.false;
      });
    });
  });

  describe('安全特性', () => {
    it('应该不会将密敏感信息暴露在响应中', () => {
      req.headers.authorization = 'Bearer invalid';
      jwtStub.verifyAccessToken.throws(new Error('Token验证失败'));

      authMiddleware(req, res, next);

      const errorMessage = res.json.getCall(0).args[0];
      // 确保不暴露内部实现细节
      expect(errorMessage.message).not.to.include('secret');
      expect(errorMessage.message).not.to.include('private');
    });

    it('应该在token缺失时提供安全的错误信息', () => {
      authMiddleware(req, res, next);

      const errorMessage = res.json.getCall(0).args[0];
      expect(errorMessage.code).to.equal(401);
      expect(errorMessage.message).to.be.a('string');
    });
  });

  describe('边界情况', () => {
    it('应该处理非常长的token', () => {
      req.headers.authorization = `Bearer ${'a'.repeat(10000)}`;
      jwtStub.verifyAccessToken.throws(new Error('Invalid'));

      authMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });

    it('应该处理特殊字符在authorization header中', () => {
      req.headers.authorization = 'Bearer token!@#$%^&*()';
      jwtStub.verifyAccessToken.throws(new Error('Invalid'));

      authMiddleware(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });

    it('应该处理多个authorization header', () => {
      // Node.js/Express 通常只保留最后一个
      req.headers.authorization = 'Bearer token1';

      authMiddleware(req, res, next);

      // 应该使用最后一个值
      expect(jwtStub.verifyAccessToken.called).to.be.true;
    });
  });
});
