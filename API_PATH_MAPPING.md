# API接口路径映射表

> 小程序与后端接口路径对照表

## 认证模块 (Auth)

| 功能 | 小程序调用 | 后端路径 | 方法 | 状态 |
|------|----------|---------|------|------|
| 微信登录 | `/auth/wechat/login` | `/api/v1/auth/wechat/login` | POST | ✅ 已修复 |
| 刷新Token | `/auth/refresh` | `/api/v1/auth/refresh` | POST | ✅ 正常 |

## 用户模块 (User)

| 功能 | 小程序调用 | 后端路径 | 方法 | 状态 |
|------|----------|---------|------|------|
| 获取当前用户信息 | `/users/me` | `/api/v1/users/me` | GET | ✅ 已修复 |
| 更新用户资料 | `/users/profile` | `/api/v1/users/profile` | PUT | ✅ 正常 |
| 获取用户统计 | `/users/{userId}/stats` | `/api/v1/users/:userId/stats` | GET | ✅ 已修复 |
| 获取其他用户信息 | `/users/{userId}` | `/api/v1/users/:userId` | GET | ⚠️ 需添加路由 |

## 期次模块 (Period)

| 功能 | 小程序调用 | 后端路径 | 方法 | 状态 |
|------|----------|---------|------|------|
| 获取期次列表 | `/periods` | `/api/v1/periods` | GET | ✅ 正常 |
| 获取期次详情 | `/periods/{periodId}` | `/api/v1/periods/:periodId` | GET | ✅ 正常 |
| 创建期次(管理员) | `/periods` | `/api/v1/periods` | POST | ✅ 正常 |
| 更新期次(管理员) | `/periods/{periodId}` | `/api/v1/periods/:periodId` | PUT | ✅ 正常 |
| 删除期次(管理员) | `/periods/{periodId}` | `/api/v1/periods/:periodId` | DELETE | ✅ 正常 |

## 课节模块 (Section)

| 功能 | 小程序调用 | 后端路径 | 方法 | 状态 |
|------|----------|---------|------|------|
| 获取期次的课节列表 | `/sections/period/{periodId}` | `/api/v1/sections/period/:periodId` | GET | ✅ 已修复 |
| 获取课节详情 | `/sections/{sectionId}` | `/api/v1/sections/:sectionId` | GET | ✅ 正常 |
| 创建课节(管理员) | `/sections` | `/api/v1/sections` | POST | ✅ 正常 |
| 更新课节(管理员) | `/sections/{sectionId}` | `/api/v1/sections/:sectionId` | PUT | ✅ 正常 |
| 删除课节(管理员) | `/sections/{sectionId}` | `/api/v1/sections/:sectionId` | DELETE | ✅ 正常 |

## 打卡模块 (Checkin)

| 功能 | 小程序调用 | 后端路径 | 方法 | 状态 |
|------|----------|---------|------|------|
| 创建打卡 | `/checkins` | `/api/v1/checkins` | POST | ✅ 正常 |
| 获取用户打卡列表 | `/checkins/user/{userId?}` | `/api/v1/checkins/user/:userId?` | GET | ✅ 正常 |
| 获取期次打卡广场 | `/checkins/period/{periodId}` | `/api/v1/checkins/period/:periodId` | GET | ✅ 正常 |
| 获取打卡详情 | `/checkins/{checkinId}` | `/api/v1/checkins/:checkinId` | GET | ✅ 正常 |
| 删除打卡 | `/checkins/{checkinId}` | `/api/v1/checkins/:checkinId` | DELETE | ✅ 正常 |

## 评论模块 (Comment)

| 功能 | 小程序调用 | 后端路径 | 方法 | 状态 |
|------|----------|---------|------|------|
| 创建评论 | `/comments` | `/api/v1/comments` | POST | ✅ 正常 |
| 获取打卡的评论列表 | `/comments/checkin/{checkinId}` | `/api/v1/comments/checkin/:checkinId` | GET | ✅ 正常 |
| 回复评论 | `/comments/{commentId}/replies` | `/api/v1/comments/:commentId/replies` | POST | ✅ 正常 |
| 删除评论 | `/comments/{commentId}` | `/api/v1/comments/:commentId` | DELETE | ✅ 正常 |
| 删除回复 | `/comments/{commentId}/replies/{replyId}` | `/api/v1/comments/:commentId/replies/:replyId` | DELETE | ✅ 正常 |

## AI反馈模块 (Insight)

| 功能 | 小程序调用 | 后端路径 | 方法 | 状态 |
|------|----------|---------|------|------|
| 生成AI反馈 | `/insights/generate` | `/api/v1/insights/generate` | POST | ✅ 正常 |
| 获取用户反馈列表 | `/insights/user/{userId?}` | `/api/v1/insights/user/:userId?` | GET | ✅ 正常 |
| 获取反馈详情 | `/insights/{insightId}` | `/api/v1/insights/:insightId` | GET | ✅ 正常 |
| 删除反馈 | `/insights/{insightId}` | `/api/v1/insights/:insightId` | DELETE | ✅ 正常 |

## 特殊说明

### 1. 用户统计接口
- 后端支持 `userId` 为 `"me"` 来获取当前登录用户的统计
- 小程序会自动从本地存储获取 userId，如果没有则传 `"me"`

### 2. 响应数据格式
后端统一使用驼峰命名（camelCase）：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": {...}
  }
}
```

小程序已适配此格式，同时兼容下划线命名。

### 3. 认证方式
所有需要认证的接口都需要在请求头中携带：
```
Authorization: Bearer {accessToken}
```

小程序的 `request.js` 工具类已自动处理。

## 已修复的问题

### API路径修复
1. ✅ 登录接口路径：从 `/auth/login` 改为 `/auth/wechat/login`
2. ✅ 获取用户信息：从 `/user/profile` 改为 `/users/me`
3. ✅ 获取用户统计：从 `/user/stats` 改为 `/users/{userId}/stats`，支持 `userId="me"`
4. ✅ 更新用户资料：从 `/user/profile` 改为 `/users/profile`
5. ✅ 获取期次课节列表：从 `/periods/{periodId}/sections` 改为 `/sections/period/{periodId}`

### 数据结构兼容性修复
6. ✅ 响应数据格式：支持 `{list: []}` 和 `{items: []}` 两种格式
7. ✅ ID字段兼容：支持MongoDB的 `_id` 和前端习惯的 `id` 字段
8. ✅ Token字段兼容：支持驼峰 `accessToken` 和下划线 `access_token` 格式

### 页面跳转参数修复
9. ✅ 打卡页面参数：profile.js从传递 `periodId` 改为传递正确的 `courseId`（sectionId）
10. ✅ 参数验证：所有跳转前都检查必要的ID参数是否存在
11. ✅ ID字段统一：所有使用section/period ID的地方都兼容 `id` 和 `_id`

## 待补充的接口

根据小程序需求，可能还需要添加：
- `GET /api/v1/users/:userId` - 获取指定用户信息（用于查看他人主页）
- `GET /api/v1/checkins/today` - 获取今日打卡状态
- `POST /api/v1/periods/:periodId/enroll` - 报名期次

---

**更新时间**: 2025-11-13
**维护者**: 开发团队
