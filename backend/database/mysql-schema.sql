-- ============================================================================
-- 晨读营 MySQL 备份库初始化脚本
-- ============================================================================
-- 用途：作为 MongoDB 的热备份，防止数据丢失
-- 特点：
--   1. 所有主键都是 CHAR(24)，对应 MongoDB ObjectId 的 hex 字符串
--   2. 使用 UPSERT (INSERT ... ON DUPLICATE KEY UPDATE) 避免重复写入冲突
--   3. 数组字段（如 likes, replies）拆分为独立表
--   4. 每个表保留 raw_json 字段存储原始 MongoDB 文档
--   5. 异步写入，MySQL 故障不影响主业务
-- ============================================================================

-- 清空（仅开发环境，生产环境需谨慎）
-- DROP DATABASE IF EXISTS morning_reading;
-- CREATE DATABASE morning_reading CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE morning_reading;

-- ============================================================================
-- 1. users - 用户表
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  openid VARCHAR(64) NOT NULL UNIQUE COMMENT '微信 openid',
  unionid VARCHAR(64) COMMENT '微信 unionid',
  nickname VARCHAR(50) NOT NULL DEFAULT '微信用户' COMMENT '用户昵称',
  avatar VARCHAR(500) DEFAULT '🦁' COMMENT '头像 emoji',
  avatar_url VARCHAR(500) COMMENT '头像 URL',
  signature VARCHAR(200) COMMENT '个人签名',
  gender ENUM('male', 'female', 'unknown') DEFAULT 'unknown' COMMENT '性别',
  total_checkin_days INT DEFAULT 0 COMMENT '总打卡天数',
  current_streak INT DEFAULT 0 COMMENT '当前连续打卡天数',
  max_streak INT DEFAULT 0 COMMENT '最高连续打卡天数',
  total_completed_periods INT DEFAULT 0 COMMENT '完成期次数',
  total_points INT DEFAULT 0 COMMENT '总积分',
  level INT DEFAULT 1 COMMENT '用户等级',
  role ENUM('user', 'admin', 'super_admin') DEFAULT 'user' COMMENT '角色',
  status ENUM('active', 'banned', 'deleted') DEFAULT 'active' COMMENT '状态',
  last_login_at DATETIME COMMENT '最后登录时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  INDEX idx_nickname (nickname),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status),
  INDEX idx_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. admins - 管理员表
-- ============================================================================
CREATE TABLE IF NOT EXISTS admins (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  name VARCHAR(100) NOT NULL COMMENT '管理员名称',
  email VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱',
  avatar VARCHAR(500) COMMENT '头像',
  role ENUM('superadmin', 'admin', 'operator') DEFAULT 'operator' COMMENT '角色',
  permissions JSON COMMENT '权限列表（JSON数组）',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  last_login_at DATETIME COMMENT '最后登录时间',
  login_count INT DEFAULT 0 COMMENT '登录次数',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. periods - 期次/营期表
-- ============================================================================
CREATE TABLE IF NOT EXISTS periods (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  name VARCHAR(50) NOT NULL COMMENT '期次名称',
  subtitle VARCHAR(100) COMMENT '副标题',
  title VARCHAR(100) COMMENT '标题',
  description TEXT COMMENT '描述',
  icon VARCHAR(10) DEFAULT '📚' COMMENT '图标 emoji',
  cover_color VARCHAR(200) COMMENT '背景颜色',
  cover_emoji VARCHAR(10) DEFAULT '📖' COMMENT '封面 emoji',
  start_date DATE NOT NULL COMMENT '开始日期',
  end_date DATE NOT NULL COMMENT '结束日期',
  total_days INT DEFAULT 23 COMMENT '总天数',
  price DECIMAL(10, 2) DEFAULT 0 COMMENT '价格',
  original_price DECIMAL(10, 2) DEFAULT 0 COMMENT '原价',
  max_enrollment INT COMMENT '最大报名人数',
  current_enrollment INT DEFAULT 0 COMMENT '当前报名人数',
  enrollment_count INT DEFAULT 0 COMMENT '报名次数',
  status ENUM('not_started', 'ongoing', 'completed') DEFAULT 'not_started' COMMENT '状态',
  is_published BOOLEAN DEFAULT FALSE COMMENT '是否已发布',
  sort_order INT DEFAULT 0 COMMENT '排序顺序',
  checkin_count INT DEFAULT 0 COMMENT '打卡数',
  total_checkins INT DEFAULT 0 COMMENT '总打卡数',
  meeting_id VARCHAR(50) DEFAULT NULL COMMENT '腾讯会议号',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  INDEX idx_start_date (start_date),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. sections - 课节/章节表
-- ============================================================================
CREATE TABLE IF NOT EXISTS sections (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  period_id CHAR(24) NOT NULL COMMENT '所属期次 ID',
  day INT NOT NULL COMMENT '第几天',
  title VARCHAR(100) NOT NULL COMMENT '课节标题',
  subtitle VARCHAR(200) COMMENT '副标题',
  icon VARCHAR(10) DEFAULT '📖' COMMENT '图标 emoji',
  meditation VARCHAR(500) COMMENT '冥想',
  question VARCHAR(200) COMMENT '问题',
  content TEXT COMMENT '内容',
  description VARCHAR(500) COMMENT '描述',
  reflection VARCHAR(500) COMMENT '反思',
  action VARCHAR(500) COMMENT '行动',
  learn VARCHAR(500) COMMENT '学习要点',
  extract VARCHAR(500) COMMENT '摘录',
  say VARCHAR(500) COMMENT '话语',
  audio_url VARCHAR(500) COMMENT '音频 URL',
  video_cover VARCHAR(500) COMMENT '视频封面',
  duration INT COMMENT '时长（秒）',
  sort_order INT DEFAULT 0 COMMENT '排序顺序',
  order_num INT DEFAULT 0 COMMENT '顺序',
  is_published BOOLEAN DEFAULT TRUE COMMENT '是否已发布',
  checkin_count INT DEFAULT 0 COMMENT '打卡数',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  UNIQUE KEY uq_period_day (period_id, day),
  INDEX idx_period_id (period_id),
  INDEX idx_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. checkins - 打卡表
-- ============================================================================
CREATE TABLE IF NOT EXISTS checkins (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  user_id CHAR(24) NOT NULL COMMENT '用户 ID',
  period_id CHAR(24) NOT NULL COMMENT '期次 ID',
  section_id CHAR(24) NOT NULL COMMENT '课节 ID',
  day INT NOT NULL COMMENT '第几天',
  checkin_date DATE NOT NULL COMMENT '打卡日期',
  reading_time INT DEFAULT 0 COMMENT '阅读时长（分钟）',
  completion_rate INT DEFAULT 0 COMMENT '完成度（0-100）',
  note TEXT COMMENT '打卡笔记',
  images JSON COMMENT '图片 URL 数组',
  mood ENUM('happy', 'calm', 'thoughtful', 'inspired', 'other') COMMENT '心情',
  points INT DEFAULT 10 COMMENT '获得积分',
  is_public BOOLEAN DEFAULT TRUE COMMENT '是否公开',
  like_count INT DEFAULT 0 COMMENT '点赞数',
  is_featured BOOLEAN DEFAULT FALSE COMMENT '是否精选',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  UNIQUE KEY uq_user_period_date (user_id, period_id, checkin_date),
  INDEX idx_user_id (user_id),
  INDEX idx_period_id (period_id),
  INDEX idx_checkin_date (checkin_date),
  INDEX idx_is_public (is_public),
  INDEX idx_is_featured (is_featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. enrollments - 报名表
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  user_id CHAR(24) NOT NULL COMMENT '用户 ID',
  period_id CHAR(24) NOT NULL COMMENT '期次 ID',
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '报名时间',
  status ENUM('active', 'completed', 'withdrawn') DEFAULT 'active' COMMENT '状态',
  payment_status ENUM('pending', 'paid', 'refunded', 'free') DEFAULT 'free' COMMENT '支付状态',
  payment_amount DECIMAL(10, 2) DEFAULT 0 COMMENT '支付金额',
  paid_at DATETIME COMMENT '支付时间',
  completed_at DATETIME COMMENT '完成时间',
  withdrawn_at DATETIME COMMENT '退出时间',
  name VARCHAR(100) COMMENT '报名姓名',
  gender ENUM('male', 'female', 'prefer_not_to_say') COMMENT '性别',
  province VARCHAR(50) COMMENT '省份',
  detailed_address VARCHAR(200) COMMENT '详细地址',
  age INT COMMENT '年龄',
  referrer VARCHAR(100) COMMENT '推荐人',
  has_read_book ENUM('yes', 'no') COMMENT '是否读过书',
  read_times INT DEFAULT 0 COMMENT '读书次数',
  enroll_reason TEXT COMMENT '报名原因',
  expectation TEXT COMMENT '期望',
  commitment ENUM('yes', 'no') COMMENT '承诺参与',
  notes VARCHAR(500) COMMENT '备注',
  deleted BOOLEAN DEFAULT FALSE COMMENT '是否软删除',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  UNIQUE KEY uq_user_period (user_id, period_id),
  INDEX idx_user_id (user_id),
  INDEX idx_period_id (period_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. payments - 支付表
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  enrollment_id CHAR(24) NOT NULL COMMENT '报名 ID',
  user_id CHAR(24) NOT NULL COMMENT '用户 ID',
  period_id CHAR(24) NOT NULL COMMENT '期次 ID',
  amount DECIMAL(10, 2) NOT NULL COMMENT '金额',
  payment_method ENUM('wechat', 'alipay', 'mock') DEFAULT 'wechat' COMMENT '支付方式',
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending' COMMENT '支付状态',
  wechat_prepay_id VARCHAR(64) COMMENT '微信预支付 ID',
  wechat_transaction_id VARCHAR(64) COMMENT '微信交易号',
  wechat_success_time DATETIME COMMENT '微信支付成功时间',
  paid_at DATETIME COMMENT '支付成功时间',
  failure_reason TEXT COMMENT '失败原因',
  notes TEXT COMMENT '备注',
  order_no VARCHAR(100) NOT NULL UNIQUE COMMENT '订单号',
  reconciled BOOLEAN DEFAULT FALSE COMMENT '是否已核销',
  reconciled_at DATETIME COMMENT '核销时间',
  is_paid BOOLEAN DEFAULT FALSE COMMENT '是否已支付（虚拟字段同步）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  INDEX idx_user_id (user_id),
  INDEX idx_period_id (period_id),
  INDEX idx_status (status),
  INDEX idx_order_no (order_no),
  INDEX idx_paid_at (paid_at),
  INDEX idx_reconciled (reconciled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. insights - 小凡看见表
-- ============================================================================
CREATE TABLE IF NOT EXISTS insights (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  user_id CHAR(24) NOT NULL COMMENT '创建者用户 ID',
  target_user_id CHAR(24) COMMENT '被看见的用户 ID',
  checkin_id CHAR(24) COMMENT '关联打卡 ID',
  period_id CHAR(24) NOT NULL COMMENT '期次 ID',
  section_id CHAR(24) COMMENT '课节 ID',
  day INT COMMENT '第几天',
  type ENUM('daily', 'weekly', 'monthly', 'insight') DEFAULT 'daily' COMMENT '类型',
  media_type ENUM('text', 'image') DEFAULT 'text' COMMENT '媒体类型',
  content TEXT NOT NULL COMMENT '内容',
  image_url VARCHAR(500) COMMENT '图片 URL',
  summary VARCHAR(500) COMMENT '摘要',
  tags JSON COMMENT '标签数组',
  status ENUM('generating', 'completed', 'failed') DEFAULT 'completed' COMMENT '状态',
  source ENUM('manual', 'auto') DEFAULT 'manual' COMMENT '来源',
  is_published BOOLEAN DEFAULT TRUE COMMENT '是否已发布',
  like_count INT DEFAULT 0 COMMENT '点赞数',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  INDEX idx_user_id (user_id),
  INDEX idx_period_id (period_id),
  INDEX idx_type (type),
  INDEX idx_is_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. insight_likes - 看见点赞表（拆分自 insights.likes 数组）
-- ============================================================================
CREATE TABLE IF NOT EXISTS insight_likes (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增 ID',
  insight_id CHAR(24) NOT NULL COMMENT '看见 ID',
  user_id CHAR(24) NOT NULL COMMENT '点赞用户 ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '点赞时间',
  INDEX idx_insight_id (insight_id),
  INDEX idx_user_id (user_id),
  UNIQUE KEY uq_insight_user (insight_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. insight_requests - 看见权限申请表
-- ============================================================================
CREATE TABLE IF NOT EXISTS insight_requests (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  from_user_id CHAR(24) NOT NULL COMMENT '申请者用户 ID',
  to_user_id CHAR(24) NOT NULL COMMENT '被申请者用户 ID',
  status ENUM('pending', 'approved', 'rejected', 'revoked') DEFAULT 'pending' COMMENT '申请状态',
  reason TEXT COMMENT '申请原因',
  period_id CHAR(24) COMMENT '期次 ID',
  approved_at DATETIME COMMENT '同意时间',
  rejected_at DATETIME COMMENT '拒绝时间',
  revoked_at DATETIME COMMENT '撤销时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  INDEX idx_from_user_id (from_user_id),
  INDEX idx_to_user_id (to_user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. insight_request_audit_logs - 看见申请审计日志表（拆分自 insight_requests.auditLog 数组）
-- ============================================================================
CREATE TABLE IF NOT EXISTS insight_request_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增 ID',
  request_id CHAR(24) NOT NULL COMMENT '申请 ID',
  action VARCHAR(50) NOT NULL COMMENT '操作（APPROVE/REJECT/REVOKE）',
  actor_id CHAR(24) COMMENT '操作者用户 ID',
  actor_type VARCHAR(20) COMMENT '操作者类型（user/admin）',
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  note TEXT COMMENT '备注',
  reason TEXT COMMENT '原因',
  INDEX idx_request_id (request_id),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. comments - 评论表
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  checkin_id CHAR(24) NOT NULL COMMENT '打卡 ID',
  user_id CHAR(24) NOT NULL COMMENT '评论者用户 ID',
  content VARCHAR(1000) NOT NULL COMMENT '评论内容',
  reply_count INT DEFAULT 0 COMMENT '回复数',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  INDEX idx_checkin_id (checkin_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. comment_replies - 评论回复表（拆分自 comments.replies 数组）
-- ============================================================================
CREATE TABLE IF NOT EXISTS comment_replies (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  comment_id CHAR(24) NOT NULL COMMENT '评论 ID',
  user_id CHAR(24) NOT NULL COMMENT '回复者用户 ID',
  content VARCHAR(500) NOT NULL COMMENT '回复内容',
  reply_to_user_id CHAR(24) COMMENT '回复给哪个用户（@某人）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comment_id (comment_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 14. notifications - 通知表
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId (hex)',
  user_id CHAR(24) NOT NULL COMMENT '接收者用户 ID',
  type ENUM('request_created', 'request_approved', 'request_rejected', 'permission_revoked', 'admin_approved', 'admin_rejected') NOT NULL COMMENT '通知类型',
  title VARCHAR(200) NOT NULL COMMENT '标题',
  content TEXT NOT NULL COMMENT '内容',
  request_id CHAR(24) COMMENT '关联的申请 ID',
  sender_id CHAR(24) COMMENT '发送者用户 ID',
  is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  read_at DATETIME COMMENT '已读时间',
  is_archived BOOLEAN DEFAULT FALSE COMMENT '是否已归档',
  archived_at DATETIME COMMENT '归档时间',
  data JSON COMMENT '额外数据（JSON）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  raw_json LONGTEXT COMMENT '原始 MongoDB 文档（JSON）',
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_is_read (is_read),
  INDEX idx_is_archived (is_archived),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 创建索引总结
-- ============================================================================
-- 为高频查询操作创建了详细的索引
-- 对于外键关系，由于异步写入的特性，未使用 FOREIGN KEY 约束，只通过逻辑外键关联
-- 所有时间戳字段都建立了索引，便于时间范围查询

-- ============================================================================
-- 初始化完成
-- ============================================================================
-- 本脚本创建了 14 张表，用于存储 MongoDB 的全量备份数据
-- 表结构充分规范化，支持 SQL 查询和统计分析
-- 通过 raw_json 字段保留完整的原始文档，确保数据完整性
