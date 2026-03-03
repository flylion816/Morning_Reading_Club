# Insight 模块单元测试实施计划 - Day 2 Task 2.2

## 📋 执行摘要

**任务**: 为 Insight 模块（小凡看见功能）编写完整单元测试
**总测试数**: 102+ 个测试用例
**预期代码量**: 2500+ 行
**总 API 数**: 26 个端点
**核心函数**: 27 个

---

## 🎯 工作分解 (WBS)

### Phase 1: Fixtures 编写（第1天上午，4-5小时）

#### 任务 1.1: 创建 insight-fixtures.js
- **文件**: `/backend/tests/fixtures/insight-fixtures.js`
- **预期行数**: 1500+
- **内容**:
  - 第1层：测试数据集合（Periods、Users、Insights、InsightRequests、Enrollments）
  - 第2层：API 请求体（各操作的有效/无效输入）
  - 第3层：预期响应（成功/失败场景）

**关键数据**:
```
Periods: 3个（进行中、已完成、未开始）
Users: 4-5个（普通用户、管理员）
Insights: 10-15个（各种状态组合）
InsightRequests: 10-15个（各种申请状态）
Enrollments: 需要验证用户是否报名期次
```

---

### Phase 2: 测试套件编写（第1天下午 + 第2天，20-25小时）

#### 任务 2.1: 创建 insight.controller.test.js
- **文件**: `/backend/tests/unit/controllers/insight.controller.test.js`
- **预期行数**: 2500+
- **总测试数**: 102+ 个

#### 子任务分配

| 序号 | 测试类别 | 测试数 | 估计时间 |
|------|---------|--------|---------|
| 2.1.1 | Insight CRUD (TC-INSIGHT-001~043) | 25 | 5小时 |
| 2.1.2 | 权限申请流程 (TC-REQUEST-001~045) | 30 | 7小时 |
| 2.1.3 | 权限检查 (TC-AUTH-001~034) | 15 | 4小时 |
| 2.1.4 | 管理员接口 (TC-ADMIN-001~032) | 20 | 4小时 |
| 2.1.5 | 外部接口 (TC-EXTERNAL-001~012) | 8 | 2小时 |
| 2.1.6 | 互动功能 (TC-INTERACT-001~011) | 4 | 1小时 |
| **总计** | | **102** | **23小时** |

---

## 📝 详细测试用例分配

### 🔴 高优先级 (第1优先完成)

#### 1. Insight CRUD - 创建 (TC-INSIGHT-001~005)
```javascript
it('TC-INSIGHT-001: 用户创建 insight 成功', async () => {
  // 准备：有效的创建请求
  req.user = { userId: testUsers.user1._id };
  req.body = {
    periodId: testPeriods.activeOngoing._id,
    type: 'insight',
    mediaType: 'text',
    content: '今天收获很大...',
    targetUserId: testUsers.user2._id
  };

  // Mock Insight.create 返回新记录
  InsightStub.create.resolves(testInsights.user1ToUser2);

  // 执行
  await createInsightManual(req, res, next);

  // 验证
  expect(res.status.calledWith(201)).to.be.true;
  expect(res.json.calledOnce).to.be.true;
  expect(InsightStub.create.calledOnce).to.be.true;
  expect(publishSyncEvent.calledOnce).to.be.true;
});
```

#### 2. 权限申请 - 流程 (TC-REQUEST-001~015)
```javascript
it('TC-REQUEST-001: 创建查看申请成功', async () => {
  // 用户A请求查看用户B的insights
  req.user = { userId: testUsers.user2._id };
  req.body = { toUserId: testUsers.user1._id };

  InsightRequestStub.findOne.resolves(null);  // 无重复申请
  UserStub.findById.resolves(testUsers.user1);

  await createInsightRequest(req, res, next);

  expect(InsightRequestStub.create.calledOnce).to.be.true;
  expect(notifyUser.calledOnce).to.be.true;  // 发送通知给被申请者
});

it('TC-REQUEST-020: 被申请者同意申请', async () => {
  const requestId = testInsightRequests.user2ToUser1._id;

  req.user = { userId: testInsightRequests.user2ToUser1.toUserId };
  req.params = { requestId };
  req.body = { periodId: testPeriods.activeOngoing._id };

  const mockRequest = {
    ...testInsightRequests.user2ToUser1,
    status: 'pending',
    save: sandbox.stub().resolves()
  };
  InsightRequestStub.findById.resolves(mockRequest);

  await approveInsightRequest(req, res, next);

  expect(mockRequest.status).to.equal('approved');
  expect(notifyUser.calledOnce).to.be.true;  // 通知申请者
});
```

#### 3. 权限检查 (TC-AUTH-001~015)
```javascript
it('TC-AUTH-001: 查看自己的 insights 返回创建+分配的', async () => {
  req.user = { userId: testUsers.user1._id };
  req.params = { userId: testUsers.user1._id };
  req.query = { page: 1, limit: 20 };

  const mockInsights = [
    testInsights.user1Created,    // 自己创建
    testInsights.user1Assigned    // 分配给自己
  ];
  InsightStub.find.resolves(mockInsights);
  InsightStub.countDocuments.resolves(2);

  await getUserInsights(req, res, next);

  // 验证 $or 查询包含两种情况
  const query = InsightStub.find.firstCall.args[0];
  expect(query.$or).to.exist;
  expect(query.$or.length).to.equal(2);
});

it('TC-AUTH-010: 查看他人 insights 需要权限', async () => {
  req.user = { userId: testUsers.user1._id };
  req.params = { userId: testUsers.user2._id };  // 查看他人

  InsightRequestStub.findOne.resolves(null);  // 无权限

  await getUserInsights(req, res, next);

  expect(res.status.calledWith(403)).to.be.true;
});
```

#### 4. 获取期次 insights (TC-INSIGHT-014~015)
```javascript
it('TC-INSIGHT-014: 已登录获取期次 insights', async () => {
  req.user = { userId: testUsers.user1._id };
  req.params = { periodId: testPeriods.activeOngoing._id };
  req.query = { page: 1, limit: 20 };

  InsightStub.find.resolves(testInsights.period1List);
  InsightStub.countDocuments.resolves(10);

  await getInsightsForPeriod(req, res, next);

  // 验证 $or 查询
  const query = InsightStub.find.firstCall.args[0];
  expect(query.$or).to.exist;  // 用户创建 + 分配给用户
});

it('TC-INSIGHT-015: 未登录获取期次 insights（仅公开）', async () => {
  req.user = undefined;  // 未登录
  req.params = { periodId: testPeriods.activeOngoing._id };

  InsightStub.find.resolves(testInsights.periodPublic);

  await getInsightsForPeriod(req, res, next);

  const query = InsightStub.find.firstCall.args[0];
  expect(query.isPublished).to.equal(true);  // 仅公开
});
```

### 🟡 中优先级 (第2轮完成)

#### 5. 创建 insight - 验证 (TC-INSIGHT-003~005)
```javascript
it('TC-INSIGHT-003: 缺少必填字段返回 400', async () => {
  req.body = {
    periodId: testPeriods.activeOngoing._id
    // 缺少 type, mediaType, content
  };

  await createInsightManual(req, res, next);

  expect(res.status.calledWith(400)).to.be.true;
});

it('TC-INSIGHT-005: 给自己创建返回 400', async () => {
  req.user = { userId: testUsers.user1._id };
  req.body = {
    ...validCreateBody,
    targetUserId: testUsers.user1._id  // 自己
  };

  await createInsightManual(req, res, next);

  expect(res.status.calledWith(400)).to.be.true;
});
```

#### 6. 更新和删除 (TC-INSIGHT-030~043)
```javascript
it('TC-INSIGHT-030: 创建者更新 insight', async () => {
  const insightId = testInsights.user1Created._id;
  req.user = { userId: testInsights.user1Created.userId };
  req.params = { insightId };
  req.body = { content: 'Updated content' };

  const mockInsight = {
    ...testInsights.user1Created,
    save: sandbox.stub().resolves(),
    populate: sandbox.stub().returnsThis()
  };
  InsightStub.findById.resolves(mockInsight);

  await updateInsight(req, res, next);

  expect(mockInsight.content).to.equal('Updated content');
  expect(mockInsight.save.calledOnce).to.be.true;
});

it('TC-INSIGHT-040: 创建者删除 insight', async () => {
  const insightId = testInsights.user1Created._id;
  req.user = { userId: testInsights.user1Created.userId };
  req.params = { insightId };

  InsightStub.findById.resolves(testInsights.user1Created);
  InsightStub.findByIdAndDelete.resolves();

  await deleteInsight(req, res, next);

  expect(InsightStub.findByIdAndDelete.calledWith(insightId)).to.be.true;
});
```

#### 7. 权限申请 - 状态管理 (TC-REQUEST-030~045)
```javascript
it('TC-REQUEST-030: 被申请者撤销权限', async () => {
  const requestId = testInsightRequests.approved._id;
  req.user = { userId: testInsightRequests.approved.toUserId };
  req.params = { requestId };

  const mockRequest = {
    ...testInsightRequests.approved,
    status: 'approved',
    save: sandbox.stub().resolves()
  };
  InsightRequestStub.findById.resolves(mockRequest);

  await revokeInsightRequest(req, res, next);

  expect(mockRequest.status).to.equal('revoked');
  expect(mockRequest.revokedAt).to.exist;
});

it('TC-REQUEST-043: 批量同意申请（5个）', async () => {
  req.body = {
    approvals: [
      { requestId: req1, periodId: periodId },
      { requestId: req2, periodId: periodId },
      // ...
    ]
  };

  InsightRequestStub.find.resolves([
    { _id: req1, save: stub },
    { _id: req2, save: stub }
  ]);

  await batchApproveRequests(req, res, next);

  expect(res.json.calledOnce).to.be.true;
  const result = res.json.firstCall.args[0].data;
  expect(result.processed).to.equal(2);
});
```

#### 8. 管理员接口 (TC-ADMIN-001~032)
```javascript
it('TC-ADMIN-001: 获取所有申请（分页）', async () => {
  req.query = { page: 1, limit: 20, status: 'pending' };

  InsightRequestStub.countDocuments.resolves(50);
  InsightRequestStub.find.resolves(testInsightRequests.pending);

  await getInsightRequestsAdmin(req, res, next);

  expect(res.json.calledOnce).to.be.true;
  const { pagination } = res.json.firstCall.args[0].data;
  expect(pagination.total).to.equal(50);
  expect(pagination.pages).to.equal(3);
});

it('TC-ADMIN-010: 获取统计信息', async () => {
  InsightRequestStub.aggregate.resolves([
    {
      total: [{ count: 100 }],
      byStatus: [
        { _id: 'pending', count: 30 },
        { _id: 'approved', count: 60 },
        { _id: 'rejected', count: 10 }
      ]
    }
  ]);

  await getInsightRequestsStats(req, res, next);

  const data = res.json.firstCall.args[0].data;
  expect(data.totalRequests).to.equal(100);
  expect(data.pendingRequests).to.equal(30);
});
```

### 🟢 低优先级 (最后完成)

#### 9. 外部接口 (TC-EXTERNAL-001~012)
```javascript
it('TC-EXTERNAL-001: 无需认证创建 insight', async () => {
  req.body = {
    periodName: '心流之境',
    targetUserId: testUsers.user1._id,
    content: 'External insight'
  };

  PeriodStub.findOne.resolves(testPeriods.activeOngoing);
  UserStub.findById.resolves(testUsers.user1);
  EnrollmentStub.findOne.resolves({ userId: testUsers.user1._id });
  InsightStub.create.resolves(testInsights.externalCreated);

  await createInsightFromExternal(req, res, next);

  expect(res.status.calledWith(201)).to.be.true;
});
```

#### 10. 互动功能 (TC-INTERACT-001~011)
```javascript
it('TC-INTERACT-001: 点赞成功并计数+1', async () => {
  const insightId = testInsights.user1Created._id;
  req.user = { userId: testUsers.user2._id };
  req.params = { insightId };

  InsightStub.findById.resolves(testInsights.user1Created);

  await likeInsight(req, res, next);

  expect(testInsights.user1Created.likeCount).to.increase;
  expect(testInsights.user1Created.likes.length).to.increase;
});
```

---

## 🔧 实施步骤

### 第1天（8小时）

**上午 (4小时): Fixtures 编写**
- [ ] 创建 insight-fixtures.js 框架
- [ ] 定义 testPeriods、testUsers（复用 checkin-fixtures）
- [ ] 定义 testInsights（10-15个，各种状态）
- [ ] 定义 testInsightRequests（10-15个）
- [ ] 定义 testEnrollments（权限验证）

**下午 (4小时): 测试框架 + CRUD 测试**
- [ ] 创建 insight.controller.test.js 基本框架
- [ ] 实现 beforeEach/afterEach
- [ ] 编写 TC-INSIGHT-001~025 (CRUD 操作)
- [ ] 验证 Stub 调用顺序

### 第2天（16小时）

**上午 (8小时): 权限申请 + 权限检查**
- [ ] 编写 TC-REQUEST-001~045 (权限申请全流程)
- [ ] 验证通知发送逻辑
- [ ] 编写 TC-AUTH-001~034 (权限检查)
- [ ] 验证 $or 查询逻辑

**下午 (8小时): 管理员 + 外部接口 + 互动**
- [ ] 编写 TC-ADMIN-001~032 (管理员接口)
- [ ] 编写 TC-EXTERNAL-001~012 (外部接口)
- [ ] 编写 TC-INTERACT-001~011 (互动功能)
- [ ] 运行全部测试 + 覆盖率检查

---

## ✅ 验收标准

### 代码质量
- [ ] 所有 102+ 个测试用例通过
- [ ] 函数覆盖率 = 100% (27/27 函数)
- [ ] 分支覆盖率 > 95%
- [ ] 行覆盖率 > 98%

### 测试质量
- [ ] 每个测试用例都有 arrange/act/assert 三段结构
- [ ] 每个测试都有清晰的目的说明（it 描述）
- [ ] 所有边界情况都被测试
- [ ] 所有错误路径都被测试

### 代码风格
- [ ] 遵循项目的代码风格（Checkin 测试为参考）
- [ ] 使用统一的 Fixture 管理方式
- [ ] 注释清晰，解释复杂逻辑

---

## 📊 时间估计

| 阶段 | 任务 | 工时 | 备注 |
|------|------|------|------|
| **Phase 1** | Fixtures 编写 | 5h | 上午 |
| **Phase 2** | CRUD 测试 | 5h | 下午 + 第2天早 |
| **Phase 2** | 权限申请测试 | 7h | 第2天中 |
| **Phase 2** | 权限检查测试 | 4h | 第2天中 |
| **Phase 2** | 管理员 + 其他 | 6h | 第2天下午 |
| **验证** | 运行测试 + 调整 | 3h | 全程贯穿 |
| **总计** | | **30h** | 约 3-4 个工作天 |

---

## 🔗 关键文件

| 文件 | 行数 | 用途 |
|------|------|------|
| `/backend/src/controllers/insight.controller.js` | 1490 | 参考实现 |
| `/backend/src/models/Insight.js` | 135 | 数据模型 |
| `/backend/src/models/InsightRequest.js` | 116 | 请求模型 |
| `/backend/tests/fixtures/checkin-fixtures.js` | 1000+ | 参考 Fixtures |
| `/backend/tests/unit/controllers/checkin.controller.test.js` | 800+ | 参考测试代码 |

---

## 🚀 成功指标

- ✅ 102+ 个测试用例全部通过
- ✅ 代码覆盖率达到 >95%
- ✅ 所有 26 个 API 端点都被测试
- ✅ 权限管理逻辑完全验证
- ✅ 代码遵循项目规范

---

**文档生成**: 2026-03-03
**状态**: 准备就绪，可开始实施
**下一步**: 开始编写 insight-fixtures.js
