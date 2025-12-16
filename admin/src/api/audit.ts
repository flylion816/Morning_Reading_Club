import axios from 'axios';

const BASE_URL = '/api/v1/audit-logs';

export interface AuditLog {
  _id: string;
  adminId: string;
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
  status: 'success' | 'failure';
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
  topAdmins: Array<{ _id: string; count: number }>;
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
  return axios.get(BASE_URL, { params }).then(res => res.data.data || res.data);
};

/**
 * 获取管理员的操作记录
 */
export const getAdminLogs = (
  adminId: string,
  page = 1,
  pageSize = 20
): Promise<AuditLogsResponse> => {
  return axios
    .get(`${BASE_URL}/admin/${adminId}`, { params: { page, pageSize } })
    .then(res => res.data.data);
};

/**
 * 获取资源的操作记录
 */
export const getResourceLogs = (
  resourceType: string,
  resourceId: string,
  page = 1,
  pageSize = 20
): Promise<AuditLogsResponse> => {
  return axios
    .get(`${BASE_URL}/resource/${resourceType}/${resourceId}`, { params: { page, pageSize } })
    .then(res => res.data.data);
};

/**
 * 获取操作统计
 */
export const getAuditStatistics = (): Promise<AuditStatistics> => {
  return axios.get(`${BASE_URL}/statistics`).then(res => res.data.data);
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
  return axios
    .get(`${BASE_URL}/export`, {
      params,
      responseType: 'blob'
    })
    .then(res => res.data);
};

/**
 * 清理过期日志
 */
export const cleanupExpiredLogs = (): Promise<{ deletedCount: number }> => {
  return axios.post(`${BASE_URL}/cleanup`).then(res => res.data.data);
};
