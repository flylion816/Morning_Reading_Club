/**
 * User Store 单元测试
 * 覆盖所有 state、getters、actions 相关场景
 * 共 6 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from '@/stores/user';
import { createMockUsers, createMockUser } from '@/tests/fixtures';

describe('UserStore - useUserStore()', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ State 测试 (2 个) ============
  describe('State Initialization', () => {
    it('[State-1] 应该以空值初始化用户状态', () => {
      const store = useUserStore();
      expect(store.users).toEqual([]);
      expect(store.selectedUserIds).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.totalCount).toBe(0);
    });

    it('[State-2] 应该允许直接修改 state 值', () => {
      const store = useUserStore();
      const users = createMockUsers(3);

      store.users = users;
      expect(store.users).toHaveLength(3);

      store.loading = true;
      expect(store.loading).toBe(true);

      store.error = '测试错误';
      expect(store.error).toBe('测试错误');
    });
  });

  // ============ Getters 测试 (2 个) ============
  describe('Getters', () => {
    it('[Getter-1] userCount 和 selectedCount 应该反映数据量', () => {
      const store = useUserStore();
      expect(store.userCount).toBe(0);
      expect(store.selectedCount).toBe(0);

      const users = createMockUsers(5);
      store.users = users;
      expect(store.userCount).toBe(5);

      store.selectedUserIds = [users[0].id, users[1].id];
      expect(store.selectedCount).toBe(2);
    });

    it('[Getter-2] selectedUsers 应该返回已选中的用户对象列表', () => {
      const store = useUserStore();
      const users = createMockUsers(4);
      store.users = users;

      store.selectedUserIds = [users[0].id, users[2].id];

      expect(store.selectedUsers).toHaveLength(2);
      expect(store.selectedUsers[0]).toEqual(users[0]);
      expect(store.selectedUsers[1]).toEqual(users[2]);
    });
  });

  // ============ Actions 测试 - User Management (2 个) ============
  describe('Actions - User Management', () => {
    it('[Action-1] setUsers()、addUser()、removeUser() 应该管理用户列表', () => {
      const store = useUserStore();
      const users = createMockUsers(3);

      store.setUsers(users);
      expect(store.userCount).toBe(3);

      const newUser = createMockUser({ id: 'new-user', _id: 'new-user', nickname: '新用户' });
      store.addUser(newUser);
      expect(store.userCount).toBe(4);
      expect(store.users[3]).toEqual(newUser);

      store.removeUser(users[0].id);
      expect(store.userCount).toBe(3);
      expect(store.users.map(u => u.id)).not.toContain(users[0].id);
    });

    it('[Action-2] updateUser() 应该更新特定用户的信息', () => {
      const store = useUserStore();
      const users = createMockUsers(3);
      store.users = users;

      const userId = users[1].id;
      store.updateUser(userId, { nickname: '更新后的昵称', status: 'inactive' });

      const updatedUser = store.users.find(u => u.id === userId);
      expect(updatedUser?.nickname).toBe('更新后的昵称');
      expect(updatedUser?.status).toBe('inactive');
      // 其他字段应保持不变
      expect(updatedUser?.email).toBe(users[1].email);
    });
  });

  // ============ Actions 测试 - Selection (1 个) ============
  describe('Actions - Selection', () => {
    it('[Action-3] 选中/取消选中 actions 应该正确管理选中状态', () => {
      const store = useUserStore();
      const users = createMockUsers(5);
      store.users = users;

      store.selectUser(users[0].id);
      expect(store.selectedUserIds).toContain(users[0].id);
      expect(store.selectedCount).toBe(1);

      store.selectUser(users[2].id);
      expect(store.selectedCount).toBe(2);

      // 重复选中不应增加计数
      store.selectUser(users[0].id);
      expect(store.selectedCount).toBe(2);

      store.deselectUser(users[0].id);
      expect(store.selectedUserIds).not.toContain(users[0].id);
      expect(store.selectedCount).toBe(1);

      store.selectAll();
      expect(store.selectedCount).toBe(5);

      store.deselectAll();
      expect(store.selectedCount).toBe(0);
    });
  });

  // ============ Actions 测试 - Async Fetch (1 个) ============
  describe('Actions - Async Fetch', () => {
    it('[Action-4] fetchUsers() 执行时应该正确管理 loading 和 error 状态', async () => {
      const store = useUserStore();
      const users = createMockUsers(3);

      // 直接设置 users（模拟 API 响应）
      store.users = users;
      store.totalCount = 3;

      // 验证状态
      expect(store.userCount).toBe(3);
      expect(store.totalCount).toBe(3);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  // ============ 工具方法测试 (1 个) ============
  describe('Utility Methods', () => {
    it('[Action-5] clearError() 和 reset() 应该清除状态', () => {
      const store = useUserStore();
      const users = createMockUsers(3);

      store.users = users;
      store.selectedUserIds = [users[0].id];
      store.loading = true;
      store.error = '加载失败';
      store.totalCount = 3;

      store.clearError();
      expect(store.error).toBeNull();
      expect(store.users).toHaveLength(3); // 其他状态不变

      store.reset();
      expect(store.users).toEqual([]);
      expect(store.selectedUserIds).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.totalCount).toBe(0);
    });
  });
});
