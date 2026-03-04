/**
 * UI Store 单元测试
 * 覆盖所有 state、getters、actions 相关场景
 * 共 5 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUIStore } from '@/stores/ui';

describe('UIStore - useUIStore()', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ State 测试 (2 个) ============
  describe('State Initialization', () => {
    it('[State-1] 应该以默认值初始化 UI 状态', () => {
      const store = useUIStore();
      expect(store.sidebarCollapsed).toBe(false);
      expect(store.notificationCount).toBe(0);
      expect(store.theme).toBe('light');
      expect(store.modalStack).toEqual([]);
    });

    it('[State-2] 应该允许直接修改 state 值', () => {
      const store = useUIStore();

      store.sidebarCollapsed = true;
      expect(store.sidebarCollapsed).toBe(true);

      store.notificationCount = 5;
      expect(store.notificationCount).toBe(5);

      store.theme = 'dark';
      expect(store.theme).toBe('dark');
    });
  });

  // ============ Getters 测试 (2 个) ============
  describe('Getters', () => {
    it('[Getter-1] isSidebarVisible 应该是 sidebarCollapsed 的反值', () => {
      const store = useUIStore();

      expect(store.isSidebarVisible).toBe(true);

      store.sidebarCollapsed = true;
      expect(store.isSidebarVisible).toBe(false);

      store.sidebarCollapsed = false;
      expect(store.isSidebarVisible).toBe(true);
    });

    it('[Getter-2] isModalOpen 和 topModal 应该正确反映 modal 栈状态', () => {
      const store = useUIStore();

      expect(store.isModalOpen).toBe(false);
      expect(store.topModal).toBeNull();

      store.modalStack.push('modal1');
      expect(store.isModalOpen).toBe(true);
      expect(store.topModal).toBe('modal1');

      store.modalStack.push('modal2');
      expect(store.topModal).toBe('modal2');

      store.modalStack.pop();
      expect(store.topModal).toBe('modal1');

      store.modalStack.pop();
      expect(store.topModal).toBeNull();
      expect(store.isModalOpen).toBe(false);
    });
  });

  // ============ Actions 测试 - Sidebar (1 个) ============
  describe('Actions - Sidebar', () => {
    it('[Action-1] toggleSidebar() 应该切换侧边栏状态', () => {
      const store = useUIStore();
      expect(store.sidebarCollapsed).toBe(false);

      store.toggleSidebar();
      expect(store.sidebarCollapsed).toBe(true);

      store.toggleSidebar();
      expect(store.sidebarCollapsed).toBe(false);

      store.setSidebarCollapsed(true);
      expect(store.sidebarCollapsed).toBe(true);

      store.setSidebarCollapsed(false);
      expect(store.sidebarCollapsed).toBe(false);
    });
  });

  // ============ Actions 测试 - Notifications (1 个) ============
  describe('Actions - Notifications', () => {
    it('[Action-2] 通知计数 actions 应该正确操作计数', () => {
      const store = useUIStore();
      expect(store.notificationCount).toBe(0);

      store.incrementNotification();
      expect(store.notificationCount).toBe(1);

      store.incrementNotification();
      expect(store.notificationCount).toBe(2);

      store.decrementNotification();
      expect(store.notificationCount).toBe(1);

      store.decrementNotification();
      expect(store.notificationCount).toBe(0);

      // 不能为负数
      store.decrementNotification();
      expect(store.notificationCount).toBe(0);

      store.notificationCount = 10;
      store.clearNotifications();
      expect(store.notificationCount).toBe(0);
    });
  });

  // ============ Actions 测试 - Theme (1 个) ============
  describe('Actions - Theme', () => {
    it('[Action-3] setTheme() 应该更新主题', () => {
      const store = useUIStore();
      expect(store.theme).toBe('light');

      store.setTheme('dark');
      expect(store.theme).toBe('dark');

      store.setTheme('light');
      expect(store.theme).toBe('light');
    });
  });

  // ============ Actions 测试 - Modals (2 个) ============
  describe('Actions - Modals', () => {
    it('[Action-4] openModal() 和 closeModal() 应该管理模态栈', () => {
      const store = useUIStore();

      store.openModal('confirmDelete');
      expect(store.modalStack).toContain('confirmDelete');
      expect(store.isModalOpen).toBe(true);

      store.openModal('editUser');
      expect(store.modalStack).toContain('editUser');
      expect(store.topModal).toBe('editUser');

      store.closeModal('confirmDelete');
      expect(store.modalStack).not.toContain('confirmDelete');
      expect(store.topModal).toBe('editUser');

      store.closeModal('editUser');
      expect(store.modalStack.length).toBe(0);
      expect(store.isModalOpen).toBe(false);
    });

    it('[Action-5] openModal() 不应该添加重复的 modal，closeTopModal() 和 clearAllModals() 应该工作', () => {
      const store = useUIStore();

      store.openModal('modal1');
      store.openModal('modal1'); // 重复
      expect(store.modalStack.length).toBe(1);

      store.openModal('modal2');
      store.openModal('modal3');
      expect(store.topModal).toBe('modal3');

      store.closeTopModal();
      expect(store.topModal).toBe('modal2');

      store.clearAllModals();
      expect(store.modalStack.length).toBe(0);
      expect(store.isModalOpen).toBe(false);
    });
  });
});
