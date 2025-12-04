# 实时通知系统指南

## 📋 概述

实时通知系统为用户提供关于"小凡看见"查看申请的实时消息通知。当发生以下事件时，系统会自动创建通知：

1. **收到新申请** - 用户收到他人的查看申请
2. **申请被批准** - 用户的申请被对方同意
3. **申请被拒绝** - 用户的申请被对方拒绝
4. **权限被撤销** - 用户之前获得的权限被撤销
5. **管理员批准** - 管理员批准了用户的申请
6. **管理员拒绝** - 管理员拒绝了用户的申请

## 🎯 核心功能

### 通知类型

| 类型 | 含义 | 接收者 | 触发条件 |
|------|------|--------|--------|
| `request_created` | 新申请 | toUserId | 新申请创建 |
| `request_approved` | 申请被同意 | fromUserId | 用户同意申请 |
| `request_rejected` | 申请被拒绝 | fromUserId | 用户拒绝申请 |
| `permission_revoked` | 权限被撤销 | fromUserId | 用户撤销权限 |
| `admin_approved` | 管理员批准 | fromUserId | 管理员批准申请 |
| `admin_rejected` | 管理员拒绝 | fromUserId | 管理员拒绝申请 |

## 📊 数据模型

### Notification 模型

```javascript
{
  _id: ObjectId,

  // 接收通知的用户
  userId: ObjectId (ref: User),

  // 通知类型
  type: String (enum: ['request_created', 'request_approved', ...]),

  // 标题和内容
  title: String,           // "收到新的小凡看见查看申请"
  content: String,         // "张三 申请查看你的小凡看见"

  // 关联数据
  requestId: ObjectId (ref: InsightRequest, optional),
  senderId: ObjectId (ref: User, optional),

  // 已读状态
  isRead: Boolean,
  readAt: Date (optional),

  // 额外数据
  data: {
    senderName: String,      // 发送者昵称
    senderAvatar: String,    // 发送者头像
    fromUserName: String,    // 申请者昵称
    toUserName: String,      // 被申请者昵称
    periodName: String,      // 期次名称
    reason: String           // 拒绝原因
  },

  // 时间戳
  createdAt: Date,
  updatedAt: Date
}
```

## 🚀 API 文档

### 1. 获取用户通知列表

```
GET /api/v1/notifications?page=1&limit=20&isRead=all

认证: 必需 (authMiddleware)

查询参数:
  page: 页码（默认1）
  limit: 每页条数（默认20）
  isRead: 过滤已读状态
    - 'all': 所有通知
    - 'true': 仅已读
    - 'false': 仅未读

响应 200:
{
  "code": 200,
  "data": {
    "notifications": [
      {
        "_id": "notif_123",
        "userId": "user_abc",
        "type": "request_created",
        "title": "收到新的小凡看见查看申请",
        "content": "张三 申请查看你的小凡看见",
        "requestId": "req_456",
        "senderId": "user_xyz",
        "isRead": false,
        "readAt": null,
        "data": {
          "senderName": "张三",
          "senderAvatar": "url...",
          "fromUserName": "张三"
        },
        "createdAt": "2025-12-04T10:30:00.000Z",
        "updatedAt": "2025-12-04T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  },
  "message": "获取成功"
}
```

### 2. 获取未读通知数量

```
GET /api/v1/notifications/unread

认证: 必需 (authMiddleware)

响应 200:
{
  "code": 200,
  "data": {
    "unreadCount": 5
  },
  "message": "获取成功"
}
```

### 3. 标记单个通知为已读

```
PUT /api/v1/notifications/:notificationId/read

认证: 必需 (authMiddleware)

响应 200:
{
  "code": 200,
  "data": {
    "_id": "notif_123",
    "isRead": true,
    "readAt": "2025-12-04T10:35:00.000Z"
  },
  "message": "已标记为已读"
}
```

### 4. 标记所有通知为已读

```
PUT /api/v1/notifications/read-all

认证: 必需 (authMiddleware)

响应 200:
{
  "code": 200,
  "data": {
    "modifiedCount": 5
  },
  "message": "已标记 5 条通知为已读"
}
```

### 5. 删除单个通知

```
DELETE /api/v1/notifications/:notificationId

认证: 必需 (authMiddleware)

响应 200:
{
  "code": 200,
  "data": null,
  "message": "通知已删除"
}
```

### 6. 删除所有通知

```
DELETE /api/v1/notifications

认证: 必需 (authMiddleware)

响应 200:
{
  "code": 200,
  "data": {
    "deletedCount": 42
  },
  "message": "已删除 42 条通知"
}
```

## 🔄 自动触发场景

### 1. 创建查看申请时

**API**: `POST /insights/requests`

**触发**:
- 创建 `request_created` 通知
- 接收者: 被申请者 (toUserId)
- 发送者: 申请者 (fromUserId)

**通知内容**:
```
标题: 收到新的小凡看见查看申请
内容: {申请者昵称} 申请查看你的小凡看见
```

### 2. 用户批准申请时

**API**: `PUT /insights/requests/:id/approve`

**触发**:
- 创建 `request_approved` 通知
- 接收者: 申请者 (fromUserId)
- 发送者: 被申请者 (toUserId)

**通知内容**:
```
标题: 小凡看见查看申请已批准
内容: {被申请者昵称} 同意了你的查看申请，允许查看 {期次名称} 的小凡看见
```

### 3. 用户拒绝申请时

**API**: `PUT /insights/requests/:id/reject`

**触发**:
- 创建 `request_rejected` 通知
- 接收者: 申请者 (fromUserId)
- 发送者: 被申请者 (toUserId)

**通知内容**:
```
标题: 小凡看见查看申请已被拒绝
内容: {被申请者昵称} 拒绝了你的查看申请
```

### 4. 用户撤销权限时

**API**: `PUT /insights/requests/:id/revoke`

**触发**:
- 创建 `permission_revoked` 通知
- 接收者: 申请者 (fromUserId)
- 发送者: 被申请者 (toUserId)

**通知内容**:
```
标题: 小凡看见查看权限已被撤销
内容: {被申请者昵称} 撤销了你的小凡看见查看权限
```

### 5. 管理员批准申请时

**API**: `PUT /admin/insights/requests/:id/approve`

**触发**:
- 创建 `admin_approved` 通知
- 接收者: 申请者 (fromUserId)
- 发送者: 管理员系统

**通知内容**:
```
标题: 小凡看见查看申请已由管理员批准
内容: 管理员已批准你的查看申请，允许查看 {期次名称} 的小凡看见
```

### 6. 管理员拒绝申请时

**API**: `PUT /admin/insights/requests/:id/reject`

**触发**:
- 创建 `admin_rejected` 通知
- 接收者: 申请者 (fromUserId)
- 发送者: 管理员系统

**通知内容**:
```
标题: 小凡看见查看申请已由管理员拒绝
内容: 管理员已拒绝你的查看申请
```

## 🧪 测试场景

### 场景1: 完整的申请→批准→撤销流程

```bash
# 1. 创建申请（user_a 申请查看 user_b 的小凡看见）
curl -X POST http://localhost:3000/api/v1/insights/requests \
  -H "Authorization: Bearer <user_a_token>" \
  -H "Content-Type: application/json" \
  -d '{"toUserId":"user_b_id"}'

# 此时 user_b 应收到 request_created 通知

# 2. user_b 获取通知列表
curl -X GET http://localhost:3000/api/v1/notifications \
  -H "Authorization: Bearer <user_b_token>"

# 3. user_b 批准申请
curl -X PUT http://localhost:3000/api/v1/insights/requests/<request_id>/approve \
  -H "Authorization: Bearer <user_b_token>" \
  -H "Content-Type: application/json" \
  -d '{"periodId":"<period_id>"}'

# 此时 user_a 应收到 request_approved 通知

# 4. user_a 获取未读通知数
curl -X GET http://localhost:3000/api/v1/notifications/unread \
  -H "Authorization: Bearer <user_a_token>"

# 5. user_a 标记通知为已读
curl -X PUT http://localhost:3000/api/v1/notifications/<notif_id>/read \
  -H "Authorization: Bearer <user_a_token>"

# 6. user_b 撤销权限
curl -X PUT http://localhost:3000/api/v1/insights/requests/<request_id>/revoke \
  -H "Authorization: Bearer <user_b_token>"

# 此时 user_a 应收到 permission_revoked 通知
```

## 📈 性能优化

### 索引

已添加以下索引以优化查询性能:

```javascript
// 查询某用户的通知
{ userId: 1, createdAt: -1 }

// 查询某用户的未读通知
{ userId: 1, isRead: 1 }

// 按创建时间排序
{ createdAt: -1 }
```

### 分页

所有列表查询都支持分页，默认限制为20条记录，最大可以调整。

## 🔐 安全性

### 权限检查

- ✅ 用户只能查看自己的通知
- ✅ 用户只能删除或标记自己的通知
- ✅ 通知数据只返回给接收者

### 数据保护

- ✅ 使用 `userId` 隔离用户数据
- ✅ 敏感信息（如拒绝原因）可选择性包含
- ✅ 所有操作都记录在审计日志中

## 🔄 清理策略

建议定期清理过期通知：

```javascript
// 清理30天前的已读通知（可以定期运行此cron任务）
db.notifications.deleteMany({
  isRead: true,
  readAt: { $lt: new Date(Date.now() - 30*24*60*60*1000) }
})
```

## 📱 前端集成（小程序）

后续步骤（详见另一份文档）:

1. 在首页显示未读通知徽章
2. 创建通知页面显示所有通知
3. 点击通知跳转到相关申请或用户
4. 支持批量标记为已读
5. 支持删除单个或多个通知

## 🚨 常见问题

### Q: 如何确保通知的实时性？

A: 系统在操作发生时即刻创建通知。对于真正的实时推送，前端可以定期轮询 `/notifications/unread` 或使用 WebSocket（待实现）。

### Q: 删除了通知，还能找回吗？

A: 不能。删除是永久的。如果需要保留历史，建议不要删除，而是标记为已读。

### Q: 如何处理大量通知？

A: 建议使用分页查询，默认20条/页。可以定期清理过期通知。

### Q: 通知什么时候会自动删除？

A: 系统不会自动删除，需要手动删除或通过 cron 任务定期清理。

## 📚 相关文档

- 权限管理指南: `.claude/memory/standards/permission-management-guide.md`
- 申请流程设计: `.claude/memory/standards/insight-request-design.md`
- API 测试脚本: `.claude/commands/testing/test-all-apis.sh`

---

**最后更新**: 2025-12-04
**维护者**: Claude Code
**状态**: 后端实现完成，待前端集成
