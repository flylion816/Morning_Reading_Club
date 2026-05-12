/**
 * 支付管理 API 单元测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient, { paymentApi } from '../api';

describe('Payment API', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({});
    vi.spyOn(apiClient, 'post').mockResolvedValue({});
  });

  it('应该导出 getPayments 方法，并接受可选参数', () => {
    const result = paymentApi.getPayments();
    expect(result).toBeInstanceOf(Promise);

    const withParams = paymentApi.getPayments({ page: 1, status: 'success' });
    expect(withParams).toBeInstanceOf(Promise);
  });

  it('应该导出 getPaymentDetail 方法，接受 id 参数', () => {
    const result = paymentApi.getPaymentDetail('payment-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 cancelPayment 方法，接受 id 参数', () => {
    const result = paymentApi.cancelPayment('payment-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 getUserPayments 方法，接受 userId 参数', () => {
    const result = paymentApi.getUserPayments('user-001');
    expect(result).toBeInstanceOf(Promise);

    const withParams = paymentApi.getUserPayments('user-001', { page: 1, limit: 20 });
    expect(withParams).toBeInstanceOf(Promise);
  });
});
