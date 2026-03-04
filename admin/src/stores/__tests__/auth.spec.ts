/**
 * Auth Store 单元测试
 * 覆盖所有 state、getters、actions 相关场景
 * 共 12 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { createMockAdmin, createMockNormalAdmin } from '@/tests/fixtures';
import { createMockLocalStorage } from '@/tests/helpers/mock-helpers';

describe('AuthStore - useAuthStore()', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Mock localStorage
    const mockStorage = createMockLocalStorage();
    global.localStorage = mockStorage as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ============ State 测试 (3 个) ============
  describe('State Initialization', () => {
    it('[State-1] 应该初始化为未认证状态', () => {
      const store = useAuthStore();
      expect(store.adminToken).toBeNull();
      expect(store.adminInfo).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('[State-2] 应该正确维护 adminToken 状态', () => {
      const store = useAuthStore();
      expect(store.adminToken).toBeNull();

      store.adminToken = 'test-token-12345';
      expect(store.adminToken).toBe('test-token-12345');

      store.adminToken = null;
      expect(store.adminToken).toBeNull();
    });

    it('[State-3] 应该正确维护 adminInfo 和 error 状态', () => {
      const store = useAuthStore();
      const admin = createMockAdmin();

      store.adminInfo = admin;
      expect(store.adminInfo).toEqual(admin);

      store.error = '登录失败';
      expect(store.error).toBe('登录失败');

      store.adminInfo = null;
      store.error = null;
      expect(store.adminInfo).toBeNull();
      expect(store.error).toBeNull();
    });
  });

  // ============ Getters 测试 (3 个) ============
  describe('Getters', () => {
    it('[Getter-1] isAuthenticated 应该正确反映认证状态', () => {
      const store = useAuthStore();
      expect(store.isAuthenticated).toBe(false);

      store.adminToken = 'valid-token';
      expect(store.isAuthenticated).toBe(true);

      store.adminToken = null;
      expect(store.isAuthenticated).toBe(false);
    });

    it('[Getter-2] isAuthenticated 不应该被直接赋值', () => {
      const store = useAuthStore();
      store.adminToken = 'token';
      expect(store.isAuthenticated).toBe(true);

      // 尝试直接赋值应该不生效（getter 是只读的）
      (store.isAuthenticated as any) = false;
      expect(store.isAuthenticated).toBe(true);
    });

    it('[Getter-3] isAuthenticated 计算状态依赖于 adminToken', () => {
      const store = useAuthStore();
      const tokens = ['token-1', 'token-2', 'a'.repeat(500)];

      tokens.forEach(token => {
        store.adminToken = token;
        expect(store.isAuthenticated).toBe(true);
      });

      store.adminToken = '';
      expect(store.isAuthenticated).toBe(false);
    });
  });

  // ============ Actions 测试 (3 个) ============
  describe('Actions - initToken', () => {
    it('[Action-1] initToken() 应该从 localStorage 恢复 token', () => {
      global.localStorage.setItem('adminToken', 'restored-token-123');
      const store = useAuthStore();

      store.initToken();

      expect(store.adminToken).toBe('restored-token-123');
      expect(store.isAuthenticated).toBe(true);
    });

    it('[Action-2] initToken() 当 localStorage 为空时应该不设置 token', () => {
      const store = useAuthStore();
      global.localStorage.clear();

      store.initToken();

      expect(store.adminToken).toBeNull();
      expect(store.isAuthenticated).toBe(false);
    });

    it('[Action-3] logout() 应该清除所有认证信息', async () => {
      const store = useAuthStore();
      const admin = createMockAdmin();

      // 设置初始状态
      store.adminToken = 'test-token';
      store.adminInfo = admin;
      global.localStorage.setItem('adminToken', 'test-token');

      // Mock authApi.logout - 使用 vi.mocked 替代
      vi.mock('@/services/api', () => ({
        authApi: {
          logout: vi.fn(async () => ({})),
          login: vi.fn(),
          getProfile: vi.fn()
        }
      }));

      await store.logout();

      expect(store.adminToken).toBeNull();
      expect(store.adminInfo).toBeNull();
      expect(global.localStorage.getItem('adminToken')).toBeNull();
    });
  });

  // ============ Actions 测试 - clearError (1 个) ============
  describe('Actions - clearError', () => {
    it('[Action-4] clearError() 应该清除错误信息', () => {
      const store = useAuthStore();
      store.error = '登录失败';

      store.clearError();

      expect(store.error).toBeNull();
    });

    it('[Action-5] clearError() 当 error 为 null 时应该保持为 null', () => {
      const store = useAuthStore();
      expect(store.error).toBeNull();

      store.clearError();

      expect(store.error).toBeNull();
    });
  });

  // ============ 状态管理测试 (2 个) ============
  describe('State Management', () => {
    it('[StateManagement-1] 可以同时更新多个状态字段', () => {
      const store = useAuthStore();
      const admin = createMockAdmin();
      const token = 'new-token';

      store.adminToken = token;
      store.adminInfo = admin;
      store.loading = true;
      store.error = null;

      expect(store.adminToken).toBe(token);
      expect(store.adminInfo).toEqual(admin);
      expect(store.loading).toBe(true);
      expect(store.error).toBeNull();
      expect(store.isAuthenticated).toBe(true);
    });

    it('[StateManagement-2] logout 清除认证令牌和信息', async () => {
      const store = useAuthStore();
      store.adminToken = 'token';
      store.adminInfo = createMockAdmin();
      global.localStorage.setItem('adminToken', 'token');

      // logout 会调用 API（可能会抛出错误），但无论如何都会清除本地状态
      await store.logout();

      expect(store.adminToken).toBeNull();
      expect(store.adminInfo).toBeNull();
      // localStorage 也应该被清除
      expect(global.localStorage.getItem('adminToken')).toBeNull();
    });
  });

  // ============ localStorage 集成测试 (1 个) ============
  describe('localStorage Integration', () => {
    it('[LocalStorage-1] initToken 从 localStorage 恢复令牌', () => {
      global.localStorage.setItem('adminToken', 'persisted-token');
      const store = useAuthStore();

      store.initToken();

      expect(store.adminToken).toBe('persisted-token');
      expect(store.isAuthenticated).toBe(true);
    });
  });
});
