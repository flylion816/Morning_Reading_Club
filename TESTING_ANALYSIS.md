# 📊 晨读营测试补全项目 - 分析与初步设计

**生成日期**: 2026-03-04
**项目状态**: 分析完成，准备就绪
**下一步**: 开始 Admin Phase 1 (框架准备)

---

## 📈 项目现状分析

### 1. 代码量统计

```
总计: 115+ 源文件

Backend (✅ 已完成):
  - 代码文件: 45+ 文件
  - 测试文件: 34 个
  - 测试用例: 922 个 ✅
  - 覆盖率: 75%+ (lines)

Admin (🔄 部分完成):
  - 代码文件: 35 个 (26 Vue + 9 TS)
  - 测试文件: 1 个
  - 测试用例: 1 个
  - 覆盖率: 0.3% ❌

Miniprogram (⚠️ 未开始):
  - 代码文件: 36 个 (18 页 + 2 组 + 11 服 + 5 工)
  - 测试文件: 0 个
  - 测试用例: 0 个
  - 覆盖率: 0% ❌
```

### 2. 技术栈差异分析

| 维度 | Backend | Admin | Miniprogram |
|------|---------|-------|------------|
| **核心框架** | Node.js | Vue 3 | 微信小程序 |
| **数据库** | MongoDB | - | - |
| **测试框架** | Jest | Vitest | Jest |
| **语言** | JavaScript | TypeScript | JavaScript |
| **Mock 库** | Sinon.js | Vitest vi | Jest vi |
| **现状** | ✅ 完整 | 🔄 1/200 | ❌ 0/180 |

### 3. 代码结构对比

```
Backend 架构:
  src/
  ├── controllers/   ← 类似 Admin views/
  ├── services/      ← 类似 Admin services/
  ├── utils/         ← 类似 Admin utils/
  ├── middleware/    ← 类似 Admin router guards/
  ├── models/        ← (Admin/Miniprogram 无此层)
  └── routes/        ← (Admin/Miniprogram 无此层)

Admin 架构:
  src/
  ├── views/         ← 类似 Backend controllers (但是 Vue 组件)
  ├── components/    ← (Backend 无此层)
  ├── services/      ← 类似 Backend services
  ├── stores/        ← (Backend 无此层，Pinia 状态管理)
  ├── router/        ← (Backend 无此层)
  └── utils/         ← 类似 Backend utils

Miniprogram 架构:
  ├── pages/         ← 类似 Backend controllers + views (组合)
  ├── components/    ← (Backend 无此层)
  ├── services/      ← 类似 Backend services
  ├── utils/         ← 类似 Backend utils
  └── config/        ← (Backend 分散在多处)
```

---

## 🎯 测试策略对应表

### Backend → Admin 对应关系

```
Backend 控制器测试 (Controller Tests)
  ↓ 转化为
Admin 视图+服务测试 (Views + Services Tests)

示例:
  Backend: auth.controller.test.js (20 个测试)
    - login() → 成功/失败/超时/invalid credentials
    - register() → 邮箱冲突/密码弱/网络错误
    ↓
  Admin: LoginView.spec.ts + auth.store.spec.ts (15 个测试)
    - 表单验证 → 错误提示
    - 登录按钮 → API 调用
    - token 保存 → localStorage/Pinia
    - 导航转向 → vue-router
```

### Backend → Miniprogram 对应关系

```
Backend 服务测试 (Service Tests)
  ↓ 转化为
Miniprogram 服务测试 (Service Tests)

示例:
  Backend: user.service.test.js (15 个测试)
    - getUserById() → 成功/失败/权限
    - updateUser() → 验证/冲突/超时
    ↓
  Miniprogram: user.service.spec.js (12 个测试)
    - getUserProfile() → 成功/失败/mock mode
    - updateUserProfile() → 验证/错误处理

Backend 中间件测试 (Middleware Tests)
  ↓ 转化为
Miniprogram 页面事件测试 (Page Lifecycle Tests)

示例:
  Backend: auth.middleware.test.js (8 个测试)
    - token 验证
    - 权限检查
    - 错误处理
    ↓
  Miniprogram: page-events.spec.js (10 个测试)
    - onLoad() 初始化
    - 权限检查
    - 错误回恢
```

---

## 🏗️ 框架设置详解

### Admin 现状

**已有** ✅:
- vitest.config.ts (完整配置)
- src/tests/setup.ts (基础设置)
- package.json 中已安装:
  - vitest@4.0.16
  - @vue/test-utils@2.4.6
  - happy-dom@20.0.11
  - c8@10.1.3 (覆盖率工具)

**缺少** ❌:
- localStorage 全局 mock
- 完整的 Vue Router mock
- Pinia 测试辅助函数
- 完整的 API 拦截器 mock

**优先级修复**:
1. 扩展 src/tests/setup.ts (添加 localStorage mock)
2. 创建 src/tests/fixtures/ 目录结构
3. 创建 src/tests/helpers/ 目录结构

### Miniprogram 现状

**已有** ✅:
- package.json (仅有基础依赖)
- jest.config.js (需要创建)
- 微信小程序框架本身

**缺少** ❌:
- 完整的 Jest 配置
- 微信 API 全局 mock (wx.*)
- 测试环境配置
- Babel 配置
- 测试 script

**优先级修复**:
1. 安装 Jest + 依赖
2. 创建 jest.config.js
3. 创建微信 API 全局 mock
4. 创建测试目录结构

---

## 📂 目录结构详细设计

### Admin 目录结构（完整）

```
admin/
├── src/
│   ├── tests/
│   │   ├── setup.ts                    # ✅ 存在（需扩展）
│   │   ├── fixtures/
│   │   │   ├── __index.ts              # 统一导出
│   │   │   ├── api.fixtures.ts         # API 响应数据（40+ 个）
│   │   │   ├── store.fixtures.ts       # Pinia 状态数据（20+ 个）
│   │   │   ├── auth.fixtures.ts        # 认证相关数据（10+ 个）
│   │   │   ├── form.fixtures.ts        # 表单数据（15+ 个）
│   │   │   └── component.fixtures.ts   # 组件 props 数据（20+ 个）
│   │   └── helpers/
│   │       ├── __index.ts              # 统一导出
│   │       ├── api-helpers.ts          # API mock（10+ 函数）
│   │       ├── component-helpers.ts    # 组件测试（8+ 函数）
│   │       ├── store-helpers.ts        # Store mock（6+ 函数）
│   │       └── router-helpers.ts       # Router mock（4+ 函数）
│   ├── services/
│   │   ├── api.ts                      # ✅ 存在
│   │   └── __tests__/
│   │       └── api.spec.ts             # ✅ 存在（1 测试）→ 目标 30+
│   ├── stores/
│   │   ├── auth.ts                     # ✅ 存在
│   │   ├── counter.ts                  # ✅ 存在
│   │   └── __tests__/
│   │       ├── auth.store.spec.ts      # 新建：15 个测试
│   │       └── counter.store.spec.ts   # 新建：10 个测试
│   ├── components/
│   │   ├── (8 个组件)
│   │   └── __tests__/
│   │       ├── AdminLayout.spec.ts     # 新建：10 个测试
│   │       ├── RichTextEditor.spec.ts  # 新建：12 个测试
│   │       └── ... (其他组件)
│   ├── views/
│   │   ├── (17 个页面)
│   │   └── __tests__/
│   │       ├── LoginView.spec.ts       # 新建：10 个测试
│   │       ├── DashboardView.spec.ts   # 新建：12 个测试
│   │       └── ... (其他页面)
│   ├── router/
│   │   ├── index.ts                    # ✅ 存在
│   │   └── __tests__/
│   │       └── index.spec.ts           # 新建：15 个测试
│   ├── utils/
│   │   ├── logger.ts                   # ✅ 存在
│   │   ├── exportUtils.ts              # ✅ 存在
│   │   └── __tests__/
│   │       ├── logger.spec.ts          # 新建：8 个测试
│   │       └── exportUtils.spec.ts     # 新建：12 个测试
│   └── __tests__/
│       └── integration/
│           ├── auth-flow.spec.ts       # 新建：8 个测试
│           ├── user-mgmt-flow.spec.ts  # 新建：8 个测试
│           └── content-mgmt-flow.spec.ts # 新建：4 个测试
│
├── vitest.config.ts                    # ✅ 存在
├── package.json                        # ✅ 存在
└── vite.config.ts                      # ✅ 存在
```

**统计**:
- Fixture 文件: 6 个 (85+ 个数据对象)
- Helper 文件: 5 个 (28+ 个函数)
- 测试文件: 25+ 个
- 总测试数: 200+ 个

### Miniprogram 目录结构（完整）

```
miniprogram/
├── tests/
│   ├── setup.js                        # 新建：全局配置
│   ├── fixtures/
│   │   ├── __index.js                  # 统一导出
│   │   ├── user.fixtures.js            # 用户数据（20+ 个）
│   │   ├── api.fixtures.js             # API 响应（30+ 个）
│   │   ├── wx.fixtures.js              # 微信 API 数据（25+ 个）
│   │   ├── page.fixtures.js            # 页面初始数据（15+ 个）
│   │   └── service.fixtures.js         # 服务数据（20+ 个）
│   └── helpers/
│       ├── __index.js                  # 统一导出
│       ├── wx-helpers.js               # wx API mock（15+ 函数）
│       ├── request-helpers.js          # 请求 mock（8+ 函数）
│       ├── page-helpers.js             # Page mock（8+ 函数）
│       └── service-helpers.js          # Service mock（6+ 函数）
├── unit/
│   ├── services/
│   │   ├── auth.service.spec.js        # 新建：8 个测试
│   │   ├── user.service.spec.js        # 新建：6 个测试
│   │   ├── course.service.spec.js      # 新建：6 个测试
│   │   ├── checkin.service.spec.js     # 新建：6 个测试
│   │   ├── insight.service.spec.js     # 新建：6 个测试
│   │   └── ... (6 个其他服务)
│   ├── utils/
│   │   ├── formatters.spec.js          # 新建：10 个测试
│   │   ├── validators.spec.js          # 新建：8 个测试
│   │   ├── request.spec.js             # 新建：4 个测试
│   │   └── logger.spec.js              # 新建：3 个测试
│   ├── components/
│   │   ├── course-card.spec.js         # 新建：15 个测试
│   │   └── notification-badge.spec.js  # 新建：15 个测试
│   └── events/
│       ├── page-events.spec.js         # 新建：10 个测试
│       └── component-events.spec.js    # 新建：10 个测试
├── pages/
│   ├── login/
│   │   ├── login.js                    # ✅ 存在
│   │   └── __tests__/
│   │       └── login.spec.js           # 新建：12 个测试
│   ├── index/
│   │   ├── index.js                    # ✅ 存在
│   │   └── __tests__/
│   │       └── index.spec.js           # 新建：10 个测试
│   ├── courses/
│   │   ├── courses.js                  # ✅ 存在
│   │   └── __tests__/
│   │       └── courses.spec.js         # 新建：10 个测试
│   ├── checkin/
│   │   ├── checkin.js                  # ✅ 存在
│   │   └── __tests__/
│   │       └── checkin.spec.js         # 新建：8 个测试
│   ├── insights/
│   │   ├── insights.js                 # ✅ 存在
│   │   └── __tests__/
│   │       └── insights.spec.js        # 新建：5 个测试
│   └── ... (13 个其他页面)
├── integration/
│   ├── auth-flow.spec.js               # 新建：8 个测试
│   ├── course-enrollment-flow.spec.js  # 新建：8 个测试
│   ├── checkin-flow.spec.js            # 新建：6 个测试
│   └── insight-flow.spec.js            # 新建：3 个测试
│
├── jest.config.js                      # 新建：配置文件
├── .babelrc                            # 新建：Babel 配置
├── app.js                              # ✅ 存在
├── package.json                        # ✅ 存在（需添加 test script）
└── ... (其他文件)
```

**统计**:
- Fixture 文件: 6 个 (110+ 个数据对象)
- Helper 文件: 5 个 (37+ 个函数)
- 测试文件: 35+ 个
- 总测试数: 180+ 个

---

## 🧩 代码示例库

### 1. Admin Fixtures 示例

**api.fixtures.ts** (API 响应数据):
```typescript
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
          email: 'admin@example.com',
          nickname: 'Admin',
          role: 'admin',
          createdAt: '2025-01-01T00:00:00Z'
        }
      }
    },

    loginFailure401: {
      code: 401,
      message: '邮箱或密码错误',
      data: null
    },

    loginFailure500: {
      code: 500,
      message: '服务器错误',
      data: null
    }
  },

  // 用户管理
  users: {
    listSuccess: {
      code: 200,
      message: '成功',
      data: [
        {
          _id: '507f1f77bcf86cd799439011',
          email: 'user1@example.com',
          nickname: '小凡',
          createdAt: '2025-01-01T00:00:00Z'
        },
        {
          _id: '507f1f77bcf86cd799439012',
          email: 'user2@example.com',
          nickname: '阿泰',
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

    listEmpty: {
      code: 200,
      message: '成功',
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0
      }
    }
  }
};
```

### 2. Admin Mock Helpers 示例

**api-helpers.ts** (可复用 mock 函数):
```typescript
import { vi } from 'vitest';
import { apiFixtures } from '../fixtures/api.fixtures';

export function createMockApiSuccess(endpoint: string, data: any) {
  return vi.fn().mockResolvedValue({
    data,
    status: 200,
    statusText: 'OK'
  });
}

export function createMockApiError(errorCode: number, message: string) {
  const error = new Error(message);
  (error as any).response = {
    status: errorCode,
    data: { code: errorCode, message }
  };
  return vi.fn().mockRejectedValue(error);
}

export function createMockAxios() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };
}
```

### 3. Admin 测试示例

**LoginView.spec.ts** (完整测试):
```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import LoginView from '../../views/LoginView.vue';
import { createMockApiSuccess, createMockApiError } from '../helpers/api-helpers';
import { apiFixtures } from '../fixtures/api.fixtures';

describe('LoginView', () => {
  let wrapper: any;
  let mockApi: any;

  beforeEach(() => {
    // Given: 创建 mock API
    mockApi = {
      login: createMockApiSuccess('auth/login', apiFixtures.auth.loginSuccess)
    };

    // 挂载组件
    wrapper = shallowMount(LoginView, {
      global: {
        provide: {
          apiService: mockApi
        }
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该渲染登录表单', () => {
      // Then: 验证表单元素存在
      expect(wrapper.find('form').exists()).toBe(true);
      expect(wrapper.find('input[type="email"]').exists()).toBe(true);
      expect(wrapper.find('input[type="password"]').exists()).toBe(true);
      expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
    });
  });

  describe('成功路径', () => {
    it('应该成功登录', async () => {
      // Given: 用户输入正确的邮箱和密码
      await wrapper.find('input[type="email"]').setValue('admin@example.com');
      await wrapper.find('input[type="password"]').setValue('password123');

      // When: 点击登录按钮
      await wrapper.find('form').trigger('submit');
      await wrapper.vm.$nextTick();

      // Then: 验证 API 被调用
      expect(mockApi.login).toHaveBeenCalled();

      // 验证 token 被保存
      expect(localStorage.getItem('adminToken')).toBe(apiFixtures.auth.loginSuccess.data.token);

      // 验证导航到首页
      expect(wrapper.vm.$router.push).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('错误路径', () => {
    it('应该处理 401 未认证错误', async () => {
      // Given: mock API 返回 401 错误
      mockApi.login = createMockApiError(401, '邮箱或密码错误');

      // When: 提交表单
      await wrapper.find('form').trigger('submit');
      await wrapper.vm.$nextTick();

      // Then: 验证错误信息被显示
      expect(wrapper.vm.error).toBe('邮箱或密码错误');
      expect(wrapper.find('.error-message').text()).toContain('邮箱或密码错误');
    });

    it('应该处理 500 服务器错误', async () => {
      // Given: mock API 返回 500 错误
      mockApi.login = createMockApiError(500, '服务器错误');

      // When: 提交表单
      await wrapper.find('form').trigger('submit');
      await wrapper.vm.$nextTick();

      // Then: 验证友好的错误提示
      expect(wrapper.vm.error).toContain('服务器');
    });
  });

  describe('边界情况', () => {
    it('应该验证邮箱格式', async () => {
      // When: 输入无效邮箱
      await wrapper.find('input[type="email"]').setValue('invalid-email');

      // Then: 验证错误提示
      expect(wrapper.find('.email-error').exists()).toBe(true);
    });

    it('应该防止空表单提交', async () => {
      // When: 不输入任何内容，直接点击提交
      await wrapper.find('form').trigger('submit');

      // Then: 验证 API 没被调用
      expect(mockApi.login).not.toHaveBeenCalled();
    });
  });
});
```

### 4. Miniprogram Fixtures 示例

**user.fixtures.js** (用户数据):
```javascript
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
    role: 'admin'
  },

  newUser: {
    _id: '507f1f77bcf86cd799439013',
    openId: 'o7skL6xxxxxx',
    nickname: '新用户',
    createdAt: '2025-03-04T00:00:00Z'
  }
};
```

### 5. Miniprogram Mock Helpers 示例

**wx-helpers.js** (微信 API mock):
```javascript
/**
 * 微信 API Mock Helpers
 */

export function createMockWxApi() {
  return {
    // 认证
    login: jest.fn().mockResolvedValue({
      code: '021test1234',
      errMsg: 'login:ok'
    }),

    // 用户信息
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

    // 导航
    navigateTo: jest.fn().mockResolvedValue({ errMsg: 'navigateTo:ok' }),
    redirectTo: jest.fn().mockResolvedValue({ errMsg: 'redirectTo:ok' }),

    // 请求
    request: jest.fn().mockResolvedValue({
      data: {},
      statusCode: 200,
      errMsg: 'request:ok'
    }),

    // 提示
    showToast: jest.fn(),
    showModal: jest.fn().mockResolvedValue({
      confirm: true,
      errMsg: 'showModal:ok'
    })
  };
}

export function createMockPage(data = {}) {
  return {
    data: { ...data },
    setData: jest.fn(function(newData) {
      Object.assign(this.data, newData);
    }),
    onLoad: jest.fn(),
    onShow: jest.fn(),
    onHide: jest.fn()
  };
}
```

### 6. Miniprogram 测试示例

**login.spec.js** (完整测试):
```javascript
import { userFixtures } from '../fixtures/user.fixtures';
import { apiFixtures } from '../fixtures/api.fixtures';
import { wxFixtures } from '../fixtures/wx.fixtures';
import { createMockWxApi, createMockPage } from '../helpers/wx-helpers';

describe('LoginPage', () => {
  let page;
  let mockWx;

  beforeEach(() => {
    // Given: 创建 mock 环境
    mockWx = createMockWxApi();
    global.wx = mockWx;

    // 创建页面实例
    page = createMockPage({
      loading: false,
      error: null
    });
  });

  describe('微信登录', () => {
    it('应该成功登录', async () => {
      // Given: mock 登录接口返回成功
      mockWx.request.mockResolvedValue({
        data: apiFixtures.auth.loginSuccess,
        statusCode: 200
      });

      // When: 调用页面的登录方法
      await page.handleLoginClick();

      // Then: 验证 wx.login 被调用
      expect(mockWx.login).toHaveBeenCalled();

      // 验证 token 被保存
      expect(mockWx.setStorageSync).toHaveBeenCalledWith(
        'token',
        apiFixtures.auth.loginSuccess.data.token
      );

      // 验证导航到首页
      expect(mockWx.navigateTo).toHaveBeenCalledWith({
        url: '/pages/index/index'
      });
    });

    it('应该处理登录失败', async () => {
      // Given: mock 登录返回错误
      mockWx.login.mockResolvedValue({
        code: undefined,
        errMsg: 'login:fail'
      });

      // When: 调用登录方法
      await page.handleLoginClick();

      // Then: 验证错误提示被显示
      expect(page.data.error).toBeTruthy();
      expect(mockWx.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '登录失败',
          icon: 'none'
        })
      );
    });
  });

  describe('本地存储', () => {
    it('应该恢复保存的登录状态', () => {
      // Given: localStorage 中有 token 和 userInfo
      mockWx.getStorageSync.mockReturnValueOnce({
        token: 'test-token',
        userInfo: userFixtures.validUser
      });

      // When: 页面加载
      page.onLoad();

      // Then: 验证自动导航到首页
      expect(mockWx.navigateTo).toHaveBeenCalledWith({
        url: '/pages/index/index'
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理用户取消微信授权', async () => {
      // Given: 用户拒绝登录
      mockWx.login.mockRejectedValue(new Error('User cancelled'));

      // When: 用户取消
      await page.handleLoginClick();

      // Then: 不应该出现错误提示（仅记录）
      expect(page.data.error).toBeFalsy();
    });
  });
});
```

---

## 📊 覆盖率预测

### Admin 预期覆盖率

```
Lines:       60% → 65% (200 个测试后)
Functions:   65% → 70%
Branches:    55% → 60%
Statements:  60% → 65%
```

### Miniprogram 预期覆盖率

```
Lines:       60% → 65% (180 个测试后)
Functions:   65% → 70%
Branches:    55% → 60%
Statements:  60% → 65%
```

---

## ⚠️ 已知风险和注意事项

### Admin 特殊考虑

1. **Vue Router 导航** - 需要完整 mock
   - 使用 `createMemoryHistory()` 或完整 router mock
   - 验证 push/replace/redirect 调用

2. **Pinia Store** - 需要测试环境隔离
   - 每个测试前重置 store
   - 避免 store 状态污染

3. **localStorage** - 需要清理
   - beforeEach 中清理
   - afterEach 中验证清理

4. **Vue 组件异步** - 需要正确的 nextTick
   - 使用 `await wrapper.vm.$nextTick()`
   - 测试异步数据加载

### Miniprogram 特殊考虑

1. **微信 API** - 需要完整 global mock
   - wx.* API 都需要 mock
   - 微信登录流程复杂，多个 API 协作

2. **小程序生命周期** - 页面复杂度高
   - onLoad/onShow/onHide/onUnload 顺序
   - 组件生命周期与页面生命周期的交互

3. **本地存储** - 微信小程序特有
   - wx.setStorageSync() 需要模拟
   - 跨页面数据同步

4. **导航** - 微信特有的 navigateTo/switchTab
   - 需要 mock 导航栈管理
   - URL 参数传递

---

## 🎬 立即可执行的行动

### 第一阶段：Admin 框架准备（本会话推荐）

**1. 验证现有 vitest 配置**
```bash
cd admin
npm run test -- src/services/__tests__/api.spec.ts
# 应该输出：1 test passed
```

**2. 扩展 setup.ts**
```bash
# 添加 localStorage mock
# 添加 vue-router mock
# 验证全局配置生效
```

**3. 创建 Fixtures 库**
```bash
mkdir -p src/tests/fixtures
# 创建 api.fixtures.ts
# 创建 store.fixtures.ts
# 创建 auth.fixtures.ts
```

**4. 创建 Mock Helpers 库**
```bash
mkdir -p src/tests/helpers
# 创建 api-helpers.ts
# 创建 component-helpers.ts
# 创建 store-helpers.ts
```

**预计时间**: 2-3 小时

### 第二阶段：Admin 测试编写（下一会话）

**Task A1-A7 按顺序执行**
- 优先级：A1 (Services) > A2 (Stores) > A5 (Views)
- 每个任务完成后立即提交

**预计时间**: 4-5 小时

### 第三阶段：Miniprogram 框架 + 测试（后续会话）

**Phase 3: 框架准备**
- 安装 Jest
- 创建 jest.config.js
- 创建微信 API mock

**Phase 4: 测试编写**
- Task M1-M6 按顺序执行

**预计时间**: 6-8 小时

---

## 📝 快速参考清单

### Admin Phase 1 检查清单

- [ ] Step 1.1: 代码结构分析完成
- [ ] Step 1.2: vitest 框架验证
- [ ] Step 1.3: Fixtures 库创建 (5 文件)
- [ ] Step 1.4: Mock Helpers 库创建 (4 文件)
- [ ] 验证现有测试仍然通过
- [ ] Git 提交：`test: admin setup - 框架和工具库准备完成`

### Admin Phase 2 检查清单

- [ ] Task A1: Services 测试 30+ ✅
- [ ] Task A2: Stores 测试 25+ ✅
- [ ] Task A3: Utils 测试 20+ ✅
- [ ] Task A4: Components 测试 40+ ✅
- [ ] Task A5: Views 测试 50+ ✅
- [ ] Task A6: Router 测试 15+ ✅
- [ ] Task A7: Integration 测试 20+ ✅
- [ ] 总计: 200+ 测试 ✅

### Miniprogram Phase 3-4 检查清单

- [ ] Phase 3: 框架准备完成
- [ ] Phase 4: 180+ 个测试完成
- [ ] 覆盖率达到 60%+
- [ ] 所有提交格式规范

---

## 📈 成功指标

### 最终目标

| 指标 | 目标 | 验证方式 |
|------|------|---------|
| Admin 总测试数 | 200+ | `npm run test -- admin` 统计 |
| Miniprogram 总测试数 | 180+ | `npm run test -- miniprogram` 统计 |
| 覆盖率 (lines) | 60%+ | 覆盖率报告 |
| 覆盖率 (functions) | 65%+ | 覆盖率报告 |
| 覆盖率 (branches) | 55%+ | 覆盖率报告 |
| 提交提成 | 规范 | Git log 查看 |
| 文档完整性 | 100% | 检查注释和说明 |

---

## 🔗 相关文档

- [TESTING_PLAN.md](./TESTING_PLAN.md) - 完整测试计划（本文档的详细版）
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发流程规范
- Backend 测试参考: `backend/tests/` 目录

---

**下一步**: 开始 Admin Phase 1 框架准备

当您准备好开始时，请确认，我将：
1. 扩展 admin/src/tests/setup.ts
2. 创建 Fixtures 库框架
3. 创建 Mock Helpers 库框架
4. 提交初始框架到 GitHub
