import apiClient from '../services/api';

export interface AuditLog {
  _id: string;
  adminId: string | { _id?: string; name?: string; email?: string; role?: string };
  adminName: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  details: {
    description?: string;
    changes?: Record<string, any>;
    reason?: string;
    batchCount?: number;
  };
  ipAddress?: string;
  userAgent?: string;
  status: "success" | "failure";
  errorMessage?: string;
  timestamp: string;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface AuditStatistics {
  total: number;
  today: number;
  failed: number;
  actionTypeStats: Record<string, number>;
  resourceTypeStats: Record<string, number>;
  topAdmins: Array<{ _id: string; name?: string; email?: string; count: number }>;
}

/**
 * 获取审计日志列表
 */
export const getAuditLogs = (params: {
  page?: number;
  pageSize?: number;
  adminName?: string;
  adminId?: string;
  actionType?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<AuditLogsResponse> => {
  return apiClient.get('/audit-logs', { params });
};

/**
 * 获取管理员的操作记录
 */
export const getAdminLogs = (
  adminId: string,
  page = 1,
  pageSize = 20,
): Promise<AuditLogsResponse> => {
  return apiClient.get(`/audit-logs/admin/${adminId}`, { params: { page, pageSize } });
};

/**
 * 获取资源的操作记录
 */
export const getResourceLogs = (
  resourceType: string,
  resourceId: string,
  page = 1,
  pageSize = 20,
): Promise<AuditLogsResponse> => {
  return apiClient.get(`/audit-logs/resource/${resourceType}/${resourceId}`, { params: { page, pageSize } });
};

/**
 * 获取操作统计
 */
export const getAuditStatistics = (): Promise<AuditStatistics> => {
  return apiClient.get('/audit-logs/statistics');
};

/**
 * 导出审计日志
 */
export const exportAuditLogs = (params: {
  adminId?: string;
  actionType?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}): Promise<Blob> => {
  return apiClient.get('/audit-logs/export', { params, responseType: 'blob' });
};

/**
 * 清理过期日志
 */
export const cleanupExpiredLogs = (): Promise<{ deletedCount: number }> => {
  return apiClient.post('/audit-logs/cleanup');
};
