/**
 * 统计 API 单元测试
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import apiClient, { statsApi } from '../api';

describe('Stats API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该导出 getDashboardStats 方法', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({});
    await expect(statsApi.getDashboardStats()).resolves.toEqual({});
    expect(getSpy).toHaveBeenCalledWith('/stats/dashboard');
  });

  it('应该导出 getEnrollmentStats 方法', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({});
    await expect(statsApi.getEnrollmentStats()).resolves.toEqual({});
    expect(getSpy).toHaveBeenCalledWith('/stats/enrollments', { params: undefined });

    await statsApi.getEnrollmentStats({ startDate: '2025-01-01' });
    expect(getSpy).toHaveBeenCalledWith('/stats/enrollments', {
      params: { startDate: '2025-01-01' }
    });
  });

  it('应该导出 getPaymentStats 方法', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({});
    await expect(statsApi.getPaymentStats()).resolves.toEqual({});
    expect(getSpy).toHaveBeenCalledWith('/stats/payments', { params: undefined });

    await statsApi.getPaymentStats({ status: 'success' });
    expect(getSpy).toHaveBeenCalledWith('/stats/payments', {
      params: { status: 'success' }
    });
  });
});
