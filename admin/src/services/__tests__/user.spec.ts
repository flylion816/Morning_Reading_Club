/**
 * 用户管理 API 单元测试
 */

import { describe, it, expect } from 'vitest';
import { userApi } from '../api';

describe('User API', () => {
  it('应该导出 getUsers 方法', () => {
    const result = userApi.getUsers();
    expect(result).toBeInstanceOf(Promise);

    const withParams = userApi.getUsers({ page: 1, status: 'active' });
    expect(withParams).toBeInstanceOf(Promise);
  });

  it('应该导出 getUserDetail 方法，接受 id 参数', () => {
    const result = userApi.getUserDetail('user-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 updateUser 方法', () => {
    const result = userApi.updateUser('user-001', { nickname: 'New Name' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 deleteUser 方法，接受 id 参数', () => {
    const result = userApi.deleteUser('user-001');
    expect(result).toBeInstanceOf(Promise);
  });
});
