/**
 * API 响应格式定义
 * 统一所有视图中的 API 响应类型处理
 */

/**
 * 标准列表响应格式
 */
export interface ListResponse<T> {
  list: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  total?: number;
}

/**
 * 标准单个对象响应格式
 */
export interface DetailResponse<T> {
  data: T;
}

/**
 * 期次对象
 */
export interface Period {
  _id: string;
  name?: string;
  subtitle?: string;
  title?: string;
  description?: string;
  icon?: string;
  coverColor?: string;
  meetingId?: string;
  meetingJoinUrl?: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  price?: number;
  originalPrice?: number;
  maxEnrollment?: number;
  currentEnrollment?: number;
  sortOrder?: number;
  isPublished?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 用户对象
 */
export interface User {
  _id: string;
  id?: string;
  nickname?: string;
  email?: string;
  phone?: string;
  signature?: string;
  openid?: string;
  role?: string;
  isActive?: boolean;
  status?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 小凡看见对象
 */
export interface Insight {
  _id: string;
  id?: string;
  userId?: string;
  fromUserId?: string | User;
  targetUserId?: string | User;
  periodId?: string | Period;
  sectionId?: {
    title?: string;
    day?: number;
  };
  periodName?: string;
  day?: number;
  content?: string;
  title?: string;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 小凡看见申请对象
 */
export interface InsightRequest {
  _id: string;
  fromUserId?: string | User;
  toUserId?: string | User;
  targetUserId?: string | User;
  insightId?: string | Insight;
  periodId?: string | Period;
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'revoked';
  adminNote?: string;
  requestPeriodName?: string;
  requestInsightTitle?: string;
  requestInsightDay?: number | null;
  createdAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  auditLog?: Array<{
    action: string;
    actorType: string;
    timestamp: string;
    note?: string;
    reason?: string;
  }>;
}

/**
 * 报名对象
 */
export interface Enrollment {
  _id: string;
  userId?: string | User;
  periodId?: string | Period;
  name?: string;
  gender?: string;
  age?: number;
  phone?: string;
  email?: string;
  wechatId?: string;
  enrollReason?: string;
  expectation?: string;
  status?: 'pending' | 'approved' | 'rejected';
  enrolledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 支付对象
 */
export interface Payment {
  _id: string;
  userId?: string | User;
  userName?: string;
  periodId?: string | Period;
  enrollmentId?: string;
  orderNo?: string;
  amount?: number;
  paymentMethod?: string;
  transactionId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  successTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 订阅消息场景对象
 */
export interface SubscriptionGrantScene {
  scene: string;
  title?: string;
  description?: string;
  templateId?: string;
  page?: string;
  availableCount?: number;
  autoTopUpTarget?: number;
  remainingToTarget?: number;
  lastResult?: 'accept' | 'reject' | 'ban' | 'error' | null;
  lastAcceptedAt?: string | null;
  lastRejectedAt?: string | null;
  lastRequestedAt?: string | null;
  scheduledSendDate?: string | null;
  scheduledSendDateKey?: string | null;
  retryAt?: string | null;
  retryCount?: number;
  periodId?: string | null;
  sourceAction?: string | null;
  context?: Record<string, any>;
  localOnly?: boolean;
  statusLabel?: string;
  statusType?: 'success' | 'warning' | 'danger' | 'info';
}

/**
 * 订阅消息排查列表项
 */
export interface SubscriptionGrantRow {
  userId?: string;
  nickname?: string;
  phone?: string;
  openid?: string;
  periodId?: string;
  periodName?: string;
  status?: string;
  statusLabel?: string;
  totalAvailableCount?: number;
  shortageSceneCount?: number;
  anomalyCount?: number;
  targetReadySceneCount?: number;
  lastRequestedAt?: string | null;
  lastAcceptedAt?: string | null;
  lastRejectedAt?: string | null;
  summaryStatus?: string;
  hasAnomaly?: boolean;
  scenes?: SubscriptionGrantScene[];
  sceneStates?: SubscriptionGrantScene[];
  user?: User;
}

/**
 * 订阅消息排查概览
 */
export interface SubscriptionGrantSummary {
  totalUsers?: number;
  totalAvailableCount?: number;
  readyUserCount?: number;
  shortageUserCount?: number;
  anomalyUserCount?: number;
  plannedReminderCount?: number;
  targetReadySceneCount?: number;
}

/**
 * 订阅消息排查详情
 */
export interface SubscriptionGrantDetail {
  user?: User;
  summary?: SubscriptionGrantSummary;
  scenes?: SubscriptionGrantScene[];
  sceneStates?: SubscriptionGrantScene[];
  deliveries?: Array<{
    _id?: string;
    scene?: string;
    status?: string;
    templateId?: string;
    targetPage?: string;
    errorCode?: number | null;
    errorMessage?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  recentDeliveries?: Array<{
    _id?: string;
    scene?: string;
    status?: string;
    templateId?: string;
    targetPage?: string;
    errorCode?: number | null;
    errorMessage?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  enrollments?: Enrollment[];
  latestEnrollment?: Enrollment | null;
  period?: Period | null;
  currentPeriod?: Period | null;
}

/**
 * 课节对象
 */
export interface Section {
  _id: string;
  periodId?: string | Period;
  day?: number;
  title?: string;
  subtitle?: string;
  icon?: string;
  meditation?: string;
  question?: string;
  content?: string;
  reflection?: string;
  action?: string;
  learn?: string;
  extract?: string;
  say?: string;
  duration?: number;
  sortOrder?: number;
  order?: number;
  isPublished?: boolean;
  checkinCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 统计数据对象
 */
export interface DashboardStats {
  totalUsers?: number;
  totalEnrollments?: number;
  totalPayments?: number;
  recentEnrollments?: Enrollment[];
  recentPayments?: Payment[];
}
