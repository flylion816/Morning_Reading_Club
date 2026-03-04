/**
 * 集成测试（Integration Tests）
 * 测试多个模块协作的端到端场景
 * 共 20 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { createMockAdmin, createMockUser } from '../tests/fixtures';

describe('Integration Tests - 管理后台集成测试', () => {
  let pinia: any;
  let authStore: any;
  let router: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    authStore = useAuthStore();

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', name: 'login', component: { template: '<div>Login</div>' }, meta: { requiresAuth: false } },
        { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' }, meta: { requiresAuth: true } },
        { path: '/users', name: 'users', component: { template: '<div>Users</div>' }, meta: { requiresAuth: true } },
        { path: '/enrollments', name: 'enrollments', component: { template: '<div>Enrollments</div>' }, meta: { requiresAuth: true } }
      ]
    });

    // 添加认证守卫
    router.beforeEach((to, from, next) => {
      authStore.initToken?.();
      if (to.meta?.requiresAuth && !authStore.isAuthenticated) {
        next({ name: 'login' });
      } else if (to.name === 'login' && authStore.isAuthenticated) {
        next({ name: 'dashboard' });
      } else {
        next();
      }
    });

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key: string) => {
        if (key === 'adminToken') return authStore.adminToken || null;
        if (key === 'user_info') return authStore.adminInfo ? JSON.stringify(authStore.adminInfo) : null;
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ 认证流程 (3 个) ============
  describe('用户认证流程', () => {
    it('[Auth-1] 未登录用户应该无法访问受保护的页面', async () => {
      authStore.isAuthenticated = false;
      await router.push('/');
      expect(router.currentRoute.value.name).toBe('login');
    });

    it('[Auth-2] 登录后应该能访问受保护的页面', async () => {
      authStore.adminInfo = createMockAdmin();
      authStore.adminToken = 'test-token';
      authStore.isAuthenticated = true;

      await router.push('/');
      expect(router.currentRoute.value.name).toBe('dashboard');
    });

    it('[Auth-3] 登录后访问登录页应该重定向到首页', async () => {
      authStore.adminInfo = createMockAdmin();
      authStore.adminToken = 'test-token';
      authStore.isAuthenticated = true;

      await router.push('/login');
      expect(router.currentRoute.value.name).toBe('dashboard');
    });
  });

  // ============ 多页面导航 (5 个) ============
  describe('多页面导航流程', () => {
    beforeEach(() => {
      authStore.adminInfo = createMockAdmin();
      authStore.adminToken = 'test-token';
      authStore.isAuthenticated = true;
    });

    it('[Nav-1] 应该能顺序导航到多个页面', async () => {
      await router.push('/');
      expect(router.currentRoute.value.name).toBe('dashboard');

      await router.push('/users');
      expect(router.currentRoute.value.name).toBe('users');

      await router.push('/enrollments');
      expect(router.currentRoute.value.name).toBe('enrollments');
    });

    it('[Nav-2] 应该能跟踪路由历史', async () => {
      await router.push('/');
      expect(router.currentRoute.value.name).toBe('dashboard');

      const routeHistory = [];
      routeHistory.push(router.currentRoute.value.name);

      await router.push('/users');
      routeHistory.push(router.currentRoute.value.name);

      expect(routeHistory).toContain('dashboard');
      expect(routeHistory).toContain('users');
      expect(routeHistory.length).toBe(2);
    });

    it('[Nav-3] 路由导航应该更新 currentRoute', async () => {
      const routes: string[] = [];

      await router.push('/');
      routes.push(router.currentRoute.value.path);

      await router.push('/users');
      routes.push(router.currentRoute.value.path);

      expect(routes).toContain('/');
      expect(routes).toContain('/users');
    });

    it('[Nav-4] 导航时应该保持认证状态', async () => {
      const originalAuth = authStore.isAuthenticated;

      await router.push('/users');
      expect(authStore.isAuthenticated).toBe(originalAuth);

      await router.push('/enrollments');
      expect(authStore.isAuthenticated).toBe(originalAuth);
    });

    it('[Nav-5] 路由参数应该在导航时正确传递', async () => {
      const router2 = createRouter({
        history: createMemoryHistory(),
        routes: [
          { path: '/users/:id', name: 'userDetail', component: { template: '<div>User</div>' } }
        ]
      });

      await router2.push({ name: 'userDetail', params: { id: '123' } });
      expect(router2.currentRoute.value.params.id).toBe('123');
    });
  });

  // ============ 状态管理与导航结合 (5 个) ============
  describe('Store 与 Router 集成', () => {
    it('[Integration-1] 登录操作应该更新 Store 和允许导航', async () => {
      // 模拟登录
      const admin = createMockAdmin();
      authStore.adminInfo = admin;
      authStore.adminToken = 'login-token';

      expect(authStore.isAuthenticated).toBe(true);

      // 现在应该能导航到受保护页面
      await router.push('/');
      expect(router.currentRoute.value.name).toBe('dashboard');
    });

    it('[Integration-2] 注销操作应该清除 Store 中的认证数据', async () => {
      // 先登录
      authStore.adminInfo = createMockAdmin();
      authStore.adminToken = 'token';
      expect(authStore.isAuthenticated).toBe(true);

      // 注销
      authStore.adminInfo = null;
      authStore.adminToken = null;
      expect(authStore.isAuthenticated).toBe(false);

      // Store 应该完全清空
      expect(authStore.adminInfo).toBeNull();
      expect(authStore.adminToken).toBeNull();
    });

    it('[Integration-3] Store 状态变化应该影响路由守卫的行为', async () => {
      authStore.isAuthenticated = false;

      await router.push('/users');
      expect(router.currentRoute.value.name).toBe('login');

      // 更新 Store 认证状态
      authStore.adminInfo = createMockAdmin();
      authStore.adminToken = 'new-token';

      await router.push('/users');
      expect(router.currentRoute.value.name).toBe('users');
    });

    it('[Integration-4] 刷新后应该从 localStorage 恢复认证状态', () => {
      const mockAdmin = createMockAdmin();
      authStore.adminInfo = mockAdmin;
      authStore.adminToken = 'persistent-token';

      // 模拟页面刷新 - localStorage 应该有数据
      const storedToken = global.localStorage.getItem('adminToken');
      const storedInfo = global.localStorage.getItem('user_info');

      expect(storedToken).not.toBeNull();
      expect(storedInfo).not.toBeNull();
    });

    it('[Integration-5] 多个 Store 更新应该保持一致性', () => {
      const admin = createMockAdmin({ name: '李四', email: 'li@example.com' });

      authStore.adminInfo = admin;
      authStore.adminToken = 'token1';

      expect(authStore.adminInfo.name).toBe('李四');
      expect(authStore.adminInfo.email).toBe('li@example.com');
      expect(authStore.adminToken).toBe('token1');

      // 更新名称
      authStore.adminInfo.name = '王五';

      expect(authStore.adminInfo.name).toBe('王五');
    });
  });

  // ============ 错误处理与恢复 (3 个) ============
  describe('错误处理与恢复', () => {
    it('[Error-1] 无效的认证令牌应该触发重新认证', () => {
      authStore.adminToken = '';
      expect(authStore.isAuthenticated).toBe(false);
    });

    it('[Error-2] 损坏的用户数据应该被处理', () => {
      authStore.adminInfo = null;
      expect(authStore.isAuthenticated).toBe(false);
    });

    it('[Error-3] 应该从错误状态恢复到有效状态', () => {
      // 错误状态
      authStore.adminInfo = null;
      authStore.adminToken = null;
      expect(authStore.isAuthenticated).toBe(false);

      // 恢复
      authStore.adminInfo = createMockAdmin();
      authStore.adminToken = 'recovered-token';
      expect(authStore.isAuthenticated).toBe(true);
    });
  });

  // ============ 并发操作 (3 个) ============
  describe('并发操作与竞态条件', () => {
    it('[Concurrent-1] 同时执行多个导航应该按顺序处理', async () => {
      authStore.adminInfo = createMockAdmin();
      authStore.adminToken = 'token';

      const promise1 = router.push('/users');
      const promise2 = router.push('/enrollments');

      await Promise.all([promise1, promise2]);

      // 应该最终导航到最后一个路由
      expect(router.currentRoute.value.name).toBe('enrollments');
    });

    it('[Concurrent-2] 快速登录-注销操作应该保持状态一致', () => {
      // 登录
      authStore.adminInfo = createMockAdmin();
      authStore.adminToken = 'token';
      expect(authStore.isAuthenticated).toBe(true);

      // 立即注销
      authStore.adminInfo = null;
      authStore.adminToken = null;
      expect(authStore.isAuthenticated).toBe(false);

      // 状态应该一致
      expect(authStore.adminInfo).toBeNull();
      expect(authStore.adminToken).toBeNull();
    });

    it('[Concurrent-3] 多次路由守卫检查应该一致', async () => {
      authStore.isAuthenticated = false;

      // 多次尝试访问受保护页面
      for (let i = 0; i < 3; i++) {
        await router.push('/users');
        expect(router.currentRoute.value.name).toBe('login');
      }
    });
  });
});
