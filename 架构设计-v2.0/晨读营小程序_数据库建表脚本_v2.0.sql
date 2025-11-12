-- ============================================================================
-- 晨读营小程序数据库建表脚本 v1.0
-- ============================================================================
-- 项目名称：晨读营小程序
-- 数据库引擎：MySQL 8.0+
-- 字符集：utf8mb4
-- 排序规则：utf8mb4_unicode_ci
-- 创建日期：2025-10-30
-- 说明：包含所有核心业务表、索引、触发器、存储过程
-- ============================================================================

-- 设置会话参数
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET SESSION innodb_lock_wait_timeout = 50;

-- ============================================================================
-- 1. 创建数据库
-- ============================================================================
DROP DATABASE IF EXISTS `morning_reading_db`;
CREATE DATABASE `morning_reading_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `morning_reading_db`;

-- ============================================================================
-- 2. 用户表 (users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
  `wechat_id` VARCHAR(100) NOT NULL UNIQUE COMMENT '微信OpenID',
  `wechat_unionid` VARCHAR(100) UNIQUE DEFAULT NULL COMMENT '微信UnionID',
  `nickname` VARCHAR(64) NOT NULL COMMENT '用户昵称',
  `real_name` VARCHAR(64) DEFAULT NULL COMMENT '真实姓名',
  `avatar_url` VARCHAR(512) DEFAULT NULL COMMENT '头像URL',
  `signature` VARCHAR(200) DEFAULT NULL COMMENT '个人签名',
  `age` TINYINT UNSIGNED DEFAULT NULL COMMENT '年龄 (18-100)',
  `gender` VARCHAR(20) DEFAULT 'unknown' COMMENT '性别 (male/female/unknown)',
  `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
  `email` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  `province` VARCHAR(50) DEFAULT NULL COMMENT '省份',
  `city` VARCHAR(50) DEFAULT NULL COMMENT '城市',
  `address` VARCHAR(255) DEFAULT NULL COMMENT '详细地址',
  `referrer_name` VARCHAR(64) DEFAULT NULL COMMENT '推荐人姓名',
  `join_reason` TEXT DEFAULT NULL COMMENT '加入原因',
  `expectations` TEXT DEFAULT NULL COMMENT '期望收获',
  `has_read_book` BOOLEAN DEFAULT FALSE COMMENT '是否读过原著',
  `read_times` TINYINT UNSIGNED DEFAULT 0 COMMENT '阅读次数',
  `status` VARCHAR(20) DEFAULT 'active' COMMENT '用户状态 (active/inactive/banned)',
  `last_login_at` DATETIME DEFAULT NULL COMMENT '最后登录时间',
  `last_checkin_at` DATETIME DEFAULT NULL COMMENT '最后打卡时间',
  `ip_address` VARCHAR(50) DEFAULT NULL COMMENT '注册IP地址',
  `device_id` VARCHAR(100) DEFAULT NULL COMMENT '设备ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',

  -- 索引
  UNIQUE KEY `uk_wechat_id` (`wechat_id`),
  UNIQUE KEY `uk_wechat_unionid` (`wechat_unionid`),
  KEY `idx_nickname` (`nickname`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_last_login_at` (`last_login_at`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================================================
-- 3. 课程表 (courses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `courses` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '课程ID',
  `title` VARCHAR(255) NOT NULL COMMENT '课程标题',
  `description` TEXT DEFAULT NULL COMMENT '课程描述',
  `emoji` VARCHAR(10) DEFAULT NULL COMMENT '课程emoji图标',
  `cover_image_url` VARCHAR(512) DEFAULT NULL COMMENT '课程封面URL',
  `author` VARCHAR(64) DEFAULT NULL COMMENT '讲师名称',
  `author_introduction` TEXT DEFAULT NULL COMMENT '讲师介绍',
  `duration_days` INT DEFAULT 23 COMMENT '课程时长（天数）',
  `category` VARCHAR(50) DEFAULT NULL COMMENT '课程分类',
  `tags` VARCHAR(200) DEFAULT NULL COMMENT '课程标签 (JSON数组)',
  `status` VARCHAR(20) DEFAULT 'draft' COMMENT '课程状态 (draft/published/archived)',
  `is_featured` BOOLEAN DEFAULT FALSE COMMENT '是否精选课程',
  `sort_order` INT DEFAULT 0 COMMENT '排序顺序',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',

  -- 索引
  KEY `idx_status` (`status`),
  KEY `idx_is_featured` (`is_featured`),
  KEY `idx_sort_order` (`sort_order`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程表';

-- ============================================================================
-- 4. 课程期次表 (course_periods)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `course_periods` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '期次ID',
  `course_id` BIGINT NOT NULL COMMENT '课程ID',
  `period_number` INT NOT NULL COMMENT '期次号 (第几期)',
  `period_name` VARCHAR(100) DEFAULT NULL COMMENT '期次名称 (例：第8期)',
  `start_date` DATE NOT NULL COMMENT '开始日期',
  `end_date` DATE NOT NULL COMMENT '结束日期',
  `status` VARCHAR(20) DEFAULT 'draft' COMMENT '期次状态 (draft/open/closed/archived)',
  `max_capacity` INT DEFAULT 5000 COMMENT '最大容量',
  `enrollment_count` INT DEFAULT 0 COMMENT '实际报名人数',
  `registration_start` DATETIME DEFAULT NULL COMMENT '报名开始时间',
  `registration_end` DATETIME DEFAULT NULL COMMENT '报名结束时间',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '是否为活跃期次',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  -- 索引
  UNIQUE KEY `uk_course_period` (`course_id`, `period_number`),
  KEY `idx_status` (`status`),
  KEY `idx_start_date` (`start_date`),
  KEY `idx_end_date` (`end_date`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_course_periods_course` FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程期次表';

-- ============================================================================
-- 5. 用户课程报名表 (user_courses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_courses` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '报名ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `period_id` BIGINT NOT NULL COMMENT '期次ID',
  `course_id` BIGINT NOT NULL COMMENT '课程ID (冗余存储，便于查询)',
  `status` VARCHAR(20) DEFAULT 'active' COMMENT '状态 (active/completed/dropped)',
  `total_sections` INT DEFAULT 0 COMMENT '该期次总课节数',
  `completed_sections` INT DEFAULT 0 COMMENT '已完成课节数',
  `completion_rate` DECIMAL(5,2) DEFAULT 0 COMMENT '完成率百分比',
  `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `completed_at` DATETIME DEFAULT NULL COMMENT '完成时间',
  `last_checkin_at` DATETIME DEFAULT NULL COMMENT '最后打卡时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  -- 索引
  UNIQUE KEY `uk_user_period` (`user_id`, `period_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_period_id` (`period_id`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_status` (`status`),
  KEY `idx_joined_at` (`joined_at`),
  KEY `idx_completion_rate` (`completion_rate`),
  CONSTRAINT `fk_user_courses_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_courses_period` FOREIGN KEY (`period_id`)
    REFERENCES `course_periods` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_courses_course` FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户课程报名关系表';

-- ============================================================================
-- 6. 课程内容表 (sections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `sections` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '课节ID',
  `course_id` BIGINT NOT NULL COMMENT '课程ID',
  `period_id` BIGINT NOT NULL COMMENT '期次ID',
  `day_number` INT NOT NULL COMMENT '第几天 (1-23)',
  `title` VARCHAR(255) NOT NULL COMMENT '课节标题',
  `content` LONGTEXT DEFAULT NULL COMMENT '课程内容 (HTML格式)',
  `five_steps` JSON DEFAULT NULL COMMENT '五步学习法内容 {静一静, 问一问, 读一读, 想一想, 记一记}',
  `learning_objective` TEXT DEFAULT NULL COMMENT '学习目标',
  `key_points` JSON DEFAULT NULL COMMENT '关键知识点 (数组)',
  `lesson_date` DATE DEFAULT NULL COMMENT '该课节的课程日期',
  `publish_at` DATETIME DEFAULT NULL COMMENT '发布时间',
  `status` VARCHAR(20) DEFAULT 'draft' COMMENT '课节状态 (draft/published/hidden)',
  `checkin_count` INT DEFAULT 0 COMMENT '打卡人数',
  `comment_count` INT DEFAULT 0 COMMENT '评论数',
  `view_count` INT DEFAULT 0 COMMENT '浏览次数',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  -- 索引
  UNIQUE KEY `uk_period_day` (`period_id`, `day_number`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_period_id` (`period_id`),
  KEY `idx_lesson_date` (`lesson_date`),
  KEY `idx_publish_at` (`publish_at`),
  KEY `idx_status` (`status`),
  KEY `idx_day_number` (`day_number`),
  CONSTRAINT `fk_sections_course` FOREIGN KEY (`course_id`)
    REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sections_period` FOREIGN KEY (`period_id`)
    REFERENCES `course_periods` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程内容（单元）表';

-- ============================================================================
-- 7. 打卡记录表 (checkins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `checkins` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '打卡ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `section_id` BIGINT NOT NULL COMMENT '课节ID',
  `user_course_id` BIGINT NOT NULL COMMENT '用户课程ID (关联报名记录)',
  `period_id` BIGINT NOT NULL COMMENT '期次ID (冗余存储)',
  `content` TEXT NOT NULL COMMENT '打卡日记内容',
  `content_length` INT DEFAULT 0 COMMENT '内容长度 (字数)',
  `checkin_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '打卡提交时间',
  `local_time` TIME DEFAULT NULL COMMENT '打卡的本地时刻',
  `is_late` BOOLEAN DEFAULT FALSE COMMENT '是否晚卡 (超过8:00)',
  `is_makeup` BOOLEAN DEFAULT FALSE COMMENT '是否补卡',
  `makeup_days_late` INT DEFAULT 0 COMMENT '补卡延迟天数',
  `status` VARCHAR(20) DEFAULT 'submitted' COMMENT '打卡状态 (submitted/processed/deleted)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  -- 索引
  UNIQUE KEY `uk_user_section` (`user_id`, `section_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_section_id` (`section_id`),
  KEY `idx_user_course_id` (`user_course_id`),
  KEY `idx_period_id` (`period_id`),
  KEY `idx_checkin_time` (`checkin_time`),
  KEY `idx_is_makeup` (`is_makeup`),
  KEY `idx_is_late` (`is_late`),
  KEY `idx_status` (`status`),
  KEY `idx_date` (`DATE(checkin_time)`),
  CONSTRAINT `fk_checkins_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_checkins_section` FOREIGN KEY (`section_id`)
    REFERENCES `sections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_checkins_user_course` FOREIGN KEY (`user_course_id`)
    REFERENCES `user_courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='打卡记录表'
PARTITION BY RANGE (YEAR(checkin_time) * 12 + MONTH(checkin_time)) (
  PARTITION p_202501 VALUES LESS THAN (202501),
  PARTITION p_202502 VALUES LESS THAN (202502),
  PARTITION p_202503 VALUES LESS THAN (202503),
  PARTITION p_202504 VALUES LESS THAN (202504),
  PARTITION p_202505 VALUES LESS THAN (202505),
  PARTITION p_202506 VALUES LESS THAN (202506),
  PARTITION p_202507 VALUES LESS THAN (202507),
  PARTITION p_202508 VALUES LESS THAN (202508),
  PARTITION p_202509 VALUES LESS THAN (202509),
  PARTITION p_202510 VALUES LESS THAN (202510),
  PARTITION p_202511 VALUES LESS THAN (202511),
  PARTITION p_202512 VALUES LESS THAN (202512),
  PARTITION p_202601 VALUES LESS THAN (202601),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- ============================================================================
-- 8. 个性化反馈表 (insights)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `insights` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '反馈ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `section_id` BIGINT NOT NULL COMMENT '课节ID',
  `checkin_id` BIGINT DEFAULT NULL COMMENT '关联的打卡ID',
  `period_id` BIGINT NOT NULL COMMENT '期次ID (冗余)',
  `content` LONGTEXT NOT NULL COMMENT '反馈内容',
  `content_summary` VARCHAR(500) DEFAULT NULL COMMENT '反馈摘要',
  `is_template` BOOLEAN DEFAULT FALSE COMMENT '是否使用模板反馈 (降级方案)',
  `ai_model` VARCHAR(50) DEFAULT NULL COMMENT '使用的AI模型 (gpt-4/claude-3-sonnet)',
  `ai_prompt_hash` VARCHAR(64) DEFAULT NULL COMMENT '输入prompt的哈希值 (用于冗余处理)',
  `tokens_used` INT DEFAULT 0 COMMENT 'AI API调用token数',
  `generation_time_ms` INT DEFAULT 0 COMMENT 'AI生成耗时(毫秒)',
  `share_count` INT DEFAULT 0 COMMENT '分享次数',
  `like_count` INT DEFAULT 0 COMMENT '点赞数',
  `quality_score` DECIMAL(3,2) DEFAULT NULL COMMENT '反馈质量评分 (1-5)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  -- 索引
  UNIQUE KEY `uk_user_section` (`user_id`, `section_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_section_id` (`section_id`),
  KEY `idx_checkin_id` (`checkin_id`),
  KEY `idx_period_id` (`period_id`),
  KEY `idx_is_template` (`is_template`),
  KEY `idx_ai_model` (`ai_model`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_insights_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_insights_section` FOREIGN KEY (`section_id`)
    REFERENCES `sections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='个性化反馈表';

-- ============================================================================
-- 9. 权限请求表 (permission_requests)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `permission_requests` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '权限请求ID',
  `requestor_id` BIGINT NOT NULL COMMENT '申请者用户ID',
  `owner_id` BIGINT NOT NULL COMMENT '反馈所有者用户ID',
  `insight_id` BIGINT NOT NULL COMMENT '反馈ID',
  `status` VARCHAR(20) DEFAULT 'pending' COMMENT '状态 (pending/accepted/rejected/expired)',
  `reject_reason` VARCHAR(200) DEFAULT NULL COMMENT '拒绝原因',
  `requested_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  `reviewed_at` DATETIME DEFAULT NULL COMMENT '审批时间',
  `expires_at` DATETIME DEFAULT NULL COMMENT '过期时间 (7天后自动过期)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  -- 索引
  KEY `uk_request` (`requestor_id`, `insight_id`, `status`) COMMENT '防止重复申请',
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_requestor_id` (`requestor_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_requested_at` (`requested_at`),
  CONSTRAINT `fk_permission_requests_requestor` FOREIGN KEY (`requestor_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_permission_requests_owner` FOREIGN KEY (`owner_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_permission_requests_insight` FOREIGN KEY (`insight_id`)
    REFERENCES `insights` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限请求表';

-- ============================================================================
-- 10. 权限授予记录表 (permission_grants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `permission_grants` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '授权记录ID',
  `grantee_id` BIGINT NOT NULL COMMENT '被授予权限的用户ID',
  `grantor_id` BIGINT NOT NULL COMMENT '权限所有者用户ID (反馈作者)',
  `insight_id` BIGINT NOT NULL COMMENT '反馈ID',
  `granted_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '授权时间',
  `revoked_at` DATETIME DEFAULT NULL COMMENT '撤销时间',
  `expires_at` DATETIME DEFAULT NULL COMMENT '过期时间 (永久有效或90天后)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  -- 索引
  UNIQUE KEY `uk_grantee_insight` (`grantee_id`, `insight_id`),
  KEY `idx_grantor_id` (`grantor_id`),
  KEY `idx_grantee_id` (`grantee_id`),
  KEY `idx_insight_id` (`insight_id`),
  KEY `idx_revoked_at` (`revoked_at`),
  KEY `idx_granted_at` (`granted_at`),
  CONSTRAINT `fk_permission_grants_grantee` FOREIGN KEY (`grantee_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_permission_grants_grantor` FOREIGN KEY (`grantor_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_permission_grants_insight` FOREIGN KEY (`insight_id`)
    REFERENCES `insights` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限授予记录表';

-- ============================================================================
-- 11. 评论表 (comments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `comments` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '评论ID',
  `user_id` BIGINT NOT NULL COMMENT '评论用户ID',
  `section_id` BIGINT NOT NULL COMMENT '课节ID',
  `period_id` BIGINT NOT NULL COMMENT '期次ID (冗余)',
  `parent_comment_id` BIGINT DEFAULT NULL COMMENT '父评论ID (回复时)',
  `reply_depth` INT DEFAULT 0 COMMENT '回复深度 (0=顶级评论)',
  `content` TEXT NOT NULL COMMENT '评论内容',
  `content_length` INT DEFAULT 0 COMMENT '内容长度 (字数)',
  `like_count` INT DEFAULT 0 COMMENT '点赞数',
  `reply_count` INT DEFAULT 0 COMMENT '回复数',
  `status` VARCHAR(20) DEFAULT 'published' COMMENT '状态 (draft/published/deleted/hidden)',
  `is_pinned` BOOLEAN DEFAULT FALSE COMMENT '是否置顶',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted_at` DATETIME DEFAULT NULL COMMENT '软删除时间',

  -- 索引
  KEY `idx_section_id` (`section_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_period_id` (`period_id`),
  KEY `idx_parent_comment_id` (`parent_comment_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_reply_depth` (`reply_depth`),
  KEY `idx_is_pinned` (`is_pinned`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_section` FOREIGN KEY (`section_id`)
    REFERENCES `sections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_parent` FOREIGN KEY (`parent_comment_id`)
    REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- ============================================================================
-- 12. 点赞记录表 (likes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `likes` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '点赞ID',
  `user_id` BIGINT NOT NULL COMMENT '点赞用户ID',
  `comment_id` BIGINT NOT NULL COMMENT '被点赞评论ID',
  `like_type` VARCHAR(20) DEFAULT 'comment' COMMENT '点赞类型 (comment/insight)',
  `target_id` BIGINT NOT NULL COMMENT '目标对象ID (comment_id或insight_id)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  -- 索引
  UNIQUE KEY `uk_user_target` (`user_id`, `target_id`, `like_type`) COMMENT '防止重复点赞',
  KEY `idx_comment_id` (`comment_id`),
  KEY `idx_target_id` (`target_id`),
  KEY `idx_like_type` (`like_type`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_likes_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_likes_comment` FOREIGN KEY (`comment_id`)
    REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点赞记录表';

-- ============================================================================
-- 13. 分享记录表 (shares)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `shares` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '分享ID',
  `user_id` BIGINT NOT NULL COMMENT '分享用户ID',
  `insight_id` BIGINT NOT NULL COMMENT '被分享的反馈ID',
  `share_channel` VARCHAR(50) DEFAULT 'moments' COMMENT '分享渠道 (moments/friend/link)',
  `share_title` VARCHAR(200) DEFAULT NULL COMMENT '分享标题',
  `share_image_url` VARCHAR(512) DEFAULT NULL COMMENT '分享图片URL',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  -- 索引
  KEY `idx_user_id` (`user_id`),
  KEY `idx_insight_id` (`insight_id`),
  KEY `idx_share_channel` (`share_channel`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_shares_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shares_insight` FOREIGN KEY (`insight_id`)
    REFERENCES `insights` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分享记录表';

-- ============================================================================
-- 14. 操作审计日志表 (audit_logs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
  `user_id` BIGINT DEFAULT NULL COMMENT '操作用户ID',
  `operation` VARCHAR(50) NOT NULL COMMENT '操作类型 (CREATE/UPDATE/DELETE/APPROVE)',
  `entity_type` VARCHAR(50) NOT NULL COMMENT '操作实体类型 (User/CheckIn/Permission)',
  `entity_id` BIGINT DEFAULT NULL COMMENT '操作实体ID',
  `changes` JSON DEFAULT NULL COMMENT '变更内容 {before: {...}, after: {...}}',
  `ip_address` VARCHAR(50) DEFAULT NULL COMMENT '操作IP地址',
  `user_agent` VARCHAR(500) DEFAULT NULL COMMENT '操作设备UA',
  `status` VARCHAR(20) DEFAULT 'success' COMMENT '操作结果 (success/failed)',
  `error_message` VARCHAR(500) DEFAULT NULL COMMENT '错误信息',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  -- 索引
  KEY `idx_user_id` (`user_id`),
  KEY `idx_operation` (`operation`),
  KEY `idx_entity_type` (`entity_type`),
  KEY `idx_entity_id` (`entity_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作审计日志表';

-- ============================================================================
-- 15. 系统消息表 (messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `messages` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '消息ID',
  `recipient_id` BIGINT NOT NULL COMMENT '接收者用户ID',
  `sender_id` BIGINT DEFAULT NULL COMMENT '发送者用户ID (系统消息为NULL)',
  `message_type` VARCHAR(50) NOT NULL COMMENT '消息类型 (checkin_reminder/insight_generated/permission_request)',
  `title` VARCHAR(200) NOT NULL COMMENT '消息标题',
  `content` TEXT NOT NULL COMMENT '消息内容',
  `related_data` JSON DEFAULT NULL COMMENT '相关数据 {insight_id: 123, ...}',
  `is_read` BOOLEAN DEFAULT FALSE COMMENT '是否已读',
  `read_at` DATETIME DEFAULT NULL COMMENT '读取时间',
  `is_notified` BOOLEAN DEFAULT FALSE COMMENT '是否已发送推送通知',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  -- 索引
  KEY `idx_recipient_id` (`recipient_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_message_type` (`message_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_messages_recipient` FOREIGN KEY (`recipient_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统消息表';

-- ============================================================================
-- 16. 用户统计快照表 (user_statistics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_statistics` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '统计ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `period_id` BIGINT NOT NULL COMMENT '期次ID',
  `total_checkins` INT DEFAULT 0 COMMENT '打卡总数',
  `early_checkins` INT DEFAULT 0 COMMENT '早卡次数 (6:00-8:00)',
  `late_checkins` INT DEFAULT 0 COMMENT '晚卡次数 (8:00之后)',
  `makeup_checkins` INT DEFAULT 0 COMMENT '补卡次数',
  `consecutive_days` INT DEFAULT 0 COMMENT '最长连续打卡天数',
  `comment_count` INT DEFAULT 0 COMMENT '发表评论数',
  `received_likes` INT DEFAULT 0 COMMENT '获得的点赞数',
  `received_permission_requests` INT DEFAULT 0 COMMENT '收到的权限请求数',
  `approved_permissions` INT DEFAULT 0 COMMENT '批准的权限请求数',
  `rejected_permissions` INT DEFAULT 0 COMMENT '拒绝的权限请求数',
  `insight_share_count` INT DEFAULT 0 COMMENT '反馈分享次数',
  `last_updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最后统计时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  -- 索引
  UNIQUE KEY `uk_user_period` (`user_id`, `period_id`),
  KEY `idx_period_id` (`period_id`),
  CONSTRAINT `fk_user_statistics_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_statistics_period` FOREIGN KEY (`period_id`)
    REFERENCES `course_periods` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户统计快照表';

-- ============================================================================
-- 17. 数据字典表 (sys_dict_data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `sys_dict_data` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '字典ID',
  `dict_type` VARCHAR(100) NOT NULL COMMENT '字典类型',
  `dict_label` VARCHAR(100) NOT NULL COMMENT '字典标签',
  `dict_value` VARCHAR(100) NOT NULL COMMENT '字典值',
  `description` VARCHAR(500) DEFAULT NULL COMMENT '描述',
  `sort_order` INT DEFAULT 0 COMMENT '排序顺序',
  `status` VARCHAR(20) DEFAULT 'enable' COMMENT '状态 (enable/disable)',
  `remark` VARCHAR(500) DEFAULT NULL COMMENT '备注',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  -- 索引
  UNIQUE KEY `uk_dict_type_value` (`dict_type`, `dict_value`),
  KEY `idx_dict_type` (`dict_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据字典表';

-- ============================================================================
-- 创建视图
-- ============================================================================

-- 视图1: 用户学习进度视图
CREATE OR REPLACE VIEW v_user_learning_progress AS
SELECT
  uc.id AS user_course_id,
  u.id AS user_id,
  u.nickname AS user_nickname,
  c.id AS course_id,
  c.title AS course_title,
  cp.id AS period_id,
  cp.period_number,
  uc.joined_at,
  uc.total_sections,
  uc.completed_sections,
  uc.completion_rate,
  uc.status,
  ROUND((uc.completed_sections / uc.total_sections * 100), 2) AS calculated_rate
FROM user_courses uc
JOIN users u ON uc.user_id = u.id
JOIN courses c ON uc.course_id = c.id
JOIN course_periods cp ON uc.period_id = cp.id
WHERE u.deleted_at IS NULL AND uc.status = 'active';

-- 视图2: 用户打卡统计视图
CREATE OR REPLACE VIEW v_user_checkin_stats AS
SELECT
  u.id AS user_id,
  u.nickname,
  COUNT(DISTINCT c.id) AS total_checkins,
  SUM(CASE WHEN c.is_late = 0 THEN 1 ELSE 0 END) AS early_checkins,
  SUM(CASE WHEN c.is_late = 1 THEN 1 ELSE 0 END) AS late_checkins,
  SUM(CASE WHEN c.is_makeup = 1 THEN 1 ELSE 0 END) AS makeup_checkins,
  DATE(MAX(c.checkin_time)) AS last_checkin_date,
  MAX(c.checkin_time) AS last_checkin_time
FROM users u
LEFT JOIN checkins c ON u.id = c.user_id AND c.status = 'submitted'
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.nickname;

-- 视图3: 课程热度视图
CREATE OR REPLACE VIEW v_course_popularity AS
SELECT
  cp.id AS period_id,
  cp.period_number,
  c.id AS course_id,
  c.title AS course_title,
  COUNT(DISTINCT uc.user_id) AS enrollment_count,
  COUNT(DISTINCT ch.user_id) AS checkin_users,
  COUNT(DISTINCT cm.id) AS comment_count,
  SUM(s.view_count) AS total_views,
  ROUND(COUNT(DISTINCT ch.user_id) / COUNT(DISTINCT uc.user_id) * 100, 2) AS engagement_rate
FROM courses c
JOIN course_periods cp ON c.id = cp.course_id
LEFT JOIN user_courses uc ON cp.id = uc.period_id
LEFT JOIN checkins ch ON uc.id = ch.user_course_id
LEFT JOIN sections s ON cp.id = s.period_id
LEFT JOIN comments cm ON s.id = cm.section_id
WHERE cp.status = 'closed'
GROUP BY cp.id, c.id;

-- ============================================================================
-- 创建存储过程
-- ============================================================================

-- 存储过程1: 计算用户打卡连续天数
DELIMITER $$
CREATE PROCEDURE sp_calculate_consecutive_days(
  IN p_user_id BIGINT,
  IN p_period_id BIGINT,
  OUT p_consecutive_days INT
)
BEGIN
  DECLARE v_current_day INT DEFAULT 0;
  DECLARE v_max_consecutive INT DEFAULT 0;
  DECLARE v_temp_consecutive INT DEFAULT 1;
  
  SELECT COALESCE(MAX(s.day_number), 0) INTO v_current_day
  FROM checkins ch
  JOIN sections s ON ch.section_id = s.id
  WHERE ch.user_id = p_user_id AND s.period_id = p_period_id
  ORDER BY s.day_number DESC
  LIMIT 1;
  
  -- 简化计算：从第1天开始计数，找到第一个没有打卡的日子
  WITH RECURSIVE day_range AS (
    SELECT 1 AS day_num
    UNION ALL
    SELECT day_num + 1
    FROM day_range
    WHERE day_num < v_current_day
  )
  SELECT COALESCE(MIN(dr.day_num) - 1, v_current_day) INTO v_max_consecutive
  FROM day_range dr
  WHERE NOT EXISTS (
    SELECT 1 FROM checkins ch2
    JOIN sections s2 ON ch2.section_id = s2.id
    WHERE ch2.user_id = p_user_id 
      AND s2.period_id = p_period_id 
      AND s2.day_number = dr.day_num
  );
  
  SET p_consecutive_days = COALESCE(v_max_consecutive, 0);
END$$
DELIMITER ;

-- 存储过程2: 更新用户课程完成率
DELIMITER $$
CREATE PROCEDURE sp_update_user_course_progress(
  IN p_user_id BIGINT,
  IN p_period_id BIGINT
)
BEGIN
  DECLARE v_total_sections INT DEFAULT 0;
  DECLARE v_completed_sections INT DEFAULT 0;
  DECLARE v_completion_rate DECIMAL(5,2) DEFAULT 0;
  
  -- 获取期次总课节数
  SELECT COUNT(*) INTO v_total_sections
  FROM sections
  WHERE period_id = p_period_id;
  
  -- 获取用户已打卡的课节数
  SELECT COUNT(DISTINCT ch.section_id) INTO v_completed_sections
  FROM checkins ch
  JOIN user_courses uc ON ch.user_course_id = uc.id
  WHERE uc.user_id = p_user_id AND uc.period_id = p_period_id;
  
  -- 计算完成率
  IF v_total_sections > 0 THEN
    SET v_completion_rate = (v_completed_sections / v_total_sections) * 100;
  END IF;
  
  -- 更新用户课程记录
  UPDATE user_courses
  SET total_sections = v_total_sections,
      completed_sections = v_completed_sections,
      completion_rate = v_completion_rate,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id AND period_id = p_period_id;
END$$
DELIMITER ;

-- 存储过程3: 自动过期权限请求
DELIMITER $$
CREATE PROCEDURE sp_expire_permission_requests()
BEGIN
  UPDATE permission_requests
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP;
  
  DELETE FROM permission_requests
  WHERE status = 'expired' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY);
END$$
DELIMITER ;

-- ============================================================================
-- 创建触发器
-- ============================================================================

-- 触发器1: 打卡成功后更新用户最后打卡时间
DELIMITER $$
CREATE TRIGGER tr_update_user_last_checkin_after_insert
AFTER INSERT ON checkins
FOR EACH ROW
BEGIN
  UPDATE users
  SET last_checkin_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.user_id;
END$$
DELIMITER ;

-- 触发器2: 打卡成功后更新课节打卡计数
DELIMITER $$
CREATE TRIGGER tr_update_section_checkin_count_after_insert
AFTER INSERT ON checkins
FOR EACH ROW
BEGIN
  UPDATE sections
  SET checkin_count = checkin_count + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.section_id;
END$$
DELIMITER ;

-- 触发器3: 发表评论后更新课节评论计数
DELIMITER $$
CREATE TRIGGER tr_update_section_comment_count_after_insert
AFTER INSERT ON comments
FOR EACH ROW
BEGIN
  IF NEW.status = 'published' AND NEW.parent_comment_id IS NULL THEN
    UPDATE sections
    SET comment_count = comment_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.section_id;
  END IF;
END$$
DELIMITER ;

-- 触发器4: 点赞后更新评论点赞计数
DELIMITER $$
CREATE TRIGGER tr_update_comment_like_count_after_insert
AFTER INSERT ON likes
FOR EACH ROW
BEGIN
  IF NEW.like_type = 'comment' THEN
    UPDATE comments
    SET like_count = like_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.target_id;
  END IF;
END$$
DELIMITER ;

-- ============================================================================
-- 初始化数据
-- ============================================================================

-- 插入数据字典数据
INSERT INTO sys_dict_data (dict_type, dict_label, dict_value, sort_order, status) VALUES
('user_status', '活跃', 'active', 1, 'enable'),
('user_status', '已禁用', 'banned', 2, 'enable'),
('user_status', '未激活', 'inactive', 3, 'enable'),
('gender', '男', 'male', 1, 'enable'),
('gender', '女', 'female', 2, 'enable'),
('gender', '保密', 'unknown', 3, 'enable'),
('course_status', '草稿', 'draft', 1, 'enable'),
('course_status', '已发布', 'published', 2, 'enable'),
('course_status', '已归档', 'archived', 3, 'enable'),
('period_status', '草稿', 'draft', 1, 'enable'),
('period_status', '报名中', 'open', 2, 'enable'),
('period_status', '已关闭', 'closed', 3, 'enable'),
('period_status', '已归档', 'archived', 4, 'enable'),
('section_status', '草稿', 'draft', 1, 'enable'),
('section_status', '已发布', 'published', 2, 'enable'),
('section_status', '已隐藏', 'hidden', 3, 'enable'),
('checkin_status', '已提交', 'submitted', 1, 'enable'),
('checkin_status', '已处理', 'processed', 2, 'enable'),
('checkin_status', '已删除', 'deleted', 3, 'enable'),
('permission_status', '待审批', 'pending', 1, 'enable'),
('permission_status', '已批准', 'accepted', 2, 'enable'),
('permission_status', '已拒绝', 'rejected', 3, 'enable'),
('permission_status', '已过期', 'expired', 4, 'enable'),
('comment_status', '草稿', 'draft', 1, 'enable'),
('comment_status', '已发布', 'published', 2, 'enable'),
('comment_status', '已删除', 'deleted', 3, 'enable'),
('comment_status', '已隐藏', 'hidden', 4, 'enable'),
('share_channel', '朋友圈', 'moments', 1, 'enable'),
('share_channel', '好友', 'friend', 2, 'enable'),
('share_channel', '复制链接', 'link', 3, 'enable'),
('message_type', '打卡提醒', 'checkin_reminder', 1, 'enable'),
('message_type', '反馈生成', 'insight_generated', 2, 'enable'),
('message_type', '权限请求', 'permission_request', 3, 'enable'),
('message_type', '权限批准', 'permission_approved', 4, 'enable'),
('ai_model', 'GPT-4', 'gpt-4', 1, 'enable'),
('ai_model', 'Claude-3-Sonnet', 'claude-3-sonnet', 2, 'enable'),
('ai_model', 'Aliyun-Tongyi', 'aliyun-tongyi', 3, 'enable');

-- ============================================================================
-- 创建索引汇总
-- ============================================================================
-- 注：大多数索引已在表定义中创建，以下列出关键复合索引

-- 复合索引：用户查询
ALTER TABLE users ADD KEY idx_status_deleted (status, deleted_at);

-- 复合索引：打卡查询
ALTER TABLE checkins ADD KEY idx_user_period_date (user_id, period_id, DATE(checkin_time));

-- 复合索引：评论查询
ALTER TABLE comments ADD KEY idx_section_status_created (section_id, status, created_at);

-- 复合索引：权限请求查询
ALTER TABLE permission_requests ADD KEY idx_owner_status_created (owner_id, status, created_at);

-- ============================================================================
-- 设置默认值和约束
-- ============================================================================

-- 设置自增初始值
ALTER TABLE users AUTO_INCREMENT = 100000;
ALTER TABLE courses AUTO_INCREMENT = 1000;
ALTER TABLE course_periods AUTO_INCREMENT = 10000;
ALTER TABLE user_courses AUTO_INCREMENT = 100000;
ALTER TABLE sections AUTO_INCREMENT = 100000;
ALTER TABLE checkins AUTO_INCREMENT = 1000000;
ALTER TABLE insights AUTO_INCREMENT = 1000000;
ALTER TABLE comments AUTO_INCREMENT = 5000000;
ALTER TABLE messages AUTO_INCREMENT = 10000000;

-- ============================================================================
-- 数据库优化参数（可选）
-- ============================================================================

-- 设置InnoDB缓冲池大小（根据服务器内存调整，建议为总内存的75%）
-- SET GLOBAL innodb_buffer_pool_size = 8589934592;  -- 8GB

-- 启用InnoDB file-per-table（默认已启用）
-- SET GLOBAL innodb_file_per_table = 1;

-- 设置InnoDB log file size
-- SET GLOBAL innodb_log_file_size = 536870912;  -- 512MB

-- 启用查询缓存（MySQL 5.7+建议禁用）
-- SET GLOBAL query_cache_type = 0;

-- ============================================================================
-- 备份和恢复说明
-- ============================================================================

/*
备份命令：
mysqldump -h localhost -u root -p morning_reading_db > morning_reading_db_backup.sql

恢复命令：
mysql -h localhost -u root -p morning_reading_db < morning_reading_db_backup.sql

增量备份（基于binlog）：
mysqlbinlog --start-datetime="2025-10-30 00:00:00" --stop-datetime="2025-10-31 00:00:00" 
  /var/lib/mysql/binlog.000001 > incremental_backup.sql
*/

-- ============================================================================
-- 数据库检查和验证
-- ============================================================================

-- 检查表结构
-- SHOW CREATE TABLE users;

-- 检查索引
-- SHOW INDEX FROM users;

-- 检查表空间使用
-- SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) MB
-- FROM information_schema.tables
-- WHERE table_schema = 'morning_reading_db'
-- ORDER BY (data_length + index_length) DESC;

-- ============================================================================
-- 数据库连接参数优化建议
-- ============================================================================

/*
my.cnf 或 my.ini 配置建议：

[mysqld]
# 连接参数
max_connections = 1000
max_used_connections = 100
max_connect_errors = 10
connect_timeout = 10
wait_timeout = 28800
interactive_timeout = 28800
max_allowed_packet = 16M

# InnoDB参数
innodb_buffer_pool_size = 8G
innodb_log_file_size = 512M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT
innodb_file_per_table = 1
innodb_lock_wait_timeout = 50

# 查询缓存（推荐禁用）
query_cache_type = 0
query_cache_size = 0

# 慢查询日志
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow_query.log
long_query_time = 1
log_queries_not_using_indexes = 1

# 日志参数
log_bin = /var/log/mysql/mysql-bin
binlog_format = ROW
expire_logs_days = 10
binlog_row_image = MINIMAL

# 字符集
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci

# 线程参数
thread_stack = 256K
thread_cache_size = 64

# 表参数
table_open_cache = 4000
table_definition_cache = 2000
max_tmp_tables = 32

# 排序和哈希
tmp_table_size = 32M
max_heap_table_size = 32M
sort_buffer_size = 1M
read_rnd_buffer_size = 8M
read_buffer_size = 2M
*/

-- ============================================================================
-- 数据库脚本执行完成
-- ============================================================================
-- 状态：✅ 所有表、视图、存储过程、触发器、索引创建完成
-- 下一步：运行数据初始化脚本和测试脚本
-- ============================================================================
