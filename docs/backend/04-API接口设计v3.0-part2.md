# API接口设计 v3.0 - Part 2

## 十、文件上传接口

### 10.1 上传图片

**接口**: `POST /upload/image`

**鉴权**: 需要

**请求格式**: `multipart/form-data`

**请求参数**:
```
file: 图片文件（必填）
relatedType: 关联类型（checkin/comment/reply）
relatedId: 关联ID
```

**响应示例**:
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "fileId": 1,
    "fileName": "20251013_abc123.jpg",
    "fileUrl": "https://cos.example.com/images/20251013_abc123.jpg",
    "thumbnailUrl": "https://cos.example.com/images/thumb_20251013_abc123.jpg",
    "fileSize": 1024000,
    "width": 1920,
    "height": 1080,
    "mimeType": "image/jpeg",
    "uploadedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**限制规则**:
- 支持格式: jpg, jpeg, png, gif, webp
- 单文件最大: 10MB
- 图片尺寸: 最大4096x4096
- 自动生成缩略图（宽度800px）

**错误码**:
- `40001`: 文件格式不支持
- `40012`: 文件大小超限
- `40013`: 图片尺寸超限
- `50003`: 上传到云存储失败

### 10.2 上传视频

**接口**: `POST /upload/video`

**鉴权**: 需要

**请求格式**: `multipart/form-data`

**请求参数**:
```
file: 视频文件（必填）
relatedType: 关联类型
relatedId: 关联ID
```

**响应示例**:
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "fileId": 2,
    "fileName": "20251013_xyz789.mp4",
    "fileUrl": "https://cos.example.com/videos/20251013_xyz789.mp4",
    "thumbnailUrl": "https://cos.example.com/videos/thumb_20251013_xyz789.jpg",
    "fileSize": 50240000,
    "width": 1920,
    "height": 1080,
    "duration": 120,
    "mimeType": "video/mp4",
    "uploadedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**限制规则**:
- 支持格式: mp4, mov
- 单文件最大: 100MB
- 视频时长: 最长10分钟
- 自动生成封面图

**错误码**:
- `40001`: 文件格式不支持
- `40012`: 文件大小超限
- `40014`: 视频时长超限

### 10.3 上传音频

**接口**: `POST /upload/audio`

**鉴权**: 需要

**请求格式**: `multipart/form-data`

**请求参数**:
```
file: 音频文件（必填）
relatedType: 关联类型
relatedId: 关联ID
```

**响应示例**:
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "fileId": 3,
    "fileName": "20251013_voice123.m4a",
    "fileUrl": "https://cos.example.com/audios/20251013_voice123.m4a",
    "fileSize": 2048000,
    "duration": 60,
    "mimeType": "audio/mp4",
    "uploadedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**限制规则**:
- 支持格式: mp3, m4a, wav
- 单文件最大: 20MB
- 音频时长: 最长5分钟

**错误码**:
- `40001`: 文件格式不支持
- `40012`: 文件大小超限
- `40015`: 音频时长超限

### 10.4 删除文件

**接口**: `DELETE /files/:id`

**鉴权**: 需要（只能删除自己的文件）

**响应示例**:
```json
{
  "code": 200,
  "message": "删除成功",
  "data": {
    "fileId": 1,
    "status": "deleted",
    "deletedAt": "2025-01-13T10:30:00.000Z"
  },
  "timestamp": 1705132800000
}
```

**业务规则**:
- 软删除（status = deleted）
- 实际文件延迟7天后删除
- 关联的打卡/评论/回复保留

---

## 十一、排行榜接口

### 11.1 获取打卡排行榜

**接口**: `GET /rankings/checkins`

**鉴权**: 可选

**查询参数**:
```
periodId: 期次ID（必填）
type: 排行类型（total总打卡/streak连续打卡，默认total）
page: 页码（默认1）
pageSize: 每页数量（默认50）
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "periodId": 8,
    "periodName": "勇敢的心",
    "type": "total",
    "myRank": {
      "rank": 15,
      "userId": 1,
      "userName": "阿泰",
      "userAvatar": "泰",
      "checkinDays": 18,
      "totalDays": 23,
      "progress": 78,
      "currentStreak": 5
    },
    "items": [
      {
        "rank": 1,
        "userId": 10,
        "userName": "小明",
        "userAvatar": "明",
        "avatarColor": "#4a90e2",
        "checkinDays": 23,
        "totalDays": 23,
        "progress": 100,
        "currentStreak": 23
      },
      {
        "rank": 2,
        "userId": 20,
        "userName": "小红",
        "userAvatar": "红",
        "avatarColor": "#e24a90",
        "checkinDays": 22,
        "totalDays": 23,
        "progress": 96,
        "currentStreak": 15
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "total": 235,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

**说明**:
- type=total: 按总打卡天数排序
- type=streak: 按连续打卡天数排序
- myRank: 当前用户的排名信息（需登录）

### 11.2 获取积分排行榜

**接口**: `GET /rankings/points`

**鉴权**: 可选

**查询参数**:
```
page: 页码（默认1）
pageSize: 每页数量（默认50）
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "myRank": {
      "rank": 28,
      "userId": 1,
      "userName": "阿泰",
      "userAvatar": "泰",
      "totalPoints": 500,
      "level": 1
    },
    "items": [
      {
        "rank": 1,
        "userId": 10,
        "userName": "小明",
        "userAvatar": "明",
        "avatarColor": "#4a90e2",
        "totalPoints": 2500,
        "level": 5,
        "totalCheckinDays": 150,
        "totalCompletedPeriods": 5
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "total": 500,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

---

## 十二、通知接口

### 12.1 获取通知列表

**接口**: `GET /notifications`

**鉴权**: 需要

**查询参数**:
```
page: 页码（默认1）
pageSize: 每页数量（默认20）
type: 类型筛选（可选: like/comment/reply/insight_request/system）
isRead: 是否已读（可选: true/false）
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "unreadCount": 5,
    "items": [
      {
        "id": 1,
        "type": "like",
        "title": "点赞通知",
        "content": "张三 赞了你的打卡",
        "relatedType": "checkin",
        "relatedId": 1,
        "fromUser": {
          "userId": 2,
          "userName": "张三",
          "userAvatar": "张"
        },
        "isRead": false,
        "createdAt": "2025-01-13T10:30:00.000Z",
        "time": "5分钟前"
      },
      {
        "id": 2,
        "type": "comment",
        "title": "评论通知",
        "content": "李四 评论了你的打卡",
        "relatedType": "checkin",
        "relatedId": 1,
        "fromUser": {
          "userId": 3,
          "userName": "李四",
          "userAvatar": "李"
        },
        "isRead": false,
        "createdAt": "2025-01-13T10:25:00.000Z",
        "time": "10分钟前"
      },
      {
        "id": 3,
        "type": "insight_request",
        "title": "小凡看见申请",
        "content": "王五 想查看你的小凡看见",
        "relatedType": "insight_request",
        "relatedId": 1,
        "fromUser": {
          "userId": 4,
          "userName": "王五",
          "userAvatar": "王"
        },
        "isRead": true,
        "createdAt": "2025-01-13T09:00:00.000Z",
        "time": "1小时前"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 25,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

**通知类型**:
- `like`: 点赞通知
- `comment`: 评论通知
- `reply`: 回复通知
- `insight_request`: 小凡看见查看申请
- `system`: 系统通知

### 12.2 标记通知已读

**接口**: `PATCH /notifications/:id/read`

**鉴权**: 需要

**响应示例**:
```json
{
  "code": 200,
  "message": "标记成功",
  "data": {
    "notificationId": 1,
    "isRead": true,
    "readAt": "2025-01-13T10:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 12.3 标记所有通知已读

**接口**: `PATCH /notifications/read-all`

**鉴权**: 需要

**响应示例**:
```json
{
  "code": 200,
  "message": "标记成功",
  "data": {
    "readCount": 5,
    "readAt": "2025-01-13T10:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 12.4 获取未读数量

**接口**: `GET /notifications/unread-count`

**鉴权**: 需要

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 5,
    "byType": {
      "like": 2,
      "comment": 1,
      "reply": 0,
      "insight_request": 2,
      "system": 0
    }
  },
  "timestamp": 1705132800000
}
```

---

## 十三、管理员接口

### 13.1 获取用户列表

**接口**: `GET /admin/users`

**鉴权**: 需要（管理员）

**查询参数**:
```
page: 页码（默认1）
pageSize: 每页数量（默认20）
search: 搜索关键词（昵称/openid）
role: 角色筛选
status: 状态筛选
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
        "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
        "nickname": "阿泰",
        "avatar": "泰",
        "role": "user",
        "status": "active",
        "totalCheckinDays": 23,
        "totalPoints": 500,
        "lastLoginAt": "2025-01-13T10:30:00.000Z",
        "createdAt": "2025-01-10T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 500,
      "totalPages": 25,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

### 13.2 更新用户状态

**接口**: `PATCH /admin/users/:id/status`

**鉴权**: 需要（管理员）

**请求参数**:
```json
{
  "status": "banned",
  "reason": "违规内容"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "userId": 1,
    "status": "banned",
    "reason": "违规内容",
    "updatedAt": "2025-01-13T10:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 13.3 创建/编辑期次

**接口**: `POST /admin/periods` (创建) / `PUT /admin/periods/:id` (编辑)

**鉴权**: 需要（管理员）

**请求参数**:
```json
{
  "name": "勇敢的心",
  "subtitle": "七个习惯晨读营",
  "title": "勇敢的心 - 七个习惯晨读营",
  "description": "21天养成阅读习惯...",
  "icon": "⛰️",
  "coverColor": "linear-gradient(135deg, #4a90e2 0%, #357abd 100%)",
  "coverEmoji": "🏔️",
  "startDate": "2025-10-11",
  "endDate": "2025-11-13",
  "totalDays": 23,
  "price": 99.00,
  "originalPrice": 199.00,
  "maxEnrollment": 500,
  "isPublished": true,
  "sortOrder": 100
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 9,
    "name": "勇敢的心",
    "status": "not_started",
    "isPublished": true,
    "createdAt": "2025-01-13T10:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 13.4 创建/编辑课节

**接口**: `POST /admin/sections` (创建) / `PUT /admin/sections/:id` (编辑)

**鉴权**: 需要（管理员）

**请求参数**:
```json
{
  "periodId": 8,
  "day": 1,
  "title": "第一天 品德成功论",
  "subtitle": "了解品德的重要性",
  "coverColor": "#4a90e2",
  "coverEmoji": "🏔️",
  "startTime": "2025-10-11T06:59:00.000Z",
  "endTime": "2025-10-13T06:59:59.000Z",
  "meditation": "开始学习之前...",
  "question": "品德成功论和个性成功论有什么区别？",
  "content": "<p>纵观历史...</p>",
  "reflection": "哪一句话触动了我？",
  "action": "把感触记录下来...",
  "isPublished": true,
  "sortOrder": 1
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 825,
    "periodId": 8,
    "day": 1,
    "title": "第一天 品德成功论",
    "isPublished": true,
    "createdAt": "2025-01-13T10:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 13.5 获取打卡审核列表

**接口**: `GET /admin/checkins/review`

**鉴权**: 需要（管理员）

**查询参数**:
```
page: 页码（默认1）
pageSize: 每页数量（默认20）
visibility: 可见性筛选
status: 状态筛选
periodId: 期次ID筛选
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
        "periodName": "勇敢的心",
        "sectionTitle": "第一天 品德成功论",
        "content": "今天学习了...",
        "visibility": "admin_only",
        "status": "normal",
        "createdAt": "2025-01-13T07:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": 1705132800000
}
```

### 13.6 隐藏/删除打卡

**接口**: `PATCH /admin/checkins/:id/status`

**鉴权**: 需要（管理员）

**请求参数**:
```json
{
  "status": "hidden",
  "reason": "内容不当"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {
    "checkinId": 1,
    "status": "hidden",
    "reason": "内容不当",
    "updatedAt": "2025-01-13T10:35:00.000Z"
  },
  "timestamp": 1705132800000
}
```

### 13.7 获取系统统计

**接口**: `GET /admin/stats`

**鉴权**: 需要（管理员）

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "users": {
      "total": 500,
      "active": 480,
      "banned": 15,
      "deleted": 5,
      "newToday": 10,
      "newThisWeek": 50,
      "newThisMonth": 150
    },
    "periods": {
      "total": 8,
      "notStarted": 2,
      "ongoing": 3,
      "completed": 3
    },
    "checkins": {
      "total": 12000,
      "today": 200,
      "thisWeek": 1500,
      "thisMonth": 6000
    },
    "enrollments": {
      "total": 2000,
      "active": 1500,
      "completed": 450,
      "cancelled": 50
    },
    "insights": {
      "total": 5000,
      "today": 50,
      "thisWeek": 400,
      "thisMonth": 1800
    }
  },
  "timestamp": 1705132800000
}
```

---

## 十四、错误码定义

### 14.1 错误码规范

错误码格式: `XYZAA`
- X: 错误类别（4=客户端错误, 5=服务器错误）
- YZ: 错误子类
- AA: 具体错误序号

### 14.2 客户端错误 (4xxxx)

#### 通用错误 (400xx)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 40001 | 参数验证失败 | 400 |
| 40002 | 请求格式错误 | 400 |
| 40003 | 缺少必填参数 | 400 |
| 40004 | 参数类型错误 | 400 |
| 40005 | 参数值超出范围 | 400 |
| 40006 | 参数格式不正确 | 400 |
| 40007 | 日期格式错误 | 400 |
| 40008 | 枚举值不合法 | 400 |
| 40009 | JSON解析失败 | 400 |
| 40010 | 请求体过大 | 413 |
| 40011 | URL长度超限 | 414 |
| 40012 | 文件大小超限 | 413 |
| 40013 | 图片尺寸超限 | 400 |
| 40014 | 视频时长超限 | 400 |
| 40015 | 音频时长超限 | 400 |

#### 认证错误 (401xx)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 40101 | Token已过期 | 401 |
| 40102 | Token无效 | 401 |
| 40103 | Token缺失 | 401 |
| 40104 | Token格式错误 | 401 |
| 40105 | 签名验证失败 | 401 |
| 40106 | 刷新Token无效 | 401 |

#### 权限错误 (403xx)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 40301 | 无权限访问 | 403 |
| 40302 | 未报名该期次 | 403 |
| 40303 | 期次未发布 | 403 |
| 40304 | 课节未发布 | 403 |
| 40305 | 无权限编辑 | 403 |
| 40306 | 无权限删除 | 403 |
| 40307 | 无权限查看 | 403 |
| 40308 | 管理员权限不足 | 403 |

#### 资源不存在 (404xx)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 40401 | 资源不存在 | 404 |
| 40402 | 用户不存在 | 404 |
| 40403 | 期次不存在 | 404 |
| 40404 | 课节不存在 | 404 |
| 40405 | 打卡不存在 | 404 |
| 40406 | 评论不存在 | 404 |
| 40407 | 回复不存在 | 404 |
| 40408 | 小凡看见不存在 | 404 |
| 40409 | 文件不存在 | 404 |
| 40410 | 路由不存在 | 404 |

#### 业务逻辑错误 (409xx)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 40901 | 资源已存在 | 409 |
| 40902 | 期次已结束 | 409 |
| 40903 | 报名人数已满 | 409 |
| 40904 | 不允许取消报名 | 409 |
| 40905 | 不在打卡时间范围 | 409 |
| 40906 | 已打卡过该课节 | 409 |
| 40907 | 超过编辑时限 | 409 |
| 40908 | 超过删除时限 | 409 |
| 40909 | 已生成小凡看见 | 409 |
| 40910 | 无需申请查看 | 409 |
| 40911 | 已申请过 | 409 |
| 40912 | 状态不允许操作 | 409 |
| 40913 | 重复操作 | 409 |
| 40914 | 昵称已被使用 | 409 |

#### 频率限制 (429xx)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 42901 | 请求过于频繁 | 429 |
| 42902 | IP被限流 | 429 |
| 42903 | 用户被限流 | 429 |

### 14.3 服务器错误 (5xxxx)

#### 微信相关错误 (500xx)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 50001 | 用户已被封禁 | 403 |
| 50002 | AI服务调用失败 | 500 |
| 50003 | 云存储服务失败 | 500 |
| 50004 | 支付服务失败 | 500 |
| 50005 | 短信服务失败 | 500 |

#### 系统错误 (500xx)

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 50101 | 服务器内部错误 | 500 |
| 50102 | 数据库错误 | 500 |
| 50103 | Redis错误 | 500 |
| 50104 | 文件系统错误 | 500 |
| 50105 | 网络请求失败 | 500 |
| 50106 | 第三方服务错误 | 500 |
| 50107 | 配置错误 | 500 |
| 50108 | 系统维护中 | 503 |

### 14.4 错误响应示例

```json
{
  "code": 40906,
  "message": "已打卡过该课节",
  "error": {
    "type": "DUPLICATE_CHECKIN",
    "details": {
      "sectionId": 802,
      "existingCheckinId": 1,
      "checkinTime": "2025-01-13T07:30:00.000Z"
    }
  },
  "timestamp": 1705132800000,
  "requestId": "req_abc123xyz"
}
```

```json
{
  "code": 40001,
  "message": "参数验证失败",
  "error": {
    "type": "VALIDATION_ERROR",
    "details": [
      {
        "field": "nickname",
        "value": "a",
        "message": "昵称长度必须在2-50个字符之间",
        "rule": "length",
        "params": { "min": 2, "max": 50 }
      },
      {
        "field": "content",
        "message": "打卡内容不能为空",
        "rule": "required"
      }
    ]
  },
  "timestamp": 1705132800000,
  "requestId": "req_def456uvw"
}
```

---

## 十五、API调用示例

### 15.1 完整打卡流程示例

```javascript
// 1. 微信登录
const loginRes = await fetch('https://api.example.com/api/v1/auth/wechat/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'wx_code_123' })
});
const { data: { accessToken } } = await loginRes.json();

// 2. 获取今日任务
const todayRes = await fetch('https://api.example.com/api/v1/sections/today', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
const { data: todaySections } = await todayRes.json();

// 3. 上传图片
const formData = new FormData();
formData.append('file', imageFile);
formData.append('relatedType', 'checkin');

const uploadRes = await fetch('https://api.example.com/api/v1/upload/image', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: formData
});
const { data: { fileUrl } } = await uploadRes.json();

// 4. 创建打卡
const checkinRes = await fetch('https://api.example.com/api/v1/checkins', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    sectionId: 802,
    content: '今天学习了品德成功论...',
    images: [fileUrl],
    visibility: 'all'
  })
});
const { data: checkin } = await checkinRes.json();

// 5. 生成小凡看见
const insightRes = await fetch('https://api.example.com/api/v1/insights', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    checkinId: checkin.id,
    visibility: 'private'
  })
});
const { data: insight } = await insightRes.json();
```

### 15.2 错误处理示例

```javascript
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
        ...options.headers
      }
    });

    const result = await response.json();

    // 检查业务错误码
    if (result.code !== 200) {
      switch (result.code) {
        case 40101: // Token过期
          await refreshToken();
          return apiRequest(url, options); // 重试
        
        case 40301: // 无权限
          showToast('无权限访问');
          navigateToLogin();
          break;
        
        case 40906: // 已打卡
          showToast('您已打卡过该课节');
          break;
        
        case 42901: // 请求过于频繁
          showToast('操作过于频繁，请稍后再试');
          break;
        
        default:
          showToast(result.message || '请求失败');
      }
      throw new Error(result.message);
    }

    return result.data;
  } catch (error) {
    console.error('API request failed:', error);
    showToast('网络请求失败，请检查网络连接');
    throw error;
  }
}
```

---

## 十六、API版本管理

### 16.1 版本策略

- 当前版本: v1
- URL格式: `/api/v1/...`
- 向后兼容原则
- 重大变更才升级版本号

### 16.2 版本废弃通知

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "deprecation": {
    "version": "v1",
    "sunset": "2026-01-01",
    "link": "https://docs.example.com/api/v2/migration"
  },
  "timestamp": 1705132800000
}
```

---

## 十七、性能优化建议

### 17.1 缓存策略

```javascript
// 使用ETags进行条件请求
const response = await fetch('/api/v1/periods', {
  headers: {
    'If-None-Match': cachedETag
  }
});

if (response.status === 304) {
  // 使用缓存数据
  return cachedData;
}
```

### 17.2 批量请求

```javascript
// 批量获取用户信息
POST /api/v1/users/batch
{
  "userIds": [1, 2, 3, 4, 5]
}

// 响应
{
  "code": 200,
  "data": {
    "users": {
      "1": { ... },
      "2": { ... },
      ...
    }
  }
}
```

### 17.3 字段投影

```javascript
// 只获取需要的字段
GET /api/v1/checkins?fields=id,content,likeCount,createdAt

// 响应只包含指定字段
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 1,
        "content": "...",
        "likeCount": 5,
        "createdAt": "2025-01-13T07:30:00.000Z"
      }
    ]
  }
}
```

---

## 附录：接口清单

### A.1 认证接口 (2个)
- POST /auth/wechat/login - 微信登录
- POST /auth/refresh - 刷新Token

### A.2 用户接口 (4个)
- GET /users/me - 获取当前用户信息
- PATCH /users/me - 更新用户信息
- GET /users/me/stats - 获取用户统计
- GET /users/:userId/checkins - 获取用户打卡列表

### A.3 期次接口 (4个)
- GET /periods - 获取期次列表
- GET /periods/:id - 获取期次详情
- POST /periods/:id/enroll - 报名期次
- DELETE /periods/:id/enroll - 取消报名

### A.4 课节接口 (3个)
- GET /periods/:periodId/sections - 获取课节列表
- GET /sections/:id - 获取课节详情
- GET /sections/today - 获取今日任务

### A.5 打卡接口 (6个)
- POST /checkins - 创建打卡
- GET /checkins - 获取打卡列表
- GET /checkins/:id - 获取打卡详情
- PATCH /checkins/:id - 更新打卡
- DELETE /checkins/:id - 删除打卡
- POST /checkins/:id/like - 点赞/取消点赞

### A.6 评论接口 (4个)
- POST /checkins/:checkinId/comments - 创建评论
- GET /checkins/:checkinId/comments - 获取评论列表
- DELETE /comments/:id - 删除评论
- POST /comments/:id/like - 点赞/取消点赞

### A.7 回复接口 (4个)
- POST /comments/:commentId/replies - 创建回复
- GET /comments/:commentId/replies - 获取回复列表
- DELETE /replies/:id - 删除回复
- POST /replies/:id/like - 点赞/取消点赞

### A.8 小凡看见接口 (7个)
- POST /insights - 生成小凡看见
- GET /insights/:id - 获取详情
- GET /users/me/insights - 获取列表
- PATCH /insights/:id - 更新可见性
- POST /insights/:id/request - 申请查看
- PATCH /insight-requests/:id - 处理申请
- GET /insight-requests/received - 获取收到的申请

### A.9 文件接口 (4个)
- POST /upload/image - 上传图片
- POST /upload/video - 上传视频
- POST /upload/audio - 上传音频
- DELETE /files/:id - 删除文件

### A.10 排行榜接口 (2个)
- GET /rankings/checkins - 打卡排行榜
- GET /rankings/points - 积分排行榜

### A.11 通知接口 (4个)
- GET /notifications - 获取通知列表
- PATCH /notifications/:id/read - 标记已读
- PATCH /notifications/read-all - 全部标记已读
- GET /notifications/unread-count - 未读数量

### A.12 管理员接口 (7个)
- GET /admin/users - 用户列表
- PATCH /admin/users/:id/status - 更新用户状态
- POST /admin/periods - 创建期次
- PUT /admin/periods/:id - 编辑期次
- POST /admin/sections - 创建课节
- PUT /admin/sections/:id - 编辑课节
- GET /admin/checkins/review - 打卡审核列表
- PATCH /admin/checkins/:id/status - 隐藏/删除打卡
- GET /admin/stats - 系统统计

**总计: 56个API接口**

---

**文档版本**: v3.0  
**最后更新**: 2025-01-13  
**文档状态**: 已完成

