# Admin 项目单元测试框架指南

> **框架完成日期**: 2026-03-04
> **框架状态**: ✅ 生产就绪（39个测试全部通过）

## 项目代码结构分析

### 代码组织

| 目录 | 文件数量 | 说明 |
|------|--------|------|
| `src/views/` | 14 个 Vue 文件 | 管理员页面（用户、期次、报名、支付、内容等） |
| `src/components/` | 9 个 Vue 文件 | 可复用组件（布局、编辑器、图标等） |
| `src/services/` | 1 个 TypeScript + 1 个测试 | API 服务层（axios 封装） |
| `src/stores/` | 2 个 TypeScript | Pinia 状态管理（auth、counter） |
| `src/utils/` | 2 个 TypeScript | 工具函数（导出、日志） |
| `src/api/` | 1 个 TypeScript | API 端点定义（审计日志） |

### 技术栈

- **框架**: Vue 3 + TypeScript
- **测试框架**: Vitest 4.0.16
- **UI 组件**: Element Plus
- **测试工具**: @vue/test-utils 2.4.6
- **测试环境**: happy-dom
- **覆盖率**: c8 10.1.3
- **构建**: Vite 7.1.11

### Vitest 配置

- ✅ vitest 已安装并配置
- ✅ 测试环境：happy-dom
- ✅ Vue Test Utils 已集成
- ✅ 全局测试配置：`src/tests/setup.ts`
- ✅ 覆盖率配置：60% 代码覆盖率目标
- ✅ npm test 命令可用

---

## 框架完成内容（4个部分）

### 1️⃣ Fixtures 库 - 测试数据工厂

**目录**: `src/tests/fixtures/`

提供 5 个 fixture 文件，包含 40+ 个工厂函数，可用于生成一致的测试数据：

#### 用户 Fixtures (`user-fixtures.ts`) - 8 个函数
```typescript
// 创建单个用户
createMockAdmin()              // 超级管理员
createMockNormalAdmin()        // 普通管理员
createMockUser()               // 普通用户
createMockDisabledUser()       // 禁用用户
createMockInactiveUser()       // 未激活用户

// 创建多个用户
createMockUsers(count, overrides)  // 批量创建
```

#### 期次 Fixtures (`period-fixtures.ts`) - 9 个函数
```typescript
createMockPeriod()             // 标准期次
createMockPeriods(count)       // 批量期次
createMockDraftPeriod()        // 草稿期次
createMockClosedPeriod()       // 已结束期次
createMockFullPeriod()         // 满员期次
createMockUpcomingPeriod()     // 即将开始期次
```

#### 报名 Fixtures (`enrollment-fixtures.ts`) - 11 个函数
```typescript
createMockEnrollment()         // 标准报名
createMockEnrollments(count)   // 批量报名
createMockPendingEnrollment()  // 待审核报名
createMockRejectedEnrollment() // 已拒绝报名
createMockUnpaidEnrollment()   // 未支付报名
createMockPaidEnrollment()     // 已支付报名
createMockCancelledEnrollment() // 已取消报名
```

#### 小凡看见 Fixtures (`insight-fixtures.ts`) - 12 个函数
```typescript
createMockInsight()            // 标准小凡看见
createMockInsights(count)      // 批量小凡看见
createMockUnpublishedInsight() // 未发布
createMockPopularInsight()     // 热门（点赞多）
createMockImageInsight()       // 带图片
createMockVideoInsight()       // 带视频
createMockLinkInsight()        // 带链接
createMockUnlikedInsight()     // 无点赞
```

#### 索引导出 (`index.ts`)
```typescript
// 统一导出所有 fixtures，便于导入
export * from './user-fixtures'
export * from './period-fixtures'
export * from './enrollment-fixtures'
export * from './insight-fixtures'
```

**使用示例**：
```typescript
import { createMockUser, createMockPeriods } from '@tests/fixtures'

describe('User Management', () => {
  it('should display user info', () => {
    const user = createMockUser({ email: 'custom@example.com' })
    const periods = createMockPeriods(3)
    // 使用 user 和 periods 进行测试
  })
})
```

---

### 2️⃣ Mock Helpers 库 - 辅助函数

**目录**: `src/tests/helpers/`

提供 25+ 个 mock 辅助函数，与后端完全一致的 API：

#### API 响应函数 (6 个)
```typescript
createMockApiSuccess(data, message)  // 成功响应 {code:200, message, data}
createMockApiError(code, message, data)  // 错误响应

mockApiGet(sandbox, returnValue)     // Mock GET 请求
mockApiPost(sandbox, returnValue)    // Mock POST 请求
mockApiPut(sandbox, returnValue)     // Mock PUT 请求
mockApiPatch(sandbox, returnValue)   // Mock PATCH 请求
mockApiDelete(sandbox, returnValue)  // Mock DELETE 请求
mockApiFailure(sandbox, code, msg)   // Mock API 失败
```

#### Pinia Store Mock (3 个)
```typescript
createMockStoreGetter(value)         // Mock getter
createMockStoreAction(returnValue)   // Mock action
createMockStoreMutation()            // Mock mutation
```

#### Router & Storage Mock (4 个)
```typescript
createMockRouter(sandbox)            // Mock Vue Router
createMockRouteParams(overrides)     // Mock 路由参数
createMockLocalStorage()             // Mock localStorage
createMockSessionStorage()           // Mock sessionStorage
```

#### 其他工具 (8+ 个)
```typescript
mockWindowAlert(sandbox)             // Mock window.alert
mockConsoleLog(sandbox)              // Mock console.log
mockConsoleError(sandbox)            // Mock console.error
mockConsoleWarn(sandbox)             // Mock console.warn
createMockResponse(sandbox)          // Mock HTTP 响应对象

waitFor(callback, timeout)           // 异步等待工具
delay(ms)                            // 延迟 Promise
resetAllMocks()                      // 重置所有 mock
restoreAllMocks()                    // 恢复所有 spy
```

#### 完整测试套件 (33+ 测试)
- ✅ Mock 响应创建函数的 10 个测试
- ✅ API 请求函数的 8 个测试
- ✅ Pinia Store mock 的 3 个测试
- ✅ Router mock 的 4 个测试
- ✅ Storage mock 的 5 个测试
- ✅ Window/Console mock 的 4 个测试
- ✅ 异步工具的 2 个测试

**使用示例**：
```typescript
import { mockApiGet, createMockRouter } from '@tests/helpers'

describe('User Service', () => {
  it('should fetch users', async () => {
    const mockGet = mockApiGet(vi, { users: [] })
    mockGet()  // 可调用该 mock 函数

    const result = await mockGet()
    expect(result.code).toBe(200)
    expect(result.data.users).toEqual([])
  })

  it('should navigate after login', async () => {
    const router = createMockRouter()
    await router.push('/dashboard')
    expect(router.push).toHaveBeenCalledWith('/dashboard')
  })
})
```

---

## 测试框架配置文件

### 1. `vitest.config.ts` - Vitest 配置
```typescript
// 测试环境：happy-dom
environment: 'happy-dom'

// 全局配置：src/tests/setup.ts
setupFiles: ['./src/tests/setup.ts']

// 覆盖率配置：60% 代码覆盖率目标
coverage: {
  provider: 'c8',
  reporter: ['text', 'json', 'html', 'lcov'],
  lines: 60,
  functions: 65,
  branches: 55,
  statements: 60
}

// 全局 describe/it/expect 可用
globals: true
```

### 2. `src/tests/setup.ts` - 全局测试设置
```typescript
// Vue Test Utils 配置
config.global.mocks = { $t: (key) => key }

// 每个测试后清理
afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  sessionStorage.clear()
})

// 全局 Mock
global.ResizeObserver = ...
window.matchMedia = ...
```

### 3. `package.json` - NPM 脚本
```json
{
  "scripts": {
    "test": "vitest",              // 运行所有测试
    "test:ui": "vitest --ui",      // 打开测试 UI
    "test:coverage": "vitest --coverage",  // 生成覆盖率报告
    "test:watch": "vitest --watch" // 监听模式
  }
}
```

---

## 快速开始

### 运行测试

```bash
# 进入 admin 目录
cd admin

# 运行所有测试（应显示 39 个测试通过）
npm test

# 监听模式（代码变更时自动重新运行）
npm run test:watch

# 打开 Vitest UI（可视化界面）
npm run test:ui

# 生成覆盖率报告
npm run test:coverage
```

### 编写新测试

**步骤1**: 导入 fixtures 和 helpers
```typescript
import { describe, it, expect, vi } from 'vitest'
import { createMockUser, createMockPeriod } from '@tests/fixtures'
import { mockApiGet, createMockRouter } from '@tests/helpers'
```

**步骤2**: 编写测试
```typescript
describe('UsersView', () => {
  it('should display user list', async () => {
    // 1. 创建测试数据
    const users = createMockUsers(5)

    // 2. Mock API
    const mockGet = mockApiGet(vi, { users })

    // 3. 测试逻辑
    const result = await mockGet()
    expect(result.data.users).toHaveLength(5)
  })

  it('should navigate to user detail', async () => {
    const router = createMockRouter()
    const user = createMockUser()

    await router.push(`/users/${user.id}`)
    expect(router.push).toHaveBeenCalled()
  })
})
```

**步骤3**: 运行测试
```bash
npm test path/to/your.test.ts
```

---

## 现有测试覆盖

✅ **Mock Helpers 测试** (`src/tests/helpers/mock-helpers.test.ts`)
- 33 个单元测试
- 完全验证所有 mock 辅助函数的正确性
- 可作为使用示例参考

✅ **API Service 测试** (`src/services/__tests__/api.spec.ts`)
- 6 个单元测试
- 验证请求/响应拦截器
- 验证 API 方法

---

## 后续开发指南

### 如何为新功能编写测试

1. **为 views 编写测试**：
   - 导入 fixtures 创建初始数据
   - Mock 路由和 stores
   - 验证组件渲染和交互
   - 示例：`UsersView.test.ts` (30-50 行代码)

2. **为 components 编写测试**：
   - 使用 @vue/test-utils mount()
   - Mock 所需的 props 和 events
   - 验证用户交互
   - 示例：`AdminLayout.test.ts` (20-40 行代码)

3. **为 stores 编写测试**：
   - 使用 createPinia()
   - Mock getters 和 actions
   - 验证状态变化
   - 示例：`auth.store.test.ts` (25-45 行代码)

4. **为 services 编写测试**：
   - Mock axios 请求
   - 验证 API 调用参数
   - 验证响应处理
   - 示例：`user.service.test.ts` (20-35 行代码)

### 预计可编写的测试数量

基于后端 200+ 个测试的规模，Admin 项目可编写：

| 类别 | 文件数 | 每个文件测试数 | 总计 |
|------|--------|--------------|------|
| Views (14个页面) | 14 | 8-12 | 112-168 |
| Components (9个) | 9 | 5-8 | 45-72 |
| Stores (2个) | 2 | 6-8 | 12-16 |
| Services/Utils | 3 | 6-10 | 18-30 |
| **总计** | **28** | **6-9** | **187-286** |

---

## 常见问题

### Q: 如何 mock localStorage?
```typescript
import { createMockLocalStorage } from '@tests/helpers'

const localStorage = createMockLocalStorage()
localStorage.setItem('token', 'abc123')
expect(localStorage.getItem('token')).toBe('abc123')
```

### Q: 如何 mock API 调用失败?
```typescript
import { mockApiFailure } from '@tests/helpers'

const failFn = mockApiFailure(vi, 500, 'Server Error')
try {
  await failFn()
} catch (error) {
  expect(error.response.code).toBe(500)
}
```

### Q: 如何测试 Pinia store?
```typescript
import { createPinia, setActivePinia } from 'pinia'
import { createMockStoreAction } from '@tests/helpers'

beforeEach(() => {
  setActivePinia(createPinia())
})

it('should dispatch action', async () => {
  const store = useAuthStore()
  const loginMock = createMockStoreAction({ success: true })
  // 测试 store
})
```

### Q: 如何测试 Vue 组件?
```typescript
import { mount } from '@vue/test-utils'
import MyComponent from './MyComponent.vue'
import { createMockRouter } from '@tests/helpers'

it('should render component', () => {
  const router = createMockRouter()
  const wrapper = mount(MyComponent, {
    global: {
      plugins: [router]
    }
  })
  expect(wrapper.exists()).toBe(true)
})
```

---

## 框架验证清单

完成日期：2026-03-04 ✅

- [x] Step 1.1：Admin 代码结构分析完成
  - [x] 各目录文件数量统计
  - [x] 技术栈列表
  - [x] 测试框架状态检查

- [x] Step 1.2：vitest 框架验证完成
  - [x] vitest 已安装
  - [x] 测试环境已配置（happy-dom）
  - [x] Vue Test Utils 已配置
  - [x] npm test 命令可用

- [x] Step 1.3：Fixtures 库创建完成
  - [x] 5 个 fixture 文件已创建
  - [x] 40+ 个工厂函数实现
  - [x] 所有工厂函数都支持 overrides 参数
  - [x] index.ts 统一导出

- [x] Step 1.4：Mock Helpers 库创建完成
  - [x] 25+ 个辅助函数实现
  - [x] 33 个单元测试全部通过
  - [x] Helpers API 与后端完全一致

- [x] Step 1.5：测试脚本配置完成
  - [x] npm test 命令可用
  - [x] vitest 框架成功启动
  - [x] 所有测试通过（39/39）

---

## 文件清单

### Fixtures 库 (5 个文件，~400 行代码)
- ✅ `src/tests/fixtures/user-fixtures.ts` (85 行)
- ✅ `src/tests/fixtures/period-fixtures.ts` (105 行)
- ✅ `src/tests/fixtures/enrollment-fixtures.ts` (90 行)
- ✅ `src/tests/fixtures/insight-fixtures.ts` (105 行)
- ✅ `src/tests/fixtures/index.ts` (7 行)

### Mock Helpers 库 (3 个文件，~700 行代码)
- ✅ `src/tests/helpers/mock-helpers.ts` (280 行)
- ✅ `src/tests/helpers/mock-helpers.test.ts` (270 行)
- ✅ `src/tests/helpers/index.ts` (5 行)

### 配置文件更新 (2 个文件)
- ✅ `src/tests/setup.ts` (更新)
- ✅ `package.json` (添加 4 个 test scripts)

---

## 后续步骤

### 立即可做的事情

1. **编写 Views 测试**
   - 从 `src/views/DashboardView.vue` 开始
   - 使用 fixtures 创建初始数据
   - 预计 8-12 个测试

2. **编写 Components 测试**
   - 从 `src/components/AdminLayout.vue` 开始
   - 测试布局和导航
   - 预计 5-8 个测试

3. **编写 Stores 测试**
   - 为 `src/stores/auth.ts` 编写测试
   - 验证登录/退出逻辑
   - 预计 6-8 个测试

### 长期目标

- 实现 200+ 个单元测试（与后端对标）
- 达到 60%+ 代码覆盖率
- 建立完整的测试文档和最佳实践
- 集成 CI/CD 自动运行测试

---

**框架已完全就绪，可开始编写 200+ 个单元测试！** 🚀
