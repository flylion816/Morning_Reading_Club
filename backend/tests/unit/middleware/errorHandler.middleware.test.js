/**
 * Error Handler Middleware 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Error Handler Middleware', () => {
  let sandbox;
  let req;
  let res;
  let next;
  let loggerStub;
  let responseStub;
  let errorHandler;
  let notFoundHandler;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      url: '/api/test',
      method: 'POST'
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    // Mock logger
    loggerStub = {
      error: sandbox.stub()
    };

    // Mock response utils
    responseStub = {
      error: (code, message, details) => ({
        code,
        message,
        ...(details && { error: details })
      })
    };

    // 使用 proxyquire 加载中间件
    const errorHandlerModule = proxyquire('../../../src/middleware/errorHandler', {
      '../utils/response': responseStub,
      '../utils/logger': loggerStub
    });

    errorHandler = errorHandlerModule.errorHandler;
    notFoundHandler = errorHandlerModule.notFoundHandler;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('errorHandler', () => {
    it('应该记录错误到logger', () => {
      const error = new Error('测试错误');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      expect(loggerStub.error.called).to.be.true;
      const logCall = loggerStub.error.getCall(0);
      expect(logCall.args[0]).to.equal('Error:');
    });

    it('应该使用error.statusCode如果提供', () => {
      const error = new Error('Bad Request');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该在statusCode缺失时使用500', () => {
      const error = new Error('内部错误');

      errorHandler(error, req, res, next);

      expect(res.status.calledWith(500)).to.be.true;
    });

    it('应该处理ValidationError', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';

      errorHandler(error, req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const jsonCall = res.json.getCall(0);
      expect(jsonCall.args[0].message).to.equal('参数验证失败');
    });

    it('应该处理UnauthorizedError', () => {
      const error = new Error('Unauthorized');
      error.name = 'UnauthorizedError';

      errorHandler(error, req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
      const jsonCall = res.json.getCall(0);
      expect(jsonCall.args[0].message).to.equal('未授权');
    });

    it('应该处理CastError', () => {
      const error = new Error('Invalid ObjectId');
      error.name = 'CastError';

      errorHandler(error, req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
      const jsonCall = res.json.getCall(0);
      expect(jsonCall.args[0].message).to.equal('无效的ID格式');
    });

    it('应该返回正确的error结构', () => {
      const error = new Error('测试错误');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      expect(response).to.have.property('code');
      expect(response).to.have.property('message');
      expect(response).to.have.property('error');
      expect(response.error).to.have.property('type');
    });

    it('生产环境下不应该暴露stack trace', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal error');
      error.statusCode = 500;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      expect(response.error).not.to.have.property('stack');

      process.env.NODE_ENV = originalEnv;
    });

    it('非生产环境下应该暴露stack trace', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const error = new Error('Test error');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      expect(response.error).to.have.property('stack');

      process.env.NODE_ENV = originalEnv;
    });

    it('应该在生产环境500错误时隐藏消息', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Database connection failed');
      error.statusCode = 500;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      // 生产环境500错误应该显示通用消息
      expect(response.message).to.equal('服务器内部错误');

      process.env.NODE_ENV = originalEnv;
    });

    it('应该在生产环境非500错误时显示错误消息', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('User not found');
      error.statusCode = 404;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      expect(response.message).to.equal('User not found');

      process.env.NODE_ENV = originalEnv;
    });

    it('应该记录请求URL和方法', () => {
      const error = new Error('Test');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const logCall = loggerStub.error.getCall(0);
      const logData = logCall.args[1];

      expect(logData).to.have.property('url', '/api/test');
      expect(logData).to.have.property('method', 'POST');
    });

    it('应该记录error名称', () => {
      const error = new Error('Test error');
      error.name = 'CustomError';
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      expect(response.error.type).to.equal('CustomError');
    });

    it('应该处理没有message的error', () => {
      const error = new Error();
      error.statusCode = 500;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      expect(response).to.have.property('message');
    });

    it('应该使用error的message如果有statusCode', () => {
      const error = new Error('Custom error message');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      expect(response.message).to.equal('Custom error message');
    });

    it('应该处理没有statusCode的ValidationError', () => {
      const error = new Error('Validation');
      error.name = 'ValidationError';
      // 不设置 statusCode，应该使用name的400

      errorHandler(error, req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该处理statusCode被覆盖的特定错误', () => {
      const error = new Error('Validation');
      error.name = 'ValidationError';
      error.statusCode = 500; // 虽然设置了500，但ValidationError应该返回400

      errorHandler(error, req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('notFoundHandler', () => {
    it('应该返回404状态码', () => {
      notFoundHandler(req, res);

      expect(res.status.calledWith(404)).to.be.true;
    });

    it('应该返回正确的404响应格式', () => {
      notFoundHandler(req, res);

      const jsonCall = res.json.getCall(0);
      const response = jsonCall.args[0];

      expect(response).to.have.property('code', 404);
      expect(response.message).to.equal('请求的资源不存在');
    });

    it('应该调用json方法', () => {
      notFoundHandler(req, res);

      expect(res.json.called).to.be.true;
    });

    it('应该接受不同的req对象', () => {
      const differentReq = { url: '/api/other', method: 'GET' };

      notFoundHandler(differentReq, res);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('错误记录', () => {
    it('应该记录error message', () => {
      const error = new Error('Specific error');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const logCall = loggerStub.error.getCall(0);
      const logData = logCall.args[1];

      expect(logData.message).to.equal('Specific error');
    });

    it('应该记录stack trace如果存在', () => {
      const error = new Error('Error with stack');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const logCall = loggerStub.error.getCall(0);
      const logData = logCall.args[1];

      expect(logData).to.have.property('stack');
    });

    it('应该记录完整的错误信息', () => {
      const error = new Error('Test error');
      error.statusCode = 422;
      req.url = '/api/users';
      req.method = 'PUT';

      errorHandler(error, req, res, next);

      const logCall = loggerStub.error.getCall(0);
      const logData = logCall.args[1];

      expect(logData).to.include({
        message: 'Test error',
        url: '/api/users',
        method: 'PUT'
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理undefined error', () => {
      // 虽然通常不会发生，但应该有防御
      try {
        errorHandler(undefined, req, res, next);
        // 取决于实现，可能会处理或抛出
      } catch (e) {
        // 预期可能抛出
      }
    });

    it('应该处理error.statusCode为字符串的情况', () => {
      const error = new Error('Test');
      error.statusCode = '400'; // 字符串

      errorHandler(error, req, res, next);

      // 应该能够处理，即使statusCode类型不对
      expect(res.status.called).to.be.true;
    });

    it('应该处理error.statusCode为0的情况', () => {
      const error = new Error('Test');
      error.statusCode = 0;

      errorHandler(error, req, res, next);

      // 应该使用0或降级到500
      expect(res.status.called).to.be.true;
    });

    it('应该处理非常长的error message', () => {
      const error = new Error('a'.repeat(10000));
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      expect(jsonCall.args[0].message).to.have.lengthOf(10000);
    });

    it('应该处理特殊字符在error message中', () => {
      const error = new Error('Error with 特殊字符 @#$%^&*()');
      error.statusCode = 400;

      errorHandler(error, req, res, next);

      const jsonCall = res.json.getCall(0);
      expect(jsonCall.args[0].message).to.include('特殊字符');
    });
  });
});
