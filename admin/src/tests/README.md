# Admin 项目测试框架

> 为 Admin 项目的 200+ 个单元测试提供的完整框架基础设施

## 快速使用

### 导入 Fixtures（测试数据工厂）

```typescript
import {
  // 用户相关
  createMockAdmin,
  createMockUser,
  createMockUsers,
  createMockDisabledUser,

  // 期次相关
  createMockPeriod,
  createMockPeriods,
  createMockDraftPeriod,
  createMockClosedPeriod,
  createMockFullPeriod,
  createMockUpcomingPeriod,

  // 报名相关
  createMockEnrollment,
  createMockEnrollments,
  createMockPendingEnrollment,
  createMockPaidEnrollment,
  createMockCancelledEnrollment,

  // 小凡看见相关
  createMockInsight,
  createMockInsights,
  createMockPopularInsight,
  createMockImageInsight,
} from '@tests/fixtures'
```

### 导入 Mock Helpers（辅助函数）

```typescript
import {
  // API Mock
  createMockApiSuccess,
  createMockApiError,
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiDelete,
  mockApiFailure,

  // Store Mock
  createMockStoreGetter,
  createMockStoreAction,
  createMockStoreMutation,

  // Router & Storage Mock
  createMockRouter,
  createMockRouteParams,
  createMockLocalStorage,
  createMockSessionStorage,

  // 工具函数
  mockWindowAlert,
  mockConsoleLog,
  waitFor,
  delay,
} from '@tests/helpers'
```

## 使用示例

### 示例 1: 测试 API Service

```typescript
import { describe, it, expect, vi } from 'vitest'
import { mockApiGet, createMockApiSuccess } from '@tests/helpers'

describe('API Service', () => {
  it('should fetch users successfully', async () => {
    // 创建 mock 函数
    const mockGet = mockApiGet(vi, { users: [] })

    // 调用并验证
    const result = await mockGet()
    expect(result.code).toBe(200)
    expect(result.data.users).toEqual([])
  })
})
```

### 示例 2: 测试 Views

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UsersView from '@/views/UsersView.vue'
import { createMockUsers } from '@tests/fixtures'
import { mockApiGet, createMockRouter } from '@tests/helpers'

describe('UsersView', () => {
  it('should display user list', async () => {
    // 准备数据
    const users = createMockUsers(5)
    const mockGet = mockApiGet(vi, { users })

    // Mock 路由
    const router = createMockRouter()

    // 挂载组件
    const wrapper = mount(UsersView, {
      global: {
        plugins: [router]
      }
    })

    // 验证
    expect(wrapper.exists()).toBe(true)
  })
})
```

### 示例 3: 测试 Pinia Store

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { createMockUser } from '@tests/fixtures'
import { createMockStoreAction } from '@tests/helpers'

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should login user', async () => {
    const store = useAuthStore()
    const user = createMockUser()

    // Mock action
    store.login = createMockStoreAction({ user })

    // 测试
    await store.login('email@example.com', 'password')
    expect(store.login).toHaveBeenCalled()
  })
})
```

### 示例 4: 测试 Components

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminLayout from '@/components/AdminLayout.vue'

describe('AdminLayout', () => {
  it('should render layout', () => {
    const wrapper = mount(AdminLayout)
    expect(wrapper.find('.admin-layout').exists()).toBe(true)
  })

  it('should handle logout', async () => {
    const wrapper = mount(AdminLayout)
    const logoutBtn = wrapper.find('.logout-btn')

    await logoutBtn.trigger('click')
    // 验证退出逻辑
  })
})
```

## 目录结构

```
src/tests/
├── fixtures/                      # 测试数据工厂
│   ├── user-fixtures.ts          # 用户相关
│   ├── period-fixtures.ts        # 期次相关
│   ├── enrollment-fixtures.ts    # 报名相关
│   ├── insight-fixtures.ts       # 小凡看见相关
│   └── index.ts                  # 统一导出
├── helpers/                       # Mock 辅助函数
│   ├── mock-helpers.ts           # 所有 mock 函数
│   ├── mock-helpers.test.ts      # 33+ 个测试
│   └── index.ts                  # 统一导出
├── setup.ts                       # 全局测试配置
└── README.md                      # 本文件
```

## API Reference

### Fixtures

#### createMockUser(overrides)
创建普通用户对象
```typescript
const user = createMockUser({ email: 'custom@example.com' })
// { id, _id, email, nickname, avatar, status, createdAt, ... }
```

#### createMockPeriod(overrides)
创建期次对象
```typescript
const period = createMockPeriod({ name: 'Custom Period' })
// { id, _id, name, description, startDate, endDate, price, ... }
```

#### createMockEnrollment(overrides)
创建报名对象
```typescript
const enrollment = createMockEnrollment({ status: 'paid' })
// { id, _id, userId, periodId, status, paymentStatus, amount, ... }
```

#### createMockInsight(overrides)
创建小凡看见对象
```typescript
const insight = createMockInsight({ content: 'My thoughts...' })
// { id, _id, userId, periodId, content, type, likeCount, ... }
```

### Mock Helpers

#### mockApiGet(sandbox, returnValue)
Mock GET 请求
```typescript
const mockGet = mockApiGet(vi, { data: [] })
const result = await mockGet()
// { code: 200, message: 'Success', data: { data: [] } }
```

#### mockApiFailure(sandbox, code, message)
Mock API 失败
```typescript
const mockFail = mockApiFailure(vi, 500, 'Error')
try {
  await mockFail()
} catch (error) {
  // error.response = { code: 500, message: 'Error', data: null }
}
```

#### createMockRouter(sandbox)
Mock Vue Router
```typescript
const router = createMockRouter()
await router.push('/path')
expect(router.push).toHaveBeenCalledWith('/path')
```

#### createMockLocalStorage()
Mock localStorage
```typescript
const storage = createMockLocalStorage()
storage.setItem('key', 'value')
expect(storage.getItem('key')).toBe('value')
```

## 测试状态

✅ **框架完成度**: 100%
- ✅ 5 个 Fixtures 文件 (40+ 函数)
- ✅ 25+ 个 Mock Helpers 函数
- ✅ 33+ 个单元测试全部通过
- ✅ 2 个配置文件已更新
- ✅ npm test 命令就绪

## 运行测试

```bash
# 运行所有测试
npm test

# 运行指定文件
npm test path/to/test.spec.ts

# 监听模式
npm run test:watch

# 打开 UI
npm run test:ui

# 生成覆盖率报告
npm run test:coverage
```

## 最佳实践

1. **使用 overrides 参数定制数据**
   ```typescript
   const user = createMockUser({
     email: 'custom@example.com',
     status: 'inactive'
   })
   ```

2. **为每个测试创建独立的数据副本**
   ```typescript
   const users = createMockUsers(3)  // 不会相互影响
   ```

3. **组合使用 fixtures 和 helpers**
   ```typescript
   const user = createMockUser()
   const mockGet = mockApiGet(vi, { user })
   ```

4. **在 beforeEach 中清理 mock**
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks()
   })
   ```

## 相关文档

- 📖 [完整测试框架指南](../TEST_FRAMEWORK_GUIDE.md)
- 📚 [Vitest 文档](https://vitest.dev)
- 🧪 [Vue Test Utils 文档](https://test-utils.vuejs.org)
- 🏪 [Pinia 测试文档](https://pinia.vuejs.org/cookbook/testing.html)

---

**框架已完全就绪！开始编写你的第一个测试吧！** 🚀
