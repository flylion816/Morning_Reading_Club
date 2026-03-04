# 🧪 晨读营测试计划快速参考

**类型**: 项目计划
**更新**: 2026-03-04
**状态**: 准备就绪，可以立即开始执行

---

## 📊 现状一览

```
Backend (✅ 完成)
  • 922 个测试 ✅
  • 34 个测试文件
  • 75%+ 覆盖率

Admin (🔄 1%)
  • 1 个测试（目标 200+）
  • 需要: Fixtures + Helpers + 199 个测试

Miniprogram (❌ 0%)
  • 0 个测试（目标 180+）
  • 需要: 框架 + Fixtures + Helpers + 180 个测试

TOTAL: 923 → 1302 个测试目标
```

---

## 🎯 执行计划速查

### Admin 项目 (Vue 3 + Vitest)

**总任务**: 200 个测试，分 7 个 Task

| Task | 模块 | 测试数 | 优先级 | 预计时间 |
|------|------|--------|--------|---------|
| A1 | Services (API) | 30 | ⭐⭐⭐ | 1 小时 |
| A2 | Stores (Pinia) | 25 | ⭐⭐⭐ | 45 分 |
| A3 | Utils | 20 | ⭐⭐ | 40 分 |
| A4 | Components | 40 | ⭐⭐ | 1.5 小时 |
| A5 | Views | 50 | ⭐⭐⭐ | 2 小时 |
| A6 | Router | 15 | ⭐ | 30 分 |
| A7 | Integration | 20 | ⭐ | 1 小时 |

**准备工作** (Phase 1):
1. 扩展 `setup.ts` (localStorage mock)
2. 创建 5 个 Fixtures 文件
3. 创建 4 个 Mock Helpers 文件

**预计总时间**: 6-8 小时（分散多个会话）

### Miniprogram 项目 (微信小程序 + Jest)

**总任务**: 180 个测试，分 6 个 Task

| Task | 模块 | 测试数 | 优先级 | 预计时间 |
|------|------|--------|--------|---------|
| M1 | Services (API) | 35 | ⭐⭐⭐ | 1.5 小时 |
| M2 | Utils | 25 | ⭐⭐ | 1 小时 |
| M3 | Components | 30 | ⭐⭐ | 1 小时 |
| M4 | Pages | 45 | ⭐⭐⭐ | 2 小时 |
| M5 | Events | 20 | ⭐⭐ | 1 小时 |
| M6 | Integration | 25 | ⭐ | 1 小时 |

**准备工作** (Phase 3):
1. 安装 Jest 依赖
2. 创建 jest.config.js
3. 创建 6 个 Fixtures 文件
4. 创建 5 个 Mock Helpers 文件

**预计总时间**: 6-8 小时（分散多个会话）

---

## 📁 文件清单

### Admin 需要创建的文件

```
src/tests/
├── fixtures/
│   ├── __index.ts              (统一导出)
│   ├── api.fixtures.ts         (40+ API 数据)
│   ├── store.fixtures.ts       (20+ Store 数据)
│   ├── auth.fixtures.ts        (10+ 认证数据)
│   ├── form.fixtures.ts        (15+ 表单数据)
│   └── component.fixtures.ts   (20+ 组件数据)
│
└── helpers/
    ├── __index.ts              (统一导出)
    ├── api-helpers.ts          (10+ 函数)
    ├── component-helpers.ts    (8+ 函数)
    ├── store-helpers.ts        (6+ 函数)
    └── router-helpers.ts       (4+ 函数)

src/services/__tests__/
└── api.spec.ts                 (扩展: 1→30)

src/stores/__tests__/
├── auth.store.spec.ts          (新建: 15)
└── counter.store.spec.ts       (新建: 10)

src/components/__tests__/
├── AdminLayout.spec.ts         (新建: 10)
├── RichTextEditor.spec.ts      (新建: 12)
└── ... (其他组件)

src/views/__tests__/
├── LoginView.spec.ts           (新建: 10)
├── DashboardView.spec.ts       (新建: 12)
└── ... (其他视图)

src/router/__tests__/
└── index.spec.ts               (新建: 15)

src/utils/__tests__/
├── logger.spec.ts              (新建: 8)
└── exportUtils.spec.ts         (新建: 12)

src/__tests__/integration/
├── auth-flow.spec.ts           (新建: 8)
├── user-mgmt-flow.spec.ts      (新建: 8)
└── content-mgmt-flow.spec.ts   (新建: 4)
```

**总计**: 25+ 个测试文件，200+ 个测试

### Miniprogram 需要创建的文件

```
tests/
├── setup.js                    (新建: 全局配置)
│
├── fixtures/
│   ├── __index.js
│   ├── user.fixtures.js        (20+ 用户数据)
│   ├── api.fixtures.js         (30+ API 响应)
│   ├── wx.fixtures.js          (25+ 微信 API)
│   ├── page.fixtures.js        (15+ 页面数据)
│   └── service.fixtures.js     (20+ 服务数据)
│
└── helpers/
    ├── __index.js
    ├── wx-helpers.js           (15+ 函数)
    ├── request-helpers.js      (8+ 函数)
    ├── page-helpers.js         (8+ 函数)
    └── service-helpers.js      (6+ 函数)

unit/services/
├── auth.service.spec.js        (新建: 8)
├── user.service.spec.js        (新建: 6)
├── course.service.spec.js      (新建: 6)
├── checkin.service.spec.js     (新建: 6)
├── insight.service.spec.js     (新建: 6)
└── ... (6 个其他服务)

unit/utils/
├── formatters.spec.js          (新建: 10)
├── validators.spec.js          (新建: 8)
├── request.spec.js             (新建: 4)
└── logger.spec.js              (新建: 3)

unit/components/
├── course-card.spec.js         (新建: 15)
└── notification-badge.spec.js  (新建: 15)

pages/*/
└── __tests__/
    └── *.spec.js               (18 个页面，预计 45 个测试)

unit/events/
├── page-events.spec.js         (新建: 10)
└── component-events.spec.js    (新建: 10)

integration/
├── auth-flow.spec.js           (新建: 8)
├── course-enrollment-flow.spec.js
├── checkin-flow.spec.js        (新建: 6)
└── insight-flow.spec.js        (新建: 3)

jest.config.js                  (新建: 配置)
.babelrc                        (新建: Babel)
```

**总计**: 35+ 个测试文件，180+ 个测试

---

## 🚀 立即可做的 3 件事

### 1️⃣ 验证 Admin 现状 (5 分钟)

```bash
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/admin

# 检查 test script
grep "test" package.json

# 运行现有测试
npm run test

# 检查覆盖率
npm run test -- --coverage
```

### 2️⃣ 扩展 Admin setup.ts (20 分钟)

```bash
# 打开文件
admin/src/tests/setup.ts

# 添加:
# 1. localStorage mock
# 2. Vue Router mock
# 3. Pinia 配置
```

### 3️⃣ 创建 Admin 基础文件 (30 分钟)

```bash
mkdir -p admin/src/tests/fixtures
mkdir -p admin/src/tests/helpers

# 创建统一导出文件
touch admin/src/tests/fixtures/__index.ts
touch admin/src/tests/helpers/__index.ts

# 创建第一个 Fixture
touch admin/src/tests/fixtures/api.fixtures.ts
```

---

## 💡 关键概念速记

### Given-When-Then 结构

```typescript
describe('LoginView', () => {
  it('应该处理登录失败', async () => {
    // Given: 创建 mock，返回 401 错误
    mockApi.login = createMockApiError(401, '邮箱或密码错误');

    // When: 用户提交表单
    await wrapper.find('form').trigger('submit');

    // Then: 验证错误提示被显示
    expect(wrapper.find('.error').text()).toContain('邮箱或密码错误');
  });
});
```

### Fixtures 集中管理

```typescript
// ✅ 好的做法：在 fixtures 文件中定义一次，多个测试复用
export const apiFixtures = {
  loginSuccess: { code: 200, data: { token: '...' } },
  loginFailure: { code: 401, message: '邮箱或密码错误' },
  serverError: { code: 500, message: '服务器错误' }
};

// 在测试中使用
mockApi.login = createMockApiSuccess(apiFixtures.loginSuccess);
```

### Mock Helpers 可复用函数库

```typescript
// ✅ 好的做法：创建 Helper 函数，避免重复编写 mock
export function createMockApiError(code, message) {
  const error = new Error(message);
  error.response = { status: code };
  return vi.fn().mockRejectedValue(error);
}

// 在多个测试中复用
it('test 1', () => {
  mockApi.login = createMockApiError(401, '未认证');
});

it('test 2', () => {
  mockApi.user = createMockApiError(403, '无权限');
});
```

---

## 📋 测试覆盖清单

### Admin 必测场景

- [ ] **Services (A1)**
  - [ ] 请求拦截器 (token 添加)
  - [ ] 响应拦截器 (转换、错误处理)
  - [ ] 所有 HTTP 方法 (GET/POST/PUT/DELETE)
  - [ ] 错误路径 (401/403/500/超时)
  - [ ] 边界情况 (空响应、大数据)

- [ ] **Stores (A2)**
  - [ ] 初始状态
  - [ ] Actions (登录、登出、更新)
  - [ ] Getters (计算属性)
  - [ ] 持久化 (localStorage)
  - [ ] 错误处理

- [ ] **Views (A5)** - 优先: LoginView
  - [ ] 渲染和表单
  - [ ] 用户交互 (输入、点击)
  - [ ] 成功路径 (登录后导航)
  - [ ] 错误路径 (401/500/超时/网络)
  - [ ] 边界情况 (空输入、格式)
  - [ ] 防止重复提交

### Miniprogram 必测场景

- [ ] **Services (M1)**
  - [ ] 成功的 API 调用
  - [ ] Mock 模式
  - [ ] 错误处理 (401/500/超时)
  - [ ] 本地存储集成
  - [ ] 网络重试

- [ ] **Pages (M4)** - 优先: LoginPage
  - [ ] onLoad/onShow/onHide
  - [ ] 微信登录流程
  - [ ] Token 保存
  - [ ] 登录失败处理
  - [ ] 本地状态恢复

- [ ] **Integration (M6)**
  - [ ] 完整的认证流程
  - [ ] 课程注册流程
  - [ ] 打卡流程
  - [ ] 权限变更

---

## 🎬 会话规划建议

### Session 1 (今天) - Admin 框架准备
**时间**: 2-3 小时

1. 扩展 `setup.ts`
2. 创建 Fixtures 库 (5 个文件)
3. 创建 Mock Helpers 库 (4 个文件)
4. 提交: `test: admin setup - 框架准备完成`

### Session 2 - Admin Task A1 (Services)
**时间**: 1-1.5 小时

1. 扩展 `api.spec.ts` (1→30 个测试)
2. 添加请求/响应拦截器测试
3. 添加错误处理测试
4. 提交: `test: admin api-service - 30 个测试通过`

### Session 3 - Admin Task A2-A3 (Stores + Utils)
**时间**: 1.5 小时

1. 创建 Store 测试 (25 个)
2. 创建 Util 测试 (20 个)
3. 提交: `test: admin stores & utils - 45 个测试通过`

### Session 4 - Admin Task A5 (Views)
**时间**: 2 小时

1. 从 LoginView 开始 (10 个测试)
2. 然后 DashboardView (12 个测试)
3. 其他 Views (28 个测试)
4. 提交: `test: admin views - 50 个测试通过`

### Session 5 - Admin Task A4/A6/A7
**时间**: 1.5 小时

1. Components 测试 (40 个)
2. Router 测试 (15 个)
3. Integration 测试 (20 个)
4. 提交多个小 commit

### Session 6-7 - Miniprogram 框架 + Task M1-M2
**时间**: 3-4 小时

1. 框架准备 (Jest + mock)
2. Services 测试 (35 个)
3. Utils 测试 (25 个)

### Session 8+ - Miniprogram 其他 Task
**时间**: 4-5 小时

1. Components (30 个)
2. Pages (45 个)
3. Events (20 个)
4. Integration (25 个)

---

## 🔗 关键文件链接

| 文件 | 用途 | 优先级 |
|------|------|--------|
| [TESTING_PLAN.md](../TESTING_PLAN.md) | 完整详细计划 | ⭐⭐⭐ |
| [TESTING_ANALYSIS.md](../TESTING_ANALYSIS.md) | 分析和代码示例 | ⭐⭐⭐ |
| [backend/tests/](../../backend/tests/) | 参考实现 | ⭐⭐ |
| [backend/tests/fixtures/](../../backend/tests/fixtures/) | Fixtures 模式参考 | ⭐⭐ |
| [backend/tests/unit/helpers/mock-helpers.js](../../backend/tests/unit/helpers/mock-helpers.js) | Mock 模式参考 | ⭐⭐ |

---

## ⏱️ 时间估算

```
Admin 总耗时: 6-8 小时
  • Phase 1 (框架): 2-3 小时 ← 立即可做
  • Task A1 (Services): 1 小时
  • Task A2 (Stores): 45 分钟
  • Task A3 (Utils): 40 分钟
  • Task A4 (Components): 1.5 小时
  • Task A5 (Views): 2 小时
  • Task A6 (Router): 30 分钟
  • Task A7 (Integration): 1 小时

Miniprogram 总耗时: 6-8 小时
  • Phase 3 (框架): 2-3 小时
  • Task M1-M6 (测试): 4-5 小时

总计: 12-16 小时（多个会话分散）
```

---

## ✅ 完成标志

- [ ] Admin 200+ 个测试通过 ✅
- [ ] Miniprogram 180+ 个测试通过 ✅
- [ ] 覆盖率 60%+ (lines) ✅
- [ ] 所有测试文件规范 ✅
- [ ] Git commits 清晰 ✅
- [ ] 文档完整 ✅

---

**准备好开始了吗？**

下一步: 打开 `/TESTING_PLAN.md` 了解完整计划，或立即开始 Admin Phase 1 框架准备。
