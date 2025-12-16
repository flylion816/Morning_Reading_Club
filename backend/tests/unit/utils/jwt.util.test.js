/**
 * JWT Utils 单元测试
 */

const { expect } = require('chai');
const jwt = require('jsonwebtoken');
const sinon = require('sinon');

// Mock dotenv
require('dotenv').config();

// 导入 JWT 工具
const {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens
} = require('../../../src/utils/jwt');

describe('JWT Utils', () => {
  const testPayload = {
    userId: '123456789',
    openid: 'test_openid',
    role: 'user'
  };

  const testUser = {
    id: '123456789',
    _id: '123456789',
    openid: 'test_openid',
    role: 'user'
  };

  describe('generateAccessToken', () => {
    it('应该生成有效的Access Token', () => {
      const token = generateAccessToken(testPayload);

      expect(token).to.be.a('string');
      expect(token.split('.')).to.have.lengthOf(3); // JWT 结构: header.payload.signature
    });

    it('生成的Access Token应该可以被验证', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key-12345678');

      expect(decoded.userId).to.equal(testPayload.userId);
      expect(decoded.openid).to.equal(testPayload.openid);
      expect(decoded.role).to.equal(testPayload.role);
    });

    it('生成的Access Token应该包含过期时间', () => {
      const token = generateAccessToken(testPayload);
      const decoded = jwt.decode(token);

      expect(decoded.exp).to.exist;
      expect(decoded.iat).to.exist;
      // exp - iat 应该约等于 7200 秒 (2小时)
      expect(decoded.exp - decoded.iat).to.be.closeTo(7200, 10);
    });

    it('应该处理空payload', () => {
      const token = generateAccessToken({});
      expect(token).to.be.a('string');
    });
  });

  describe('generateRefreshToken', () => {
    it('应该生成有效的Refresh Token', () => {
      const token = generateRefreshToken(testPayload);

      expect(token).to.be.a('string');
      expect(token.split('.')).to.have.lengthOf(3);
    });

    it('生成的Refresh Token应该可以被验证', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-87654321'
      );

      expect(decoded.userId).to.equal(testPayload.userId);
    });

    it('Refresh Token的过期时间应该更长（30天）', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = jwt.decode(token);

      // 30天 = 2592000 秒
      expect(decoded.exp - decoded.iat).to.be.closeTo(2592000, 10);
    });
  });

  describe('verifyAccessToken', () => {
    it('应该验证有效的Access Token', () => {
      const token = generateAccessToken(testPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).to.equal(testPayload.userId);
      expect(decoded.openid).to.equal(testPayload.openid);
      expect(decoded.role).to.equal(testPayload.role);
    });

    it('无效的Token应该抛出错误', () => {
      expect(() => {
        verifyAccessToken('invalid.token.here');
      }).to.throw();
    });

    it('应该识别过期的Token', (done) => {
      // 创建一个已过期的token - 不能同时指定exp和expiresIn
      const expiredPayload = Object.assign({}, testPayload);
      const expiredToken = jwt.sign(
        expiredPayload,
        process.env.JWT_SECRET || 'dev-secret-key-12345678',
        { expiresIn: '-1h' } // 负数表示已过期
      );

      try {
        verifyAccessToken(expiredToken);
        done(new Error('应该抛出过期错误'));
      } catch (err) {
        expect(err.message).to.include('过期');
        done();
      }
    });

    it('应该处理格式错误的Token', () => {
      expect(() => {
        verifyAccessToken('not-a-token');
      }).to.throw('Token无效');
    });

    it('使用错误的密钥应该抛出错误', () => {
      const token = generateAccessToken(testPayload);

      // 使用错误的密钥验证
      expect(() => {
        jwt.verify(token, 'wrong-secret-key');
      }).to.throw();
    });
  });

  describe('verifyRefreshToken', () => {
    it('应该验证有效的Refresh Token', () => {
      const token = generateRefreshToken(testPayload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).to.equal(testPayload.userId);
    });

    it('无效的Refresh Token应该抛出错误', () => {
      expect(() => {
        verifyRefreshToken('invalid.token.here');
      }).to.throw('Refresh Token无效');
    });

    it('应该识别过期的Refresh Token', (done) => {
      const expiredToken = jwt.sign(
        testPayload,
        process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-87654321',
        { expiresIn: '-1h' }
      );

      try {
        verifyRefreshToken(expiredToken);
        done(new Error('应该抛出过期错误'));
      } catch (err) {
        expect(err.message).to.include('过期');
        done();
      }
    });
  });

  describe('generateTokens', () => {
    it('应该生成包含accessToken和refreshToken的对象', () => {
      const tokens = generateTokens(testUser);

      expect(tokens).to.have.property('accessToken');
      expect(tokens).to.have.property('refreshToken');
      expect(tokens).to.have.property('expiresIn');
      expect(tokens.expiresIn).to.equal(7200);
    });

    it('生成的tokens应该都是有效的', () => {
      const tokens = generateTokens(testUser);

      const accessDecoded = verifyAccessToken(tokens.accessToken);
      const refreshDecoded = verifyRefreshToken(tokens.refreshToken);

      expect(accessDecoded.userId).to.equal(testUser._id);
      expect(refreshDecoded.userId).to.equal(testUser._id);
    });

    it('应该支持使用id或_id字段', () => {
      const userWithId = { id: 'user_id_123', openid: 'openid', role: 'user' };
      const userWithUnderscore = { _id: 'user_id_456', openid: 'openid', role: 'user' };

      const tokens1 = generateTokens(userWithId);
      const tokens2 = generateTokens(userWithUnderscore);

      const decoded1 = verifyAccessToken(tokens1.accessToken);
      const decoded2 = verifyAccessToken(tokens2.accessToken);

      expect(decoded1.userId).to.equal('user_id_123');
      expect(decoded2.userId).to.equal('user_id_456');
    });

    it('应该使用默认role值', () => {
      const userWithoutRole = { _id: 'user_id', openid: 'openid' };
      const tokens = generateTokens(userWithoutRole);

      const decoded = verifyAccessToken(tokens.accessToken);
      expect(decoded.role).to.equal('user');
    });

    it('应该保留user的role值', () => {
      const userWithRole = { _id: 'user_id', openid: 'openid', role: 'admin' };
      const tokens = generateTokens(userWithRole);

      const decoded = verifyAccessToken(tokens.accessToken);
      expect(decoded.role).to.equal('admin');
    });
  });

  describe('Token 安全特性', () => {
    it('tokens不应该包含敏感信息的明文', () => {
      const tokens = generateTokens(testUser);
      const accessDecoded = jwt.decode(tokens.accessToken);

      // payload中不应该有密码或其他敏感信息
      expect(JSON.stringify(accessDecoded)).not.to.include('password');
      expect(JSON.stringify(accessDecoded)).not.to.include('secret');
    });

    it('Access Token和Refresh Token应该使用不同的密钥', () => {
      const token = generateAccessToken(testPayload);

      // 使用Refresh密钥验证Access Token应该失败
      expect(() => {
        jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-87654321');
      }).to.throw();
    });

    it('应该处理极长的Token', () => {
      const longPayload = {
        userId: '123456789',
        openid: 'test_openid',
        role: 'user',
        data: 'x'.repeat(1000)
      };

      const token = generateAccessToken(longPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.data).to.have.lengthOf(1000);
    });
  });

  describe('错误处理', () => {
    it('应该处理null payload', () => {
      // jwt.sign 会拒绝 null payload
      expect(() => {
        generateAccessToken(null);
      }).to.throw();
    });

    it('应该处理undefined payload', () => {
      // jwt.sign 会拒绝 undefined payload
      expect(() => {
        generateAccessToken(undefined);
      }).to.throw();
    });

    it('malformed token应该被拒绝', () => {
      expect(() => {
        verifyAccessToken('header.payload'); // 缺少signature
      }).to.throw('Token无效');
    });

    it('修改后的token应该被拒绝', () => {
      const token = generateAccessToken(testPayload);
      // 修改token的某个字符
      const modifiedToken = token.slice(0, -5) + '00000';

      expect(() => {
        verifyAccessToken(modifiedToken);
      }).to.throw('Token无效');
    });
  });

  describe('边界情况', () => {
    it('应该支持特殊字符在userId中', () => {
      const specialPayload = {
        userId: 'user-123@domain.com',
        openid: 'openid-with-special-chars-!@#',
        role: 'user'
      };

      const token = generateAccessToken(specialPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).to.equal(specialPayload.userId);
      expect(decoded.openid).to.equal(specialPayload.openid);
    });

    it('应该支持中文字符', () => {
      const chinesePayload = {
        userId: '用户123',
        openid: '测试openid',
        role: 'user'
      };

      const token = generateAccessToken(chinesePayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).to.equal(chinesePayload.userId);
      expect(decoded.openid).to.equal(chinesePayload.openid);
    });

    it('多次生成token应该生成不同的token（由于时间戳不同）', () => {
      const token1 = generateAccessToken(testPayload);
      // 等待一点时间确保时间戳不同
      setTimeout(() => {
        const token2 = generateAccessToken(testPayload);
        expect(token1).not.to.equal(token2);
      }, 10);
    });
  });
});
