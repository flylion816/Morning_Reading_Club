import apiClient from './api';

export const activityCouponService = {
  getList(params?: Record<string, unknown>) {
    return apiClient.get('/admin/activity-coupons', { params });
  },
  create(data: Record<string, unknown>) {
    return apiClient.post('/admin/activity-coupons', data);
  },
  update(id: string, data: Record<string, unknown>) {
    return apiClient.put(`/admin/activity-coupons/${id}`, data);
  },
  remove(id: string) {
    return apiClient.delete(`/admin/activity-coupons/${id}`);
  }
};
