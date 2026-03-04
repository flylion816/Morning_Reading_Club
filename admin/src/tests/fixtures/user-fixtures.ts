/**
 * 用户相关的测试数据工厂函数
 * 用于 Admin 项目的单元测试
 */

export interface MockUser {
  id?: string;
  _id?: string;
  email: string;
  nickname: string;
  role?: string;
  avatar?: string;
  status?: string;
  createdAt?: Date;
  [key: string]: unknown;
}

/**
 * 创建超级管理员 Mock 对象
 */
export const createMockAdmin = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: 'admin-001',
  _id: 'admin-001',
  email: 'admin@morningreading.com',
  nickname: '超级管理员',
  role: 'super_admin',
  avatar: 'https://example.com/admin-avatar.jpg',
  status: 'active',
  createdAt: new Date('2025-01-01'),
  ...overrides
});

/**
 * 创建普通管理员 Mock 对象
 */
export const createMockNormalAdmin = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: 'admin-002',
  _id: 'admin-002',
  email: 'user@morningreading.com',
  nickname: '普通管理员',
  role: 'admin',
  avatar: 'https://example.com/admin2-avatar.jpg',
  status: 'active',
  createdAt: new Date('2025-02-01'),
  ...overrides
});

/**
 * 创建普通用户 Mock 对象
 */
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: 'user-001',
  _id: 'user-001',
  email: 'user1@example.com',
  nickname: '小王',
  avatar: 'https://example.com/user-avatar.jpg',
  status: 'active',
  createdAt: new Date('2025-01-15'),
  ...overrides
});

/**
 * 创建多个普通用户
 */
export const createMockUsers = (count = 3, overrides: Partial<MockUser> = {}): MockUser[] =>
  Array.from({ length: count }, (_, i) =>
    createMockUser({
      id: `user-${String(i + 1).padStart(3, '0')}`,
      _id: `user-${String(i + 1).padStart(3, '0')}`,
      email: `user${i + 1}@example.com`,
      nickname: `用户${i + 1}`,
      ...overrides
    })
  );

/**
 * 创建禁用状态的用户
 */
export const createMockDisabledUser = (overrides: Partial<MockUser> = {}): MockUser =>
  createMockUser({
    status: 'disabled',
    ...overrides
  });

/**
 * 创建未激活的用户
 */
export const createMockInactiveUser = (overrides: Partial<MockUser> = {}): MockUser =>
  createMockUser({
    status: 'inactive',
    ...overrides
  });
