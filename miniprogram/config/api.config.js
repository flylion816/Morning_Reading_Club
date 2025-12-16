/**
 * API配置文件
 * 统一管理所有API接口路径
 */

module.exports = {
  // ==================== 认证相关 ====================
  auth: {
    login: '/auth/login', // 微信登录
    logout: '/auth/logout', // 退出登录
    refresh: '/auth/refresh' // 刷新Token
  },

  // ==================== 用户相关 ====================
  user: {
    profile: '/user/profile', // 获取/更新用户信息
    stats: '/user/stats', // 获取用户统计
    checkins: '/user/checkins', // 获取用户打卡记录
    courses: '/user/courses', // 获取用户课程列表
    insights: '/user/insights', // 获取用户反馈列表
    completeInfo: '/user/complete-info', // 完善用户信息
    getById: userId => `/users/${userId}` // 获取指定用户信息
  },

  // ==================== 课程相关 ====================
  course: {
    list: '/courses', // 获取课程列表
    detail: courseId => `/courses/${courseId}`, // 获取课程详情
    currentPeriod: courseId => `/courses/${courseId}/current-period`, // 当前期次
    periods: courseId => `/courses/${courseId}/periods`, // 期次列表
    enroll: periodId => `/periods/${periodId}/enroll`, // 报名课程
    todaySection: periodId => `/periods/${periodId}/today`, // 今日课程
    progress: userCourseId => `/user-courses/${userCourseId}/progress` // 课程进度
  },

  // ==================== 课节相关 ====================
  section: {
    detail: sectionId => `/sections/${sectionId}` // 获取课节详情
  },

  // ==================== 打卡相关 ====================
  checkin: {
    submit: '/checkins', // 提交打卡
    today: '/checkins/today', // 今日打卡状态
    list: '/checkins', // 打卡列表
    stats: '/checkins/stats', // 打卡统计
    streak: '/checkins/streak', // 连续打卡天数
    makeup: '/checkins/makeup', // 补打卡
    detail: checkinId => `/checkins/${checkinId}`, // 打卡详情
    delete: checkinId => `/checkins/${checkinId}` // 删除打卡
  },

  // ==================== 小凡看见相关 ====================
  insight: {
    my: '/insights/my', // 我的反馈列表
    public: '/insights/public', // 公开反馈列表
    detail: insightId => `/insights/${insightId}`, // 反馈详情
    like: insightId => `/insights/${insightId}/like`, // 点赞/取消点赞
    share: insightId => `/insights/${insightId}/share`, // 分享
    shareCard: insightId => `/insights/${insightId}/share-card`, // 分享卡片
    request: insightId => `/insights/${insightId}/request`, // 请求权限
    requestsReceived: '/insights/requests/received', // 收到的权限请求
    requestsSent: '/insights/requests/sent', // 发出的权限请求
    approveRequest: requestId => `/insights/requests/${requestId}/approve`, // 批准请求
    rejectRequest: requestId => `/insights/requests/${requestId}/reject` // 拒绝请求
  },

  // ==================== 评论相关 ====================
  comment: {
    list: '/comments', // 评论列表
    create: '/comments', // 发表评论
    delete: commentId => `/comments/${commentId}`, // 删除评论
    like: commentId => `/comments/${commentId}/like`, // 点赞评论
    replies: commentId => `/comments/${commentId}/replies` // 评论回复
  },

  // ==================== 通知相关 ====================
  notification: {
    list: '/notifications', // 通知列表
    unread: '/notifications/unread', // 未读通知数
    read: notificationId => `/notifications/${notificationId}/read`, // 标记已读
    readAll: '/notifications/read-all' // 全部已读
  },

  // ==================== 搜索相关 ====================
  search: {
    courses: '/search/courses', // 搜索课程
    users: '/search/users', // 搜索用户
    insights: '/search/insights' // 搜索反馈
  },

  // ==================== 上传相关 ====================
  upload: {
    image: '/upload/image', // 上传图片
    avatar: '/upload/avatar' // 上传头像
  },

  // ==================== 其他 ====================
  common: {
    config: '/common/config', // 获取配置
    version: '/common/version', // 获取版本信息
    feedback: '/common/feedback' // 意见反馈
  }
};
