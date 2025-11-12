# 数据库设计文档

## 概述

晨读营小程序数据库设计，包含完整的表结构和初始化数据。

## 数据库表

### 核心表

1. **users** - 用户表
   - 存储用户基本信息（昵称、头像、签名等）
   - 关联微信openid

2. **courses** - 课程表
   - 课程基本信息（标题、期数、时间范围）
   - 支持多期课程

3. **course_chapters** - 课程章节表
   - 23天课程的每日章节
   - 包含开始和结束时间

4. **user_courses** - 用户课程关系表
   - 用户报名记录
   - 当前学习进度

5. **checkins** - 打卡记录表
   - 用户每日打卡内容
   - 关联课程和章节

6. **insights** - 小凡看见表
   - AI生成的个性化反馈
   - 关联打卡记录

7. **insight_requests** - 权限请求表
   - 查看他人小凡看见的权限请求
   - 支持批准/拒绝状态

8. **comments** - 评论表
   - 对打卡内容的评论
   - 社区互动功能

9. **user_stats** - 用户统计表
   - 总打卡数、连续天数等统计信息
   - 定期更新

## 使用方法

### 1. 创建数据库

```sql
CREATE DATABASE morning_reading CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE morning_reading;
```

### 2. 执行表结构脚本

```bash
mysql -u root -p morning_reading < schema.sql
```

### 3. 导入初始数据

```bash
mysql -u root -p morning_reading < init-data.sql
```

## 初始数据说明

初始数据基于HTML demo，包含：

- **3个测试用户**：狮子（🦁）、小明（😊）、小红（🌸）
- **1个课程**：七个习惯晨读营第1期（23天）
- **12个章节**：开营词 + 前11天的课程内容
- **3条打卡记录**：示例打卡内容
- **2条小凡看见**：AI反馈示例
- **2条评论**：社区互动示例
- **用户统计数据**：打卡数、连续天数等

## 注意事项

1. **openid管理**：生产环境需要真实的微信openid
2. **时间数据**：初始化数据使用了2025年的日期，需根据实际情况调整
3. **数据安全**：确保数据库访问权限配置正确
4. **字符集**：使用utf8mb4支持emoji表情

## 扩展功能

后续可以添加：
- 积分系统表
- 徽章成就表
- 消息通知表
- 分享记录表

## 数据库ER图

```
users (用户)
  ├─ user_courses (报名关系)
  │    └─ courses (课程)
  │         └─ course_chapters (章节)
  ├─ checkins (打卡记录)
  │    ├─ insights (小凡看见)
  │    └─ comments (评论)
  ├─ insight_requests (权限请求)
  └─ user_stats (统计数据)
```
