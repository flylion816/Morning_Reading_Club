import axios from 'axios';
import logger from '../utils/logger';

// 配置 API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 添加认证令牌
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('adminToken');
    logger.debug('[API Request] URL:', { url: config.url });
    logger.debug('[API Request] localStorage.adminToken:', { value: token ? '有值' : '无值' });
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      logger.debug('[API Request] Authorization header已设置:', {
        token: `Bearer ${token.substring(0, 20)}...`
      });
    } else {
      logger.warn('[API Request] ⚠️ 没有token，不会附加Authorization header');
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误和令牌过期
apiClient.interceptors.response.use(
  response => {
    logger.debug('[API Response] 成功', { url: response.config.url, status: response.status });
    logger.debug('[API Response] response.data:', response.data);
    console.log('[API Interceptor] 原始 response.data:', response.data);

    // 后端返回格式：{code, message, data: {...}, pagination: {...}, timestamp: ...}
    if (response.data && typeof response.data === 'object') {
      // 如果响应有标准结构 {code, message, data}，需要转换成兼容格式
      if ('code' in response.data && 'message' in response.data && 'data' in response.data) {
        logger.debug('[API Response] 标准格式，转换为兼容结构');
        console.log('[API Interceptor] 检测到标准格式 {code, message, data, ...}');

        const data = response.data.data;
        console.log('[API Interceptor] 返回的 data:', data);
        console.log('[API Interceptor] pagination:', response.data.pagination);

        // 关键：返回兼容格式
        // 如果 data 是数组，返回 {list: [...], ...pagination}
        // 这样既保持向后兼容（response.list），也支持新用法（Array.isArray(response)）
        if (Array.isArray(data)) {
          const result: any = {
            list: data,
            data: data, // 同时支持 data 字段
            ...response.data.pagination // 展开 pagination 字段
          };
          console.log('[API Interceptor] 返回兼容格式:', result);
          return result;
        }

        // 如果不是数组，直接返回 data
        return data;
      }
      // 否则直接返回响应数据
      logger.debug('[API Response] 非标准格式，返回 response.data');
      console.log('[API Interceptor] 非标准格式，返回整个 response.data');
      return response.data;
    }
    logger.debug('[API Response] 返回 response.data');
    console.log('[API Interceptor] 返回 response.data (非对象)');
    return response.data;
  },
  error => {
    logger.warn('[API Response] 错误', { url: error.config?.url, status: error.response?.status });
    logger.debug('[API Response] 错误详情:', error.response?.data);
    if (error.response?.status === 401) {
      logger.warn('[API Response] ❌ 401 Unauthorized，清除token并重定向到登录页');
      // 清除过期的令牌并重定向到登录页
      localStorage.removeItem('adminToken');
      window.location.href = '/login';
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

// 认证 API
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/admin/login', { email, password }),
  logout: () => apiClient.post('/auth/admin/logout'),
  getProfile: () => apiClient.get('/auth/admin/profile')
};

// 报名 API
export const enrollmentApi = {
  getEnrollments: (params?: any) => apiClient.get('/enrollments', { params }),
  getEnrollmentDetail: (id: string) => apiClient.get(`/enrollments/${id}`),
  approveEnrollment: (id: string, data?: any) => apiClient.post(`/enrollments/${id}/approve`, data),
  rejectEnrollment: (id: string, data?: any) => apiClient.post(`/enrollments/${id}/reject`, data),
  updateEnrollment: (id: string, data: any) => apiClient.put(`/enrollments/${id}`, data)
};

// 支付 API
export const paymentApi = {
  getPayments: (params?: any) => apiClient.get('/payments', { params }),
  getPaymentDetail: (id: string) => apiClient.get(`/payments/${id}`),
  cancelPayment: (id: string) => apiClient.post(`/payments/${id}/cancel`),
  getUserPayments: (userId: string, params?: any) =>
    apiClient.get(`/payments/user/${userId}`, { params })
};

// 期次 API
export const periodApi = {
  getPeriods: (params?: any) => apiClient.get('/periods', { params }),
  getPeriodDetail: (id: string) => apiClient.get(`/periods/${id}`),
  createPeriod: (data: any) => apiClient.post('/periods', data),
  updatePeriod: (id: string, data: any) => apiClient.put(`/periods/${id}`, data),
  deletePeriod: (id: string) => apiClient.delete(`/periods/${id}`),

  // 课节相关 API
  getSections: (periodId: string, params?: any) =>
    apiClient.get(`/periods/${periodId}/sections`, { params }),
  getAllSections: (periodId: string, params?: any) =>
    apiClient.get(`/periods/${periodId}/sections/admin/all`, { params }),
  createSection: (periodId: string, data: any) =>
    apiClient.post(`/periods/${periodId}/sections`, data),
  updateSection: (sectionId: string, data: any) => apiClient.put(`/sections/${sectionId}`, data),
  deleteSection: (sectionId: string) => apiClient.delete(`/sections/${sectionId}`)
};

// 用户 API
export const userApi = {
  getUsers: (params?: any) => apiClient.get('/users', { params }),
  getUserDetail: (id: string) => apiClient.get(`/users/${id}`),
  updateUser: (id: string, data: any) => apiClient.put(`/users/${id}`, data),
  deleteUser: (id: string) => apiClient.delete(`/users/${id}`)
};

// 统计 API
export const statsApi = {
  getDashboardStats: () => apiClient.get('/stats/dashboard'),
  getEnrollmentStats: (params?: any) => apiClient.get('/stats/enrollments', { params }),
  getPaymentStats: (params?: any) => apiClient.get('/stats/payments', { params })
};

// 小凡看见 API
export const insightApi = {
  getInsights: (params?: any) => apiClient.get('/insights', { params }),
  getInsightsByPeriod: (periodId: string, params?: any) =>
    apiClient.get(`/insights/period/${periodId}`, { params }),
  getInsightDetail: (id: string) => apiClient.get(`/insights/${id}`),
  createInsight: (data: any) => apiClient.post('/insights/manual/create', data),
  updateInsight: (id: string, data: any) => apiClient.put(`/insights/${id}`, data),
  deleteInsight: (id: string) => apiClient.delete(`/insights/manual/${id}`),
  publishInsight: (id: string) => apiClient.put(`/insights/${id}`, { isPublished: true }),
  unpublishInsight: (id: string) => apiClient.put(`/insights/${id}`, { isPublished: false })
};

// 文件上传 API
export const uploadApi = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  uploadMultiple: (files: File[]) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    return apiClient.post('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  deleteFile: (filename: string) => apiClient.delete(`/upload/${filename}`)
};

export default apiClient;
