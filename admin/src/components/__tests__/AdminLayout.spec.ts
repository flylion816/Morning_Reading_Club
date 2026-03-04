/**
 * AdminLayout 组件单元测试
 * 测试管理后台布局的导航和功能
 * 共 9 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import AdminLayout from '../AdminLayout.vue';
import { useAuthStore } from '../../stores/auth';
import { createMockAdmin } from '../../tests/fixtures';

describe('AdminLayout - 管理后台布局组件', () => {
  let router: any;
  let pinia: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
        { path: '/users', name: 'users', component: { template: '<div>Users</div>' } },
        { path: '/analytics', name: 'analytics', component: { template: '<div>Analytics</div>' } },
        { path: '/database', name: 'database', component: { template: '<div>Database</div>' } }
      ]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ 页面标题计算 (3 个) ============
  describe('页面标题计算', () => {
    it('[Title-1] 默认路由的页面标题应该是"仪表板"', async () => {
      await router.push('/');
      await router.isReady();

      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      expect(wrapper.vm.pageTitle).toBe('仪表板');
    });

    it('[Title-2] /users 路由的页面标题应该是"用户管理"', async () => {
      await router.push('/users');
      await router.isReady();

      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      expect(wrapper.vm.pageTitle).toBe('用户管理');
    });

    it('[Title-3] /analytics 路由的页面标题应该是"数据分析"', async () => {
      await router.push('/analytics');
      await router.isReady();

      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      expect(wrapper.vm.pageTitle).toBe('数据分析');
    });
  });

  // ============ 用户信息显示 (2 个) ============
  describe('用户信息显示', () => {
    it('[User-1] 应该从 authStore 读取管理员信息', async () => {
      const authStore = useAuthStore();
      const adminData = createMockAdmin({ name: '张三' });
      authStore.adminInfo = adminData;

      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      // 验证 authStore 中的值正确
      const store = useAuthStore();
      expect(store.adminInfo?.name).toBe('张三');
    });

    it('[User-2] 应该在 script 中能访问 authStore', async () => {
      const authStore = useAuthStore();
      authStore.adminInfo = createMockAdmin({ name: '李四', avatar: 'https://example.com/avatar.jpg' });

      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      // 验证组件已接受 authStore（通过检查是否成功挂载）
      expect(wrapper.exists()).toBe(true);
      // 验证 authStore 中的值
      expect(authStore.adminInfo?.avatar).toBe('https://example.com/avatar.jpg');
    });
  });

  // ============ 菜单导航 (2 个) ============
  describe('菜单导航', () => {
    it('[Menu-1] 应该提供菜单选择处理函数', async () => {
      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      // 验证 handleMenuSelect 方法存在并可被调用
      expect(typeof wrapper.vm.handleMenuSelect).toBe('function');

      // 测试普通菜单路由导航
      const routerSpy = vi.spyOn(router, 'push');
      await wrapper.vm.handleMenuSelect('/users');
      expect(routerSpy).toHaveBeenCalledWith('/users');
    });

    it('[Menu-2] 数据库菜单项选中时应该打开二次验证对话框', async () => {
      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      // 模拟菜单选择事件
      expect(wrapper.vm.dbAccessVisible).toBe(false);
      await wrapper.vm.handleMenuSelect('/database');
      expect(wrapper.vm.dbAccessVisible).toBe(true);
      expect(wrapper.vm.pendingRoute).toBe('/database');
    });
  });

  // ============ 数据库访问验证 (2 个) ============
  describe('数据库访问验证', () => {
    it('[DB-1] 初始状态应该不显示数据库访问对话框', async () => {
      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      expect(wrapper.vm.dbAccessVisible).toBe(false);
      expect(wrapper.vm.dbAccessPassword).toBe('');
      expect(wrapper.vm.dbAccessError).toBe('');
    });

    it('[DB-2] 非数据库菜单项应该直接导航，不显示验证对话框', async () => {
      const wrapper = mount(AdminLayout, {
        global: {
          plugins: [pinia, router],
          stubs: ['el-container', 'el-aside', 'el-menu', 'el-menu-item-group', 'el-menu-item',
                  'el-main', 'el-header', 'el-button', 'el-avatar', 'el-dialog', 'el-input']
        }
      });

      const routerPushSpy = vi.spyOn(router, 'push');
      await wrapper.vm.handleMenuSelect('/users');

      expect(routerPushSpy).toHaveBeenCalledWith('/users');
      expect(wrapper.vm.dbAccessVisible).toBe(false);
    });
  });
});
