# Insight 模块分析与测试实施计划

## 📋 目录
1. [模块总体概况](#模块总体概况)
2. [API 端点完整列表](#api-端点完整列表)
3. [核心业务逻辑分析](#核心业务逻辑分析)
4. [测试设计方案](#测试设计方案)
5. [与 Checkin 的复用策略](#与-checkin-的复用策略)

---

## 模块总体概况

### 📊 模块简介

**Insight 模块**（小凡看见功能）是晨读营应用的核心社交功能，允许用户在完成打卡后获得AI个性化反馈，并可以：
- 创建和分享学习感悟
- 给其他用户发送"小凡看见"
- 申请查看他人的小凡看见
- 管理查看权限
- 点赞和互动

### 🏗️ 模块结构

```
Backend:
  - 模型: Insight.js (135行) + InsightRequest.js (116行)
  - 控制器: insight.controller.js (1490行，27个函数)
  - 路由: insight.routes.js (233行，26条路由)

Frontend:
  - 服务: insight.service.js (170行，14个方法)
  - 页面: （小程序中）
```

### 📁 文件位置

| 文件 | 路径 | 行数 | 职责 |
|------|------|------|------|
| Insight 模型 | `/backend/src/models/Insight.js` | 135 | 小凡看见数据结构 |
| InsightRequest 模型 | `/backend/src/models/InsightRequest.js` | 116 | 查看申请数据结构 |
| Controller | `/backend/src/controllers/insight.controller.js` | 1490 | 业务逻辑实现 |
| 路由 | `/backend/src/routes/insight.routes.js` | 233 | API 端点定义 |
| 小程序服务 | `/miniprogram/services/insight.service.js` | 170 | 前端 API 封装 |

---

## API 端点完整列表

### 分类统计

| 类别 | API 数量 | 说明 |
|------|---------|------|
| **Insight 管理** | 8 | CRUD + 生成 AI |
| **Insight 查看权限** | 10 | 申请、审批、撤销等 |
| **管理员接口** | 5 | 后台管理、统计、批量操作 |
| **外部接口** | 1 | 第三方系统集成 |
| **互动功能** | 2 | 点赞、取消点赞 |
| **总计** | **26** | **26个 API 端点** |

### 详细 API 列表

#### 1️⃣ Insight 基础 CRUD (8个)

| # | 路由 | 方法 | 控制器函数 | 认证 | 说明 |
|----|------|------|---------|------|------|
| 1 | `/api/v1/insights` | `GET` | `getInsights()` | 管理员 | 管理后台：获取所有 insights |
| 2 | `/api/v1/insights` | `POST` | `createInsightManual()` | 用户 | 用户：创建 insight |
| 3 | `/api/v1/insights/:insightId` | `GET` | `getInsightDetail()` | 用户 | 获取 insight 详情 |
| 4 | `/api/v1/insights/:insightId` | `PUT` | `updateInsight()` | 用户 | 更新 insight |
| 5 | `/api/v1/insights/:insightId` | `DELETE` | `deleteInsight()` | 用户 | 删除 insight |
| 6 | `/api/v1/insights/user/:userId?` | `GET` | `getUserInsights()` | 用户 | 获取用户的 insights（含权限检查） |
| 7 | `/api/v1/insights/period/:periodId` | `GET` | `getInsightsForPeriod()` | 用户 | 获取期次的 insights（已登录和未登录都支持） |
| 8 | `/api/v1/insights/generate` | `POST` | `generateInsight()` | 用户 | 生成 AI 反馈（基于打卡） |

#### 2️⃣ 查看权限申请 (10个)

| # | 路由 | 方法 | 控制器函数 | 认证 | 说明 |
|----|------|------|---------|------|------|
| 9 | `/api/v1/insights/requests` | `POST` | `createInsightRequest()` | 用户 | 创建查看申请 |
| 10 | `/api/v1/insights/requests/received` | `GET` | `getReceivedRequests()` | 用户 | 获取收到的申请列表 |
| 11 | `/api/v1/insights/requests/sent` | `GET` | `getSentRequests()` | 用户 | 获取发起的申请列表 |
| 12 | `/api/v1/insights/requests/status/:userId` | `GET` | `getRequestStatus()` | 用户 | 检查与某用户的申请状态 |
| 13 | `/api/v1/insights/requests/:requestId/approve` | `POST` | `approveInsightRequest()` | 用户 | 同意申请 |
| 14 | `/api/v1/insights/requests/:requestId/reject` | `POST` | `rejectInsightRequest()` | 用户 | 拒绝申请 |
| 15 | `/api/v1/insights/requests/:requestId/revoke` | `PUT` | `revokeInsightRequest()` | 用户 | 撤销已批准的权限 |
| 16 | `/api/v1/admin/insights/requests` | `GET` | `getInsightRequestsAdmin()` | 管理员 | 管理员：获取所有申请 |
| 17 | `/api/v1/admin/insights/requests/stats` | `GET` | `getInsightRequestsStats()` | 管理员 | 管理员：获取申请统计 |
| 18 | `/api/v1/admin/insights/requests/:requestId/approve` | `PUT` | `adminApproveRequest()` | 管理员 | 管理员：同意申请 |

#### 3️⃣ 管理员相关 (5个)

| # | 路由 | 方法 | 控制器函数 | 认证 | 说明 |
|----|------|------|---------|------|------|
| 19 | `/api/v1/admin/insights/requests/:requestId/reject` | `PUT` | `adminRejectRequest()` | 管理员 | 管理员：拒绝申请 |
| 20 | `/api/v1/admin/insights/requests/:requestId` | `DELETE` | `deleteInsightRequest()` | 管理员 | 管理员：删除申请 |
| 21 | `/api/v1/admin/insights/requests/batch-approve` | `POST` | `batchApproveRequests()` | 管理员 | 管理员：批量同意申请 |
| 22 | `/api/v1/insights/manual/create` | `POST` | `createInsightManual()` | 管理员 | 管理员：创建 insight |
| 23 | `/api/v1/insights/manual/:insightId` | `DELETE` | `deleteInsightManual()` | 管理员 | 管理员：删除 insight |

#### 4️⃣ 互动功能 (2个)

| # | 路由 | 方法 | 控制器函数 | 认证 | 说明 |
|----|------|------|---------|------|------|
| 24 | `/api/v1/insights/:insightId/like` | `POST` | `likeInsight()` | 用户 | 点赞 |
| 25 | `/api/v1/insights/:insightId/unlike` | `POST` | `unlikeInsight()` | 用户 | 取消点赞 |

#### 5️⃣ 外部接口 (1个)

| # | 路由 | 方法 | 控制器函数 | 认证 | 说明 |
|----|------|------|---------|------|------|
| 26 | `/api/v1/insights/external/create` | `POST` | `createInsightFromExternal()` | 无 | 第三方系统创建 insight |

### 路由定义文件映射

**文件**: `/backend/src/routes/insight.routes.js` (233行)

- 第 1-31 行：导入所有控制器函数
- 第 34-173 行：用户 API 路由
- 第 175-217 行：管理员 API 路由
- 第 219-231 行：外部接口

---

## 核心业务逻辑分析

### 1️⃣ Insight 生命周期

```
创建阶段:
  └─ generateInsight()
     ├─ 验证打卡存在 + 权限
     ├─ 检查是否已生成
     ├─ Mock AI 生成内容
     └─ 保存到数据库 + 发布同步事件

发布阶段:
  └─ createInsightManual()
     ├─ 验证必填字段（periodId, type, mediaType, content）
     ├─ 验证 mediaType（text|image）和 type（daily|weekly|monthly|insight）
     ├─ 验证不能给自己创建
     ├─ 创建记录（userId, targetUserId, periodId）
     └─ 发布同步事件

更新阶段:
  └─ updateInsight()
     ├─ 验证记录存在
     ├─ 权限检查（创建者或管理员）
     ├─ 批量更新字段（periodId, targetUserId, type, mediaType 等）
     └─ Populate + 发布同步事件

删除阶段:
  └─ deleteInsight() / deleteInsightManual()
     ├─ 验证记录存在
     ├─ 权限检查（创建者或管理员）
     └─ 发布同步事件
```

### 2️⃣ 权限管理系统（InsightRequest）

```
申请流程:
  申请者 ──createInsightRequest()──> 被申请者
     ├─ 防重复申请检查
     ├─ 自动查询被申请者的活跃报名
     ├─ 创建 pending 申请
     └─ 发送通知给被申请者

审批流程（用户）:
  被申请者 ──approveInsightRequest()──> 申请者
     ├─ 验证申请者身份
     ├─ 验证申请状态为 pending
     ├─ 更新为 approved + 记录时间戳
     └─ 发送通知给申请者

  被申请者 ──rejectInsightRequest()──> 申请者
     ├─ 验证申请状态为 pending
     ├─ 更新为 rejected + 记录时间戳
     └─ 发送通知给申请者

撤销流程:
  被申请者 ──revokeInsightRequest()──> 申请者
     ├─ 验证申请状态为 approved
     ├─ 更新为 revoked + 记录时间戳
     └─ 发送通知给申请者

审批流程（管理员）:
  管理员 ──adminApproveRequest()──> 申请者
     ├─ 验证申请状态为 pending
     ├─ 更新状态 + 记录管理员操作
     └─ 发送通知给申请者

  管理员 ──batchApproveRequests()──> 多个申请者
     ├─ 验证 approvals 数组（最多100个）
     ├─ 批量更新所有申请
     └─ 批量发送通知
```

### 3️⃣ 权限检查机制（访问 Insight）

**getUserInsights()** - 查看自己或他人的 insights:
```javascript
if (targetUserId !== currentUserId) {
  // 查看他人
  检查是否有 approved 权限
    ├─ 有 → 返回他人创建的 insights
    └─ 无 → 403 Forbidden
} else {
  // 查看自己
  返回：
    ├─ 自己创建的 insights（userId === currentUserId）
    └─ 分配给自己的 insights（targetUserId === currentUserId）
}
```

**getInsightsForPeriod()** - 公共接口，支持已登录和未登录:
```javascript
if (userId) {
  // 已登录
  返回：
    ├─ 用户创建的 insights
    └─ 分配给用户的 insights
} else {
  // 未登录
  返回：仅发布的（isPublished=true）insights
}
```

### 4️⃣ 数据同步（MySQL 同步）

每个写操作都发布同步事件：
```javascript
publishSyncEvent({
  type: 'create'|'update'|'delete',
  collection: 'insights'|'insight_requests',
  documentId: '..._id',
  data: { ...toObject() }
})
```

### 5️⃣ 通知系统集成

关键操作会发送通知：
- 创建申请 → 被申请者
- 批准申请 → 申请者
- 拒绝申请 → 申请者
- 撤销权限 → 申请者

通知通过 `notifyUser()` / `notifyUsers()` 发送，支持 WebSocket 推送。

### 6️⃣ 外部系统集成

**createInsightFromExternal()** - 允许第三方系统创建 insight:
```
输入：periodName(期次名称) + targetUserId + content|imageUrl
流程：
  ├─ 根据 periodName 查询期次
  ├─ 验证 targetUser 存在 + 已报名期次
  ├─ 使用系统用户或 targetUser 作为创建者
  ├─ 创建 insight（type='insight', source='manual'）
  └─ 返回简洁响应（仅ID和元数据）
权限：无需认证（PUBLIC）
```

---

## 测试设计方案

### 📊 预期测试覆盖范围

总计：**100+ 个测试用例**

| 类别 | 测试数 | 场景分布 |
|------|--------|---------|
| Insight CRUD | 25 | 创建(5) + 获取(7) + 更新(6) + 删除(7) |
| 权限申请 | 30 | 创建(4) + 查询(6) + 审批(8) + 拒绝(6) + 撤销(6) |
| 权限检查 | 15 | 查看自己(3) + 查看他人(4) + 公开接口(3) + 权限失败(5) |
| 管理员接口 | 20 | 批量操作(8) + 统计(4) + 查询(5) + 删除(3) |
| 外部接口 | 8 | 创建(5) + 验证(3) |
| 互动功能 | 4 | 点赞(2) + 取消点赞(2) |
| **总计** | **102** | 各功能覆盖 100%，包含正常、异常、边界情况 |

### 🔍 测试分布（按类别）

#### A. Insight CRUD 测试 (25个)

**创建 Insight (5个)**
- TC-INSIGHT-001: 用户创建（成功）
- TC-INSIGHT-002: 管理员创建（成功）
- TC-INSIGHT-003: 缺少必填字段（400）
- TC-INSIGHT-004: mediaType 无效（400）
- TC-INSIGHT-005: 给自己创建（400）

**获取 Insight 列表 (7个)**
- TC-INSIGHT-010: 获取所有 insights（管理员）
- TC-INSIGHT-011: 获取自己的 insights
- TC-INSIGHT-012: 获取他人的 insights（有权限）
- TC-INSIGHT-013: 获取他人的 insights（无权限）
- TC-INSIGHT-014: 获取期次 insights（已登录）
- TC-INSIGHT-015: 获取期次 insights（未登录）
- TC-INSIGHT-016: 分页查询

**获取详情 (3个)**
- TC-INSIGHT-020: 获取存在的 insight
- TC-INSIGHT-021: 获取不存在的 insight（404）
- TC-INSIGHT-022: 验证返回字段完整

**更新 Insight (6个)**
- TC-INSIGHT-030: 创建者更新（成功）
- TC-INSIGHT-031: 管理员更新（成功）
- TC-INSIGHT-032: 非创建者更新（403）
- TC-INSIGHT-033: 更新不存在的记录（404）
- TC-INSIGHT-034: 部分字段更新
- TC-INSIGHT-035: 更新后 populate 验证

**删除 Insight (4个)**
- TC-INSIGHT-040: 创建者删除（成功）
- TC-INSIGHT-041: 管理员删除（成功）
- TC-INSIGHT-042: 非创建者删除（403）
- TC-INSIGHT-043: 删除不存在的记录（404）

#### B. 查看权限申请测试 (30个)

**创建申请 (4个)**
- TC-REQUEST-001: 创建申请（成功）
- TC-REQUEST-002: 自己申请自己（400）
- TC-REQUEST-003: 重复申请检测
- TC-REQUEST-004: 自动查询被申请者报名

**查询申请 (6个)**
- TC-REQUEST-010: 获取收到的申请
- TC-REQUEST-011: 获取发起的申请
- TC-REQUEST-012: 按状态筛选（pending|approved|rejected）
- TC-REQUEST-013: 获取申请状态（与特定用户）
- TC-REQUEST-014: 申请不存在返回无申请
- TC-REQUEST-015: 分页查询

**用户审批 (8个)**
- TC-REQUEST-020: 被申请者同意申请（成功）
- TC-REQUEST-021: 被申请者拒绝申请（成功）
- TC-REQUEST-022: 非被申请者审批（403）
- TC-REQUEST-023: 同意已完成申请（400）
- TC-REQUEST-024: 拒绝已完成申请（400）
- TC-REQUEST-025: 同意时发送通知
- TC-REQUEST-026: 拒绝时发送通知
- TC-REQUEST-027: 验证审批时间戳

**权限撤销 (6个)**
- TC-REQUEST-030: 被申请者撤销权限（成功）
- TC-REQUEST-031: 申请者不能撤销（403）
- TC-REQUEST-032: 拒绝状态无法撤销（400）
- TC-REQUEST-033: 撤销时发送通知
- TC-REQUEST-034: 验证撤销时间戳
- TC-REQUEST-035: 撤销后获取 insights 403

**管理员审批 (6个)**
- TC-REQUEST-040: 管理员同意申请（成功）
- TC-REQUEST-041: 管理员拒绝申请（成功）
- TC-REQUEST-042: 记录审计日志
- TC-REQUEST-043: 批量同意申请（5个）
- TC-REQUEST-044: 批量同意限制（>100 返回 400）
- TC-REQUEST-045: 批量操作统计

#### C. 权限检查测试 (15个)

**查看自己的 insights (3个)**
- TC-AUTH-001: 查看自己的列表（返回创建+分配）
- TC-AUTH-002: 含权限信息
- TC-AUTH-003: 分页正确

**查看他人的 insights (4个)**
- TC-AUTH-010: 有权限可见（approved）
- TC-AUTH-011: 无权限 403
- TC-AUTH-012: 权限过期测试
- TC-AUTH-013: 权限验证日志

**公开接口（未登录）(3个)**
- TC-AUTH-020: 未登录获取期次 insights（仅 isPublished=true）
- TC-AUTH-021: 未登录分页查询
- TC-AUTH-022: isPublished=false 不显示

**权限失败场景 (5个)**
- TC-AUTH-030: 申请状态为 pending（无权访问）
- TC-AUTH-031: 申请状态为 rejected（无权访问）
- TC-AUTH-032: 申请被撤销（无权访问）
- TC-AUTH-033: 申请被删除（无权访问）
- TC-AUTH-034: 用户被禁用（无权访问）

#### D. 管理员接口测试 (20个)

**获取所有申请 (5个)**
- TC-ADMIN-001: 获取所有申请（分页）
- TC-ADMIN-002: 按状态筛选
- TC-ADMIN-003: 按用户搜索（fromUser）
- TC-ADMIN-004: 按用户搜索（toUser）
- TC-ADMIN-005: 组合筛选

**统计信息 (4个)**
- TC-ADMIN-010: 获取总数
- TC-ADMIN-011: 获取按状态统计
- TC-ADMIN-012: 获取平均响应时间
- TC-ADMIN-013: 空数据返回 0

**批量操作 (8个)**
- TC-ADMIN-020: 批量同意（1 个）
- TC-ADMIN-021: 批量同意（50 个）
- TC-ADMIN-022: 批量同意（100 个限制）
- TC-ADMIN-023: 为不同申请分配不同期次
- TC-ADMIN-024: 验证所有申请 pendding 状态
- TC-ADMIN-025: 验证所有期次存在
- TC-ADMIN-026: 批量通知发送
- TC-ADMIN-027: 审计日志记录

**删除申请 (3个)**
- TC-ADMIN-030: 删除申请（成功）
- TC-ADMIN-031: 记录审计日志
- TC-ADMIN-032: 删除不存在的申请（404）

#### E. 外部接口测试 (8个)

**创建 Insight (5个)**
- TC-EXTERNAL-001: 正常创建（无需认证）
- TC-EXTERNAL-002: 期次不存在（404）
- TC-EXTERNAL-003: 被看见人不存在（404）
- TC-EXTERNAL-004: 被看见人未报名期次（403）
- TC-EXTERNAL-005: content 和 imageUrl 都空（400）

**验证 (3个)**
- TC-EXTERNAL-010: 验证响应格式（简洁）
- TC-EXTERNAL-011: 系统用户作为创建者
- TC-EXTERNAL-012: 使用 targetUserId 作为创建者（无系统用户）

#### F. 互动功能测试 (4个)

**点赞 (2个)**
- TC-INTERACT-001: 点赞（成功，计数+1）
- TC-INTERACT-002: 重复点赞检测（已点过）

**取消点赞 (2个)**
- TC-INTERACT-010: 取消点赞（成功，计数-1）
- TC-INTERACT-011: 未点赞时取消（不报错）

### 📦 Fixtures 设计（三层结构）

#### 第1层：测试数据集合

```javascript
// insight-fixtures.js

const testPeriods = {
  activeOngoing: { _id: ObjectId(), name: '心流之境', status: 'active', ... },
  activeEnded: { _id: ObjectId(), name: '能量充电站', status: 'ended', ... },
  notStarted: { _id: ObjectId(), name: '春日新生', status: 'draft', ... }
};

const testUsers = {
  user1: { _id: ObjectId(), nickname: '小红', role: 'user', ... },
  user2: { _id: ObjectId(), nickname: '小蓝', role: 'user', ... },
  admin: { _id: ObjectId(), nickname: '管理员', role: 'admin', ... }
};

const testInsights = {
  user1Insight1: {
    _id: ObjectId(),
    userId: testUsers.user1._id,
    targetUserId: testUsers.user2._id,  // 分配给 user2
    periodId: testPeriods.activeOngoing._id,
    type: 'insight',
    mediaType: 'text',
    content: '今天收获很大...',
    status: 'completed',
    isPublished: true,
    likeCount: 5,
    ...
  },
  // ... 其他 insights
};

const testInsightRequests = {
  user2ToUser1: {
    _id: ObjectId(),
    fromUserId: testUsers.user2._id,
    toUserId: testUsers.user1._id,
    status: 'pending',
    periodId: testPeriods.activeOngoing._id,
    createdAt: new Date(),
    ...
  },
  // ... 其他请求
};
```

#### 第2层：API 请求体

```javascript
const createInsightRequests = {
  valid: {
    periodId: 'period_id',
    type: 'insight',
    mediaType: 'text',
    content: '小凡看见内容',
    targetUserId: 'user_id'
  },

  missingFields: {
    periodId: 'period_id',
    // 缺少 type, mediaType, content
  },

  invalidMediaType: {
    periodId: 'period_id',
    type: 'insight',
    mediaType: 'video',  // ❌ 无效
    content: '...'
  }
};

const createRequestRequests = {
  valid: {
    toUserId: 'user_id',
    periodId: 'period_id'
  },

  selfRequest: {
    toUserId: 'same_as_current_user'  // ❌ 自己申请自己
  }
};
```

#### 第3层：预期响应

```javascript
const expectedResponses = {
  createSuccess: {
    code: 200 | 201,
    message: '小凡看见创建成功',
    data: {
      _id: ObjectId,
      userId: '...',
      targetUserId: '...',
      periodId: '...',
      content: '...',
      createdAt: Date
    }
  },

  createFail_MissingFields: {
    code: 400,
    message: '缺少必填字段'
  },

  getListSuccess: {
    code: 200,
    message: '获取成功',
    data: {
      list: [ ... ],
      pagination: {
        page: 1,
        limit: 20,
        total: 100,
        pages: 5
      }
    }
  }
};
```

---

## 与 Checkin 的复用策略

### 🔄 相同之处

| 方面 | Checkin | Insight | 复用可能 |
|------|---------|---------|--------|
| 数据模型 | MongoDB Schema | MongoDB Schema | ✅ 模型定义方式相同 |
| 认证方式 | authMiddleware | authMiddleware | ✅ 完全相同 |
| 响应格式 | success/errors | success/errors | ✅ 完全相同 |
| 同步机制 | publishSyncEvent | publishSyncEvent | ✅ 完全相同 |
| 通知系统 | createNotification | createNotification | ✅ 完全相同 |
| 测试框架 | Mocha + Sinon + Chai | Mocha + Sinon + Chai | ✅ 完全相同 |
| Stub 方式 | Proxyquire | Proxyquire | ✅ 完全相同 |

### 📋 Fixtures 复用

**可以复用的 Fixtures**：

```javascript
// 从 checkin-fixtures.js 复用
testPeriods      // ✅ Period 数据集
testUsers        // ✅ User 数据集
testSections     // ✅ Section 数据集（部分）

// 新建的 Fixtures（Insight 特有）
testInsights     // Insight 特有
testInsightRequests  // InsightRequest 特有
testEnrollments  // Enrollment（权限验证需要）
```

**复用示例**：

```javascript
// insight-fixtures.js
const { testPeriods, testUsers, testSections } = require('./checkin-fixtures');

// 新增 Insight 特有数据
const testInsights = { ... };
const testInsightRequests = { ... };

module.exports = {
  testPeriods,      // 复用
  testUsers,        // 复用
  testSections,     // 复用
  testInsights,     // 新建
  testInsightRequests  // 新建
};
```

### 📝 测试代码复用

**可以复用的测试模式**：

```javascript
// 1. 认证测试模式
req.user = { userId: testUsers.user1._id };

// 2. Stub 创建模式
UserStub = {
  findById: sandbox.stub()
};

// 3. 响应验证模式
expect(res.status.calledWith(201)).to.be.true;
expect(res.json.calledOnce).to.be.true;

// 4. 分页查询模式
const { page = 1, limit = 20 } = req.query;
```

### ❌ 不能复用的（Insight 特有）

1. **权限管理逻辑** - Checkin 没有权限申请，Insight 有
2. **InsightRequest 相关测试** - Checkin 模块不存在
3. **外部接口测试** - Insight 特有
4. **点赞系统** - Insight 特有（Checkin 不支持）

---

## 测试实施细节

### 🛠️ 测试文件结构

```
backend/tests/
├── fixtures/
│   ├── checkin-fixtures.js       (已存在，1000+ 行)
│   └── insight-fixtures.js       (新建，1500+ 行)
├── unit/
│   └── controllers/
│       ├── checkin.controller.test.js  (已存在，800+ 行)
│       └── insight.controller.test.js  (新建，2500+ 行)
```

### 📊 insight.controller.test.js 结构预期

```javascript
describe('Insight Controller', () => {
  // 前置准备 (beforeEach)
  // - 创建 sandbox
  // - 初始化 req/res/next 对象
  // - 创建 Model Stubs (InsightStub, UserStub, InsightRequestStub)
  // - 创建 response/logger/notification Stubs
  // - Proxyquire 加载 insight.controller

  describe('TC-INSIGHT-001~005: 创建 Insight', () => {
    it('TC-INSIGHT-001: 用户创建成功', ...);
    it('TC-INSIGHT-002: 管理员创建成功', ...);
    it('TC-INSIGHT-003: 缺少必填字段返回 400', ...);
    it('TC-INSIGHT-004: mediaType 无效返回 400', ...);
    it('TC-INSIGHT-005: 给自己创建返回 400', ...);
  });

  describe('TC-INSIGHT-010~016: 获取列表', () => {
    it('TC-INSIGHT-010: 管理员获取所有 insights', ...);
    // ... 其他测试
  });

  describe('TC-REQUEST-001~045: 权限申请', () => {
    it('TC-REQUEST-001: 创建申请成功', ...);
    // ... 其他测试
  });

  describe('TC-AUTH-001~034: 权限检查', () => {
    it('TC-AUTH-001: 查看自己的列表', ...);
    // ... 其他测试
  });

  describe('TC-ADMIN-001~032: 管理员接口', () => {
    it('TC-ADMIN-001: 获取所有申请', ...);
    // ... 其他测试
  });

  describe('TC-EXTERNAL-001~012: 外部接口', () => {
    it('TC-EXTERNAL-001: 无需认证创建', ...);
    // ... 其他测试
  });

  describe('TC-INTERACT-001~011: 互动功能', () => {
    it('TC-INTERACT-001: 点赞成功', ...);
    // ... 其他测试
  });
});
```

### ✅ 测试覆盖率目标

```
Function Coverage:    100% (27 个函数)
Branch Coverage:      >95% (所有分支条件)
Line Coverage:        >98% (1490 行代码)
```

---

## 快速参考

### 🎯 关键函数对照表

| 功能 | 函数名 | 行号 | 复杂度 | 优先级 |
|------|--------|------|--------|--------|
| 创建 Insight | `createInsightManual()` | 300 | 中 | 🔴 高 |
| 生成 AI | `generateInsight()` | 44 | 中 | 🟡 中 |
| 获取列表 | `getUserInsights()` | 133 | 高 | 🔴 高 |
| 获取期次 | `getInsightsForPeriod()` | 359 | 高 | 🔴 高 |
| 权限检查 | `getUserInsights()` 权限逻辑 | 140 | 高 | 🔴 高 |
| 创建申请 | `createInsightRequest()` | 538 | 中 | 🔴 高 |
| 批准申请 | `approveInsightRequest()` | 721 | 中 | 🟡 中 |
| 管理员操作 | `adminApproveRequest()` / `batchApproveRequests()` | 979 / 1263 | 中 | 🟡 中 |
| 外部接口 | `createInsightFromExternal()` | 1385 | 中 | 🟢 低 |
| 点赞 | `likeInsight()` | (未显示) | 低 | 🟢 低 |

---

## 总结

### 📈 模块规模

- **API 端点**: 26 个
- **控制器函数**: 27 个
- **数据模型**: 2 个（Insight + InsightRequest）
- **预期测试用例**: 102+ 个
- **代码行数**: 1490 (controller) + 116 (models) + 233 (routes) = 1839 行

### 🎯 测试实施重点

1. **权限管理** - 最复杂的功能，需要重点测试权限申请、检查、撤销的全流程
2. **$or 查询** - getUserInsights 和 getInsightsForPeriod 都使用了 $or 查询，需要验证返回的数据集正确
3. **通知系统** - 每个权限变化都需要发送通知，需要验证通知的触发
4. **异步同步** - 所有写操作都需要发布同步事件到 MySQL
5. **边界情况** - 未登录访问、权限过期、重复申请等特殊场景

### 🚀 下一步行动

1. 创建 `insight-fixtures.js`（1500+ 行，包含所有测试数据）
2. 创建 `insight.controller.test.js`（2500+ 行，102+ 个测试用例）
3. 运行测试并验证覆盖率（目标 >95%）
4. 集成到 CI/CD 流程

---

**文档更新时间**: 2026-03-03
**状态**: 准备就绪，可开始实施
