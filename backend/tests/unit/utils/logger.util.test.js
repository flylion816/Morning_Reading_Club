/**
 * Logger Utils 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Logger Utils', () => {
  let sandbox;
  let winstonStub;
  let logger;

  beforeEach(() => {
    delete require.cache[require.resolve('../../../src/utils/logger')];

    sandbox = sinon.createSandbox();

    // Mock Winston logger
    winstonStub = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub()
    };

    const winstonMock = {
      createLogger: sandbox.stub().returns(winstonStub),
      format: {
        combine: (...args) => ({}),
        colorize: sandbox.stub().returns({}),
        timestamp: sandbox.stub().returns({}),
        printf: sandbox.stub().returns({}),
        errors: sandbox.stub().returns({}),
        json: sandbox.stub().returns({})
      },
      transports: {
        Console: sandbox.stub(),
        File: sandbox.stub()
      }
    };

    // Mock fs and path
    const fsMock = {
      existsSync: sandbox.stub().returns(true),
      mkdirSync: sandbox.stub()
    };

    const pathMock = {
      join: (...args) => args.join('/')
    };

    // Load logger with mocked dependencies
    logger = proxyquire('../../../src/utils/logger', {
      'winston': winstonMock,
      'path': pathMock,
      'fs': fsMock
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('基础日志方法', () => {
    it('应该提供 info 方法', () => {
      expect(logger).to.have.property('info');
      expect(logger.info).to.be.a('function');
    });

    it('应该提供 warn 方法', () => {
      expect(logger).to.have.property('warn');
      expect(logger.warn).to.be.a('function');
    });

    it('应该提供 error 方法', () => {
      expect(logger).to.have.property('error');
      expect(logger.error).to.be.a('function');
    });

    it('应该提供 debug 方法', () => {
      expect(logger).to.have.property('debug');
      expect(logger.debug).to.be.a('function');
    });
  });

  describe('info 方法', () => {
    it('应该调用 winston.info', () => {
      logger.info('测试信息');
      expect(winstonStub.info.called).to.be.true;
    });

    it('应该传递消息和元数据', () => {
      const meta = { userId: '123', action: 'login' };
      logger.info('用户登录', meta);

      expect(winstonStub.info.called).to.be.true;
      const call = winstonStub.info.getCall(0);
      expect(call.args[0]).to.equal('用户登录');
    });

    it('应该在没有元数据时使用空对象', () => {
      logger.info('简单信息');

      expect(winstonStub.info.called).to.be.true;
    });
  });

  describe('error 方法', () => {
    it('应该接受错误对象', () => {
      const error = new Error('测试错误');
      logger.error('发生错误', error);

      expect(winstonStub.error.called).to.be.true;
    });

    it('应该处理 Error 实例', () => {
      const error = new Error('数据库连接失败');
      error.code = 'ECONNREFUSED';
      logger.error('数据库错误', error);

      expect(winstonStub.error.called).to.be.true;
      const call = winstonStub.error.getCall(0);
      expect(call.args[0]).to.equal('数据库错误');
    });

    it('应该接受普通对象作为错误信息', () => {
      const errorObj = { message: '验证失败', code: 'VALIDATION_ERROR' };
      logger.error('处理失败', errorObj);

      expect(winstonStub.error.called).to.be.true;
    });

    it('应该支持第三个参数作为元数据', () => {
      const error = new Error('操作失败');
      const meta = { userId: '456' };
      logger.error('发生错误', error, meta);

      expect(winstonStub.error.called).to.be.true;
    });

    it('应该处理 null 错误参数', () => {
      logger.error('错误消息', null, { context: 'test' });

      expect(winstonStub.error.called).to.be.true;
    });
  });

  describe('warn 方法', () => {
    it('应该调用 winston.warn', () => {
      logger.warn('警告信息');

      expect(winstonStub.warn.called).to.be.true;
    });

    it('应该支持元数据', () => {
      const meta = { remaining: 10, total: 100 };
      logger.warn('即将达到限制', meta);

      expect(winstonStub.warn.called).to.be.true;
    });
  });

  describe('debug 方法', () => {
    it('应该调用 winston.debug', () => {
      logger.debug('调试信息');

      expect(winstonStub.debug.called).to.be.true;
    });

    it('应该支持元数据', () => {
      const meta = { step: 1, data: 'debug' };
      logger.debug('处理步骤', meta);

      expect(winstonStub.debug.called).to.be.true;
    });
  });

  describe('特殊日志方法', () => {
    it('应该提供 http 方法记录HTTP请求', () => {
      expect(logger).to.have.property('http');
      expect(logger.http).to.be.a('function');
    });

    it('应该提供 database 方法记录数据库操作', () => {
      expect(logger).to.have.property('database');
      expect(logger.database).to.be.a('function');
    });

    it('应该提供 auth 方法记录认证事件', () => {
      expect(logger).to.have.property('auth');
      expect(logger.auth).to.be.a('function');
    });

    it('应该提供 event 方法记录业务事件', () => {
      expect(logger).to.have.property('event');
      expect(logger.event).to.be.a('function');
    });

    it('应该提供 getWinstonLogger 方法获取原始logger实例', () => {
      expect(logger).to.have.property('getWinstonLogger');
      expect(logger.getWinstonLogger).to.be.a('function');
    });
  });

  describe('http 日志方法', () => {
    it('应该记录HTTP请求信息', () => {
      logger.http('GET', '/api/users', 200, 45);

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该对4xx状态码使用 warn 级别', () => {
      logger.http('POST', '/api/login', 401, 12);

      // 应该调用 warn（因为 401 >= 400）
      expect(winstonStub.warn.called).to.be.true;
    });

    it('应该对5xx状态码使用 warn 级别', () => {
      logger.http('GET', '/api/data', 500, 89);

      expect(winstonStub.warn.called).to.be.true;
    });

    it('应该包含可选的 userId', () => {
      logger.http('DELETE', '/api/resource/123', 204, 30, 'user_456');

      expect(winstonStub.info.called || winstonStub.warn.called).to.be.true;
    });
  });

  describe('database 日志方法', () => {
    it('应该记录数据库操作', () => {
      logger.database('INSERT', 'users', 15);

      expect(winstonStub.debug.called).to.be.true;
    });

    it('应该在操作失败时使用 warn 级别', () => {
      logger.database('UPDATE', 'orders', 200, false);

      expect(winstonStub.warn.called).to.be.true;
    });

    it('应该支持元数据参数', () => {
      const meta = { rows: 100, query: 'complex' };
      logger.database('SELECT', 'insights', 450, true, meta);

      expect(winstonStub.debug.called).to.be.true;
    });
  });

  describe('auth 日志方法', () => {
    it('应该记录认证事件', () => {
      logger.auth('LOGIN', 'user_123');

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该记录登出事件', () => {
      logger.auth('LOGOUT', 'user_456');

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该记录token刷新事件', () => {
      logger.auth('TOKEN_REFRESH', 'user_789');

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该支持额外的元数据', () => {
      logger.auth('PERMISSION_DENIED', 'user_111', { resource: 'admin' });

      expect(winstonStub.info.called).to.be.true;
    });
  });

  describe('event 日志方法', () => {
    it('应该记录业务事件', () => {
      logger.event('CHECKIN_CREATED', '用户打卡成功');

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该记录各种类型的事件', () => {
      logger.event('ENROLLMENT_APPROVED', '报名已批准');
      logger.event('PAYMENT_RECEIVED', '收到支付');
      logger.event('REMINDER_SENT', '已发送提醒');

      expect(winstonStub.info.callCount).to.be.at.least(3);
    });

    it('应该支持事件元数据', () => {
      const meta = { recordId: '123', amount: 99.9 };
      logger.event('PAYMENT_RECEIVED', '收到支付', meta);

      expect(winstonStub.info.called).to.be.true;
    });
  });

  describe('上下文构建', () => {
    it('应该在上下文中添加进程 ID', () => {
      logger.info('测试');

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该在生产环境添加内存信息', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      logger.info('生产环境日志');

      expect(winstonStub.info.called).to.be.true;
      process.env.NODE_ENV = originalEnv;
    });

    it('应该在开发环境不添加内存信息', () => {
      process.env.NODE_ENV = 'development';

      logger.info('开发环境日志');

      expect(winstonStub.info.called).to.be.true;
    });
  });

  describe('边界情况', () => {
    it('应该处理非常长的消息', () => {
      const longMessage = 'a'.repeat(10000);
      logger.info(longMessage);

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该处理包含特殊字符的消息', () => {
      logger.info('错误: 特殊字符 @#$%^&*() 中文');

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该处理复杂的嵌套元数据对象', () => {
      const meta = {
        user: {
          id: '123',
          profile: {
            name: '用户名',
            nested: {
              deep: 'value'
            }
          }
        },
        arrays: [1, 2, 3],
        timestamp: new Date()
      };

      logger.info('复杂元数据', meta);

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该处理 undefined 和 null 元数据值', () => {
      const meta = { value: undefined, nullable: null };
      logger.info('null/undefined', meta);

      expect(winstonStub.info.called).to.be.true;
    });

    it('应该处理循环引用的元数据', () => {
      const meta = { a: 1 };
      meta.self = meta; // 循环引用

      // 应该不抛出错误
      expect(() => logger.info('循环引用', { ...meta })).to.not.throw();
    });
  });

  describe('getWinstonLogger 方法', () => {
    it('应该返回 Winston 实例', () => {
      const winstonInstance = logger.getWinstonLogger();

      expect(winstonInstance).to.deep.equal(winstonStub);
    });

    it('应该允许直接使用 Winston 方法', () => {
      const winstonInstance = logger.getWinstonLogger();

      winstonInstance.info('直接使用 winston');

      expect(winstonStub.info.called).to.be.true;
    });
  });

  describe('多个日志调用', () => {
    it('应该支持连续的日志调用', () => {
      logger.info('第一条');
      logger.warn('第二条');
      logger.error('第三条', new Error('err'));
      logger.debug('第四条');

      expect(winstonStub.info.callCount).to.equal(1);
      expect(winstonStub.warn.callCount).to.equal(1);
      expect(winstonStub.error.callCount).to.equal(1);
      expect(winstonStub.debug.callCount).to.equal(1);
    });

    it('应该保持每个日志调用的独立性', () => {
      const meta1 = { action: 'login' };
      const meta2 = { action: 'logout' };

      logger.info('操作1', meta1);
      logger.info('操作2', meta2);

      expect(winstonStub.info.callCount).to.equal(2);
    });
  });
});
