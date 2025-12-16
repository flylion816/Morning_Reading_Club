# 权限管理增强功能指南

## 📋 概述

权限管理增强功能为"小凡看见"查看申请系统添加了两个关键功能：

1. **权限撤销** - 已授予访问权限的用户可以撤销之前的同意
2. **管理删除** - 系统管理员可以删除任何查看申请记录

## 🎯 核心功能

### 1. 权限撤销 (Permission Revocation)

**目的**: 允许被申请者（toUserId）随时撤销已经批准的查看权限

**API 端点**:

```
PUT /api/v1/insights/requests/:requestId/revoke
```

**请求参数**: 无（通过 URL 路径参数传递 requestId）

**响应示例**:

```json
{
  "code": 200,
  "data": {
    "_id": "req_123",
    "fromUserId": "user_456",
    "toUserId": "user_789",
    "status": "revoked",
    "revokedAt": "2025-12-04T10:30:00.000Z",
    "auditLog": [
      {
        "action": "create",
        "actor": "user_456",
        "actorType": "user",
        "timestamp": "2025-12-04T10:25:00.000Z"
      },
      {
        "action": "approve",
        "actor": "user_789",
        "actorType": "user",
        "timestamp": "2025-12-04T10:28:00.000Z"
      },
      {
        "action": "revoke",
        "actor": "user_789",
        "actorType": "user",
        "timestamp": "2025-12-04T10:30:00.000Z"
      }
    ]
  },
  "message": "已撤销查看权限"
}
```

**权限检查**:

- ✅ 只有被申请者（toUserId）可以撤销权限
- ✅ 只能撤销已批准（status: 'approved'）的申请
- ✅ 撤销后状态变为 'revoked'，无法恢复为 'approved'

**使用场景**:

- 用户感觉隐私受到威胁，想撤销之前给予的访问权限
- 用户与某人关系变化，需要撤销权限
- 定期清理不需要的权限授予

### 2. 管理删除 (Admin Deletion)

**目的**: 允许系统管理员删除任何查看申请记录

**API 端点**:

```
DELETE /api/v1/admin/insights/requests/:requestId
```

**请求参数**:

```json
{
  "adminNote": "删除原因（可选）"
}
```

**响应示例**:

```json
{
  "code": 200,
  "data": null,
  "message": "申请已删除"
}
```

**权限检查**:

- ✅ 只有管理员（adminAuthMiddleware）可以删除
- ✅ 可以删除任何状态的申请（pending、approved、rejected、revoked）
- ✅ 删除操作会被记录到审计日志（在删除前保存）

**使用场景**:

- 清理系统中的垃圾或重复申请
- 违规用户的申请记录删除
- 数据维护和清理

## 📊 数据模型变化

### InsightRequest 模型更新

**新增字段**:

```javascript
// 权限撤销时间戳
revokedAt: {
  type: Date,
  default: null
}
```

**状态枚举更新**:

```javascript
// 从 ['pending', 'approved', 'rejected']
// 更新为 ['pending', 'approved', 'rejected', 'revoked']
```

**审计日志操作更新**:

```javascript
// 新增操作类型
enum: ['create', 'approve', 'reject', 'admin_approve', 'admin_reject', 'revoke', 'admin_delete'];
```

## 🚀 前端集成

### 删除按钮

在管理后台的申请列表中，每行都有一个"删除"按钮：

```vue
<el-button type="danger" size="small" text @click="handleDeleteRequest(row)">
  删除
</el-button>
```

**删除流程**:

1. 用户点击"删除"按钮
2. 弹出确认对话框："确认删除此申请吗？此操作不可恢复"
3. 用户确认后调用 API：`DELETE /admin/insights/requests/:id`
4. 成功后刷新列表和统计数据

### 状态过滤

筛选下拉菜单中新增"已撤销"选项：

```
- 待审批 (pending)
- 已同意 (approved)
- 已拒绝 (rejected)
- 已撤销 (revoked)  ← 新增
- 全部 (all)
```

### 状态标签

详情对话框中的审计日志显示新的操作标签：

- `admin_delete` → "管理员删除"
- `revoke` → "撤销权限"

## 🔐 安全性考虑

### 权限撤销的安全性

1. **用户隐私保护**: 用户可以随时撤销权限，不受任何限制
2. **完整审计日志**: 每次撤销都会被记录，管理员可查询
3. **状态不可逆**: 一旦撤销，无法自动恢复为已批准状态，需要重新申请

### 删除操作的安全性

1. **管理员级别权限**: 仅管理员可删除，确保一般用户无法删除记录
2. **删除前审计记录**: 删除前会保存到审计日志，保留操作痕迹
3. **不可恢复**: 删除后无法恢复，管理员应谨慎操作
4. **确认对话框**: 删除前有确认提示，防止误操作

## 📋 完整 API 文档

### 用户权限撤销

```
PUT /api/v1/insights/requests/:requestId/revoke

认证: 必需 (authMiddleware)
权限: 仅被申请者可撤销

请求体:
  无

响应 200:
{
  code: 200,
  data: InsightRequest,
  message: '已撤销查看权限'
}

响应 400 (只能撤销已批准的申请):
{
  code: 400,
  message: '只能撤销已批准的申请'
}

响应 403 (无权撤销):
{
  code: 403,
  message: '无权撤销权限'
}

响应 404 (申请不存在):
{
  code: 404,
  message: '申请不存在'
}
```

### 管理员删除申请

```
DELETE /api/v1/admin/insights/requests/:requestId

认证: 必需 (adminAuthMiddleware)
权限: 仅管理员可删除

请求体:
{
  "adminNote": "删除原因（可选）"
}

响应 200:
{
  code: 200,
  data: null,
  message: '申请已删除'
}

响应 404 (申请不存在):
{
  code: 404,
  message: '申请不存在'
}
```

## 🧪 测试场景

### 权限撤销测试

```bash
# 1. 创建申请
curl -X POST http://localhost:3000/api/v1/insights/requests \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{"toUserId":"user_id_2"}'

# 2. 获取申请ID（从收到的申请中）
curl -X GET http://localhost:3000/api/v1/insights/requests/received \
  -H "Authorization: Bearer <user_2_token>"

# 3. 同意申请
curl -X PUT http://localhost:3000/api/v1/insights/requests/<request_id>/approve \
  -H "Authorization: Bearer <user_2_token>" \
  -H "Content-Type: application/json" \
  -d '{"periodId":"period_id"}'

# 4. 撤销权限
curl -X PUT http://localhost:3000/api/v1/insights/requests/<request_id>/revoke \
  -H "Authorization: Bearer <user_2_token>"
```

### 删除申请测试

```bash
# 1. 获取申请ID（从管理后台列表中）
curl -X GET http://localhost:3000/api/v1/admin/insights/requests \
  -H "Authorization: Bearer <admin_token>"

# 2. 删除申请
curl -X DELETE http://localhost:3000/api/v1/admin/insights/requests/<request_id> \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"adminNote":"违规删除"}'

# 3. 验证删除
curl -X GET http://localhost:3000/api/v1/admin/insights/requests \
  -H "Authorization: Bearer <admin_token>"
```

## 📈 统计数据更新

`GET /admin/insights/requests/stats` 统计接口现在包含：

- 新增"已撤销"(revoked) 状态的计数
- 平均响应时间仍基于 pending → (approved | rejected) 的转变

## ⚡ 性能考虑

- **删除操作**: 先保存审计日志（写入），再删除记录（写入），共2次数据库写入
- **撤销操作**: 仅更新状态和时间戳（1次写入）
- **查询优化**: 现有索引已支持新的状态值过滤

## 🔄 回滚步骤

如需回滚此功能：

1. **恢复模型**:
   - 从 status enum 移除 'revoked'
   - 从 auditLog actions enum 移除 'admin_delete'
   - 删除 revokedAt 字段

2. **恢复控制器**:
   - 移除 `revokeInsightRequest()` 函数
   - 移除 `deleteInsightRequest()` 函数
   - 从 module.exports 移除这两个函数

3. **恢复路由**:
   - 移除 PUT /requests/:requestId/revoke 路由
   - 移除 DELETE /admin/requests/:requestId 路由

4. **恢复前端**:
   - 移除删除按钮
   - 移除"已撤销"状态选项
   - 从 getStatusLabel 和 getActionLabel 移除相关标签

## 📚 相关文档

- 完整设计文档: `.claude/memory/standards/insight-request-design.md`
- 数据导出指南: `.claude/memory/standards/excel-export-setup.md`
- API 测试脚本: `.claude/commands/testing/test-all-apis.sh`

---

**最后更新**: 2025-12-04
**维护者**: Claude Code
**状态**: 已实现并测试
