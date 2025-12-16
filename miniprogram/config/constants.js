/**
 * 全局常量定义
 * 统一管理项目中使用的常量
 */

module.exports = {
  // ==================== 课程相关 ====================

  // 课程天数
  COURSE_DURATION: 23,

  // 课程状态
  COURSE_STATUS: {
    NOT_STARTED: 'not_started',
    ONGOING: 'ongoing',
    COMPLETED: 'completed'
  },

  // 课程状态文本映射
  COURSE_STATUS_TEXT: {
    not_started: '未开始',
    ongoing: '进行中',
    completed: '已完成'
  },

  // ==================== 打卡相关 ====================

  // 打卡最少字数
  CHECKIN_MIN_LENGTH: 50,

  // 打卡最多字数
  CHECKIN_MAX_LENGTH: 2000,

  // 晚卡时间阈值(小时)
  LATE_CHECKIN_HOUR: 8,

  // 打卡状态
  CHECKIN_STATUS: {
    UNCHECKED: 'unchecked',
    CHECKED: 'checked',
    LATE: 'late',
    MAKEUP: 'makeup'
  },

  // ==================== 权限相关 ====================

  // 权限过期天数
  PERMISSION_EXPIRE_DAYS: 7,

  // 权限请求状态
  PERMISSION_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    EXPIRED: 'expired'
  },

  // 权限状态文本
  PERMISSION_STATUS_TEXT: {
    pending: '待审批',
    accepted: '已同意',
    rejected: '已拒绝',
    expired: '已过期'
  },

  // ==================== 反馈相关 ====================

  // 反馈可见性
  INSIGHT_VISIBILITY: {
    PRIVATE: 'private', // 仅自己可见
    FRIENDS: 'friends', // 好友可见
    PUBLIC: 'public' // 公开
  },

  // 反馈可见性文本
  INSIGHT_VISIBILITY_TEXT: {
    private: '仅自己可见',
    friends: '好友可见',
    public: '公开'
  },

  // ==================== 评论相关 ====================

  // 评论类型
  COMMENT_TYPE: {
    INSIGHT: 'insight',
    CHECKIN: 'checkin',
    COURSE: 'course'
  },

  // 评论最大长度
  COMMENT_MAX_LENGTH: 500,

  // ==================== 分页相关 ====================

  // 默认分页大小
  PAGE_SIZE: 20,

  // 最大分页大小
  MAX_PAGE_SIZE: 100,

  // ==================== 存储键名 ====================

  STORAGE_KEYS: {
    TOKEN: 'token',
    REFRESH_TOKEN: 'refreshToken',
    USER_INFO: 'userInfo',
    THEME: 'theme',
    FONT_SIZE: 'fontSize'
  },

  // ==================== Token相关 ====================

  // Token过期时间(毫秒) - 7天
  TOKEN_EXPIRE_TIME: 7 * 24 * 60 * 60 * 1000,

  // RefreshToken过期时间(毫秒) - 30天
  REFRESH_TOKEN_EXPIRE_TIME: 30 * 24 * 60 * 60 * 1000,

  // ==================== 缓存相关 ====================

  // 缓存过期时间
  CACHE_EXPIRE: {
    SHORT: 5 * 60 * 1000, // 5分钟
    MEDIUM: 30 * 60 * 1000, // 30分钟
    LONG: 24 * 60 * 60 * 1000 // 24小时
  },

  // ==================== 网络相关 ====================

  // 请求超时时间(毫秒)
  REQUEST_TIMEOUT: 10000,

  // 重试次数
  MAX_RETRY_COUNT: 3,

  // ==================== 性能相关 ====================

  // 防抖延迟(毫秒)
  DEBOUNCE_DELAY: 300,

  // 节流延迟(毫秒)
  THROTTLE_DELAY: 500,

  // 图片懒加载阈值
  IMAGE_LAZY_LOAD_THRESHOLD: 200,

  // ==================== 文件相关 ====================

  // 图片最大大小(字节) - 5MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024,

  // 支持的图片格式
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],

  // ==================== 用户相关 ====================

  // 用户性别
  GENDER: {
    MALE: 'male',
    FEMALE: 'female',
    UNKNOWN: 'unknown'
  },

  // 用户性别文本
  GENDER_TEXT: {
    male: '男',
    female: '女',
    unknown: '未知'
  },

  // 用户状态
  USER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    BANNED: 'banned'
  },

  // ==================== 正则表达式 ====================

  REGEX: {
    PHONE: /^1[3-9]\d{9}$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+/,
    WECHAT_ID: /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/
  },

  // ==================== 日期格式 ====================

  DATE_FORMAT: {
    DATE: 'YYYY-MM-DD',
    TIME: 'HH:mm:ss',
    DATETIME: 'YYYY-MM-DD HH:mm:ss',
    MONTH_DAY: 'MM-DD',
    HOUR_MINUTE: 'HH:mm'
  },

  // ==================== 错误码 ====================

  ERROR_CODE: {
    SUCCESS: 0,
    UNKNOWN_ERROR: -1,
    NETWORK_ERROR: 1001,
    AUTH_ERROR: 1002,
    PERMISSION_DENIED: 1003,
    RESOURCE_NOT_FOUND: 1004,
    VALIDATION_ERROR: 1005,
    SERVER_ERROR: 1006
  },

  // ==================== 分享相关 ====================

  SHARE: {
    DEFAULT_TITLE: '晨读营 - 在晨光中,遇见更好的自己',
    DEFAULT_IMAGE: '/assets/images/share-default.png',
    DEFAULT_PATH: '/pages/index/index'
  }
};
