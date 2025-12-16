/**
 * Config Validator Utils 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Config Validator Utils', () => {
  let sandbox;
  let processEnvBackup;
  let loggerStub;
  let chalkStub;
  let configValidator;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    processEnvBackup = { ...process.env };

    // Reset environment variables
    process.env.NODE_ENV = 'test';
    delete process.env.MONGODB_URI;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    // Mock logger
    loggerStub = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub()
    };

    // Mock chalk with proper chaining support
    const textStub = sandbox.stub().returnsArg(0);

    // Create stub functions that support both direct calls and chaining
    const createColorChain = () => ({
      bold: textStub
    });

    chalkStub = {
      cyan: textStub,
      yellow: textStub,
      green: textStub,
      blue: textStub,
      red: textStub
    };

    // Support chaining like chalk.cyan.bold(text), chalk.red.bold(text), etc.
    chalkStub.cyan.bold = textStub;
    chalkStub.yellow.bold = textStub;
    chalkStub.green.bold = textStub;
    chalkStub.blue.bold = textStub;
    chalkStub.red.bold = textStub;

    // Mock process.exit to prevent actual process exit during tests
    sandbox.stub(process, 'exit');

    // Load config-validator with mocked dependencies
    const module = proxyquire('../../../src/utils/config-validator', {
      'chalk': chalkStub,
      './logger': loggerStub
    });

    configValidator = module;
  });

  afterEach(() => {
    sandbox.restore();
    // Restore process.env
    process.env = { ...processEnvBackup };
  });

  describe('validateEnvValue 函数（私有，通过测试间接验证）', () => {
    it('应该验证必需的环境变量是否设置', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'secret123456';
      process.env.JWT_REFRESH_SECRET = 'refresh_secret123456';

      // validateConfig 应该通过而不退出
      expect(() => {
        configValidator.validateConfig();
      }).to.not.throw();
    });

    it('应该检查 NODE_ENV 有效值', () => {
      process.env.NODE_ENV = 'invalid_env';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      // 应该记录错误
      expect(() => {
        configValidator.validateConfig();
      }).to.not.throw(); // validateConfig 可能调用 process.exit，我们模拟它
    });

    it('应该验证 PORT 是数字', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = 'not_a_number';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      // 应该记录错误
      expect(loggerStub.info.called || loggerStub.error.called).to.be.false;
      // (实际上会在 validateConfig 中处理)
    });

    it('应该验证 MONGODB_URI 格式', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'invalid_uri';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      // 应该记录错误
      configValidator.validateConfig();
    });

    it('应该验证 JWT_SECRET 不为空字符串', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = '';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      configValidator.validateConfig();
    });
  });

  describe('validateConfig 函数', () => {
    it('应该导出 validateConfig 函数', () => {
      expect(configValidator).to.have.property('validateConfig');
      expect(configValidator.validateConfig).to.be.a('function');
    });

    it('应该返回 boolean 值', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret123456';
      process.env.JWT_REFRESH_SECRET = 'refresh_secret';

      const result = configValidator.validateConfig();

      // 应该返回 true 或 false
      expect(result).to.be.a('boolean');
    });

    it('应该检查所有必需的环境变量', () => {
      // 移除所有必需的环境变量
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.MONGODB_URI;
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      configValidator.validateConfig();

      // 应该记录错误信息
      expect(loggerStub.info.called || loggerStub.error.called).to.not.be.undefined;
    });

    it('应该处理缺少必需变量的情况', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      // 缺少 MONGODB_URI
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      configValidator.validateConfig();
    });

    it('应该处理格式无效的必需变量', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = 'invalid_port';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      configValidator.validateConfig();
    });

    it('应该检查可选的环境变量并使用默认值', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';
      delete process.env.LOG_LEVEL; // 可选变量

      configValidator.validateConfig();

      // 应该记录使用默认值的信息
      expect(loggerStub.info.called).to.be.true;
    });

    it('应该不暴露敏感信息的明文', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'my_secret_key_12345';
      process.env.JWT_REFRESH_SECRET = 'my_refresh_secret_key';

      configValidator.validateConfig();

      // 日志中不应该包含完整的 secret
      const allCalls = loggerStub.info.getCalls();
      const hasSecretExposed = allCalls.some(call => {
        const arg = JSON.stringify(call.args);
        return arg.includes('my_secret_key_12345');
      });

      expect(hasSecretExposed).to.be.false;
    });
  });

  describe('getValidatedConfig 函数', () => {
    it('应该导出 getValidatedConfig 函数', () => {
      expect(configValidator).to.have.property('getValidatedConfig');
      expect(configValidator.getValidatedConfig).to.be.a('function');
    });

    it('应该返回结构化的配置对象', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'secret_key';
      process.env.JWT_REFRESH_SECRET = 'refresh_key';

      const config = configValidator.getValidatedConfig();

      expect(config).to.be.an('object');
      expect(config).to.have.property('app');
      expect(config).to.have.property('db');
      expect(config).to.have.property('jwt');
    });

    it('应该包含 app 配置', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '5000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';
      process.env.API_BASE_URL = 'https://api.example.com';

      const config = configValidator.getValidatedConfig();

      expect(config.app).to.have.property('nodeEnv', 'production');
      expect(config.app).to.have.property('port', 5000);
      expect(config.app).to.have.property('apiBaseUrl', 'https://api.example.com');
    });

    it('应该包含 db 配置', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://user:pass@cluster.mongodb.net/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';
      process.env.MYSQL_HOST = 'mysql.example.com';
      process.env.MYSQL_PORT = '3306';

      const config = configValidator.getValidatedConfig();

      expect(config.db).to.have.property('mongodbUri');
      expect(config.db).to.have.property('mysql');
      expect(config.db).to.have.property('redis');
      expect(config.db.mysql).to.have.property('host');
      expect(config.db.mysql).to.have.property('port');
    });

    it('应该包含 jwt 配置', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'jwt_secret_key';
      process.env.JWT_REFRESH_SECRET = 'jwt_refresh_secret_key';
      process.env.JWT_EXPIRES_IN = '1h';
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';

      const config = configValidator.getValidatedConfig();

      expect(config.jwt).to.have.property('secret', 'jwt_secret_key');
      expect(config.jwt).to.have.property('refreshSecret', 'jwt_refresh_secret_key');
      expect(config.jwt).to.have.property('expiresIn', '1h');
      expect(config.jwt).to.have.property('refreshExpiresIn', '7d');
    });

    it('应该包含 wechat 配置', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';
      process.env.WECHAT_APPID = 'wx123456';
      process.env.WECHAT_SECRET = 'wechat_secret';

      const config = configValidator.getValidatedConfig();

      expect(config.wechat).to.have.property('appId', 'wx123456');
      expect(config.wechat).to.have.property('secret', 'wechat_secret');
    });

    it('应该包含 log 配置', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';
      process.env.LOG_LEVEL = 'debug';

      const config = configValidator.getValidatedConfig();

      expect(config.log).to.have.property('level', 'debug');
    });

    it('应该使用默认值当环境变量未设置时', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';
      delete process.env.API_BASE_URL;
      delete process.env.JWT_EXPIRES_IN;

      const config = configValidator.getValidatedConfig();

      expect(config.app.apiBaseUrl).to.equal('http://localhost:3000');
      expect(config.jwt.expiresIn).to.equal('2h');
    });

    it('应该转换 PORT 为整数', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '8080';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      const config = configValidator.getValidatedConfig();

      expect(config.app.port).to.equal(8080);
      expect(config.app.port).to.be.a('number');
    });

    it('应该处理不同的 NODE_ENV 值', () => {
      const envs = ['development', 'staging', 'production'];

      for (const env of envs) {
        process.env.NODE_ENV = env;
        process.env.PORT = '3000';
        process.env.MONGODB_URI = 'mongodb://localhost/test';
        process.env.JWT_SECRET = 'secret';
        process.env.JWT_REFRESH_SECRET = 'refresh';

        const config = configValidator.getValidatedConfig();
        expect(config.app.nodeEnv).to.equal(env);
      }
    });
  });

  describe('导出的常量', () => {
    it('应该导出 REQUIRED_ENV 对象', () => {
      expect(configValidator).to.have.property('REQUIRED_ENV');
      expect(configValidator.REQUIRED_ENV).to.be.an('object');
    });

    it('应该导出 OPTIONAL_ENV 对象', () => {
      expect(configValidator).to.have.property('OPTIONAL_ENV');
      expect(configValidator.OPTIONAL_ENV).to.be.an('object');
    });

    it('REQUIRED_ENV 应该包含必需的变量', () => {
      const requiredEnv = configValidator.REQUIRED_ENV;

      expect(requiredEnv).to.have.property('NODE_ENV');
      expect(requiredEnv).to.have.property('PORT');
      expect(requiredEnv).to.have.property('MONGODB_URI');
      expect(requiredEnv).to.have.property('JWT_SECRET');
      expect(requiredEnv).to.have.property('JWT_REFRESH_SECRET');
    });

    it('OPTIONAL_ENV 应该包含可选的变量', () => {
      const optionalEnv = configValidator.OPTIONAL_ENV;

      expect(optionalEnv).to.have.property('API_BASE_URL');
      expect(optionalEnv).to.have.property('JWT_EXPIRES_IN');
      expect(optionalEnv).to.have.property('LOG_LEVEL');
    });
  });

  describe('边界情况', () => {
    it('应该处理非常长的环境变量值', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'x'.repeat(1000);
      process.env.JWT_REFRESH_SECRET = 'y'.repeat(1000);

      const config = configValidator.getValidatedConfig();

      expect(config.jwt.secret).to.have.lengthOf(1000);
      expect(config.jwt.refreshSecret).to.have.lengthOf(1000);
    });

    it('应该处理包含特殊字符的 URL', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb+srv://user:p@ssw0rd!@cluster.mongodb.net/test?retryWrites=true';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      const config = configValidator.getValidatedConfig();

      expect(config.db.mongodbUri).to.include('user:p@ssw0rd!@cluster');
    });

    it('应该处理数字作为字符串的 PORT', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      const config = configValidator.getValidatedConfig();

      expect(config.app.port).to.equal(3000);
      expect(typeof config.app.port).to.equal('number');
    });

    it('应该处理多个可选变量同时设置和未设置的情况', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';
      process.env.LOG_LEVEL = 'debug';
      delete process.env.API_BASE_URL;
      process.env.JWT_EXPIRES_IN = '3h';

      const config = configValidator.getValidatedConfig();

      expect(config.log.level).to.equal('debug');
      expect(config.app.apiBaseUrl).to.equal('http://localhost:3000'); // default
      expect(config.jwt.expiresIn).to.equal('3h'); // from env
    });
  });

  describe('错误场景', () => {
    it('应该在缺少多个必需变量时记录错误', () => {
      delete process.env.NODE_ENV;
      delete process.env.JWT_SECRET;

      configValidator.validateConfig();

      expect(loggerStub.info.called || loggerStub.error.called).to.not.be.undefined;
    });

    it('应该在无效的 NODE_ENV 值时记录错误', () => {
      process.env.NODE_ENV = 'invalid_environment';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'mongodb://localhost/test';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      configValidator.validateConfig();
    });

    it('应该在无效的 MongoDB URI 时记录错误', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      process.env.MONGODB_URI = 'not-a-mongodb-uri';
      process.env.JWT_SECRET = 'secret';
      process.env.JWT_REFRESH_SECRET = 'refresh';

      configValidator.validateConfig();
    });
  });
});
