> ⚠️ **历史参考文档** — 此文档已过时，当前权威文档请查阅 `docs/backend/API-接口索引-代码同步版-2026-05-12.md`
>
> ---

# API接口设计 v3.0

## 文档信息

- **文档版本**: v3.0
- **产品版本**: v1.0
- **创建日期**: 2025-01-13
- **文档状态**: 已发布

## 说明

本文档定义所有后端API接口，包括RESTful规范、请求响应格式、鉴权方式、错误码等。基于前端v1.0实际需求设计。

---

## 一、API设计规范

### 1.1 基础URL

```
开发环境: http://localhost:3000/api/v1
测试环境: https://test-api.example.com/api/v1
生产环境: https://api.example.com/api/v1
```

### 1.2 请求规范

**HTTP方法**:

- `GET`: 获取资源
- `POST`: 创建资源
- `PUT`: 完整更新资源
- `PATCH`: 部分更新资源
- `DELETE`: 删除资源

**请求头**:

```http
Content-Type: application/json
Authorization: Bearer {access_token}
X-Request-ID: {unique_request_id}
```

**URL规范**:

- 使用小写字母和连字符
- 资源名使用复数形式
- 嵌套资源不超过2层

示例:

```
✅ GET /api/v1/periods
✅ GET /api/v1/periods/8/sections
✅ GET /api/v1/checkins/1/comments
❌ GET /api/v1/period
❌ GET /api/v1/periods/8/sections/1/checkins/1/comments
```

### 1.3 响应规范

**成功响应格式**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    // 实际数据
  },
  "timestamp": 1705132800000
}
```

**列表响应格式**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

**错误响应格式**:

```json
{
  "code": 400,
  "message": "Invalid parameters",
  "error": {
    "type": "VALIDATION_ERROR",
    "details": [
      {
        "field": "nickname",
        "message": "昵称长度必须在2-50个字符之间"
      }
    ]
  },
  "timestamp": 1705132800000
}
```

### 1.4 分页参数

**查询参数**:

```
page: 页码（从1开始，默认1）
pageSize: 每页数量（默认20，最大100）
sortBy: 排序字段（默认createdAt）
order: 排序方向（asc/desc，默认desc）
```

**示例**:

```
GET /api/v1/checkins?page=2&pageSize=20&sortBy=createdAt&order=desc
```

### 1.5 过滤和搜索

**查询参数**:

```
filter[field]: 过滤条件
search: 搜索关键词
status: 状态筛选
startDate: 开始日期
endDate: 结束日期
```

**示例**:

```
GET /api/v1/periods?filter[status]=ongoing&search=勇敢
GET /api/v1/checkins?startDate=2025-01-01&endDate=2025-01-31
```

---

## 二、认证与鉴权

### 2.1 微信登录

**接口**: `POST /auth/wechat/login`

**请求参数**:

```json
{
  "code": "061YaF100dSm2Z1hxS200oSzkC0YaF1Q"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200,
    "user": {
      "id": 1,
      "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
      "nickname": "微信用户",
      "avatar": "🦁",
      "avatarUrl": null,
      "role": "user",
      "status": "active",
      "isNewUser": true
    }
  },
  "timestamp": 1705132800000
}
```

**流程说明**:

1. 小程序调用 `wx.login()` 获取code
2. 发送code到后端
3. 后端调用微信API获取openid和session_key
4. 查找或创建用户
5. 生成JWT token返回

**错误码**:

- `40001`: 微信code无效
- `40002`: 微信API调用失败
- `50001`: 用户已被封禁

### 2.2 刷新Token

**接口**: `POST /auth/refresh`

**请求参数**:

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 7200
  },
  "timestamp": 1705132800000
}
```

**错误码**:

- `40101`: Token已过期
- `40102`: Token无效

### 2.3 JWT Token格式

**Payload结构**:

```json
{
  "userId": 1,
  "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
  "role": "user",
  "iat": 1705132800,
  "exp": 1705140000
}
```

**验证中间件**:

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      code: 401,
      message: '认证令牌无效或已过期'
    });
  }
}

// 管理员权限验证
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      code: 403,
      message: '无权限访问'
    });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };
```

---

## 三、用户相关接口

### 3.1 获取当前用户信息

**接口**: `GET /users/me`

**鉴权**: 需要

**请求头**:

```http
Authorization: Bearer {access_token}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
    "nickname": "阿泰",
    "avatar": "🦁",
    "avatarUrl": "https://...",
    "signature": "天天开心，觉知当下！",
    "gender": "male",
    "totalCheckinDays": 23,
    "currentStreak": 5,
    "maxStreak": 15,
    "totalCompletedPeriods": 3,
    "totalPoints": 500,
    "level": 1,
    "role": "user",
    "status": "active",
    "createdAt": "2025-01-10T08:00:00.000Z",
    "lastLoginAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**错误码**:

- `40101`: Token已过期
- `40401`: 用户不存在

### 3.2 更新用户信息

**接口**: `PATCH /users/me`

**鉴权**: 需要

**请求参数**:

```json
{
  "nickname": "阿泰",
  "avatar": "泰",
  "signature": "天天开心，觉知当下！",
  "gender": "male"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": 1,
    "nickname": "阿泰",
    "avatar": "泰",
    "signature": "天天开心，觉知当下！",
    "gender": "male",
    "updatedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**验证规则**:

- nickname: 2-50字符
- avatar: 1-10字符
- signature: 0-200字符
- gender: male/female/unknown

**错误码**:

- `40001`: 参数验证失败
- `40901`: 昵称已被使用

### 3.3 获取用户统计信息

**接口**: `GET /users/me/stats`

**鉴权**: 需要

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "totalCheckinDays": 23,
    "currentStreak": 5,
    "maxStreak": 15,
    "totalCompletedPeriods": 3,
    "totalPoints": 500,
    "level": 1,
    "checkinCalendar": [
      {
        "date": "2025-01-13",
        "count": 1,
        "sections": [
          {
            "sectionId": 802,
            "title": "第一天 品德成功论"
          }
        ]
      }
    ],
    "recentActivity": [
      {
        "type": "checkin",
        "date": "2025-01-13T07:30:00.000Z",
        "description": "打卡了「第一天 品德成功论」"
      },
      {
        "type": "comment",
        "date": "2025-01-13T08:00:00.000Z",
        "description": "评论了 @张三 的打卡"
      }
    ]
  },
  "timestamp": 1705132800000
}
```

### 3.4 获取用户打卡列表

**接口**: `GET /users/:userId/checkins`

**鉴权**: 需要

**查询参数**:

```
page: 页码（默认1）
pageSize: 每页数量（默认20）
periodId: 期次ID（可选）
status: 状态（可选: normal/deleted/hidden）
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "userId": 1,
        "userName": "阿泰",
        "userAvatar": "泰",
        "periodId": 8,
        "periodName": "勇敢的心",
        "sectionId": 802,
        "sectionTitle": "第一天 品德成功论",
        "sectionDay": 1,
        "content": "今天学习了品德成功论...",
        "images": ["https://..."],
        "videos": [],
        "voices": [],
        "visibility": "all",
        "likeCount": 5,
        "commentCount": 3,
        "isLiked": false,
        "status": "normal",
        "createdAt": "2025-01-13T07:30:00.000Z",
        "createTimeFormatted": "2小时前"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 23,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

---

## 四、期次相关接口

### 4.1 获取期次列表

**接口**: `GET /periods`

**鉴权**: 可选（登录后返回更多信息）

**查询参数**:

```
page: 页码（默认1）
pageSize: 每页数量（默认20）
status: 状态过滤（可选: not_started/ongoing/completed）
isPublished: 是否已发布（可选: true/false）
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 8,
        "name": "勇敢的心",
        "subtitle": "七个习惯晨读营",
        "title": "勇敢的心 - 七个习惯晨读营",
        "description": "21天养成阅读习惯...",
        "icon": "⛰️",
        "coverColor": "linear-gradient(135deg, #4a90e2 0%, #357abd 100%)",
        "coverEmoji": "🏔️",
        "startDate": "2025-10-11",
        "endDate": "2025-11-13",
        "dateRange": "10-11 至 11-13",
        "totalDays": 23,
        "price": 99.0,
        "originalPrice": 199.0,
        "maxEnrollment": 500,
        "currentEnrollment": 235,
        "status": "ongoing",
        "isPublished": true,
        "sortOrder": 100,
        "isEnrolled": true,
        "checkedDays": 15,
        "progress": 65,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 8,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

**说明**:

- 未登录: 只返回基本信息，不包含 isEnrolled, checkedDays, progress
- 已登录: 返回完整信息

### 4.2 获取期次详情

**接口**: `GET /periods/:id`

**鉴权**: 可选

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 8,
    "name": "勇敢的心",
    "subtitle": "七个习惯晨读营",
    "title": "勇敢的心 - 七个习惯晨读营",
    "description": "21天养成阅读习惯...",
    "icon": "⛰️",
    "coverColor": "linear-gradient(135deg, #4a90e2 0%, #357abd 100%)",
    "coverEmoji": "🏔️",
    "startDate": "2025-10-11",
    "endDate": "2025-11-13",
    "dateRange": "10-11 至 11-13",
    "totalDays": 23,
    "price": 99.0,
    "originalPrice": 199.0,
    "maxEnrollment": 500,
    "currentEnrollment": 235,
    "status": "ongoing",
    "isPublished": true,
    "isEnrolled": true,
    "checkedDays": 15,
    "progress": 65,
    "enrollment": {
      "enrollmentId": 1,
      "enrolledAt": "2025-10-10T10:00:00.000Z",
      "lastCheckinAt": "2025-01-13T07:30:00.000Z"
    },
    "sectionsCount": 23,
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**错误码**:

- `40401`: 期次不存在
- `40301`: 期次未发布

### 4.3 报名期次

**接口**: `POST /periods/:id/enroll`

**鉴权**: 需要

**请求参数**:

```json
{
  "paymentType": "wechat_pay",
  "paymentAmount": 99.0
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "报名成功",
  "data": {
    "enrollmentId": 1,
    "periodId": 8,
    "periodName": "勇敢的心",
    "userId": 1,
    "status": "active",
    "paymentStatus": "unpaid",
    "paymentAmount": 99.0,
    "orderNo": "ORDER20251010123456",
    "paymentInfo": {
      "prepayId": "wx20251010123456789",
      "nonceStr": "abc123",
      "timestamp": 1705132800,
      "sign": "..."
    },
    "enrolledAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**业务规则**:

- 同一用户同一期次只能报名一次
- 期次必须是未开始或进行中状态
- 达到最大报名人数时不允许报名

**错误码**:

- `40901`: 已经报名过该期次
- `40902`: 期次已结束，不能报名
- `40903`: 报名人数已满

### 4.4 取消报名

**接口**: `DELETE /periods/:id/enroll`

**鉴权**: 需要

**响应示例**:

```json
{
  "code": 200,
  "message": "取消报名成功",
  "data": {
    "enrollmentId": 1,
    "periodId": 8,
    "status": "cancelled",
    "cancelledAt": "2025-01-13T10:30:00.000Z",
    "refundStatus": "processing",
    "refundAmount": 99.0
  },
  "timestamp": 1705132800000
}
```

**业务规则**:

- 期次开始前可随时取消
- 期次开始后，根据打卡进度决定退款比例

**错误码**:

- `40401`: 未找到报名记录
- `40904`: 该期次不允许取消

---

## 五、课节相关接口

### 5.1 获取期次课节列表

**接口**: `GET /periods/:periodId/sections`

**鉴权**: 可选

**查询参数**:

```
page: 页码（默认1）
pageSize: 每页数量（默认100，课节较少不分页）
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 801,
        "periodId": 8,
        "day": 0,
        "title": "开营词",
        "subtitle": "欢迎来到晨读营",
        "coverColor": "#4a90e2",
        "coverEmoji": "🎉",
        "startTime": "2025-10-10T06:59:00.000Z",
        "endTime": "2025-10-11T06:59:59.000Z",
        "dateRange": "10-10 至 10-11",
        "isPublished": true,
        "checkinCount": 200,
        "isCheckedIn": false,
        "canCheckin": false,
        "createdAt": "2025-01-01T00:00:00.000Z"
      },
      {
        "id": 802,
        "periodId": 8,
        "day": 1,
        "title": "第一天 品德成功论",
        "subtitle": "了解品德的重要性",
        "coverColor": "#4a90e2",
        "coverEmoji": "🏔️",
        "startTime": "2025-10-11T06:59:00.000Z",
        "endTime": "2025-10-13T06:59:59.000Z",
        "dateRange": "10-11 至 10-13",
        "isPublished": true,
        "checkinCount": 180,
        "isCheckedIn": true,
        "canCheckin": false,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 100,
      "total": 23,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

**计算字段说明**:

- `isCheckedIn`: 当前用户是否已打卡（需登录）
- `canCheckin`: 是否在打卡时间范围内
- `checkinCount`: 当前课节打卡人数

### 5.2 获取课节详情

**接口**: `GET /sections/:id`

**鉴权**: 需要（查看课节内容需要报名）

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 802,
    "periodId": 8,
    "periodName": "勇敢的心",
    "day": 1,
    "title": "第一天 品德成功论",
    "subtitle": "了解品德的重要性",
    "coverColor": "#4a90e2",
    "coverEmoji": "🏔️",
    "startTime": "2025-10-11T06:59:00.000Z",
    "endTime": "2025-10-13T06:59:59.000Z",
    "dateRange": "10-11 至 10-13",
    "meditation": "开始学习之前，让我们先静下心来...",
    "question": "品德成功论和个性成功论有什么区别？",
    "content": "<p>纵观历史...</p>",
    "reflection": "哪一句话触动了我？为什么？",
    "action": "把感触记录下来...",
    "isPublished": true,
    "checkinCount": 180,
    "isCheckedIn": true,
    "canCheckin": false,
    "myCheckin": {
      "id": 1,
      "content": "今天学习了品德成功论...",
      "images": ["https://..."],
      "likeCount": 5,
      "commentCount": 3,
      "createdAt": "2025-01-13T07:30:00.000Z"
    },
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**业务规则**:

- 必须报名该期次才能查看课节内容
- 未在打卡时间范围内也可查看（复习）

**错误码**:

- `40401`: 课节不存在
- `40301`: 未报名该期次
- `40302`: 课节未发布

### 5.3 获取今日任务

**接口**: `GET /sections/today`

**鉴权**: 需要

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": 802,
      "periodId": 8,
      "periodTitle": "勇敢的心 - 七个习惯晨读营",
      "day": 1,
      "title": "第一天 品德成功论",
      "coverColor": "#4a90e2",
      "coverEmoji": "🏔️",
      "startTime": "2025-10-11T06:59:00.000Z",
      "endTime": "2025-10-13T06:59:59.000Z",
      "checkinCount": 180,
      "isCheckedIn": false,
      "canCheckin": true,
      "progress": 65
    }
  ],
  "timestamp": 1705132800000
}
```

**说明**:

- 返回当前时间在打卡范围内的所有课节
- 支持多个期次同时进行
- 如果没有今日任务，返回空数组

---

## 六、打卡相关接口

### 6.1 创建打卡

**接口**: `POST /checkins`

**鉴权**: 需要

**请求参数**:

```json
{
  "sectionId": 802,
  "content": "今天学习了品德成功论，深有感触...",
  "images": ["https://..."],
  "videos": [],
  "voices": [],
  "visibility": "all"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "打卡成功",
  "data": {
    "id": 1,
    "userId": 1,
    "userName": "阿泰",
    "userAvatar": "泰",
    "periodId": 8,
    "sectionId": 802,
    "sectionTitle": "第一天 品德成功论",
    "sectionDay": 1,
    "content": "今天学习了品德成功论，深有感触...",
    "images": ["https://..."],
    "videos": [],
    "voices": [],
    "visibility": "all",
    "likeCount": 0,
    "commentCount": 0,
    "isLiked": false,
    "status": "normal",
    "createdAt": "2025-01-13T07:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**业务规则**:

- 每个用户每个课节只能打卡一次
- 必须在打卡时间范围内
- 必须报名该期次
- content不能为空

**验证规则**:

- content: 必填，最少10字符
- images: 最多9张
- videos: 最多3个
- voices: 最多1个
- visibility: all/admin_only

**错误码**:

- `40001`: 参数验证失败
- `40301`: 未报名该期次
- `40905`: 不在打卡时间范围内
- `40906`: 已经打卡过该课节

### 6.2 获取打卡列表

**接口**: `GET /checkins`

**鉴权**: 可选

**查询参数**:

```
page: 页码（默认1）
pageSize: 每页数量（默认20）
periodId: 期次ID（可选）
sectionId: 课节ID（可选）
userId: 用户ID（可选）
visibility: 可见性（可选）
sortBy: 排序字段（默认createdAt）
order: 排序方向（默认desc）
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "userId": 1,
        "userName": "阿泰",
        "userAvatar": "泰",
        "avatarColor": "#4a90e2",
        "periodId": 8,
        "periodName": "勇敢的心",
        "sectionId": 802,
        "sectionTitle": "第一天 品德成功论",
        "sectionDay": 1,
        "content": "今天学习了品德成功论...",
        "images": ["https://..."],
        "videos": [],
        "voices": [],
        "visibility": "all",
        "likeCount": 5,
        "commentCount": 3,
        "isLiked": false,
        "status": "normal",
        "createdAt": "2025-01-13T07:30:00.000Z",
        "createTimeFormatted": "2小时前"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

**说明**:

- 未登录: 只能看到visibility=all的打卡
- 普通用户: 可以看到自己的所有打卡 + 别人visibility=all的打卡
- 管理员: 可以看到所有打卡

### 6.3 获取打卡详情

**接口**: `GET /checkins/:id`

**鉴权**: 可选

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "userId": 1,
    "userName": "阿泰",
    "userAvatar": "泰",
    "avatarColor": "#4a90e2",
    "periodId": 8,
    "periodName": "勇敢的心",
    "sectionId": 802,
    "sectionTitle": "第一天 品德成功论",
    "sectionDay": 1,
    "content": "今天学习了品德成功论...",
    "images": ["https://..."],
    "videos": [],
    "voices": [],
    "visibility": "all",
    "likeCount": 5,
    "commentCount": 3,
    "isLiked": false,
    "status": "normal",
    "hasInsight": true,
    "insight": {
      "id": 1,
      "content": "从你的分享中...",
      "visibility": "private",
      "canView": true
    },
    "comments": [
      {
        "id": 1,
        "userId": 2,
        "userName": "张三",
        "userAvatar": "张",
        "content": "写得很好！",
        "likeCount": 2,
        "replyCount": 1,
        "isLiked": false,
        "createdAt": "2025-01-13T08:00:00.000Z",
        "createTimeFormatted": "1小时前"
      }
    ],
    "createdAt": "2025-01-13T07:30:00.000Z",
    "createTimeFormatted": "2小时前"
  },
  "timestamp": 1705132800000
}
```

**错误码**:

- `40401`: 打卡不存在
- `40301`: 无权限查看

### 6.4 更新打卡

**接口**: `PATCH /checkins/:id`

**鉴权**: 需要（只能更新自己的打卡）

**请求参数**:

```json
{
  "content": "更新后的内容...",
  "visibility": "admin_only"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": 1,
    "content": "更新后的内容...",
    "visibility": "admin_only",
    "updatedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**业务规则**:

- 只能更新自己的打卡
- 不能更新images/videos/voices（需删除重新创建）
- 打卡后24小时内可以编辑

**错误码**:

- `40301`: 无权限编辑
- `40907`: 超过编辑时限

### 6.5 删除打卡

**接口**: `DELETE /checkins/:id`

**鉴权**: 需要（只能删除自己的打卡）

**响应示例**:

```json
{
  "code": 200,
  "message": "删除成功",
  "data": {
    "id": 1,
    "status": "deleted",
    "deletedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**业务规则**:

- 软删除（status = deleted）
- 删除后关联的评论、点赞等保留
- 打卡后24小时内可以删除

**错误码**:

- `40301`: 无权限删除
- `40908`: 超过删除时限

### 6.6 点赞/取消点赞打卡

**接口**: `POST /checkins/:id/like`

**鉴权**: 需要

**请求参数**:

```json
{
  "action": "like"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "点赞成功",
  "data": {
    "checkinId": 1,
    "isLiked": true,
    "likeCount": 6
  },
  "timestamp": 1705132800000
}
```

**说明**:

- action: "like" 点赞, "unlike" 取消点赞
- 重复点赞自动切换状态

---

## 七、评论相关接口

### 7.1 创建评论

**接口**: `POST /checkins/:checkinId/comments`

**鉴权**: 需要

**请求参数**:

```json
{
  "content": "写得很好！"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "评论成功",
  "data": {
    "id": 1,
    "checkinId": 1,
    "userId": 2,
    "userName": "张三",
    "userAvatar": "张",
    "avatarColor": "#4a90e2",
    "content": "写得很好！",
    "likeCount": 0,
    "replyCount": 0,
    "isLiked": false,
    "status": "normal",
    "createdAt": "2025-01-13T08:00:00.000Z",
    "createTimeFormatted": "刚刚"
  },
  "timestamp": 1705132800000
}
```

**验证规则**:

- content: 必填，1-500字符

**错误码**:

- `40001`: 参数验证失败
- `40401`: 打卡不存在

### 7.2 获取评论列表

**接口**: `GET /checkins/:checkinId/comments`

**鉴权**: 可选

**查询参数**:

```
page: 页码（默认1）
pageSize: 每页数量（默认20）
sortBy: 排序字段（默认createdAt）
order: 排序方向（默认desc）
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "checkinId": 1,
        "userId": 2,
        "userName": "张三",
        "userAvatar": "张",
        "avatarColor": "#4a90e2",
        "content": "写得很好！",
        "likeCount": 2,
        "replyCount": 1,
        "isLiked": false,
        "status": "normal",
        "replies": [
          {
            "id": 1,
            "commentId": 1,
            "userId": 1,
            "userName": "阿泰",
            "userAvatar": "泰",
            "toUserId": 2,
            "toUserName": "张三",
            "content": "谢谢你的鼓励！",
            "likeCount": 1,
            "isLiked": false,
            "createdAt": "2025-01-13T08:30:00.000Z",
            "createTimeFormatted": "30分钟前"
          }
        ],
        "createdAt": "2025-01-13T08:00:00.000Z",
        "createTimeFormatted": "1小时前"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 3,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

### 7.3 删除评论

**接口**: `DELETE /comments/:id`

**鉴权**: 需要（只能删除自己的评论）

**响应示例**:

```json
{
  "code": 200,
  "message": "删除成功",
  "data": {
    "id": 1,
    "status": "deleted",
    "deletedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 7.4 点赞/取消点赞评论

**接口**: `POST /comments/:id/like`

**鉴权**: 需要

**请求参数**:

```json
{
  "action": "like"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "点赞成功",
  "data": {
    "commentId": 1,
    "isLiked": true,
    "likeCount": 3
  },
  "timestamp": 1705132800000
}
```

---

## 八、回复相关接口

### 8.1 创建回复

**接口**: `POST /comments/:commentId/replies`

**鉴权**: 需要

**请求参数**:

```json
{
  "content": "谢谢你的鼓励！",
  "toUserId": 2
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "回复成功",
  "data": {
    "id": 1,
    "commentId": 1,
    "userId": 1,
    "userName": "阿泰",
    "userAvatar": "泰",
    "toUserId": 2,
    "toUserName": "张三",
    "content": "谢谢你的鼓励！",
    "likeCount": 0,
    "isLiked": false,
    "status": "normal",
    "createdAt": "2025-01-13T08:30:00.000Z",
    "createTimeFormatted": "刚刚"
  },
  "timestamp": 1705132800000
}
```

**验证规则**:

- content: 必填，1-500字符
- toUserId: 可选（回复评论时不填，回复回复时必填）

### 8.2 获取回复列表

**接口**: `GET /comments/:commentId/replies`

**鉴权**: 可选

**查询参数**:

```
page: 页码（默认1）
pageSize: 每页数量（默认20）
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "commentId": 1,
        "userId": 1,
        "userName": "阿泰",
        "userAvatar": "泰",
        "toUserId": 2,
        "toUserName": "张三",
        "content": "谢谢你的鼓励！",
        "likeCount": 1,
        "isLiked": false,
        "status": "normal",
        "createdAt": "2025-01-13T08:30:00.000Z",
        "createTimeFormatted": "30分钟前"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

### 8.3 删除回复

**接口**: `DELETE /replies/:id`

**鉴权**: 需要（只能删除自己的回复）

**响应示例**:

```json
{
  "code": 200,
  "message": "删除成功",
  "data": {
    "id": 1,
    "status": "deleted",
    "deletedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 8.4 点赞/取消点赞回复

**接口**: `POST /replies/:id/like`

**鉴权**: 需要

**请求参数**:

```json
{
  "action": "like"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "点赞成功",
  "data": {
    "replyId": 1,
    "isLiked": true,
    "likeCount": 2
  },
  "timestamp": 1705132800000
}
```

---

## 九、小凡看见相关接口

### 9.1 生成小凡看见

**接口**: `POST /insights`

**鉴权**: 需要

**请求参数**:

```json
{
  "checkinId": 1,
  "visibility": "private"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "生成成功",
  "data": {
    "id": 1,
    "userId": 1,
    "checkinId": 1,
    "sectionId": 802,
    "sectionTitle": "第一天 品德成功论",
    "sectionDay": 1,
    "content": "从你的分享中，小凡看见了...",
    "visibility": "private",
    "viewCount": 0,
    "requestCount": 0,
    "aiModel": "gpt-4",
    "generatedAt": "2025-01-13T07:35:00.000Z",
    "status": "normal",
    "createdAt": "2025-01-13T07:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**业务规则**:

- 每个打卡只能生成一次小凡看见
- 必须是自己的打卡
- 使用AI生成个性化反馈

**错误码**:

- `40401`: 打卡不存在
- `40301`: 无权限操作
- `40909`: 已生成过小凡看见
- `50002`: AI服务调用失败

### 9.2 获取小凡看见详情

**接口**: `GET /insights/:id`

**鉴权**: 需要

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "userId": 1,
    "userName": "阿泰",
    "userAvatar": "泰",
    "checkinId": 1,
    "sectionId": 802,
    "sectionTitle": "第一天 品德成功论",
    "sectionDay": 1,
    "content": "从你的分享中，小凡看见了...",
    "visibility": "private",
    "viewCount": 5,
    "requestCount": 2,
    "canView": true,
    "aiModel": "gpt-4",
    "generatedAt": "2025-01-13T07:35:00.000Z",
    "status": "normal",
    "createdAt": "2025-01-13T07:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**权限说明**:

- visibility=private: 只有本人可见
- visibility=friends: 需要申请并获得同意
- visibility=public: 所有人可见

**错误码**:

- `40401`: 小凡看见不存在
- `40301`: 无权限查看（需要申请）

### 9.3 获取用户的小凡看见列表

**接口**: `GET /users/me/insights`

**鉴权**: 需要

**查询参数**:

```
page: 页码（默认1）
pageSize: 每页数量（默认20）
periodId: 期次ID（可选）
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "userId": 1,
        "checkinId": 1,
        "sectionId": 802,
        "sectionTitle": "第一天 品德成功论",
        "sectionDay": 1,
        "periodId": 8,
        "periodName": "勇敢的心",
        "content": "从你的分享中，小凡看见了...",
        "preview": "从你的分享中，小凡看见了...",
        "visibility": "private",
        "viewCount": 5,
        "requestCount": 2,
        "generatedAt": "2025-01-13T07:35:00.000Z",
        "createdAt": "2025-01-13T07:35:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 15,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

### 9.4 更新小凡看见可见性

**接口**: `PATCH /insights/:id`

**鉴权**: 需要（只能更新自己的）

**请求参数**:

```json
{
  "visibility": "friends"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "id": 1,
    "visibility": "friends",
    "updatedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 9.5 申请查看小凡看见

**接口**: `POST /insights/:id/request`

**鉴权**: 需要

**请求参数**:

```json
{
  "message": "想看看你的感悟"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "申请已发送",
  "data": {
    "requestId": 1,
    "insightId": 1,
    "fromUserId": 2,
    "toUserId": 1,
    "status": "pending",
    "message": "想看看你的感悟",
    "createdAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**业务规则**:

- 只能申请visibility=friends的小凡看见
- 同一个小凡看见每个用户只能申请一次
- 本人的小凡看见不需要申请

**错误码**:

- `40910`: 无需申请（visibility=public或本人的）
- `40911`: 已申请过

### 9.6 处理查看申请

**接口**: `PATCH /insight-requests/:id`

**鉴权**: 需要（只能处理自己收到的申请）

**请求参数**:

```json
{
  "status": "approved",
  "replyMessage": "可以的"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "处理成功",
  "data": {
    "requestId": 1,
    "status": "approved",
    "replyMessage": "可以的",
    "processedAt": "2025-01-13T10:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**说明**:

- status: approved(同意) / rejected(拒绝)

### 9.7 获取收到的申请列表

**接口**: `GET /insight-requests/received`

**鉴权**: 需要

**查询参数**:

```
page: 页码（默认1）
pageSize: 每页数量（默认20）
status: 状态筛选（可选: pending/approved/rejected）
```

**响应示例**:

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "insightId": 1,
        "fromUserId": 2,
        "fromUserName": "张三",
        "fromUserAvatar": "张",
        "avatarColor": "#4a90e2",
        "toUserId": 1,
        "status": "pending",
        "message": "想看看你的感悟",
        "replyMessage": null,
        "processedAt": null,
        "createdAt": "2025-01-13T10:30:00.000Z",
        "time": "刚刚"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 5,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

---

**文档版本**: v3.0  
**最后更新**: 2025-01-13  
**文档状态**: Part 1 完成（共2部分）