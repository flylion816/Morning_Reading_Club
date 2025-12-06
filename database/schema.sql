-- ⚠️ 已弃用：项目已迁移到 MongoDB
-- 保留此文件仅作历史参考
-- 当前数据库使用 MongoDB，请参考 database/README.md 中的 MongoDB 初始化说明
--
-- 晨读营数据库表结构设计（MySQL 版本，已过时）

-- 用户表
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wx_openid VARCHAR(100) UNIQUE NOT NULL,
  nickname VARCHAR(50),
  avatar VARCHAR(10) DEFAULT '🦁',
  signature VARCHAR(200) DEFAULT '天天开心，觉知当下！',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 课程表
CREATE TABLE courses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  period INT DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INT DEFAULT 23,
  status ENUM('not_started', 'ongoing', 'completed') DEFAULT 'not_started',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 课程章节表
CREATE TABLE course_chapters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL,
  day_number INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- 用户课程关系表
CREATE TABLE user_courses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  current_day INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE KEY uk_user_course (user_id, course_id)
);

-- 打卡记录表
CREATE TABLE checkins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  chapter_id INT NOT NULL,
  day_number INT NOT NULL,
  content TEXT NOT NULL,
  checkin_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (chapter_id) REFERENCES course_chapters(id)
);

-- 小凡看见表
CREATE TABLE insights (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  checkin_id INT NOT NULL,
  day_number INT NOT NULL,
  title VARCHAR(100),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (checkin_id) REFERENCES checkins(id)
);

-- 小凡看见权限请求表
CREATE TABLE insight_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  requester_id INT NOT NULL COMMENT '请求者ID',
  target_user_id INT NOT NULL COMMENT '被请求者ID',
  insight_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id),
  FOREIGN KEY (insight_id) REFERENCES insights(id)
);

-- 评论表
CREATE TABLE comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  checkin_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (checkin_id) REFERENCES checkins(id)
);

-- 用户统计表
CREATE TABLE user_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNIQUE NOT NULL,
  total_checkins INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_courses INT DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_checkins_user ON checkins(user_id);
CREATE INDEX idx_checkins_course ON checkins(course_id);
CREATE INDEX idx_insights_user ON insights(user_id);
CREATE INDEX idx_comments_checkin ON comments(checkin_id);
