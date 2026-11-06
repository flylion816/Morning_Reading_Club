import axios, { type AxiosRequestConfig } from 'axios';
import logger from '../utils/logger';

// 配置 API 基础 URL
// 开发环境：使用相对路径 /api/v1，由 Vite 代理转发到真实后端
// 生产环境：使用完整 URL https://wx.shubai01.com/api/v1
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api/v1' : 'https://wx.shubai01.com/api/v1');

type DataApiClient = {
  get<T = any>(_url: string, _config?: AxiosRequestConfig): Promise<T>;
  post<T = any>(_url: string, _data?: any, _config?: AxiosRequestConfig): Promise<T>;
  put<T = any>(_url: string, _data?: any, _config?: AxiosRequestConfig): Promise<T>;
  patch<T = any>(_url: string, _data?: any, _config?: AxiosRequestConfig): Promise<T>;
  delete<T = any>(_url: string, _config?: AxiosRequestConfig): Promise<T>;
};

// 创建 axios 实例。响应拦截器会返回 response.data，因此业务层使用 DataApiClient 类型。
const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Administrator access tokens live only in memory. The browser receives the
// rotating refresh credential as a Secure, HttpOnly cookie.
let adminAccessToken: string | null = null;
let maintenanceProof: string | null = null;
let refreshPromise: Promise<any | null> | null = null;

export function setAdminAccessToken(token: string | null) {
  adminAccessToken = token;
  if (token) axiosClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete axiosClient.defaults.headers.common.Authorization;
}

export function setAdminMaintenanceProof(token: string | null) {
  maintenanceProof = token;
}

function refreshAdminSession(): Promise<any | null> {
  if (!refreshPromise) {
    refreshPromise = axios.post(`${API_BASE_URL}/auth/admin/refresh-token`, {}, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    }).then(response => {
      const data = response.data?.data || response.data;
      if (!data?.accessToken) return null;
      setAdminAccessToken(data.accessToken);
      return data;
    }).catch(() => null).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// 请求拦截器 - 添加认证令牌
axiosClient.interceptors.request.use(
  (config) => {
    if (adminAccessToken) config.headers.Authorization = `Bearer ${adminAccessToken}`;
    if (config.url?.startsWith('/backup/') && maintenanceProof) {
      config.headers['X-Admin-Maintenance-Proof'] = maintenanceProof;
    }

    try {
      const activeTenant = localStorage.getItem('admin_active_tenant');
      if (activeTenant) config.headers['X-Active-Tenant'] = activeTenant;
    } catch (_) {
      // Storage availability is not an authorization signal.
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误和令牌过期
axiosClient.interceptors.response.use(
  (response) => {
    logger.debug('[API Response] 成功', {
      url: response.config.url,
      status: response.status
    });

    // 后端返回格式：{code, message, data: {...}, pagination: {...}, timestamp: ...}
    if (response.data && typeof response.data === 'object') {
      // 如果响应有标准结构 {code, message, data}，需要转换成兼容格式
      if (
        'code' in response.data &&
        'message' in response.data &&
        'data' in response.data
      ) {
        logger.debug('[API Response] 标准格式，转换为兼容结构');

        const data = response.data.data;

        // 关键：返回兼容格式
        // 如果 data 是数组，返回 {list: [...], ...pagination}
        // 这样既保持向后兼容（response.list），也支持新用法（Array.isArray(response)）
        if (Array.isArray(data)) {
          const result: any = {
            list: data,
            data: data, // 同时支持 data 字段
            ...response.data.pagination // 展开 pagination 字段
          };
          return result;
        }

        // 如果不是数组，直接返回 data
        return data;
      }
      // 否则直接返回响应数据
      logger.debug('[API Response] 非标准格式，返回 response.data');
      return response.data;
    }
    logger.debug('[API Response] 返回 response.data');
    return response.data;
  },
  (error) => {
    logger.warn('[API Response] 错误', {
      url: error.config?.url,
      status: error.response?.status
    });
    const url = error.config?.url || '';
    const responseMessage = error.response?.data?.message || '';
    if (error.response?.status === 403 && url.startsWith('/backup/') && /二次验证|授权已过期|授权已失效/u.test(responseMessage)) {
      setAdminMaintenanceProof(null);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('admin-maintenance-expired'));
    }
    const isSessionEndpoint = url.includes('/auth/admin/login') || url.includes('/auth/admin/refresh-token');
    if (error.response?.status === 401 && !isSessionEndpoint && !(error.config as any)?._adminRefreshRetry) {
      (error.config as any)._adminRefreshRetry = true;
      return refreshAdminSession().then(session => {
        if (session?.accessToken && error.config) {
          error.config.headers.Authorization = `Bearer ${session.accessToken}`;
          return axiosClient.request(error.config);
        }
        setAdminAccessToken(null);
        setAdminMaintenanceProof(null);
        try { localStorage.removeItem('adminInfo'); } catch (_) { /* ignore */ }
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error.response?.data || error);
      });
    }
    if (error.response?.status === 401 && !isSessionEndpoint) {
      setAdminAccessToken(null);
      setAdminMaintenanceProof(null);
      try { localStorage.removeItem('adminInfo'); } catch (_) { /* ignore */ }
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    // 返回更详细的错误信息
    const errorData = error.response?.data;
    if (errorData && typeof errorData === 'object' && 'message' in errorData) {
      // 创建一个包含 message 属性的错误对象
      const err = new Error(errorData.message);
      (err as any).data = errorData;
      return Promise.reject(err);
    }
    return Promise.reject(error.response?.data || error);
  }
);

const apiClient = axiosClient as unknown as DataApiClient;

// 认证 API
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/admin/login', { email, password }),
  refresh: () => refreshAdminSession(),
  logout: () => apiClient.post('/auth/admin/logout'),
  getProfile: () => apiClient.get('/auth/admin/profile'),
  updateProfile: (data: { name: string; avatar?: string | null }) =>
    apiClient.put('/auth/admin/profile', data),
  verifyDbAccess: async (password: string) => {
    const result: any = await apiClient.post('/auth/admin/verify-db-access', { password });
    if (result?.maintenanceToken) setAdminMaintenanceProof(result.maintenanceToken);
    return result;
  }
};

// 账号管理 API
export const accountApi = {
  getAdmins: (params?: any) => apiClient.get('/admins', { params }),
  getAdminDetail: (id: string) => apiClient.get(`/admins/${id}`),
  createAdmin: (data: any) => apiClient.post('/admins', data),
  updateAdmin: (id: string, data: any) => apiClient.put(`/admins/${id}`, data),
  deleteAdmin: (id: string) => apiClient.delete(`/admins/${id}`),
  resetPassword: (id: string, password: string) => 
    apiClient.patch(`/admins/${id}/password`, { password }),
  updateStatus: (id: string, status: string) => 
    apiClient.patch(`/admins/${id}/status`, { status })
};

// 租户 API
export const tenantApi = {
  getTenants: async (params?: any) => {
    const result: any = await apiClient.get('/admin/tenants', { params });
    const tenants = Array.isArray(result?.list)
      ? result.list
      : Array.isArray(result)
        ? result
        : result?.tenants || [];
    return {
      data: {
        data: {
          tenants,
          total: result?.total || tenants.length
        },
        tenants,
        total: result?.total || tenants.length
      }
    };
  },
  getSummary: async () => {
    const result: any = await apiClient.get('/admin/tenants');
    const tenants = Array.isArray(result?.list)
      ? result.list
      : Array.isArray(result)
        ? result
        : result?.tenants || [];
    const summary = {
      total: tenants.length,
      active: tenants.filter((tenant: any) => tenant.status === 'active').length,
      inactive: tenants.filter((tenant: any) => tenant.status !== 'active').length
    };
    return {
      data: {
        data: summary,
        ...summary
      }
    };
  },
  createTenant: (data: any) => apiClient.post('/admin/tenants', data),
  updateTenant: (id: string, data: any) => apiClient.put(`/admin/tenants/${id}`, data),
  updateStatus: (id: string, status: string) => apiClient.put(`/admin/tenants/${id}`, { status })
};

// 报名 API
export const enrollmentApi = {
  getEnrollments: (params?: any) => apiClient.get('/enrollments', { params }),
  getEnrollmentDetail: (id: string) => apiClient.get(`/enrollments/${id}`),
  approveEnrollment: (id: string, data?: any) =>
    apiClient.post(`/enrollments/${id}/approve`, data),
  rejectEnrollment: (id: string, data?: any) =>
    apiClient.post(`/enrollments/${id}/reject`, data),
  updateEnrollment: (id: string, data: any) =>
    apiClient.put(`/enrollments/${id}`, data),
  getFormStatistics: (params?: any) =>
    apiClient.get('/enrollments/form-statistics', { params }),
  syncNicknamesFromEnrollments: () =>
    apiClient.post('/enrollments/sync-nicknames')
};

// 结营实录报告 API
export const completionReportApi = {
  getReports: (params?: any) =>
    apiClient.get('/enrollments/reports', { params }),
  bindReport: (enrollmentId: string, data: any) =>
    apiClient.put(`/enrollments/${enrollmentId}/completion-report`, data),
  clearReport: (enrollmentId: string) =>
    apiClient.delete(`/enrollments/${enrollmentId}/completion-report`)
};

// 支付 API
export const paymentApi = {
  getPayments: (params?: any) => apiClient.get('/payments', { params }),
  getPaymentDetail: (id: string) => apiClient.get(`/payments/${id}`),
  cancelPayment: (id: string) => apiClient.post(`/payments/${id}/cancel`),
  adminCancelPayment: (id: string) =>
    apiClient.post(`/payments/${id}/admin-cancel`),
  resetPaymentToPending: (id: string) =>
    apiClient.post(`/payments/${id}/reset-to-pending`),
  getUserPayments: (userId: string, params?: any) =>
    apiClient.get(`/payments/user/${userId}`, { params })
};

// 期次 API
export const courseTemplateApi = {
  list: () => apiClient.get('/course-templates'),
  create: (data: any) => apiClient.post('/course-templates', data),
  update: (id: string, data: any) => apiClient.put(`/course-templates/${id}`, data)
};

export const enrollmentTemplateApi = {
  list: () => apiClient.get('/enrollment-templates'),
  create: (data: any) => apiClient.post('/enrollment-templates', data),
  update: (id: string, data: any) => apiClient.put(`/enrollment-templates/${id}`, data)
};

export const periodApi = {
  getPeriods: (params?: any) => apiClient.get('/periods', { params }),
  getPeriodDetail: (id: string) => apiClient.get(`/periods/${id}`),
  getPeriodById: (id: string) => apiClient.get(`/periods/${id}`),
  createPeriod: (data: any) => apiClient.post('/periods', data),
  updatePeriod: (id: string, data: any) =>
    apiClient.put(`/periods/${id}`, data),
  deletePeriod: (id: string) => apiClient.delete(`/periods/${id}`),
  copyPeriod: (id: string, data: any) =>
    apiClient.post(`/periods/${id}/copy`, data),
  syncAllPeriodsStatus: () => apiClient.post('/periods/sync-status'),

  // 课节相关 API
  getSections: (periodId: string, params?: any) =>
    apiClient.get(`/periods/${periodId}/sections`, { params }),
  getAllSections: (periodId: string, params?: any) =>
    apiClient.get(`/periods/${periodId}/sections/admin/all`, { params }),
  getSectionDetail: (sectionId: string) =>
    apiClient.get(`/sections/${sectionId}`),
  createSection: (periodId: string, data: any) =>
    apiClient.post(`/periods/${periodId}/sections`, data),
  updateSection: (sectionId: string, data: any) =>
    apiClient.put(`/sections/${sectionId}`, data),
  deleteSection: (sectionId: string) =>
    apiClient.delete(`/sections/${sectionId}`)
};

// 用户 API
export const userApi = {
  getUsers: (paramsOrPage?: any, pageSize?: number) => {
    const params =
      typeof paramsOrPage === 'number'
        ? { page: paramsOrPage, limit: pageSize }
        : paramsOrPage;
    return apiClient.get('/users', { params });
  },
  getUserDetail: (id: string) => apiClient.get(`/users/${id}`),
  updateUser: (id: string, data: any) => apiClient.put(`/users/${id}`, data),
  deleteUser: (id: string) => apiClient.delete(`/users/${id}`),
  adminSearch: (q: string) => apiClient.get('/users/admin/search', { params: { q } })
};

// 统计 API
export const statsApi = {
  getDashboardStats: () => apiClient.get('/stats/dashboard'),
  getEnrollmentStats: (params?: any) =>
    apiClient.get('/stats/enrollments', { params }),
  getPaymentStats: (params?: any) =>
    apiClient.get('/stats/payments', { params })
};

// 小凡看见 API
export const insightApi = {
  getInsights: (params?: any) => apiClient.get('/insights', { params }),
  getInsightsByPeriod: (periodId: string, params?: any) =>
    apiClient.get(`/insights/period/${periodId}`, { params }),
  getInsightDetail: (id: string) => apiClient.get(`/insights/${id}`),
  createInsight: (data: any) => apiClient.post('/insights/manual/create', data),
  updateInsight: (id: string, data: any) =>
    apiClient.put(`/insights/admin/${id}`, data),
  deleteInsight: (id: string) => apiClient.delete(`/insights/manual/${id}`),
  publishInsight: (id: string) =>
    apiClient.put(`/insights/admin/${id}`, { isPublished: true }),
  unpublishInsight: (id: string) =>
    apiClient.put(`/insights/admin/${id}`, { isPublished: false }),
  getInsightDetailAdmin: (id: string) => apiClient.get(`/insights/admin/${id}/detail`),
  getDanmakuAdmin: (id: string) => apiClient.get(`/insights/admin/${id}/danmaku`),
  likeForUserAdmin: (id: string, userId: string, scrollPercent?: number) => apiClient.post(`/insights/admin/${id}/like`, { userId, scrollPercent: scrollPercent ?? 0 }),
  postDanmakuForUserAdmin: (id: string, data: any) => apiClient.post(`/insights/admin/${id}/danmaku`, data),
  deleteDanmakuAdmin: (danmakuId: string) => apiClient.delete(`/insights/admin/danmaku/${danmakuId}`)
};

// 小凡看见申请 API（管理后台）
export const insightRequestsApi = {
  getRequests: (params?: any) =>
    apiClient.get('/insights/admin/requests', { params }),
  getRequestDetail: (requestId: string) =>
    apiClient.get(`/insights/admin/requests/${requestId}`),
  getRequestStats: () => apiClient.get('/insights/admin/requests/stats'),
  approveRequest: (requestId: string, data?: any) =>
    apiClient.put(`/insights/admin/requests/${requestId}/approve`, data),
  rejectRequest: (requestId: string, data?: any) =>
    apiClient.put(`/insights/admin/requests/${requestId}/reject`, data),
  batchApprove: (requestIds: string[]) =>
    apiClient.post('/insights/admin/requests/batch-approve', { requestIds }),
  deleteRequest: (requestId: string) =>
    apiClient.delete(`/insights/admin/requests/${requestId}`)
};

// 订阅消息排查 API
export const subscriptionDebugApi = {
  getGrants: (params?: any) =>
    apiClient.get('/admin/subscription-grants', { params }),
  getGrantDetail: (userId: string, params?: any) =>
    apiClient.get(`/admin/subscription-grants/${userId}`, { params })
};

// 审计日志 API
export const auditLogsApi = {
  getLogs: (params?: any) => apiClient.get('/audit-logs', { params }),
  getStatistics: () => apiClient.get('/audit-logs/statistics'),
  getAdminLogs: (adminId: string, params?: any) =>
    apiClient.get(`/audit-logs/admin/${adminId}`, { params }),
  getResourceLogs: (resourceType: string, resourceId: string, params?: any) =>
    apiClient.get(`/audit-logs/resource/${resourceType}/${resourceId}`, {
      params
    }),
  exportLogs: (params?: any) =>
    apiClient.get('/audit-logs/export', { params, responseType: 'blob' })
};

// 数据分析 API
export const analyticsApi = {
  getUserTrend: (params?: any) =>
    apiClient.get('/analytics/users/trend', { params }),
  getEnrollmentTrend: (params?: any) =>
    apiClient.get('/analytics/enrollments/trend', { params }),
  getRevenueTrend: (params?: any) =>
    apiClient.get('/analytics/revenue/trend', { params }),
  getConversionMetrics: (params?: any) =>
    apiClient.get('/analytics/conversion', { params }),
  getKeyMetrics: () => apiClient.get('/analytics/metrics'),
  getActivityAnalytics: (params?: any) =>
    apiClient.get('/activities/analytics', { params })
};

// 文件上传 API
export const uploadApi = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 300000
    });
  },

  uploadClosingVideo: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/sections/admin/upload-closing-video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 300000
    });
  },

  uploadMultiple: (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    return apiClient.post('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 300000
    });
  },

  deleteFile: (filename: string) => apiClient.delete(`/upload/${filename}`)
};

// 在场印记 API
export const imprintApi = {
  getImprints: (params?: any) => apiClient.get('/imprints/admin/list', { params }),
  getImprintDetail: (id: string) => apiClient.get(`/imprints/${id}`),
  updateImprint: (id: string, data: any) => apiClient.put(`/imprints/admin/${id}`, data),
  deleteImprint: (id: string) => apiClient.delete(`/imprints/admin/${id}`),
  uploadMedia: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post('/imprints/admin/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    } as any);
  }
};

export const imprintActivityTypeApi = {
  getTypes: () => apiClient.get('/imprints/admin/activity-types'),
  createType: (data: any) => apiClient.post('/imprints/admin/activity-types', data),
  updateType: (id: string, data: any) => apiClient.put(`/imprints/admin/activity-types/${id}`, data),
  deleteType: (id: string) => apiClient.delete(`/imprints/admin/activity-types/${id}`),
  reorderTypes: (items: { id: string; sortOrder: number }[]) =>
    apiClient.put('/imprints/admin/activity-types/reorder', { items })
};

export const homeConfigApi = {
  getConfig: () => apiClient.get('/home-config/admin'),
  updateConfig: (
    sections: Array<string | { key: string; hidden?: boolean }>,
    hiddenSections?: string[]
  ) => apiClient.put('/home-config/admin', { sections, hiddenSections })
};

// 备份管理 API
export const backupApi = {
  // 统计
  getMongodbStats: () => apiClient.get('/backup/mongodb/stats'),
  getMysqlStats: () => apiClient.get('/backup/mysql/stats'),
  compareBackup: () => apiClient.get('/backup/compare'),

  // 字段级对比
  compareFieldsDetail: (tableName: string) =>
    apiClient.get('/backup/compare/fields', { params: { tableName } }),

  // 数据查询
  getMongodbTableData: (table: string, page: number, limit: number) =>
    apiClient.get('/backup/mongodb/data', { params: { table, page, limit } }),
  getMysqlTableData: (table: string, page: number, limit: number) =>
    apiClient.get('/backup/mysql/data', { params: { table, page, limit } }),

  // 同步
  fullSync: () => apiClient.post('/backup/sync/full'),
  deltaSync: () => apiClient.post('/backup/sync/delta'),

  // 恢复
  recoverFull: (confirmation: string) => apiClient.post('/backup/recover/full', {}, {
    headers: { 'X-Destructive-Confirmation': confirmation }
  }),

  // MongoDB 单条记录 CRUD
  updateMongodbRecord: (table: string, id: string, data: any) =>
    apiClient.put('/backup/mongodb/record', { table, id, data }),
  deleteMongodbRecord: (table: string, id: string) =>
    apiClient.delete('/backup/mongodb/record', { params: { table, id } })
};

export default apiClient;
