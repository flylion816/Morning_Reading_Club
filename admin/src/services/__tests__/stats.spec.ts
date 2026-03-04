/**
 * 统计 API 单元测试
 */

import { describe, it, expect } from 'vitest';
import { statsApi } from '../api';

describe('Stats API', () => {
  it('应该导出 getDashboardStats 方法', () => {
    const result = statsApi.getDashboardStats();
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 getEnrollmentStats 方法', () => {
    const result = statsApi.getEnrollmentStats();
    expect(result).toBeInstanceOf(Promise);

    const withParams = statsApi.getEnrollmentStats({ startDate: '2025-01-01' });
    expect(withParams).toBeInstanceOf(Promise);
  });

  it('应该导出 getPaymentStats 方法', () => {
    const result = statsApi.getPaymentStats();
    expect(result).toBeInstanceOf(Promise);

    const withParams = statsApi.getPaymentStats({ status: 'success' });
    expect(withParams).toBeInstanceOf(Promise);
  });
});
