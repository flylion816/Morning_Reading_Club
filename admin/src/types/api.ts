/**
 * API 响应格式定义
 * 统一所有视图中的 API 响应类型处理
 */

/**
 * 标准列表响应格式
 */
export interface ListResponse<T> {
  list: T[]
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
  total?: number
}

/**
 * 标准单个对象响应格式
 */
export interface DetailResponse<T> {
  data: T
}

/**
 * 期次对象
 */
export interface Period {
  _id: string
  name?: string
  subtitle?: string
  title?: string
  description?: string
  icon?: string
  coverColor?: string
  startDate?: string
  endDate?: string
  totalDays?: number
  price?: number
  originalPrice?: number
  maxEnrollment?: number
  currentEnrollment?: number
  sortOrder?: number
  isPublished?: boolean
  status?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 用户对象
 */
export interface User {
  _id: string
  id?: string
  nickname?: string
  email?: string
  phone?: string
  signature?: string
  openid?: string
  role?: string
  isActive?: boolean
  status?: string
  lastLoginAt?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 小凡看见对象
 */
export interface Insight {
  _id: string
  id?: string
  userId?: string
  fromUserId?: string | User
  targetUserId?: string | User
  periodId?: string | Period
  content?: string
  title?: string
  isPublished?: boolean
  createdAt?: string
  updatedAt?: string
}

/**
 * 小凡看见申请对象
 */
export interface InsightRequest {
  _id: string
  fromUserId?: string | User
  toUserId?: string | User
  targetUserId?: string | User
  periodId?: string | Period
  reason?: string
  status?: 'pending' | 'approved' | 'rejected'
  adminNote?: string
  createdAt?: string
  approvedAt?: string
  rejectedAt?: string
  auditLog?: Array<{
    action: string
    actorType: string
    timestamp: string
    note?: string
    reason?: string
  }>
}

/**
 * 报名对象
 */
export interface Enrollment {
  _id: string
  userId?: string | User
  periodId?: string | Period
  name?: string
  gender?: string
  age?: number
  phone?: string
  email?: string
  wechatId?: string
  enrollReason?: string
  expectation?: string
  status?: 'pending' | 'approved' | 'rejected'
  enrolledAt?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 支付对象
 */
export interface Payment {
  _id: string
  userId?: string | User
  userName?: string
  periodId?: string | Period
  enrollmentId?: string
  orderNo?: string
  amount?: number
  paymentMethod?: string
  transactionId?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  successTime?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 课节对象
 */
export interface Section {
  _id: string
  periodId?: string | Period
  title?: string
  content?: string
  order?: number
  createdAt?: string
  updatedAt?: string
}

/**
 * 统计数据对象
 */
export interface DashboardStats {
  totalUsers?: number
  totalEnrollments?: number
  totalPayments?: number
  recentEnrollments?: Enrollment[]
  recentPayments?: Payment[]
}
