#!/usr/bin/env node

/**
 * MySQL 表结构初始化脚本
 * 创建备份同步所需的所有 MySQL 表
 * 每个表都包含 raw_json 字段用于存储 MongoDB 原始文档
 */

require('dotenv').config();
const { mysqlPool } = require('../src/config/database');
const logger = require('../src/utils/logger');

const TABLE_DEFINITIONS = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      openid VARCHAR(100) UNIQUE COMMENT '微信 openid',
      unionid VARCHAR(100) COMMENT '微信 unionid',
      nickname VARCHAR(100) COMMENT '昵称',
      avatar VARCHAR(500) COMMENT '头像 emoji',
      avatar_url VARCHAR(500) COMMENT '头像 URL',
      signature VARCHAR(500) COMMENT '个性签名',
      gender VARCHAR(20) COMMENT '性别: male/female/unknown',
      total_checkin_days INT DEFAULT 0 COMMENT '总打卡天数',
      current_streak INT DEFAULT 0 COMMENT '当前连续打卡天数',
      max_streak INT DEFAULT 0 COMMENT '最长连续打卡天数',
      total_completed_periods INT DEFAULT 0 COMMENT '完成的期数',
      total_points INT DEFAULT 0 COMMENT '总积分',
      level INT DEFAULT 1 COMMENT '等级',
      role VARCHAR(50) COMMENT '角色: user/admin/super_admin',
      status VARCHAR(50) COMMENT '状态: active/banned/deleted',
      last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      INDEX idx_openid (openid),
      INDEX idx_created_at (created_at),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
  `,

  admins: `
    CREATE TABLE IF NOT EXISTS admins (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      name VARCHAR(100) COMMENT '管理员名称',
      email VARCHAR(100) UNIQUE COMMENT '邮箱',
      password_hash VARCHAR(255) COMMENT '密码哈希',
      role VARCHAR(50) COMMENT '角色: superadmin/admin',
      permissions JSON COMMENT '权限列表',
      is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      UNIQUE KEY uk_email (email),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';
  `,

  periods: `
    CREATE TABLE IF NOT EXISTS periods (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      name VARCHAR(255) COMMENT '期次名称',
      description LONGTEXT COMMENT '期次描述',
      start_date TIMESTAMP COMMENT '开始日期',
      end_date TIMESTAMP COMMENT '结束日期',
      status VARCHAR(50) COMMENT '状态: draft/published/ongoing/ended',
      is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      INDEX idx_status (status),
      INDEX idx_start_date (start_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='期次表';
  `,

  sections: `
    CREATE TABLE IF NOT EXISTS sections (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      period_id CHAR(24) COMMENT '期次 ID',
      day_number INT COMMENT '天数',
      title VARCHAR(255) COMMENT '章节标题',
      content LONGTEXT COMMENT '章节内容',
      order_index INT COMMENT '排序',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (period_id) REFERENCES periods(id),
      INDEX idx_period_id (period_id),
      INDEX idx_day_number (day_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节表';
  `,

  checkins: `
    CREATE TABLE IF NOT EXISTS checkins (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '用户 ID',
      period_id CHAR(24) COMMENT '期次 ID',
      day_number INT COMMENT '打卡天数',
      content LONGTEXT COMMENT '打卡内容',
      images JSON COMMENT '打卡图片列表',
      status VARCHAR(50) COMMENT '状态: draft/submitted/approved',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (period_id) REFERENCES periods(id),
      INDEX idx_user_id (user_id),
      INDEX idx_period_id (period_id),
      INDEX idx_day_number (day_number),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='打卡记录表';
  `,

  enrollments: `
    CREATE TABLE IF NOT EXISTS enrollments (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '用户 ID',
      period_id CHAR(24) COMMENT '期次 ID',
      status VARCHAR(50) COMMENT '状态: pending/active/completed/cancelled',
      enrollment_date TIMESTAMP COMMENT '报名日期',
      current_day INT COMMENT '当前进度',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (period_id) REFERENCES periods(id),
      UNIQUE KEY uk_user_period (user_id, period_id),
      INDEX idx_status (status),
      INDEX idx_enrollment_date (enrollment_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报名记录表';
  `,

  payments: `
    CREATE TABLE IF NOT EXISTS payments (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '用户 ID',
      period_id CHAR(24) COMMENT '期次 ID',
      amount DECIMAL(10, 2) COMMENT '金额',
      status VARCHAR(50) COMMENT '状态: pending/completed/failed/refunded',
      transaction_id VARCHAR(100) COMMENT '交易 ID',
      paid_at TIMESTAMP NULL COMMENT '支付时间',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (period_id) REFERENCES periods(id),
      INDEX idx_user_id (user_id),
      INDEX idx_status (status),
      INDEX idx_paid_at (paid_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付记录表';
  `,

  insights: `
    CREATE TABLE IF NOT EXISTS insights (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '创建用户 ID',
      target_user_id CHAR(24) COMMENT '目标用户 ID（被看见的人）',
      period_id CHAR(24) COMMENT '期次 ID',
      type VARCHAR(50) COMMENT '类型: text/image/video',
      title VARCHAR(255) COMMENT '标题',
      content LONGTEXT COMMENT '内容',
      images JSON COMMENT '图片列表',
      is_published BOOLEAN DEFAULT FALSE COMMENT '是否发布',
      likes_count INT DEFAULT 0 COMMENT '点赞数',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (target_user_id) REFERENCES users(id),
      FOREIGN KEY (period_id) REFERENCES periods(id),
      INDEX idx_user_id (user_id),
      INDEX idx_target_user_id (target_user_id),
      INDEX idx_is_published (is_published),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小凡看见表';
  `,

  insight_likes: `
    CREATE TABLE IF NOT EXISTS insight_likes (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
      insight_id CHAR(24) COMMENT '小凡看见 ID',
      user_id CHAR(24) COMMENT '点赞用户 ID',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (insight_id) REFERENCES insights(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE KEY uk_insight_user (insight_id, user_id),
      INDEX idx_insight_id (insight_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小凡看见点赞表';
  `,

  insight_requests: `
    CREATE TABLE IF NOT EXISTS insight_requests (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '请求用户 ID',
      period_id CHAR(24) COMMENT '期次 ID',
      reason VARCHAR(255) COMMENT '请求原因',
      status VARCHAR(50) COMMENT '状态: pending/approved/rejected',
      approved_at TIMESTAMP NULL COMMENT '批准时间',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (period_id) REFERENCES periods(id),
      INDEX idx_user_id (user_id),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小凡看见申请表';
  `,

  insight_request_audit_logs: `
    CREATE TABLE IF NOT EXISTS insight_request_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
      request_id CHAR(24) COMMENT '申请 ID',
      admin_id CHAR(24) COMMENT '审核管理员 ID',
      action VARCHAR(50) COMMENT '操作: approved/rejected',
      remarks TEXT COMMENT '备注',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (request_id) REFERENCES insight_requests(id),
      FOREIGN KEY (admin_id) REFERENCES admins(id),
      INDEX idx_request_id (request_id),
      INDEX idx_admin_id (admin_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小凡看见申请审计日志表';
  `,

  comments: `
    CREATE TABLE IF NOT EXISTS comments (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      insight_id CHAR(24) COMMENT '小凡看见 ID',
      user_id CHAR(24) COMMENT '评论用户 ID',
      content LONGTEXT COMMENT '评论内容',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (insight_id) REFERENCES insights(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_insight_id (insight_id),
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';
  `,

  comment_replies: `
    CREATE TABLE IF NOT EXISTS comment_replies (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
      comment_id CHAR(24) COMMENT '评论 ID',
      user_id CHAR(24) COMMENT '回复用户 ID',
      content LONGTEXT COMMENT '回复内容',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (comment_id) REFERENCES comments(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_comment_id (comment_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论回复表';
  `,

  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '接收用户 ID',
      type VARCHAR(50) COMMENT '通知类型: checkin_approved/insight_posted/comment_received',
      title VARCHAR(255) COMMENT '通知标题',
      content LONGTEXT COMMENT '通知内容',
      related_id VARCHAR(100) COMMENT '关联数据 ID',
      is_read BOOLEAN DEFAULT FALSE COMMENT '是否已读',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      read_at TIMESTAMP NULL COMMENT '阅读时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_user_id (user_id),
      INDEX idx_is_read (is_read),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';
  `
};

async function initMysqlTables() {
  console.log('\n' + '='.repeat(70));
  console.log('    🗄️  MySQL 表结构初始化');
  console.log('='.repeat(70) + '\n');

  const conn = await mysqlPool.getConnection();

  try {
    const tableNames = Object.keys(TABLE_DEFINITIONS);

    for (let i = 0; i < tableNames.length; i++) {
      const tableName = tableNames[i];
      const sql = TABLE_DEFINITIONS[tableName];
      const stepNumber = i + 1;

      try {
        console.log(`[${stepNumber}/${tableNames.length}] 创建表: ${tableName}...`);
        await conn.query(sql);
        console.log(`✅ 表 ${tableName} 创建成功\n`);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠️  表 ${tableName} 已存在，跳过\n`);
        } else {
          console.error(`❌ 表 ${tableName} 创建失败:`, error.message);
          throw error;
        }
      }
    }

    console.log('='.repeat(70));
    console.log('✅ MySQL 表结构初始化完成！');
    console.log('='.repeat(70));
    console.log('\n📊 已创建的表：');
    tableNames.forEach((tableName, index) => {
      console.log(`   ${index + 1}. ${tableName}`);
    });
    console.log('\n💡 现在可以使用以下命令同步数据：');
    console.log('   npm run sync:mongodb-to-mysql\n');
  } catch (error) {
    console.error('\n❌ MySQL 初始化失败:', error.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}

// 运行初始化
if (require.main === module) {
  initMysqlTables().catch(error => {
    logger.error('MySQL initialization failed', error);
    process.exit(1);
  });
}

module.exports = { initMysqlTables };
