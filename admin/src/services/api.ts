import axios from 'axios'

// 配置 API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加认证令牌
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理错误和令牌过期
apiClient.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      // 清除过期的令牌并重定向到登录页
      localStorage.removeItem('adminToken')
      window.location.href = '/login'
    }
    return Promise.reject(error.response?.data || error)
  }
)

// 认证 API
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/admin/login', { email, password }),
  logout: () => apiClient.post('/auth/admin/logout'),
  getProfile: () => apiClient.get('/auth/admin/profile')
}

// 报名 API
export const enrollmentApi = {
  getEnrollments: (params?: any) =>
    apiClient.get('/enrollments', { params }),
  getEnrollmentDetail: (id: string) =>
    apiClient.get(`/enrollments/${id}`),
  approveEnrollment: (id: string, data?: any) =>
    apiClient.post(`/enrollments/${id}/approve`, data),
  rejectEnrollment: (id: string, data?: any) =>
    apiClient.post(`/enrollments/${id}/reject`, data),
  updateEnrollment: (id: string, data: any) =>
    apiClient.put(`/enrollments/${id}`, data)
}

// 支付 API
export const paymentApi = {
  getPayments: (params?: any) =>
    apiClient.get('/payments', { params }),
  getPaymentDetail: (id: string) =>
    apiClient.get(`/payments/${id}`),
  cancelPayment: (id: string) =>
    apiClient.post(`/payments/${id}/cancel`),
  getUserPayments: (userId: string, params?: any) =>
    apiClient.get(`/payments/user/${userId}`, { params })
}

// 期次 API
export const periodApi = {
  getPeriods: (params?: any) =>
    apiClient.get('/periods', { params }),
  getPeriodDetail: (id: string) =>
    apiClient.get(`/periods/${id}`),
  createPeriod: (data: any) =>
    apiClient.post('/periods', data),
  updatePeriod: (id: string, data: any) =>
    apiClient.put(`/periods/${id}`, data),
  deletePeriod: (id: string) =>
    apiClient.delete(`/periods/${id}`)
}

// 用户 API
export const userApi = {
  getUsers: (params?: any) =>
    apiClient.get('/users', { params }),
  getUserDetail: (id: string) =>
    apiClient.get(`/users/${id}`),
  updateUser: (id: string, data: any) =>
    apiClient.put(`/users/${id}`, data),
  deleteUser: (id: string) =>
    apiClient.delete(`/users/${id}`)
}

// 统计 API
export const statsApi = {
  getDashboardStats: () =>
    apiClient.get('/stats/dashboard'),
  getEnrollmentStats: (params?: any) =>
    apiClient.get('/stats/enrollments', { params }),
  getPaymentStats: (params?: any) =>
    apiClient.get('/stats/payments', { params })
}

// 文件上传 API
export const uploadApi = {
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  uploadMultiple: (files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })
    return apiClient.post('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  deleteFile: (filename: string) =>
    apiClient.delete(`/upload/${filename}`)
}

export default apiClient
