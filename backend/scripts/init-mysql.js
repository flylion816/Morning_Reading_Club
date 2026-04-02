#!/usr/bin/env node

/**
 * MySQL 表结构初始化脚本（完整版）
 * 创建备份同步所需的所有 MySQL 表
 * 所有表都包含MongoDB所有字段 + raw_json
 *
 * 多环境支持：
 * - 本地开发环境：.env.config.js (currentEnv='dev')
 *   ├─ 连接: localhost:3306
 *   ├─ 用户: morning_user
 *   └─ 数据库: morning_reading
 *
 * - 线上环境：.env.config.js (currentEnv='prod')
 *   ├─ 连接: localhost:13306 (Docker 映射)
 *   ├─ 用户: root
 *   └─ 数据库: morning_reading
 *
 * 配置加载优先级：
 * 1. .env.config.js 中的 config.mysql（推荐）
 * 2. 环境变量 MYSQL_* （备选）
 * 3. .env 文件中的值（最后备选）
 */

const path = require('path');

// 先加载 .env.config.js（统一环境配置）
let envConfig = null;
let mysqlConfig = null;

try {
  const envConfigPath = path.resolve(__dirname, '../../.env.config.js');
  envConfig = require(envConfigPath);
  process.env.NODE_ENV = process.env.NODE_ENV || envConfig.config.backend.nodeEnv;
  mysqlConfig = envConfig.config.mysql;
} catch (error) {
  console.warn('⚠️  未找到 .env.config.js，将使用 .env 文件');
}

// 再加载 .env 文件（作为备选配置来源）
require('dotenv').config();

// 创建临时连接池（不指定数据库，用于创建数据库）
// 优先使用 .env.config.js 中的配置，否则使用 .env 中的值
const mysql = require('mysql2/promise');
const getTempPoolConfig = () => {
  if (mysqlConfig) {
    return {
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }
  // 备选方案：从 .env 读取
  return {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'morning_user',
    password: process.env.MYSQL_PASSWORD || 'morning123',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
};

const tempPool = mysql.createPool(getTempPoolConfig());

const logger = require('../src/utils/logger');

const TABLE_DEFINITIONS = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      openid VARCHAR(100) COMMENT '微信 openid',
      unionid VARCHAR(100) COMMENT '微信 unionid',
      nickname VARCHAR(100) COMMENT '昵称',
      avatar VARCHAR(500) COMMENT '头像 emoji',
      avatar_url VARCHAR(500) COMMENT '头像 URL',
      signature VARCHAR(500) COMMENT '个性签名',
      gender VARCHAR(20) DEFAULT 'unknown' COMMENT '性别',
      total_checkin_days INT DEFAULT 0 COMMENT '总打卡天数',
      current_streak INT DEFAULT 0 COMMENT '当前连续打卡',
      max_streak INT DEFAULT 0 COMMENT '最长连续打卡',
      total_completed_periods INT DEFAULT 0 COMMENT '完成期数',
      total_points INT DEFAULT 0 COMMENT '总积分',
      level INT DEFAULT 1 COMMENT '等级',
      role VARCHAR(50) DEFAULT 'user' COMMENT '角色',
      status VARCHAR(50) DEFAULT 'active' COMMENT '状态',
      phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
      phone_bind_at DATETIME(6) DEFAULT NULL COMMENT '手机号绑定时间',
      last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      INDEX idx_openid (openid),
      INDEX idx_created_at (created_at),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
  `,

  admins: `
    CREATE TABLE IF NOT EXISTS admins (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      name VARCHAR(100) NOT NULL COMMENT '管理员名称',
      email VARCHAR(100) UNIQUE NOT NULL COMMENT '邮箱',
      password VARCHAR(255) NOT NULL COMMENT '密码哈希',
      avatar VARCHAR(500) COMMENT '头像',
      role VARCHAR(50) DEFAULT 'operator' COMMENT '角色',
      permissions JSON COMMENT '权限列表',
      status VARCHAR(50) DEFAULT 'active' COMMENT '状态',
      last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
      login_count INT DEFAULT 0 COMMENT '登录次数',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      UNIQUE KEY uk_email (email),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';
  `,

  periods: `
    CREATE TABLE IF NOT EXISTS periods (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      name VARCHAR(255) NOT NULL COMMENT '期次名称',
      subtitle VARCHAR(255) COMMENT '副标题',
      title VARCHAR(255) COMMENT '标题',
      description LONGTEXT COMMENT '描述',
      icon VARCHAR(50) COMMENT '图标',
      cover_color VARCHAR(50) COMMENT '封面颜色',
      cover_emoji VARCHAR(10) COMMENT '封面emoji',
      start_date TIMESTAMP NULL COMMENT '开始日期',
      end_date TIMESTAMP NULL COMMENT '结束日期',
      total_days INT DEFAULT 0 COMMENT '总天数',
      price DECIMAL(10,2) DEFAULT 0 COMMENT '价格',
      original_price DECIMAL(10,2) COMMENT '原价',
      max_enrollment INT COMMENT '最大报名',
      current_enrollment INT DEFAULT 0 COMMENT '当前报名',
      enrollment_count INT DEFAULT 0 COMMENT '报名数',
      status VARCHAR(50) DEFAULT 'draft' COMMENT '状态',
      is_published BOOLEAN DEFAULT 0 COMMENT '是否发布',
      sort_order INT COMMENT '排序',
      checkin_count INT DEFAULT 0 COMMENT '打卡数',
      total_checkins INT DEFAULT 0 COMMENT '总打卡',
      meeting_id VARCHAR(50) DEFAULT NULL COMMENT '腾讯会议号',
      meeting_join_url VARCHAR(1000) DEFAULT NULL COMMENT '腾讯会议邀请链接',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      INDEX idx_status (status),
      INDEX idx_start_date (start_date),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='期次表';
  `,

  sections: `
    CREATE TABLE IF NOT EXISTS sections (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      period_id CHAR(24) COMMENT '期次 ID',
      day INT COMMENT '天数',
      title VARCHAR(255) COMMENT '标题',
      subtitle VARCHAR(255) COMMENT '副标题',
      icon VARCHAR(50) COMMENT '图标',
      meditation LONGTEXT COMMENT '冥想',
      question LONGTEXT COMMENT '问题',
      content LONGTEXT COMMENT '内容',
      description LONGTEXT COMMENT '描述',
      reflection LONGTEXT COMMENT '反思',
      action LONGTEXT COMMENT '行动',
      learn LONGTEXT COMMENT '学到',
      extract LONGTEXT COMMENT '提取',
      say LONGTEXT COMMENT '说',
      audio_url VARCHAR(500) COMMENT '音频URL',
      video_cover VARCHAR(500) COMMENT '视频封面',
      duration INT COMMENT '时长',
      sort_order INT COMMENT '排序',
      \`order\` INT COMMENT '顺序',
      is_published BOOLEAN DEFAULT 0 COMMENT '是否发布',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE,
      INDEX idx_period_id (period_id),
      INDEX idx_day (day),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节表';
  `,

  checkins: `
    CREATE TABLE IF NOT EXISTS checkins (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '用户 ID',
      period_id CHAR(24) COMMENT '期次 ID',
      section_id CHAR(24) COMMENT '章节 ID',
      day INT COMMENT '打卡天数',
      checkin_date TIMESTAMP COMMENT '打卡日期',
      reading_time INT COMMENT '阅读时间',
      completion_rate INT COMMENT '完成率',
      note LONGTEXT COMMENT '笔记',
      images JSON COMMENT '图片列表',
      mood VARCHAR(50) COMMENT '心情',
      points INT DEFAULT 0 COMMENT '积分',
      is_public BOOLEAN DEFAULT 0 COMMENT '是否公开',
      like_count INT DEFAULT 0 COMMENT '点赞数',
      likes JSON COMMENT '点赞用户列表',
      is_featured BOOLEAN DEFAULT 0 COMMENT '是否精选',
      status VARCHAR(50) COMMENT '状态',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id),
      INDEX idx_user_id (user_id),
      INDEX idx_period_id (period_id),
      INDEX idx_day (day),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='打卡表';
  `,

  enrollments: `
    CREATE TABLE IF NOT EXISTS enrollments (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '用户 ID',
      period_id CHAR(24) COMMENT '期次 ID',
      enrolled_at TIMESTAMP COMMENT '报名时间',
      status VARCHAR(50) DEFAULT 'pending' COMMENT '状态',
      payment_status VARCHAR(50) COMMENT '支付状态',
      payment_amount DECIMAL(10,2) COMMENT '支付金额',
      paid_at TIMESTAMP NULL COMMENT '支付时间',
      completed_at TIMESTAMP NULL COMMENT '完成时间',
      withdrawn_at TIMESTAMP NULL COMMENT '退出时间',
      name VARCHAR(100) COMMENT '姓名',
      gender VARCHAR(20) COMMENT '性别',
      province VARCHAR(100) COMMENT '省份',
      detailed_address VARCHAR(500) COMMENT '详细地址',
      age INT COMMENT '年龄',
      referrer VARCHAR(100) COMMENT '推荐人',
      has_read_book BOOLEAN COMMENT '是否读过书',
      read_times INT COMMENT '阅读次数',
      enroll_reason LONGTEXT COMMENT '报名原因',
      expectation LONGTEXT COMMENT '期望',
      commitment LONGTEXT COMMENT '承诺',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      deleted BOOLEAN DEFAULT 0 COMMENT '是否软删除',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE,
      UNIQUE KEY uk_user_period (user_id, period_id),
      INDEX idx_status (status),
      INDEX idx_enrolled_at (enrolled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报名表';
  `,

  payments: `
    CREATE TABLE IF NOT EXISTS payments (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      enrollment_id CHAR(24) COMMENT '报名 ID',
      user_id CHAR(24) COMMENT '用户 ID',
      period_id CHAR(24) COMMENT '期次 ID',
      amount DECIMAL(10,2) NOT NULL COMMENT '金额',
      payment_method VARCHAR(50) COMMENT '支付方法',
      status VARCHAR(50) DEFAULT 'pending' COMMENT '状态',
      wechat JSON COMMENT '微信支付信息',
      order_no VARCHAR(100) COMMENT '订单号',
      reconciled BOOLEAN DEFAULT 0 COMMENT '是否对账',
      paid_at DATETIME(6) COMMENT '支付时间',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      is_paid BOOLEAN DEFAULT 0 COMMENT '是否已支付（虚拟字段同步）',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付表';
  `,

  insights: `
    CREATE TABLE IF NOT EXISTS insights (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '创建用户 ID',
      target_user_id CHAR(24) COMMENT '目标用户 ID',
      checkin_id CHAR(24) COMMENT '打卡 ID',
      period_id CHAR(24) COMMENT '期次 ID',
      section_id CHAR(24) COMMENT '章节 ID',
      day INT COMMENT '天数',
      type VARCHAR(50) COMMENT '类型',
      media_type VARCHAR(50) COMMENT '媒体类型',
      content LONGTEXT COMMENT '内容',
      image_url VARCHAR(500) COMMENT '图片URL',
      summary LONGTEXT COMMENT '摘要',
      tags JSON COMMENT '标签',
      status VARCHAR(50) COMMENT '状态',
      source VARCHAR(50) COMMENT '来源',
      is_published BOOLEAN DEFAULT 0 COMMENT '是否发布',
      likes JSON COMMENT '点赞',
      like_count INT DEFAULT 0 COMMENT '点赞数',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id),
      FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE,
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
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uk_insight_user (insight_id, user_id),
      INDEX idx_insight_id (insight_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小凡看见点赞表';
  `,

  insight_requests: `
    CREATE TABLE IF NOT EXISTS insight_requests (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      from_user_id CHAR(24) COMMENT '发送用户 ID',
      to_user_id CHAR(24) COMMENT '接收用户 ID',
      status VARCHAR(50) DEFAULT 'pending' COMMENT '状态',
      reason VARCHAR(255) COMMENT '原因',
      period_id CHAR(24) COMMENT '期次 ID',
      insight_id CHAR(24) DEFAULT NULL COMMENT '小凡看见 ID',
      request_period_name VARCHAR(100) DEFAULT NULL COMMENT '申请期次名称快照',
      request_insight_title VARCHAR(255) DEFAULT NULL COMMENT '申请看见标题快照',
      request_insight_day INT DEFAULT NULL COMMENT '申请看见天数快照',
      approved_at TIMESTAMP NULL COMMENT '批准时间',
      rejected_at TIMESTAMP NULL COMMENT '拒绝时间',
      revoked_at TIMESTAMP NULL COMMENT '撤销时间',
      audit_log JSON DEFAULT NULL COMMENT '审计日志(操作记录数组)',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_insight_id (insight_id),
      INDEX idx_from_user_id (from_user_id),
      INDEX idx_to_user_id (to_user_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小凡看见申请表';
  `,

  insight_request_audit_logs: `
    CREATE TABLE IF NOT EXISTS insight_request_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
      request_id CHAR(24) COMMENT '申请 ID',
      admin_id CHAR(24) COMMENT '管理员 ID',
      action VARCHAR(50) COMMENT '操作',
      actor_type VARCHAR(50) COMMENT '操作者类型',
      timestamp TIMESTAMP COMMENT '时间戳',
      remarks TEXT COMMENT '备注',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (request_id) REFERENCES insight_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(id),
      INDEX idx_request_id (request_id),
      INDEX idx_admin_id (admin_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='小凡看见申请审计日志表';
  `,

  comments: `
    CREATE TABLE IF NOT EXISTS comments (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '用户 ID',
      content LONGTEXT COMMENT '评论内容',
      reply_to_user_id CHAR(24) COMMENT '回复用户 ID',
      checkin_id CHAR(24) COMMENT '打卡 ID',
      reply_count INT DEFAULT 0 COMMENT '回复数',
      like_count INT DEFAULT 0 COMMENT '点赞数',
      likes JSON COMMENT '点赞用户列表',
      replies JSON DEFAULT NULL COMMENT '回复列表(嵌套数组)',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to_user_id) REFERENCES users(id),
      FOREIGN KEY (checkin_id) REFERENCES checkins(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_checkin_id (checkin_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';
  `,

  comment_replies: `
    CREATE TABLE IF NOT EXISTS comment_replies (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID',
      comment_id CHAR(24) COMMENT '评论 ID',
      user_id CHAR(24) COMMENT '用户 ID',
      content LONGTEXT COMMENT '回复内容',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_comment_id (comment_id),
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论回复表';
  `,

  notifications: `
    CREATE TABLE IF NOT EXISTS notifications (
      id CHAR(24) PRIMARY KEY COMMENT 'MongoDB ObjectId',
      user_id CHAR(24) COMMENT '用户 ID',
      type VARCHAR(50) COMMENT '通知类型',
      title VARCHAR(255) COMMENT '通知标题',
      content LONGTEXT COMMENT '通知内容',
      request_id VARCHAR(100) COMMENT '请求 ID',
      sender_id CHAR(24) COMMENT '发送者 ID',
      is_read BOOLEAN DEFAULT 0 COMMENT '是否已读',
      read_at TIMESTAMP NULL COMMENT '阅读时间',
      is_archived BOOLEAN DEFAULT 0 COMMENT '是否归档',
      archived_at TIMESTAMP NULL COMMENT '归档时间',
      data JSON COMMENT '数据',
      created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
      updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
      raw_json LONGTEXT COMMENT 'MongoDB 原始文档 JSON',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_is_read (is_read),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';
  `
};

const SCHEMA_UPGRADES = [
  {
    name: 'periods.meeting_join_url',
    sql: `
      ALTER TABLE periods
      ADD COLUMN IF NOT EXISTS meeting_join_url VARCHAR(1000) DEFAULT NULL COMMENT '腾讯会议邀请链接' AFTER meeting_id
    `
  }
];

async function initMysqlTables() {
  console.log('\n' + '='.repeat(70));
  console.log('    🗄️  MySQL 表结构初始化');
  console.log('='.repeat(70) + '\n');

  // 第一步：确保数据库存在
  try {
    const dbName = mysqlConfig?.database || process.env.MYSQL_DATABASE || 'morning_reading';
    console.log(`检查/创建数据库 [${process.env.NODE_ENV}]...`);
    const tempConn = await tempPool.getConnection();
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    tempConn.release();
    console.log(`✅ 数据库 ${dbName} 已就绪 (环境: ${process.env.NODE_ENV})\n`);
  } catch (error) {
    console.error(`❌ 无法创建数据库:`, error.message);
    throw error;
  }

  // 现在可以使用主pool（包含数据库）
  const { mysqlPool } = require('../src/config/database');
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

    for (const upgrade of SCHEMA_UPGRADES) {
      console.log(`执行表结构升级: ${upgrade.name}...`);
      await conn.query(upgrade.sql);
      console.log(`✅ 表结构升级完成: ${upgrade.name}\n`);
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
