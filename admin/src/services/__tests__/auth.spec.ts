/**
 * 认证服务单元测试
 * 测试 authApi 相关接口的定义和参数接口
 */

import { describe, it, expect } from 'vitest';
import { authApi } from '../api';

describe('Auth API', () => {
  describe('login', () => {
    it('应该导出 login 函数', () => {
      expect(authApi.login).toBeDefined();
      expect(typeof authApi.login).toBe('function');
    });

    it('login 应该接受 email 和 password 参数', () => {
      const result = authApi.login('admin@example.com', 'password123');
      expect(result).toBeDefined();
    });

    it('login 应该返回 Promise', () => {
      const result = authApi.login('admin@example.com', 'password123');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('logout', () => {
    it('应该导出 logout 函数', () => {
      expect(authApi.logout).toBeDefined();
      expect(typeof authApi.logout).toBe('function');
    });

    it('logout 应该返回 Promise', () => {
      const result = authApi.logout();
      expect(result).toBeInstanceOf(Promise);
    });

    it('logout 不需要任何参数', () => {
      const result = authApi.logout();
      expect(result).toBeDefined();
    });
  });

  describe('getProfile', () => {
    it('应该导出 getProfile 函数', () => {
      expect(authApi.getProfile).toBeDefined();
      expect(typeof authApi.getProfile).toBe('function');
    });

    it('getProfile 应该返回 Promise', () => {
      const result = authApi.getProfile();
      expect(result).toBeInstanceOf(Promise);
    });

    it('getProfile 不需要任何参数', () => {
      const result = authApi.getProfile();
      expect(result).toBeDefined();
    });
  });

  describe('verifyDbAccess', () => {
    it('应该导出 verifyDbAccess 函数', () => {
      expect(authApi.verifyDbAccess).toBeDefined();
      expect(typeof authApi.verifyDbAccess).toBe('function');
    });

    it('verifyDbAccess 应该接受 password 参数', () => {
      const result = authApi.verifyDbAccess('password123');
      expect(result).toBeDefined();
    });

    it('verifyDbAccess 应该返回 Promise', () => {
      const result = authApi.verifyDbAccess('password123');
      expect(result).toBeInstanceOf(Promise);
    });

    it('verifyDbAccess 参数为空时也应该返回 Promise', () => {
      const result = authApi.verifyDbAccess('');
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
