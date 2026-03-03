# Day 2 Task 2.2 完整任务包 - Insight 模块分析总结

## 🎯 任务概览

**任务编号**: Day 2 Task 2.2
**模块名称**: Insight（小凡看见）
**任务内容**: 完整单元测试 100+ 个测试用例
**总体规模**: 102+ 测试用例，2500+ 行代码
**预期周期**: 30 小时（3-4 个工作天）
**优先级**: 🔴 高

---

## 📊 模块规模速览

### API 端点总数: 26 个

| 分类 | 数量 | 关键端点 |
|------|------|--------|
| 🔵 基础 CRUD | 8 | 创建、获取、更新、删除、生成 AI |
| 🟣 权限申请 | 10 | **最复杂**，包含 4 个状态转换 |
| 🟠 管理员接口 | 5 | 批量操作、统计 |
| 🟢 其他 | 3 | 互动、外部接口 |
| **总计** | **26** | 比 Checkin 多 10 个 |

### 核心数据模型: 2 个

| 模型 | 字段数 | 特点 |
|------|--------|------|
| **Insight** | 18 | 内容存储，包含点赞、发布状态 |
| **InsightRequest** | 12 | **状态机**，记录权限申请完整生命周期 |

### 核心函数: 27 个

| 类别 | 数量 | 复杂度 |
|------|------|--------|
| CRUD 操作 | 8 | ⭐⭐ 中等 |
| 权限管理 | 10 | ⭐⭐⭐⭐ 高 |
| 管理接口 | 5 | ⭐⭐⭐ 中高 |
| 辅助函数 | 4 | ⭐ 低 |

---

## 🔑 关键业务逻辑 5 大要点

### 1️⃣ 权限申请状态机

```
申请流程:
  pending  ──(用户审批)──> approved ──(用户撤销)──> revoked
       └──(用户拒绝)──> rejected (终态)

申请流程（管理员）:
  pending  ──(管理员审批)──> approved
       └──(管理员拒绝)──> rejected (终态)

撤销流程:
  已批准  ──(被申请者撤销)──> revoked (权限失效)
```

**关键**: 只有 approved 状态的申请才能被撤销，rejected 不可逆。

### 2️⃣ 复杂的 $or 查询逻辑

```javascript
// getUserInsights() 中
if (查看自己) {
  返回: userId === currentUser OR targetUserId === currentUser
  (既能看自己创建的，也能看分配给自己的)

} else if (查看他人) {
  检查权限: 是否有 approved 的 InsightRequest
  有权限? 返回他人创建的insights
  无权限? 403 Forbidden
}
```

**关键**: $or 的两个条件必须都被测试。

### 3️⃣ 多用户权限验证

```javascript
// 涉及 3 个用户角色
Creator (创建者)      // 可以更新/删除自己的 insight
TargetUser (被分配者) // 可以查看分配给自己的
RequestUser (申请者)   // 需要权限才能查看他人的

权限流: RequestUser ──申请──> TargetUser ──批准──> 权限生成
```

**关键**: 权限检查发生在多个环节，需要逐个验证。

### 4️⃣ 通知系统集成

```
关键操作会发送通知:
- 创建申请    → 被申请者收到"有新申请"通知
- 批准申请    → 申请者收到"申请已批准"通知
- 拒绝申请    → 申请者收到"申请已拒绝"通知
- 撤销权限    → 申请者收到"权限已撤销"通知

通知方式:
  ├─ WebSocket 实时推送 (wsManager)
  └─ 数据库存储 (Notification 表)
```

**关键**: 需要 Mock notifyUser() 函数验证通知发送。

### 5️⃣ MySQL 同步机制

```
所有写操作都发送同步事件:
  create/update/delete
    ↓
  publishSyncEvent()
    ↓
  MongoDB + MySQL 双写一致性

包括同步的表:
  - insights
  - insight_requests
```

**关键**: 需要 Mock publishSyncEvent 并验证调用。

---

## 📋 测试分布详情 (102+ 用例)

### 模块1: Insight CRUD (25 个用例)
```
创建 (5):  验证字段、权限、mediaType、type、不能给自己创建
获取 (7):  管理员获取、用户获取、他人获取、权限检查、分页
详情 (3):  获取、不存在、字段完整性
更新 (6):  创建者更新、管理员更新、权限检查、populate验证
删除 (4):  创建者删除、管理员删除、权限检查
```

### 模块2: 权限申请 (30 个用例) ⭐ 最复杂
```
创建申请 (4):    正常、自己申请自己、重复申请、自动查询报名
查询申请 (6):    收到的、发起的、按状态筛选、状态检查、分页
用户审批 (8):    同意、拒绝、权限检查、状态验证、通知、时间戳
权限撤销 (6):    正常撤销、权限检查、状态检查、通知、时间戳
管理员操作 (6):  同意、拒绝、审计日志、批量同意、限制、统计
```

### 模块3: 权限检查 (15 个用例)
```
查看自己 (3):  返回创建+分配、权限信息、分页
查看他人 (4):  有权限可见、无权限403、权限过期、验证日志
公开接口 (3):  未登录仅公开、分页、过滤发布状态
权限失败 (5):  pending状态、rejected、revoked、删除、禁用
```

### 模块4: 管理员接口 (20 个用例)
```
获取申请 (5):  分页、按状态筛选、按用户搜索、组合筛选
统计 (4):      总数、按状态统计、平均响应时间、空数据
批量操作 (8):  1个、50个、100个限制、不同期次、验证状态、验证期次、通知、审计
删除 (3):      正常删除、审计日志、404错误
```

### 模块5: 外部接口 (8 个用例)
```
创建 (5):  正常、期次不存在、用户不存在、未报名、字段验证
验证 (3):  响应格式、系统用户作为创建者、targetUser作为创建者
```

### 模块6: 互动功能 (4 个用例)
```
点赞 (2):      正常点赞、重复点赞检测
取消点赞 (2):  正常取消、未点赞时取消
```

---

## 🛠️ Fixtures 数据结构

### 第1层: 测试数据集合

```javascript
testPeriods {
  activeOngoing: { _id, name: '心流之境', status: 'active' },
  activeEnded: { _id, name: '能量充电站', status: 'ended' },
  notStarted: { _id, name: '春日新生', status: 'draft' }
}

testUsers {
  user1: { _id, nickname: '小红', role: 'user' },
  user2: { _id, nickname: '小蓝', role: 'user' },
  admin: { _id, nickname: '管理员', role: 'admin' }
}

testSections {
  day1: { _id, periodId: activeOngoing._id, day: 1 },
  day2: { _id, periodId: activeOngoing._id, day: 2 }
}

testInsights {
  user1Created: {      // 用户1创建的
    _id, userId: user1._id, targetUserId: user2._id,
    type: 'insight', status: 'completed', isPublished: true
  },
  user1Assigned: {     // 分配给用户1的
    _id, userId: user2._id, targetUserId: user1._id,
    type: 'insight', status: 'completed'
  },
  unpublished: {       // 未发布
    _id, isPublished: false
  }
  // ... 更多状态组合
}

testInsightRequests {
  pending: {
    _id, fromUserId: user1._id, toUserId: user2._id,
    status: 'pending'
  },
  approved: {
    _id, fromUserId: user1._id, toUserId: user2._id,
    status: 'approved', approvedAt: Date
  },
  rejected: {
    _id, fromUserId: user1._id, toUserId: user2._id,
    status: 'rejected', rejectedAt: Date
  },
  revoked: {
    _id, fromUserId: user1._id, toUserId: user2._id,
    status: 'revoked', revokedAt: Date
  }
}

testEnrollments {
  user1InPeriod1: { userId: user1._id, periodId: activeOngoing._id },
  user2InPeriod1: { userId: user2._id, periodId: activeOngoing._id }
}
```

### 第2层: 请求体数据

```javascript
createInsightRequests {
  valid: { periodId, type, mediaType, content, targetUserId },
  missingFields: { /* 缺少必填 */ },
  invalidType: { type: 'invalid' },
  selfTarget: { targetUserId: 与userId相同 }
}

createRequestRequests {
  valid: { toUserId, periodId },
  selfRequest: { toUserId: 与currentUserId相同 }
}
```

### 第3层: 预期响应

```javascript
expectedResponses {
  success: { code: 200/201, data: {...} },
  badRequest: { code: 400, message: '...' },
  forbidden: { code: 403, message: '...' },
  notFound: { code: 404, message: '...' }
}
```

---

## 🚀 实施路线图

### Week 1 (第1天 - 上午, 4小时)
```
□ 创建 insight-fixtures.js 框架
□ 定义所有 testXxx 对象（20-30个）
□ 验证 Fixtures 数据一致性
□ 预计完成: 1500+ 行代码
```

### Week 1 (第1天 - 下午, 4小时)
```
□ 创建 insight.controller.test.js 框架
□ 实现 beforeEach/afterEach
□ 编写 TC-INSIGHT-001~025 (CRUD 25个)
□ 验证测试框架工作正常
```

### Week 2 (第2天, 8小时)
```
□ 编写 TC-REQUEST-001~045 (权限申请 30个)
□ 验证 $or 查询逻辑
□ 验证通知发送
```

### Week 2 (第2天 - 下午, 8小时)
```
□ 编写 TC-AUTH-001~034 (权限检查 15个)
□ 编写 TC-ADMIN-001~032 (管理员 20个)
□ 编写 TC-EXTERNAL-001~012 (外部 8个)
□ 编写 TC-INTERACT-001~011 (互动 4个)
□ 运行全部测试
```

### 验证阶段 (贯穿, 3小时)
```
□ 所有 102+ 用例通过
□ 行覆盖率 > 98%
□ 分支覆盖率 > 95%
□ 函数覆盖率 = 100%
```

---

## 📚 关键代码片段参考

### 最重要的 3 个测试模板

#### 模板1: 权限申请流程测试
```javascript
it('TC-REQUEST-020: 被申请者同意申请', async () => {
  const request = {
    ...testInsightRequests.pending,
    save: sandbox.stub().resolves()
  };

  req.user = { userId: request.toUserId };
  req.params = { requestId: request._id };
  req.body = { periodId: testPeriods.activeOngoing._id };

  InsightRequestStub.findById.resolves(request);

  await approveInsightRequest(req, res, next);

  expect(request.status).to.equal('approved');
  expect(notifyUser.calledOnce).to.be.true;  // ⭐ 关键
});
```

#### 模板2: 权限检查测试 ($or 查询)
```javascript
it('TC-AUTH-001: 查看自己的 insights', async () => {
  req.user = { userId: testUsers.user1._id };
  req.params = { userId: testUsers.user1._id };

  const insights = [testInsights.user1Created, testInsights.user1Assigned];
  InsightStub.find.resolves(insights);
  InsightStub.countDocuments.resolves(2);

  await getUserInsights(req, res, next);

  // ⭐ 验证 $or 查询
  const query = InsightStub.find.firstCall.args[0];
  expect(query.$or).to.exist;
  expect(query.$or[0]).to.have.property('userId');
  expect(query.$or[1]).to.have.property('targetUserId');
});
```

#### 模板3: 错误处理测试
```javascript
it('TC-INSIGHT-012: 查看他人 insights 无权限返回 403', async () => {
  req.user = { userId: testUsers.user1._id };
  req.params = { userId: testUsers.user2._id };  // 查看他人

  InsightRequestStub.findOne.resolves(null);  // 无权限

  await getUserInsights(req, res, next);

  expect(res.status.calledWith(403)).to.be.true;
  expect(res.json.firstCall.args[0].message).to.include('无权查看');
});
```

---

## 🎓 常见错误预防

### ❌ 错误1: 权限检查不完整
```javascript
// ❌ 错误：没有检查 InsightRequest 表
if (targetUserId !== currentUserId) {
  // 直接返回他人的 insights（权限泄漏）
}

// ✅ 正确：需要检查申请状态
if (targetUserId !== currentUserId) {
  const hasPermission = await InsightRequest.findOne({
    fromUserId: currentUserId,
    toUserId: targetUserId,
    status: 'approved'
  });
  if (!hasPermission) return 403;
}
```

### ❌ 错误2: $or 查询只测试了一个分支
```javascript
// ❌ 错误：只验证了 userId 分支
const query = InsightStub.find.firstCall.args[0];
expect(query.$or[0]).to.have.property('userId');

// ✅ 正确：验证两个分支都存在
expect(query.$or[0]).to.have.property('userId');
expect(query.$or[1]).to.have.property('targetUserId');
```

### ❌ 错误3: 忘记验证通知发送
```javascript
// ❌ 错误：没有验证通知
await approveInsightRequest(req, res, next);
// 完成，但实际忘记了发送通知给申请者

// ✅ 正确：验证通知发送
await approveInsightRequest(req, res, next);
expect(notifyUser.calledOnce).to.be.true;
expect(notifyUser.firstCall.args[1]).to.equal(request.fromUserId);
```

---

## 📊 工作量细分

| 任务 | 工时 | 占比 |
|------|------|------|
| Fixtures 编写 | 5h | 17% |
| CRUD 测试 | 5h | 17% |
| 权限申请测试 | 7h | 23% |
| 权限检查测试 | 4h | 13% |
| 管理员接口测试 | 4h | 13% |
| 其他测试 (外部+互动) | 2h | 7% |
| 调试 + 覆盖率优化 | 3h | 10% |
| **总计** | **30h** | **100%** |

---

## ✅ 完成标准

### 必须满足
- [ ] 所有 102+ 个测试用例通过
- [ ] 函数覆盖率 = 100% (27/27)
- [ ] 分支覆盖率 ≥ 95%
- [ ] 行覆盖率 ≥ 98%
- [ ] 代码遵循项目规范

### 建议满足
- [ ] 测试代码有清晰的注释
- [ ] 每个测试用例 TC 编号唯一
- [ ] Fixtures 数据充分（20-30 个对象）
- [ ] 权限检查 100% 覆盖

---

## 🔗 相关文档

在 `.claude/memory/` 目录中：

1. **INSIGHT_ANALYSIS.md** (4000+ 行)
   - 完整模块分析
   - 所有 API 端点详表
   - 完整的测试用例清单
   - Fixtures 数据结构定义

2. **INSIGHT_IMPLEMENTATION_PLAN.md** (1500+ 行)
   - 分步骤实施计划
   - 每个测试模块的时间估计
   - 关键代码模板
   - 优先级划分

3. **INSIGHT_VS_CHECKIN_COMPARISON.md** (2000+ 行)
   - 与 Checkin 模块的详细对比
   - 复用机制分析
   - 难度评估
   - 编写效率对比

---

## 🎯 核心要点速记

**最重要的 3 个特点**:
1. ⭐⭐⭐ **权限申请状态机** - 最复杂的部分，需要特别关注
2. ⭐⭐⭐ **$or 查询验证** - 两个分支都必须测试
3. ⭐⭐ **通知系统集成** - 5 个操作都需要发送通知

**最容易出错的地方**:
1. 权限检查不完整（泄漏权限）
2. 只验证了 $or 的一个分支
3. 忘记验证通知发送
4. 忘记验证同步事件发送

**最值得复用的地方**:
1. Fixtures 数据（Periods, Users, Sections）
2. 测试框架结构（beforeEach/afterEach）
3. Stub 创建模式
4. 响应验证方式

---

## 🚀 立即开始

**下一步**:
1. 打开 `/backend/tests/fixtures/checkin-fixtures.js` 作为参考
2. 创建 `/backend/tests/fixtures/insight-fixtures.js`
3. 开始定义第1层数据集合 (testInsights, testInsightRequests)

**预计完成**: 2026 年 3 月 5 日（下周二）

---

**文档更新**: 2026-03-03
**状态**: ✅ 分析完成，可开始编码
**优先级**: 🔴 高（Day 2 Task 2.2）
**关键联系人**: （项目经理）
