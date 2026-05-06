# 🧪 晨读营完整单元测试补全计划

> **目标**: 为 Admin (Vue 3) 和 Miniprogram (微信小程序) 创建完整的单元测试，保持与 Backend 项目完全相同的方式和一致性。

**更新日期**: 2026-03-04

---

## 📊 项目现状快速总览

### 测试覆盖情况

| 项目 | 类型 | 代码文件数 | 现有测试 | 新增测试 | 总目标 | 进度 |
|------|------|-----------|---------|---------|-------|------|
| **Backend** | Node.js + Mongoose | 45+ | 922 个 test() | - | ✅ 922 | 100% |
| **Admin** | Vue 3 + TypeScript | 35 (26 Vue + 9 TS) | 1 | 199 | **200** | 🔄 0.5% |
| **Miniprogram** | 微信小程序 | 36 (18 页面 + 2 组件 + 11 服务 + 5 工具) | 0 | 180 | **180** | 🔄 0% |
| **TOTAL** | 全栈 | 115+ | 923 | 379 | **1302** | 🎯 |

### 项目架构

```
晨读营全栈项目/
├── backend/                    # ✅ 完整测试 (922 tests)
│   ├── src/controllers/        # 20+ controller tests
│   ├── src/middleware/         # 8+ middleware tests
│   ├── src/utils/              # 12+ utility tests
│   ├── src/services/           # 8+ service tests
│   └── tests/                  # 测试基础设施
│       ├── fixtures/           # 9 个 fixture 文件 (集中数据管理)
│       ├── unit/helpers/       # Mock helpers 库
│       ├── integration/        # 集成测试
│       └── setup.js            # 全局测试配置
│
├── admin/                      # 🔄 部分测试 (1/200)
│   ├── src/
│   │   ├── views/              # 17 个页面组件 (类似 Backend controllers)
│   │   ├── components/         # 8 个可复用组件
│   │   ├── services/           # 1 个 API 服务文件
│   │   ├── stores/             # 2 个 Pinia store
│   │   ├── router/             # 1 个路由配置
│   │   ├── utils/              # 3 个工具函数文件
│   │   └── tests/              # 测试目录
│   │       ├── setup.ts        # ✅ 已有
│   │       ├── fixtures/       # 待创建
│   │       └── helpers/        # 待创建
│   └── package.json            # ✅ 已配置 vitest
│
└── miniprogram/                # 🔄 无测试 (0/180)
    ├── pages/                  # 18 个页面 (多个逻辑文件)
    ├── components/             # 2 个自定义组件
    ├── services/               # 11 个 API 服务
    ├── utils/                  # 5 个工具函数
    └── tests/                  # 待创建
        ├── setup.js            # 待创建
        ├── fixtures/           # 待创建
        └── helpers/            # 待创建
```

---

## 🎯 核心目标

### 1. 保持完全一致性

✅ **与 Backend 测试完全相同的方式**：

| 方面 | Backend | Admin | Miniprogram |
|------|---------|-------|------------|
| 框架 | Jest | Vitest | Jest |
| 语言 | JavaScript | TypeScript | JavaScript |
| Mock 库 | Sinon | Vitest vi | Jest vi |
| 测试结构 | Given-When-Then | Given-When-Then | Given-When-Then |
| Fixtures | 集中管理 (9 files) | 集中管理 | 集中管理 |
| Mock Helpers | 统一库 (mock-helpers.js) | 统一库 | 统一库 |
| 覆盖率要求 | 60% lines, 65% functions | 相同 | 相同 |

### 2. 按模块系统覆盖

**Backend 成功案例** (已验证):
- ✅ 所有 controller 的正常路径和错误路径
- ✅ 所有 middleware 的认证、错误处理、日志
- ✅ 所有 utility 函数的边界情况
- ✅ 跨模块集成测试

**Admin 目标** (复用模式):
- 所有 view (页面) 的逻辑和交互
- 所有可复用组件的 props 和事件
- Pinia store 的状态变更和 getters
- API service 的请求和错误处理
- 工具函数的各种输入情况

**Miniprogram 目标** (适配小程序):
- 所有 page 的生命周期和事件处理
- 所有 service 的 API 调用和 mock 模式
- 所有 util 函数的计算和格式化
- 自定义组件的数据绑定和交互
- wx API 的调用和响应处理

### 3. 完整错误覆盖

**测试全谱**：

```javascript
// 示例：API 调用测试

describe('getUserProfile', () => {
  // ✅ 正常路径
  it('应该成功获取用户信息', async () => {
    // Given: API mock 返回用户数据
    // When: 调用 getUserProfile()
    // Then: 返回正确的用户对象
  });

  // ✅ 错误路径 #1: 网络错误
  it('应该处理网络错误', async () => {
    // Given: 网络请求失败
    // When: 调用 getUserProfile()
    // Then: 抛出错误或返回错误提示
  });

  // ✅ 错误路径 #2: 401 未认证
  it('应该处理401未认证错误', async () => {
    // Given: API 返回 401
    // When: 调用 getUserProfile()
    // Then: 清除 token，跳转登录
  });

  // ✅ 错误路径 #3: 500 服务器错误
  it('应该处理500服务器错误', async () => {
    // Given: API 返回 500
    // When: 调用 getUserProfile()
    // Then: 显示错误提示
  });

  // ✅ 错误路径 #4: 超时
  it('应该处理请求超时', async () => {
    // Given: 请求超时
    // When: 调用 getUserProfile()
    // Then: 显示超时提示
  });

  // ✅ 边界情况 #5: 空响应
  it('应该处理空响应', async () => {
    // Given: API 返回空数据
    // When: 调用 getUserProfile()
    // Then: 返回默认值或空对象
  });
});
```

---

## 📋 执行计划详解

### Phase 1: Admin 项目分析与准备 (Step 1-4)

#### Step 1.1: 分析 Admin 代码结构

**目录结构**:
```
admin/src/
├── views/                # 17 个页面组件
│   ├── DashboardView.vue
│   ├── LoginView.vue
│   ├── UsersView.vue
│   ├── PeriodsView.vue
│   ├── EnrollmentsView.vue
│   ├── CheckinsManagementView.vue
│   ├── InsightsManagementView.vue
│   ├── InsightRequestsManagementView.vue
│   ├── PaymentsView.vue
│   ├── ContentManagementView.vue
│   ├── AnalyticsView.vue
│   ├── AuditLogsView.vue
│   └── ... (13/17 已列出)
│
├── components/           # 8 个可复用组件
│   ├── AdminLayout.vue
│   ├── RichTextEditor.vue
│   ├── WelcomeItem.vue
│   ├── TheWelcome.vue
│   ├── HelloWorld.vue
│   └── icons/ (4 个 icon 组件)
│
├── services/            # 1 个 API 服务
│   └── api.ts           # 包含完整的 axios 配置、拦截器、转换逻辑
│
├── stores/              # 2 个 Pinia store
│   ├── auth.ts          # 认证状态管理
│   └── counter.ts       # 计数器状态 (示例 store)
│
├── router/              # 1 个路由配置
│   └── index.ts         # Vue Router 路由定义和守卫
│
├── utils/               # 3 个工具文件
│   ├── logger.ts
│   ├── exportUtils.ts
│   └── ... (其他 util)
│
├── types/               # 类型定义
│   └── api.ts
│
└── tests/               # 测试基础设施
    ├── setup.ts         # ✅ 已有
    ├── fixtures/        # 待创建 (4-5 个文件)
    └── helpers/         # 待创建 (3-4 个文件)
```

**关键数据**:
- 26 个 Vue 组件文件
- 9 个 TypeScript 文件
- 35 个总源文件
- 1 个现有测试 (api.spec.ts)

#### Step 1.2: 建立 Admin 测试框架

**现状**:
- ✅ Vitest 已安装 (package.json 中)
- ✅ vitest.config.ts 已配置
- ✅ src/tests/setup.ts 已创建
- ✅ @vue/test-utils 已安装 (Vue 3 组件测试)
- ✅ happy-dom 已安装 (轻量级 DOM 环境)

**需要验证的项目**:
```bash
# 检查 test script
npm run test  # 应该运行 vitest

# 检查现有测试
npm run test -- src/services/__tests__/api.spec.ts

# 检查覆盖率
npm run test -- --coverage
```

**可能需要添加的配置**:
- ✅ 已有 `globals: true`，支持全局 describe/it
- 可能需要: `setupFilesAfterEnv` for additional Vue setup
- 可能需要: ES modules 兼容性配置

#### Step 1.3: 创建 Admin Fixtures (集中数据管理)

**目录结构**:
```
admin/src/tests/fixtures/
├── __index.ts                   # 统一导出点
├── api.fixtures.ts              # API 响应数据
├── store.fixtures.ts            # Pinia store 初始状态
├── component.fixtures.ts        # 组件 props 数据
├── auth.fixtures.ts             # 认证数据
└── form.fixtures.ts             # 表单数据
```

**api.fixtures.ts 示例**:
```typescript
/**
 * API 响应 Mock 数据
 * 集中管理所有 HTTP 响应数据，提高复用率
 */

export const apiFixtures = {
  // 认证
  auth: {
    loginSuccess: {
      code: 200,
      message: '登录成功',
      data: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          _id: '507f1f77bcf86cd799439011',
          email: 'admin@morningreading.com',
          nickname: 'Admin',
          role: 'admin'
        }
      }
    },
    loginFailure: {
      code: 401,
      message: '邮箱或密码错误',
      data: null
    }
  },

  // 用户列表
  users: {
    list: [
      {
        _id: '507f1f77bcf86cd799439011',
        email: 'user1@example.com',
        nickname: '小凡',
        role: 'user',
        createdAt: '2025-01-01T00:00:00Z'
      },
      {
        _id: '507f1f77bcf86cd799439012',
        email: 'user2@example.com',
        nickname: '阿泰',
        role: 'user',
        createdAt: '2025-01-02T00:00:00Z'
      }
    ],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 100,
      totalPages: 10
    }
  },

  // 其他 API 响应...
};
```

**store.fixtures.ts 示例**:
```typescript
/**
 * Pinia Store 初始状态数据
 */

export const storeFixtures = {
  auth: {
    isAuthenticated: true,
    token: 'test-token',
    user: {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@morningreading.com',
      nickname: 'Admin'
    }
  },

  authEmpty: {
    isAuthenticated: false,
    token: null,
    user: null
  }
};
```

#### Step 1.4: 建立 Admin Mock Helpers (可复用函数库)

**目录结构**:
```
admin/src/tests/helpers/
├── __index.ts                  # 统一导出
├── api-helpers.ts              # API mock 函数 (10+)
├── component-helpers.ts        # Vue 组件测试助手 (8+)
├── store-helpers.ts            # Pinia store mock (6+)
└── router-helpers.ts           # Router mock (4+)
```

**api-helpers.ts 示例**:
```typescript
/**
 * API Service Mock Helpers
 *
 * 提供可复用的 mock 函数，避免在每个测试中重复编写
 */

import { vi } from 'vitest';
import { apiFixtures } from '../fixtures/api.fixtures';

/**
 * 创建成功的 API mock
 * @param endpoint API 端点
 * @param data 响应数据
 */
export function createMockApiSuccess(endpoint: string, data: any) {
  return vi.fn().mockResolvedValue({
    data,
    status: 200,
    statusText: 'OK'
  });
}

/**
 * 创建失败的 API mock
 * @param endpoint API 端点
 * @param errorCode 错误代码
 * @param message 错误信息
 */
export function createMockApiError(
  endpoint: string,
  errorCode: number,
  message: string
) {
  const error = new Error(message);
  (error as any).response = {
    status: errorCode,
    data: {
      code: errorCode,
      message
    }
  };
  return vi.fn().mockRejectedValue(error);
}

/**
 * 创建超时的 API mock
 */
export function createMockApiTimeout() {
  const error = new Error('Request timeout');
  (error as any).code = 'ECONNABORTED';
  return vi.fn().mockRejectedValue(error);
}

/**
 * Mock axios 实例
 * @returns 完整的 mock axios 对象
 */
export function createMockAxios() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() }
    }
  };
}

/**
 * Mock localStorage (API token)
 */
export function setupMockLocalStorage() {
  const store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    })
  };
}
```

**component-helpers.ts 示例**:
```typescript
/**
 * Vue 3 组件测试助手
 * 简化 Vue 组件的挂载和测试
 */

import { shallowMount, mount } from '@vue/test-utils';
import { vi } from 'vitest';

/**
 * 创建挂载选项（含常用 mock 和 provide）
 */
export function createComponentOptions(overrides: any = {}) {
  return {
    global: {
      mocks: {
        $router: {
          push: vi.fn(),
          replace: vi.fn()
        },
        $route: {
          path: '/',
          params: {},
          query: {}
        }
      },
      provide: {
        apiService: vi.fn()
      },
      stubs: {
        teleport: true,
        Teleport: true
      }
    },
    ...overrides
  };
}

/**
 * 快速挂载 Vue 组件（浅挂载）
 */
export function shallowMountComponent(component: any, options: any = {}) {
  return shallowMount(component, createComponentOptions(options));
}

/**
 * 快速挂载 Vue 组件（完整挂载）
 */
export function mountComponent(component: any, options: any = {}) {
  return mount(component, createComponentOptions(options));
}

/**
 * 模拟用户交互：点击
 */
export async function userClick(wrapper: any, selector: string) {
  const element = wrapper.find(selector);
  await element.trigger('click');
  await wrapper.vm.$nextTick();
}

/**
 * 模拟用户交互：输入
 */
export async function userInput(wrapper: any, selector: string, value: string) {
  const element = wrapper.find(selector);
  await element.setValue(value);
  await wrapper.vm.$nextTick();
}

/**
 * 等待异步操作完成
 */
export async function waitForAsync(wrapper: any, ms: number = 0) {
  await wrapper.vm.$nextTick();
  if (ms > 0) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**store-helpers.ts 示例**:
```typescript
/**
 * Pinia Store Mock Helpers
 */

import { setActivePinia, createPinia } from 'pinia';
import { vi } from 'vitest';

/**
 * 创建测试用的 Pinia 实例
 */
export function createTestPinia() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}

/**
 * Mock Auth Store
 */
export function createMockAuthStore() {
  return {
    isAuthenticated: true,
    token: 'test-token',
    user: {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@example.com',
      nickname: 'Admin'
    },
    login: vi.fn(),
    logout: vi.fn(),
    setToken: vi.fn(),
    setUser: vi.fn()
  };
}

/**
 * Mock 任意 Store（通用）
 */
export function createMockStore(initialState: any = {}) {
  const state = { ...initialState };
  return {
    ...state,
    $patch: vi.fn((patch: any) => {
      Object.assign(state, patch);
    }),
    $reset: vi.fn(),
    $subscribe: vi.fn()
  };
}
```

---

### Phase 2: Admin 单元测试编写 (7个子任务)

#### Task A1: Services 层测试 (API 调用) - 预计 30 个测试

**文件**: `admin/src/services/__tests__/api.spec.ts` (现有，需扩展)

**测试覆盖范围**:
```typescript
describe('API Service', () => {
  // ✅ 请求拦截器
  describe('请求拦截器', () => {
    it('应该添加 Authorization header');
    it('应该处理没有 token 的情况');
    it('应该正确编码请求体');
  });

  // ✅ 响应拦截器
  describe('响应拦截器', () => {
    it('应该转换标准格式 {code, message, data}');
    it('应该处理数组响应 {list: [...], pagination: {...}}');
    it('应该处理 401 未认证错误');
    it('应该处理 403 无权限错误');
    it('应该处理 500 服务器错误');
    it('应该处理网络错误');
    it('应该处理超时错误');
    it('应该处理未知错误');
  });

  // ✅ HTTP 方法
  describe('HTTP 方法', () => {
    it('应该正确执行 GET 请求');
    it('应该正确执行 POST 请求');
    it('应该正确执行 PUT 请求');
    it('应该正确执行 DELETE 请求');
    it('应该正确执行 PATCH 请求');
  });

  // ✅ 数据转换
  describe('数据转换', () => {
    it('应该处理空响应');
    it('应该处理 null 响应');
    it('应该处理空数组');
    it('应该保留 pagination 信息');
    it('应该处理嵌套对象');
  });

  // ✅ 边界情况
  describe('边界情况', () => {
    it('应该处理大型响应');
    it('应该处理特殊字符');
    it('应该处理 Unicode 字符');
  });
});
```

**预计测试数**: 30+

#### Task A2: Stores 层测试 (Pinia 状态) - 预计 25 个测试

**文件**: `admin/src/stores/__tests__/`

**创建**:
- `auth.store.spec.ts` - Auth store 测试 (15 个)
- `counter.store.spec.ts` - Counter store 测试 (10 个)

**测试覆盖范围**:
```typescript
describe('Auth Store', () => {
  // ✅ 初始状态
  it('应该有正确的初始状态');

  // ✅ Actions
  it('应该设置 token');
  it('应该设置用户信息');
  it('应该执行登录');
  it('应该处理登录失败');
  it('应该执行登出');
  it('应该清除 token 和用户信息');

  // ✅ Getters
  it('应该判断是否已认证');
  it('应该获取当前用户信息');
  it('应该获取用户的权限');

  // ✅ 持久化
  it('应该从 localStorage 恢复状态');
  it('应该持久化状态到 localStorage');

  // ✅ 错误处理
  it('应该处理网络错误');
  it('应该处理无效的 token');
});
```

**预计测试数**: 25+

#### Task A3: Utils 层测试 (工具函数) - 预计 20 个测试

**文件**: `admin/src/utils/__tests__/`

**创建**:
- `logger.spec.ts` (8 个)
- `exportUtils.spec.ts` (12 个)

**测试覆盖范围**:
```typescript
describe('Logger', () => {
  it('应该记录 debug 日志');
  it('应该记录 info 日志');
  it('应该记录 warn 日志');
  it('应该记录 error 日志');
  it('应该格式化日志信息');
  it('应该处理对象日志');
  it('应该处理数组日志');
  it('应该支持日志级别过滤');
});

describe('Export Utils', () => {
  it('应该导出为 CSV');
  it('应该导出为 Excel');
  it('应该导出为 JSON');
  it('应该处理大型数据集');
  it('应该处理特殊字符');
  it('应该处理日期格式化');
  it('应该处理金额格式化');
  it('应该处理空数据');
  it('应该生成文件名');
  it('应该触发下载');
  it('应该处理导出错误');
  it('应该验证导出格式');
});
```

**预计测试数**: 20+

#### Task A4: Components 测试 (可复用组件) - 预计 40 个测试

**文件**: `admin/src/components/__tests__/`

**创建**:
- `AdminLayout.spec.ts` (10 个)
- `RichTextEditor.spec.ts` (12 个)
- `HelloWorld.spec.ts` (8 个)
- `icons/*.spec.ts` (10 个)

**测试覆盖范围**:
```typescript
describe('AdminLayout 组件', () => {
  it('应该渲染导航栏');
  it('应该渲染侧边栏');
  it('应该渲染主内容区');
  it('应该处理导航点击');
  it('应该支持响应式布局');
  it('应该处理用户登出');
  it('应该显示用户信息');
  it('应该处理权限检查');
  it('应该支持主题切换');
  it('应该处理错误状态');
});

describe('RichTextEditor 组件', () => {
  it('应该渲染编辑器');
  it('应该加载初始内容');
  it('应该处理文本输入');
  it('应该支持粗体格式');
  it('应该支持斜体格式');
  it('应该支持列表格式');
  it('应该支持链接插入');
  it('应该支持图片上传');
  it('应该验证内容');
  it('应该发出 change 事件');
  it('应该处理粘贴事件');
  it('应该支持撤销/重做');
});
```

**预计测试数**: 40+

#### Task A5: Views 测试 (页面逻辑) - 预计 50 个测试

**文件**: `admin/src/views/__tests__/`

**创建** (优先级):
- `LoginView.spec.ts` (10 个) - 优先级最高
- `DashboardView.spec.ts` (12 个)
- `UsersView.spec.ts` (10 个)
- `PeriodsView.spec.ts` (10 个)
- `AnalyticsView.spec.ts` (8 个)

**测试覆盖范围** (LoginView 示例):
```typescript
describe('LoginView', () => {
  // ✅ 渲染
  it('应该渲染登录表单');
  it('应该显示邮箱输入框');
  it('应该显示密码输入框');
  it('应该显示登录按钮');

  // ✅ 用户交互
  it('应该处理邮箱输入');
  it('应该处理密码输入');
  it('应该验证表单');
  it('应该处理登录点击');

  // ✅ 成功路径
  it('应该成功登录');
  it('应该保存 token 到 localStorage');
  it('应该跳转到首页');
  it('应该显示成功提示');

  // ✅ 错误路径
  it('应该处理登录失败');
  it('应该显示错误信息');
  it('应该清除敏感信息');
  it('应该处理网络错误');

  // ✅ 边界情况
  it('应该处理空输入');
  it('应该处理无效邮箱');
  it('应该处理密码过短');
  it('应该防止重复提交');
});
```

**预计测试数**: 50+

#### Task A6: Router 测试 (路由守卫) - 预计 15 个测试

**文件**: `admin/src/router/__tests__/index.spec.ts`

**测试覆盖范围**:
```typescript
describe('Router', () => {
  // ✅ 路由定义
  it('应该定义所有路由');
  it('应该支持嵌套路由');
  it('应该处理动态路由参数');

  // ✅ 导航守卫
  it('应该检查认证状态');
  it('应该禁止未认证用户访问受保护页面');
  it('应该允许认证用户访问受保护页面');
  it('应该检查用户权限');
  it('应该禁止低权限用户访问管理页面');
  it('应该处理重定向');
  it('应该处理导航失败');

  // ✅ 404 处理
  it('应该重定向到 404 页面');
  it('应该支持通配符路由');

  // ✅ 元数据
  it('应该支持 meta 字段');
  it('应该读取页面标题');
});
```

**预计测试数**: 15+

#### Task A7: Integration 测试 (完整流程) - 预计 20 个测试

**文件**: `admin/src/__tests__/integration/`

**创建**:
- `auth-flow.spec.ts` (8 个)
- `user-management-flow.spec.ts` (8 个)
- `content-management-flow.spec.ts` (4 个)

**测试覆盖范围**:
```typescript
describe('认证流程 (Integration)', () => {
  it('完整的登录-首页-登出流程');
  it('登录失败后重试');
  it('token 过期后自动刷新');
  it('并发请求的 token 处理');
  it('错误恢复流程');
  it('会话超时处理');
  it('权限变更后的UI更新');
  it('错误回收流程');
});

describe('用户管理流程 (Integration)', () => {
  it('完整的查询-编辑-保存流程');
  it('批量操作流程');
  it('导出用户列表');
  it('搜索和过滤');
  it('排序和分页');
  it('并发编辑冲突');
  it('操作权限检查');
  it('审计日志记录');
});
```

**预计测试数**: 20+

---

### Phase 3: Miniprogram 项目准备 (Step 3.1-3.4)

#### Step 3.1: 分析 Miniprogram 代码结构

**目录结构**:
```
miniprogram/
├── pages/                      # 18 个页面
│   ├── index/index.js          # 首页
│   ├── login/login.js          # 登录页
│   ├── courses/courses.js      # 课程列表
│   ├── course-detail/course-detail.js
│   ├── checkin/checkin.js      # 打卡页
│   ├── checkin-records/checkin-records.js
│   ├── insights/insights.js    # 小凡看见
│   ├── insight-detail/insight-detail.js
│   ├── ranking/ranking.js      # 排行榜
│   ├── profile/profile.js      # 个人资料
│   ├── profile-others/profile-others.js
│   ├── members/members.js      # 成员列表
│   ├── notifications/notifications.js
│   ├── enrollment/enrollment.js
│   ├── payment/payment.js
│   ├── share/share.js
│   ├── privacy-policy/privacy-policy.js
│   └── user-agreement/user-agreement.js
│
├── components/                 # 2 个自定义组件
│   ├── course-card/index.js
│   └── notification-badge/notification-badge.js
│
├── services/                   # 11 个 API 服务
│   ├── auth.service.js         # 认证服务
│   ├── user.service.js         # 用户服务
│   ├── course.service.js       # 课程服务
│   ├── checkin.service.js      # 打卡服务
│   ├── insight.service.js      # 小凡看见服务
│   ├── comment.service.js      # 评论服务
│   ├── ranking.service.js      # 排行榜服务
│   ├── payment.service.js      # 支付服务
│   ├── enrollment.service.js   # 课程注册服务
│   ├── notification.service.js # 通知服务
│   └── websocket.service.js    # WebSocket 服务
│
├── utils/                      # 5 个工具函数
│   ├── request.js              # HTTP 请求库
│   ├── formatters.js           # 格式化函数
│   ├── validators.js           # 验证函数
│   ├── logger.js               # 日志工具
│   └── storage.js              # 本地存储工具
│
├── config/                     # 配置文件
│   └── env.js                  # 环境配置
│
└── app.js                      # 应用入口 (App 逻辑)
```

**关键数据**:
- 18 个页面逻辑文件
- 2 个自定义组件
- 11 个 API 服务
- 5 个工具函数
- 36 个总源文件

#### Step 3.2: 建立 Miniprogram 测试框架

**需要安装**:
```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0",
    "@babel/preset-env": "^7.20.0"
  }
}
```

**创建配置文件**:
```javascript
// miniprogram/jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.spec.js', '**/*.spec.js'],
  collectCoverageFrom: [
    'pages/**/*.js',
    'components/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  }
};
```

**创建 package.json script**:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

#### Step 3.3: 创建 Miniprogram Fixtures

**目录结构**:
```
miniprogram/tests/fixtures/
├── __index.js                  # 统一导出
├── user.fixtures.js            # 用户数据
├── api.fixtures.js             # API 响应
├── wx.fixtures.js              # 微信 API 数据
├── page.fixtures.js            # 页面数据
└── service.fixtures.js         # 服务数据
```

**fixtures 示例**:
```javascript
// user.fixtures.js
export const userFixtures = {
  validUser: {
    _id: '507f1f77bcf86cd799439011',
    openId: 'o7skL4xxxxxx',
    nickname: '小凡',
    avatar: 'https://example.com/avatar.jpg',
    signature: '天天开心，觉知当下！',
    createdAt: '2025-01-01T00:00:00Z'
  },

  adminUser: {
    _id: '507f1f77bcf86cd799439012',
    openId: 'o7skL5xxxxxx',
    nickname: '运营',
    role: 'admin',
    createdAt: '2025-01-01T00:00:00Z'
  }
};

// api.fixtures.js
export const apiFixtures = {
  getUserProfile: {
    code: 200,
    message: '成功',
    data: userFixtures.validUser
  },

  getCheckinsSuccess: {
    code: 200,
    message: '成功',
    data: [
      {
        _id: '507f1f77bcf86cd799439020',
        periodId: '507f1f77bcf86cd799439010',
        checkinDate: '2025-03-04',
        readingTime: 30,
        mood: '😊'
      }
    ],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 45
    }
  }
};

// wx.fixtures.js
export const wxFixtures = {
  loginResponse: {
    code: '021test1234',
    errMsg: 'login:ok'
  },

  getStorageSuccessResponse: {
    data: { _id: '507f1f77bcf86cd799439011', nickname: '小凡' },
    errMsg: 'getStorage:ok'
  }
};
```

#### Step 3.4: 建立 Miniprogram Mock Helpers

**目录结构**:
```
miniprogram/tests/helpers/
├── __index.js                  # 统一导出
├── wx-helpers.js               # 微信 API mock (15+)
├── request-helpers.js          # HTTP 请求 mock (8+)
├── page-helpers.js             # Page/Component 助手 (8+)
└── service-helpers.js          # Service mock (6+)
```

**wx-helpers.js 示例**:
```javascript
/**
 * 微信 API Mock Helpers
 * 模拟 wx.* 全局 API
 */

export function createMockWxApi() {
  return {
    // 登录
    login: jest.fn().mockResolvedValue({
      code: '021test1234',
      errMsg: 'login:ok'
    }),

    // 获取用户信息
    getUserInfo: jest.fn().mockResolvedValue({
      userInfo: {
        nickName: '小凡',
        avatarUrl: 'https://example.com/avatar.jpg'
      },
      errMsg: 'getUserInfo:ok'
    }),

    // 存储
    setStorageSync: jest.fn(),
    getStorageSync: jest.fn().mockReturnValue(null),
    removeStorageSync: jest.fn(),
    clearStorageSync: jest.fn(),

    // 导航
    navigateTo: jest.fn().mockResolvedValue({ errMsg: 'navigateTo:ok' }),
    redirectTo: jest.fn().mockResolvedValue({ errMsg: 'redirectTo:ok' }),
    navigateBack: jest.fn(),
    switchTab: jest.fn().mockResolvedValue({ errMsg: 'switchTab:ok' }),

    // 请求
    request: jest.fn().mockResolvedValue({
      data: {},
      statusCode: 200,
      errMsg: 'request:ok'
    }),

    // 提示
    showToast: jest.fn(),
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
    showModal: jest.fn().mockResolvedValue({
      confirm: true,
      errMsg: 'showModal:ok'
    }),

    // 其他
    getSystemInfo: jest.fn().mockReturnValue({
      model: 'iPhone',
      screenHeight: 667
    }),
    vibrateShort: jest.fn()
  };
}

/**
 * Mock Page 对象
 */
export function createMockPage(data = {}) {
  return {
    data: {
      ...data
    },
    setData: jest.fn(function(newData) {
      Object.assign(this.data, newData);
    }),
    onLoad: jest.fn(),
    onShow: jest.fn(),
    onHide: jest.fn(),
    onUnload: jest.fn()
  };
}

/**
 * Mock Component 对象
 */
export function createMockComponent(data = {}, methods = {}) {
  return {
    data: {
      ...data
    },
    methods: {
      ...methods
    },
    setData: jest.fn(function(newData) {
      Object.assign(this.data, newData);
    })
  };
}
```

**request-helpers.js 示例**:
```javascript
/**
 * HTTP 请求 Mock Helpers
 */

export function createMockRequest() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  };
}

/**
 * Mock 成功的 API 响应
 */
export function createMockApiResponse(data) {
  return {
    code: 200,
    message: '成功',
    data
  };
}

/**
 * Mock 失败的 API 响应
 */
export function createMockApiError(code, message) {
  const error = new Error(message);
  error.response = {
    status: code,
    data: {
      code,
      message
    }
  };
  return error;
}
```

---

### Phase 4: Miniprogram 单元测试编写 (6个子任务)

#### Task M1: Services 层 (API 调用) - 预计 35 个测试

**文件**: `miniprogram/tests/unit/services/`

**创建**:
- `auth.service.spec.js` (8 个)
- `user.service.spec.js` (6 个)
- `course.service.spec.js` (6 个)
- `checkin.service.spec.js` (6 个)
- `insight.service.spec.js` (6 个)
- `other-services.spec.js` (3 个)

**测试覆盖范围**:
```javascript
describe('AuthService', () => {
  // ✅ 成功路径
  it('应该成功登录');
  it('应该成功获取 token');
  it('应该成功刷新 token');

  // ✅ 错误路径
  it('应该处理登录失败');
  it('应该处理 token 过期');
  it('应该处理无效的 code');
  it('应该处理网络错误');

  // ✅ 本地存储
  it('应该保存 token 到本地存储');
  it('应该清除 token');
});

describe('UserService', () => {
  // ✅ CRUD 操作
  it('应该获取用户资料');
  it('应该更新用户资料');
  it('应该获取用户统计信息');
  it('应该处理空用户数据');
  it('应该处理大型头像 URL');
  it('应该处理特殊字符在用户名中');
});
```

**预计测试数**: 35+

#### Task M2: Utils 层 (工具函数) - 预计 25 个测试

**文件**: `miniprogram/tests/unit/utils/`

**创建**:
- `formatters.spec.js` (10 个)
- `validators.spec.js` (8 个)
- `request.spec.js` (4 个)
- `logger.spec.js` (3 个)

**测试覆盖范围**:
```javascript
describe('Formatters', () => {
  // ✅ 日期格式化
  it('应该格式化日期为 YYYY-MM-DD');
  it('应该格式化时间为 HH:mm:ss');
  it('应该处理 null/undefined 日期');
  it('应该处理无效日期');

  // ✅ 数字格式化
  it('应该格式化金额');
  it('应该格式化百分比');
  it('应该格式化千位分隔符');

  // ✅ 文本格式化
  it('应该截断长文本');
  it('应该处理特殊字符');
  it('应该处理 HTML 转义');
});

describe('Validators', () => {
  it('应该验证邮箱格式');
  it('应该验证手机号码');
  it('应该验证密码强度');
  it('应该验证 URL 格式');
  it('应该处理 null 输入');
  it('应该处理空字符串');
  it('应该处理特殊字符');
  it('应该处理 Unicode 字符');
});
```

**预计测试数**: 25+

#### Task M3: Components 层 - 预计 30 个测试

**文件**: `miniprogram/tests/unit/components/`

**创建**:
- `course-card.spec.js` (15 个)
- `notification-badge.spec.js` (15 个)

**测试覆盖范围**:
```javascript
describe('CourseCard 组件', () => {
  // ✅ 渲染
  it('应该渲染课程卡片');
  it('应该显示课程名称');
  it('应该显示课程图标');
  it('应该显示报名人数');

  // ✅ 交互
  it('应该处理点击事件');
  it('应该导航到课程详情');
  it('应该显示登录提示（未登录时）');
  it('应该禁用操作按钮（已注册时）');

  // ✅ 数据绑定
  it('应该接收 course props');
  it('应该处理空课程数据');
  it('应该处理缺失的字段');

  // ✅ 样式
  it('应该应用正确的样式');
  it('应该支持响应式布局');
});

describe('NotificationBadge 组件', () => {
  // ✅ 渲染
  it('应该渲染通知徽章');
  it('应该显示通知数量');
  it('应该隐藏零数量');

  // ✅ 样式
  it('应该应用正确的背景颜色');
  it('应该支持自定义颜色');
  it('应该处理大数字');
});
```

**预计测试数**: 30+

#### Task M4: Pages 逻辑 - 预计 45 个测试

**文件**: `miniprogram/tests/unit/pages/`

**优先级创建**:
- `login.spec.js` (12 个) - 最高优先级
- `index.spec.js` (10 个)
- `courses.spec.js` (10 个)
- `checkin.spec.js` (8 个)
- `insights.spec.js` (5 个)

**测试覆盖范围**:
```javascript
describe('LoginPage', () => {
  // ✅ 初始化
  it('应该初始化页面数据');
  it('应该检查登录状态');

  // ✅ 用户交互
  it('应该处理微信登录');
  it('应该显示加载状态');
  it('应该显示错误提示');

  // ✅ 成功路径
  it('应该成功登录');
  it('应该保存 token');
  it('应该导航到首页');

  // ✅ 错误路径
  it('应该处理网络错误');
  it('应该处理超时');
  it('应该显示友好的错误提示');

  // ✅ 边界情况
  it('应该防止重复点击');
  it('应该处理取消登录');
});

describe('IndexPage (首页)', () => {
  // ✅ 数据加载
  it('应该加载轮播图');
  it('应该加载课程列表');
  it('应该加载通知');

  // ✅ 分页
  it('应该加载下一页');
  it('应该检测到底部');
  it('应该显示加载更多');

  // ✅ 交互
  it('应该处理课程点击');
  it('应该处理通知点击');
  it('应该处理下拉刷新');
  it('应该处理上拉加载');
});
```

**预计测试数**: 45+

#### Task M5: 事件处理 - 预计 20 个测试

**文件**: `miniprogram/tests/unit/events/`

**创建**:
- `page-events.spec.js` (10 个)
- `component-events.spec.js` (10 个)

**测试覆盖范围**:
```javascript
describe('页面事件', () => {
  it('应该处理 onLoad 生命周期');
  it('应该处理 onShow 生命周期');
  it('应该处理 onHide 生命周期');
  it('应该处理 onUnload 生命周期');
  it('应该处理下拉刷新');
  it('应该处理上拉加载');
  it('应该处理页面滚动');
  it('应该处理分享事件');
  it('应该处理返回事件');
  it('应该清理资源');
});

describe('组件事件', () => {
  it('应该触发自定义事件');
  it('应该传递事件数据');
  it('应该处理事件冒泡');
  it('应该处理事件捕获');
  it('应该支持事件委托');
  it('应该处理多个监听器');
  it('应该支持事件移除');
  it('应该处理异步事件');
  it('应该处理事件错误');
  it('应该支持事件计数');
});
```

**预计测试数**: 20+

#### Task M6: Integration 测试 - 预计 25 个测试

**文件**: `miniprogram/tests/integration/`

**创建**:
- `auth-flow.spec.js` (8 个)
- `course-enrollment-flow.spec.js` (8 个)
- `checkin-flow.spec.js` (6 个)
- `insight-flow.spec.js` (3 个)

**测试覆盖范围**:
```javascript
describe('登录流程 (Integration)', () => {
  it('完整的登录流程');
  it('登录失败重试');
  it('登录状态恢复');
  it('token 刷新流程');
  it('登出流程');
  it('权限检查流程');
  it('错误恢复');
  it('会话管理');
});

describe('课程注册流程 (Integration)', () => {
  it('完整的课程浏览-注册-支付流程');
  it('注册后的权限更新');
  it('支付成功后的状态更新');
  it('取消注册流程');
  it('重新注册流程');
  it('多课程管理');
  it('配额限制检查');
  it('费用计算验证');
});

describe('打卡流程 (Integration)', () => {
  it('完整的打卡流程');
  it('打卡验证');
  it('打卡记录保存');
  it('统计更新');
  it('排行榜更新');
  it('成就解锁');
});

describe('小凡看见流程 (Integration)', () => {
  it('完整的发布-评论-点赞流程');
  it('权限检查');
  it('内容审核');
  it('通知推送');
});
```

**预计测试数**: 25+

---

## 🛠️ 测试框架配置清单

### Admin (Vitest)

- [x] 框架已安装
- [x] vitest.config.ts 已配置
- [x] setup.ts 已创建
- [ ] 需要扩展 setup.ts (添加 localStorage mock)
- [ ] 需要配置 ES modules
- [ ] 需要添加 vue-router mock

### Miniprogram (Jest)

- [ ] Jest 需要安装
- [ ] jest.config.js 需要创建
- [ ] setup.js 需要创建
- [ ] Babel 配置需要创建 (.babelrc)
- [ ] package.json scripts 需要添加
- [ ] 微信 API 全局 mock 需要创建

---

## 📝 Git 提交规范

**遵循既有的 Backend 规范**:

```bash
git commit -m "test: [项目] [模块] - X 个测试通过

详细说明:
- 创建或扩展了 X 个测试
- 测试覆盖 Y 个场景
- 覆盖率: Z%

预计测试数: X+

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**示例**:
```bash
git commit -m "test: admin api-service - 30 个测试通过

详细说明:
- 扩展了现有的 api.spec.ts 测试
- 添加了完整的拦截器、错误处理、数据转换测试
- 覆盖了 8 个 HTTP 方法和 5+ 错误场景
- 覆盖率: 85% lines, 90% functions

预计测试数: 30+

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 🎯 时间估算

### Admin 项目
- **Phase 1** (准备): 2-3 小时
  - Step 1.1 (分析): 30 分钟
  - Step 1.2 (框架): 30 分钟
  - Step 1.3 (Fixtures): 45 分钟
  - Step 1.4 (Helpers): 45 分钟

- **Phase 2** (测试编写): 4-5 小时
  - Task A1-A7: 4-5 小时 (200+ 个测试)

- **小计**: 6-8 小时

### Miniprogram 项目
- **Phase 3** (准备): 2-3 小时
  - Step 3.1 (分析): 30 分钟
  - Step 3.2 (框架): 45 分钟
  - Step 3.3 (Fixtures): 45 分钟
  - Step 3.4 (Helpers): 45 分钟

- **Phase 4** (测试编写): 4-5 小时
  - Task M1-M6: 4-5 小时 (180+ 个测试)

- **小计**: 6-8 小时

### 全总计: **12-16 小时** (分散在多个会话)

---

## 📊 预期成果

### 测试覆盖率目标

| 项目 | 行数 | 函数数 | 分支数 | 声明数 |
|------|------|--------|--------|--------|
| Backend | ✅ 75% | ✅ 80% | ✅ 70% | ✅ 75% |
| **Admin** | 🎯 60% | 🎯 65% | 🎯 55% | 🎯 60% |
| **Miniprogram** | 🎯 60% | 🎯 65% | 🎯 55% | 🎯 60% |

### 完成后的项目统计

| 指标 | 数值 |
|------|------|
| 总测试用例数 | 1302+ |
| 总测试文件数 | 50+ |
| Fixture 文件数 | 15+ |
| Mock Helper 函数数 | 100+ |
| 平均测试覆盖率 | 65%+ |

---

## 📚 参考资源

### 测试框架文档
- [Vitest 官方文档](https://vitest.dev/)
- [Jest 官方文档](https://jestjs.io/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Sinon.JS](https://sinonjs.org/) (Backend 参考)

### 最佳实践
- Backend 测试示例: `backend/tests/`
- Fixtures 模式: `backend/tests/fixtures/`
- Mock Helpers: `backend/tests/unit/helpers/mock-helpers.js`

### 微信小程序相关
- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/)
- [微信 API 参考](https://developers.weixin.qq.com/miniprogram/dev/api/)

---

## 🚀 下一步行动

**立即可以开始的任务**:

1. **Admin Phase 1** (当前会话推荐)
   - [ ] Step 1.1: 详细分析 Admin 代码 (已在本文档中)
   - [ ] Step 1.2: 验证 vitest 框架配置
   - [ ] Step 1.3: 创建 Admin Fixtures 库
   - [ ] Step 1.4: 创建 Admin Mock Helpers 库

2. **Admin Phase 2** (下一会话)
   - [ ] Task A1: Services 测试 (30 个)
   - [ ] Task A2: Stores 测试 (25 个)
   - [ ] 待续...

3. **Miniprogram Phase 3-4** (后续会话)
   - [ ] 按照相同的 Phase/Task 结构执行

---

## 📝 文档维护

本计划文档是活动文档，会随着项目进展更新。更新点:
- 完成的任务会标记为 ✅
- 发现的新需求会添加到对应的 Phase/Task
- 时间估算会根据实际反馈调整

**上次更新**: 2026-03-04
**维护者**: Claude Code
**项目**: 晨读营全栈项目

---

## ✨ 一致性保证

本计划完全遵循 Backend 项目的已验证成功模式:

✅ **Fixtures 集中管理** - 有 9 个 fixture 文件，避免硬编码测试数据
✅ **Mock Helpers 库** - 有 100+ 可复用的 mock 函数
✅ **Given-When-Then 结构** - 每个测试都清晰描述预期行为
✅ **完整错误覆盖** - 每个功能都测试 5+ 个错误路径
✅ **规范的 Git 提交** - 每个任务完成后立即提交
✅ **完整的文档** - 每个部分都有文档和示例

**目标**: 使 Admin 和 Miniprogram 的测试质量与 Backend 完全相同 🎯
