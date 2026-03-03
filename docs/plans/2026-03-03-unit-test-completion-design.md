# 单元测试补全方案设计文档

**版本**: v1.0
**日期**: 2026-03-03
**作者**: Claude Code
**状态**: ✅ 已批准，准备实施

---

## 一、概述

基于 219 个企业级测试用例文档和现有单元测试代码，设计一个**关键路径优先、100% 覆盖率**的单元测试补全方案。

**目标**：
- ✅ 在 1-2 天内完成
- ✅ 达到 100% 代码覆盖率
- ✅ 确保数据操作安全（禁止批量删除）
- ✅ 与 219 个测试用例文档完全对应

---

## 二、设计方案

### 2.1 执行时间表

| 阶段 | 模块 | 目标 | 时间 |
|------|------|------|------|
| **Day 1** | Auth + User + Enrollment + Payment | 认证、报名、支付 100% 覆盖 | 6-8 小时 |
| **Day 2** | Checkin + Insight + 全流程集成 | 打卡、内容、完整流程 100% 覆盖 | 6-8 小时 |

### 2.2 测试结构

#### 单元测试（Unit Tests）
```
tests/unit/
├── controllers/
│   ├── auth.controller.test.js
│   ├── user.controller.test.js
│   ├── enrollment.controller.test.js
│   ├── payment.controller.test.js
│   ├── checkin.controller.test.js
│   └── insight.controller.test.js
├── services/
│   ├── auth.service.test.js
│   ├── user.service.test.js
│   ├── enrollment.service.test.js
│   ├── payment.service.test.js
│   ├── checkin.service.test.js
│   └── insight.service.test.js
└── middleware/
    ├── auth.middleware.test.js
    └── errorHandler.middleware.test.js
```

#### 集成测试（Integration Tests）
```
tests/integration/
├── auth-flow.integration.test.js
├── enrollment-payment-flow.test.js
├── checkin-insight-flow.test.js
├── concurrent-ops.integration.test.js
├── error-scenarios.integration.test.js
└── data-consistency.integration.test.js
```

### 2.3 数据安全原则（关键）

**严格禁止**：
- ❌ 调用任何 `init-*.js` 脚本
- ❌ 使用 `collection.deleteMany()` 或 `deleteMany({})`
- ❌ 批量删除操作
- ❌ 删除整个集合或数据库

**严格允许**：
- ✅ 单条 `create()`
- ✅ 单条 `findByIdAndUpdate()`
- ✅ 单条 `findByIdAndDelete()`
- ✅ 查询和断言验证

### 2.4 100% 覆盖率要求

**Controller 层**：
- 成功响应（200/201）
- 输入验证错误（400）
- 认证错误（401）
- 权限错误（403）
- 不存在错误（404）
- 服务器错误（500）
- 所有 if/else 分支

**Service 层**：
- 所有业务逻辑分支
- 边界值处理
- 并发场景
- 数据验证
- 异常处理

**Middleware 层**：
- 有效 Token
- 过期 Token
- 无效 Token
- 缺少 Token
- Token 刷新

### 2.5 测试环境

- **框架**：Mocha + Chai + Sinon（现有）
- **数据库**：MongoDB Memory Server（隔离、安全）
- **Mock 工具**：proxyquire、sinon stubs/spies
- **命令**：`npm test`（全部）或 `npm run test:unit`/`test:integration`（分类）

### 2.6 与 219 个测试用例的映射

**阶段 1（Day 1）**：
- 单元测试：TC-AUTH-001~007 + TC-ADMIN-001~002 + TC-ENROLL-001~010 + TC-PAYMENT-001~010
- 集成测试：完整的登录流程 + 报名→支付流程
- 安全测试：TC-SEC-001~008（认证、支付安全）
- 数据库测试：TC-DB-001~005（事务一致性）

**阶段 2（Day 2）**：
- 单元测试：TC-CHECKIN-001~010 + TC-INSIGHTS-001~015
- 集成测试：完整的打卡流程 + 小凡看见流程 + 并发场景
- 数据库测试：TC-DB-006~011（并发、性能）
- UI/UX 测试：TC-UX-001~018（用户反馈、可用性）

---

## 三、Fixtures 设计

```javascript
// tests/fixtures/testData.js
module.exports = {
  users: [
    { openid: 'user_001', nickname: '测试用户1', status: 'normal' },
    { openid: 'user_002', nickname: '测试用户2', status: 'normal' },
    { openid: 'user_admin', nickname: '管理员', status: 'admin' },
    { openid: 'user_banned', nickname: '被禁用用户', status: 'disabled' }
  ],

  periods: [
    { name: '心流之境', startDate: now(), status: 'ongoing', price: 99 },
    { name: '平衡之道', startDate: now() - 1day, status: 'closed', price: 99 },
    { name: '未来期次', startDate: now() + 1day, status: 'draft', price: 99 }
  ],

  enrollments: [
    { status: 'pending', paymentStatus: 'pending' },
    { status: 'approved', paymentStatus: 'paid' },
    { status: 'rejected', paymentStatus: null }
  ],

  payments: [
    { status: 'pending', amount: 99 },
    { status: 'paid', amount: 99 },
    { status: 'refunded', amount: 99 }
  ],

  // 更多...
};
```

---

## 四、关键实施规范

### 4.1 单条操作测试模板

```javascript
describe('模块功能', () => {
  let testUserId, testPeriodId;

  beforeEach(async () => {
    // ✅ 创建单条测试数据
    const user = await User.create({ ... });
    testUserId = user._id;

    const period = await Period.create({ ... });
    testPeriodId = period._id;
  });

  afterEach(async () => {
    // ✅ 单条清理，不能批量删除
    if (testPeriodId) {
      await Period.findByIdAndDelete(testPeriodId);
    }
    if (testUserId) {
      await User.findByIdAndDelete(testUserId);
    }
  });

  it('应该成功执行', async () => {
    // ... 测试逻辑
  });
});
```

### 4.2 审视现有测试的标准

**保留**：覆盖正常场景 + 至少一个错误场景
**删除**：重复、不完整、不符合规范
**修复**：缺少错误场景、缺少安全场景

---

## 五、成功标准

- ✅ 全部测试通过（npm test 100% 绿）
- ✅ 覆盖率 ≥ 100%（全分支）
- ✅ 执行时间 < 60 秒
- ✅ 零数据污染（单条操作、隔离数据库）
- ✅ 与 219 个测试用例文档 1:1 对应
- ✅ 代码审查合格

---

## 六、审批记录

- ✅ 用户确认：2026-03-03
- ✅ 方案选择：分阶段递进式 + 关键路径优先
- ✅ 数据安全：严格单条操作、禁止批量删除
- ✅ 目标确认：100% 覆盖率、1-2 天完成

---

**设计状态**：✅ 已批准，准备实施
