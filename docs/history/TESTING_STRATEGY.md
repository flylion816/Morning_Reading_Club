# 晨读营项目 - 完整测试与验证机制

**版本**: 1.0.0
**日期**: 2025-12-17
**状态**: 设计方案

---

## 📋 目录

1. [测试金字塔设计](#1-测试金字塔设计)
2. [触发规则与优先级](#2-触发规则与优先级)
3. [后端API测试方案](#3-后端api测试方案)
4. [PC后台管理系统测试方案](#4-pc后台管理系统测试方案)
5. [小程序测试方案](#5-小程序测试方案)
6. [Git Hooks配置](#6-git-hooks配置)
7. [CI/CD流程](#7-cicd流程)
8. [测试工具与依赖](#8-测试工具与依赖)
9. [预期反馈时间](#9-预期反馈时间)
10. [实施步骤](#10-实施步骤)

---

## 1. 测试金字塔设计

```
                  /\
                 /  \     E2E Tests (5%)
                /----\
               /      \   Integration Tests (25%)
              /--------\
             /          \ Unit Tests (70%)
            /____________\
```

### 1.1 测试层级划分

| 测试层级     | 覆盖率目标   | 执行时间 | 触发时机               |
| ------------ | ------------ | -------- | ---------------------- |
| **单元测试** | 70-80%       | < 2分钟  | Pre-commit, CI每次提交 |
| **集成测试** | 关键路径100% | 2-5分钟  | Pre-push, CI每次提交   |
| **E2E测试**  | 核心场景100% | 5-10分钟 | CI PR合并前            |
| **性能测试** | 关键API      | 3-5分钟  | 手动 / 定期CI          |
| **安全测试** | 依赖漏洞扫描 | 1-2分钟  | CI每日 / 每周          |

---

## 2. 触发规则与优先级

### 2.1 本地开发阶段

#### **Pre-commit Hook**（必须通过）

```bash
执行顺序（串行）：
1. ESLint 代码检查（30秒）
2. Prettier 格式检查（10秒）
3. 敏感文件检查（5秒）
4. Debugger/console警告（5秒）
5. 单元测试（快速模式 - 仅修改文件相关）（1分钟）

失败策略：
- 任一步骤失败 → 阻止提交
- 提供清晰的错误信息和修复建议
```

#### **Pre-push Hook**（推荐但可跳过）

```bash
执行顺序（串行）：
1. 所有单元测试（2分钟）
2. 集成测试（快速模式）（3分钟）
3. 构建测试（确保代码可编译）（1分钟）

失败策略：
- 测试失败 → 警告但允许推送
- 需要添加 --no-verify 参数跳过
```

### 2.2 CI/CD 阶段

#### **每次 Push 到任意分支**

```yaml
执行顺序（并行优化）：
1. Lint 检查（所有模块并行）
├─ Backend ESLint
├─ Admin ESLint
└─ Miniprogram 静态检查

2. 单元测试（所有模块并行）
├─ Backend Unit Tests (70%+ coverage)
├─ Admin Unit Tests (60%+ coverage)
└─ Miniprogram 工具函数测试

3. 集成测试（串行，依赖数据库）
└─ Backend Integration Tests

失败策略：
- 任一步骤失败 → 标记为失败
- 通知开发者修复
```

#### **Pull Request 阶段**

```yaml
执行顺序（完整验证）：
1. 所有 Push 阶段的检查
2. E2E 测试（并行）
├─ Admin E2E (Cypress)
└─ API 契约测试
3. 性能测试（关键API）
4. 安全扫描（npm audit, Snyk）
5. 代码覆盖率报告

失败策略：
- 必须全部通过才能合并
- 覆盖率低于阈值 → 警告但不阻止
```

#### **定期任务**

```yaml
每日 02:00 AM:
  - 完整测试套件
  - 依赖漏洞扫描
  - 性能基准测试
  - 生成测试报告

每周日:
  - 全量E2E测试
  - 压力测试
  - 数据库备份验证
```

---

## 3. 后端API测试方案

### 3.1 单元测试（70%覆盖率目标）

**测试框架**: Mocha + Chai + Sinon

**目录结构**:

```
backend/
├── tests/
│   ├── unit/
│   │   ├── controllers/      # 控制器单元测试（已存在）
│   │   ├── models/            # 模型单元测试（已存在）
│   │   ├── middleware/        # 中间件单元测试（已存在）
│   │   ├── utils/             # 工具函数单元测试（已存在）
│   │   └── services/          # 服务层单元测试（待添加）
```

**执行命令**:

```bash
# 运行所有单元测试
npm run test:unit

# 运行单个文件测试
npm run test:unit -- tests/unit/controllers/auth.controller.test.js

# 监听模式（开发时）
npm run test:watch
```

**示例测试用例**:

```javascript
// tests/unit/controllers/auth.controller.test.js
describe('Auth Controller', () => {
  describe('login()', () => {
    it('应该成功登录并返回JWT token', async () => {
      // 测试正常登录流程
    });

    it('应该拒绝错误的密码', async () => {
      // 测试密码错误场景
    });

    it('应该在用户不存在时返回404', async () => {
      // 测试用户不存在场景
    });
  });
});
```

### 3.2 集成测试（关键路径100%）

**测试框架**: Mocha + Chai + Supertest + MongoDB Memory Server

**目录结构**:

```
backend/
├── tests/
│   ├── integration/
│   │   ├── auth.integration.test.js        # 认证流程（已存在，需修复）
│   │   ├── checkin.integration.test.js     # 打卡流程（已存在）
│   │   ├── insight.integration.test.js     # 小凡看见流程（已存在）
│   │   ├── period-section.integration.test.js # 期次章节（已存在）
│   │   ├── payment.integration.test.js     # 支付流程（待添加）
│   │   └── user-lifecycle.integration.test.js # 用户全流程（待添加）
```

**关键测试场景**:

1. **用户注册 → 登录 → 获取信息** 完整流程
2. **用户报名期次 → 打卡 → 查看统计** 完整流程
3. **创建小凡看见 → 评论 → 通知** 完整流程
4. **管理员创建期次 → 用户报名 → 完成学习** 完整流程

**执行命令**:

```bash
# 运行所有集成测试
npm run test:integration

# 运行单个集成测试
npm run test:integration -- tests/integration/auth.integration.test.js
```

**修复现有问题**:

```javascript
// 问题: beforeAll is not defined in Mocha
// 解决: 使用 before() 替代 beforeAll()

// ❌ 错误写法（Jest风格）
beforeAll(async () => {
  await mongoServer.start();
});

// ✅ 正确写法（Mocha风格）
before(async function () {
  this.timeout(30000); // 增加超时时间
  await mongoServer.start();
});
```

### 3.3 API契约测试

**测试工具**: Postman + Newman 或 REST Client

**目录结构**:

```
backend/
├── tests/
│   ├── api-contracts/
│   │   ├── auth.postman_collection.json
│   │   ├── users.postman_collection.json
│   │   ├── periods.postman_collection.json
│   │   └── insights.postman_collection.json
```

**执行命令**:

```bash
# 使用 Newman 运行 Postman 集合
npx newman run tests/api-contracts/auth.postman_collection.json \
  --environment tests/api-contracts/test.environment.json
```

### 3.4 性能测试

**测试工具**: Artillery 或 k6

**测试场景**:

- 登录接口: 100 req/s 持续1分钟
- 打卡接口: 50 req/s 持续2分钟
- 查询接口: 200 req/s 持续1分钟

**配置文件**:

```yaml
# backend/tests/performance/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 100
      name: 'Warm up'
    - duration: 120
      arrivalRate: 200
      name: 'Sustained load'

scenarios:
  - name: 'Login flow'
    flow:
      - post:
          url: '/api/v1/auth/login'
          json:
            email: 'test@example.com'
            password: 'password123'
```

**执行命令**:

```bash
# 运行性能测试
npm run test:load

# 或使用 Artillery
artillery run tests/performance/load-test.yml
```

---

## 4. PC后台管理系统测试方案

### 4.1 单元测试（60%覆盖率目标）

**测试框架**: Vitest + Vue Test Utils

**目录结构**:

```
admin/
├── src/
│   ├── components/
│   │   ├── InsightCard.vue
│   │   └── __tests__/
│   │       └── InsightCard.spec.ts
│   ├── views/
│   │   ├── InsightsManagementView.vue
│   │   └── __tests__/
│   │       └── InsightsManagementView.spec.ts
│   ├── services/
│   │   ├── api.ts
│   │   └── __tests__/
│   │       └── api.spec.ts
│   └── stores/
│       ├── user.ts
│       └── __tests__/
│           └── user.spec.ts
```

**示例测试用例**:

```typescript
// src/components/__tests__/InsightCard.spec.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import InsightCard from '../InsightCard.vue';

describe('InsightCard.vue', () => {
  it('应该正确渲染小凡看见内容', () => {
    const wrapper = mount(InsightCard, {
      props: {
        insight: {
          content: '测试内容',
          createdAt: '2025-12-17',
          creatorId: { nickname: '测试用户' }
        }
      }
    });

    expect(wrapper.text()).toContain('测试内容');
    expect(wrapper.text()).toContain('测试用户');
  });

  it('应该在点击编辑按钮时触发事件', async () => {
    const wrapper = mount(InsightCard, {
      props: { insight: mockInsight }
    });

    await wrapper.find('.edit-btn').trigger('click');
    expect(wrapper.emitted('edit')).toBeTruthy();
  });
});
```

**执行命令**:

```bash
# 在 admin/package.json 中添加
"scripts": {
  "test": "vitest",
  "test:unit": "vitest run",
  "test:coverage": "vitest run --coverage"
}

# 运行测试
cd admin
npm run test:unit
```

### 4.2 组件测试

**测试范围**:

- 所有公共组件（如表单、表格、弹窗）
- 所有页面级组件的关键交互
- Pinia store 的状态管理

**关键测试场景**:

1. 表单验证逻辑
2. 数据加载和错误处理
3. 用户交互（点击、输入、提交）
4. 路由导航

### 4.3 E2E测试

**测试框架**: Cypress（已配置）

**目录结构**:

```
admin/
├── cypress/
│   ├── e2e/
│   │   ├── login.cy.ts              # 登录流程
│   │   ├── insights-management.cy.ts # 小凡看见管理
│   │   ├── user-management.cy.ts    # 用户管理
│   │   └── period-management.cy.ts  # 期次管理
│   ├── fixtures/                    # 测试数据
│   └── support/                     # 自定义命令
```

**示例测试用例**:

```typescript
// cypress/e2e/insights-management.cy.ts
describe('小凡看见管理', () => {
  beforeEach(() => {
    cy.login('admin@morningreading.com', 'admin123');
    cy.visit('/insights');
  });

  it('应该能够查看小凡看见列表', () => {
    cy.get('.insights-table').should('exist');
    cy.get('.insights-table tbody tr').should('have.length.greaterThan', 0);
  });

  it('应该能够编辑小凡看见', () => {
    cy.get('.insights-table tbody tr:first .edit-btn').click();
    cy.get('.edit-dialog').should('be.visible');
    cy.get('input[name="content"]').clear().type('更新后的内容');
    cy.get('.submit-btn').click();
    cy.get('.success-message').should('contain', '更新成功');
  });
});
```

**执行命令**:

```bash
# 在 admin/package.json 中添加
"scripts": {
  "test:e2e": "cypress run",
  "test:e2e:open": "cypress open"
}

# 运行E2E测试
cd admin
npm run test:e2e
```

---

## 5. 小程序测试方案

### 5.1 工具函数单元测试

**测试框架**: Miniprogram Test Framework（官方）或 Jest

**目录结构**:

```
miniprogram/
├── utils/
│   ├── date.js
│   ├── validator.js
│   ├── storage.js
│   └── __tests__/
│       ├── date.test.js
│       ├── validator.test.js
│       └── storage.test.js
```

**示例测试用例**:

```javascript
// utils/__tests__/date.test.js
const { formatDate, isToday } = require('../date.js');

describe('Date Utils', () => {
  test('formatDate 应该正确格式化日期', () => {
    const date = new Date('2025-12-17');
    expect(formatDate(date)).toBe('2025-12-17');
  });

  test('isToday 应该正确判断今天', () => {
    const today = new Date();
    expect(isToday(today)).toBe(true);

    const yesterday = new Date(Date.now() - 86400000);
    expect(isToday(yesterday)).toBe(false);
  });
});
```

**执行命令**:

```bash
# 在项目根目录添加 jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/miniprogram/**/*.test.js'],
  collectCoverageFrom: ['miniprogram/utils/**/*.js']
}

# 运行测试
npm run test:miniprogram
```

### 5.2 API Service 测试

**测试方法**: Mock wx.request，验证API调用逻辑

```javascript
// services/__tests__/auth.service.test.js
const authService = require('../auth.service.js');

describe('Auth Service', () => {
  beforeEach(() => {
    // Mock wx.request
    global.wx = {
      request: jest.fn()
    };
  });

  test('login 应该调用正确的API端点', async () => {
    wx.request.mockImplementation(({ success }) => {
      success({ data: { code: 200, data: { token: 'test-token' } } });
    });

    await authService.login({ code: 'test-code' });

    expect(wx.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/api/v1/auth/wxlogin'),
        method: 'POST'
      })
    );
  });
});
```

### 5.3 页面逻辑测试

**测试方法**: 使用微信开发者工具的自动化测试功能

```javascript
// miniprogram/pages/insights/__tests__/insights.test.js
const automator = require('miniprogram-automator');

describe('Insights Page', () => {
  let miniProgram;
  let page;

  beforeAll(async () => {
    miniProgram = await automator.launch({
      projectPath: '/path/to/miniprogram'
    });
    page = await miniProgram.navigateTo('/pages/insights/insights');
  });

  afterAll(async () => {
    await miniProgram.close();
  });

  test('应该正确加载小凡看见列表', async () => {
    await page.waitFor(1000);
    const listItems = await page.$$('.insight-item');
    expect(listItems.length).toBeGreaterThan(0);
  });
});
```

### 5.4 手动测试清单

由于小程序的UI交互复杂性，部分功能需要手动测试：

**关键测试场景**:

- [ ] 微信登录授权流程
- [ ] 页面跳转和返回
- [ ] 下拉刷新和上拉加载
- [ ] 图片上传和预览
- [ ] 分享功能
- [ ] 支付流程（如有）
- [ ] 不同机型适配（iOS/Android）
- [ ] 网络异常处理

---

## 6. Git Hooks配置

### 6.1 Pre-commit Hook（增强版）

```bash
#!/bin/bash
# .git/hooks/pre-commit

set -e

echo "🔍 运行 Pre-commit 检查..."

# 获取staged文件列表
STAGED_FILES=$(git diff --cached --name-only)

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# 1. ESLint 检查
echo -e "${BLUE}📋 运行 ESLint 检查...${NC}"

# Backend 文件
BACKEND_FILES=$(echo "$STAGED_FILES" | grep "^backend/.*\.js$" || true)
if [ -n "$BACKEND_FILES" ]; then
  echo "检查 Backend 文件..."
  cd backend
  if ! npm run lint -- $BACKEND_FILES 2>&1; then
    echo -e "${RED}✗ Backend ESLint 检查失败${NC}"
    ERRORS=$((ERRORS + 1))
  fi
  cd ..
fi

# Admin 文件
ADMIN_FILES=$(echo "$STAGED_FILES" | grep "^admin/.*\.\(ts\|vue\)$" || true)
if [ -n "$ADMIN_FILES" ]; then
  echo "检查 Admin 文件..."
  cd admin
  if ! npm run lint 2>&1; then
    echo -e "${RED}✗ Admin ESLint 检查失败${NC}"
    ERRORS=$((ERRORS + 1))
  fi
  cd ..
fi

# 2. Prettier 格式检查
echo -e "${BLUE}✨ 运行 Prettier 格式检查...${NC}"
if ! npx prettier --check $STAGED_FILES 2>&1; then
  echo -e "${YELLOW}⚠ 代码格式不符合规范，运行 'npx prettier --write <files>' 修复${NC}"
  WARNINGS=$((WARNINGS + 1))
fi

# 3. 敏感文件检查
echo -e "${BLUE}🔐 检查敏感文件...${NC}"
SENSITIVE_FILES=".env .env.local .env.production credentials.json secrets.json"
for file in $SENSITIVE_FILES; do
  if echo "$STAGED_FILES" | grep -q "^$file$"; then
    echo -e "${RED}✗ 禁止提交敏感文件: $file${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

# 4. 检查 debugger 语句
echo -e "${BLUE}🐛 检查 debugger 语句...${NC}"
for file in $STAGED_FILES; do
  if [[ $file =~ \.(js|ts|jsx|tsx|vue)$ ]]; then
    if [[ ! $file =~ node_modules ]]; then
      if git diff --cached "$file" | grep "^\+.*debugger" > /dev/null 2>&1; then
        echo -e "${RED}✗ 禁止提交 debugger 语句: $file${NC}"
        ERRORS=$((ERRORS + 1))
      fi
    fi
  fi
done

# 5. 运行快速单元测试（仅修改的文件相关）
echo -e "${BLUE}🧪 运行快速单元测试...${NC}"

# Backend 单元测试
if [ -n "$BACKEND_FILES" ]; then
  cd backend
  if ! npm run test:unit -- --grep "$(echo $BACKEND_FILES | sed 's/backend\///g' | sed 's/\.js/.test.js/g')" 2>&1; then
    echo -e "${RED}✗ Backend 单元测试失败${NC}"
    ERRORS=$((ERRORS + 1))
  fi
  cd ..
fi

# 6. TypeScript 类型检查（Admin）
if [ -n "$ADMIN_FILES" ]; then
  echo -e "${BLUE}📘 运行 TypeScript 类型检查...${NC}"
  cd admin
  if ! npm run type-check 2>&1; then
    echo -e "${RED}✗ TypeScript 类型检查失败${NC}"
    ERRORS=$((ERRORS + 1))
  fi
  cd ..
fi

# 结果汇总
echo ""
echo "========================================="
if [ $ERRORS -eq 0 ]; then
  if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ Pre-commit 检查通过！${NC}"
  else
    echo -e "${YELLOW}⚠️  Pre-commit 检查完成，有 $WARNINGS 个警告${NC}"
  fi
  exit 0
else
  echo -e "${RED}❌ Pre-commit 检查失败，共 $ERRORS 个错误${NC}"
  echo ""
  echo "修复建议:"
  echo "1. 查看上方错误信息"
  echo "2. 运行 'npm run lint:fix' 自动修复部分问题"
  echo "3. 运行 'npm run test:unit' 查看详细测试错误"
  echo "4. 如需跳过检查（不推荐），使用 'git commit --no-verify'"
  exit 1
fi
```

### 6.2 Pre-push Hook

```bash
#!/bin/bash
# .git/hooks/pre-push

set -e

echo "🚀 运行 Pre-push 检查..."

ERRORS=0

# 1. 运行所有单元测试
echo "🧪 运行所有单元测试..."
cd backend
if ! npm run test:unit; then
  echo "❌ Backend 单元测试失败"
  ERRORS=$((ERRORS + 1))
fi
cd ..

cd admin
if ! npm run test:unit; then
  echo "❌ Admin 单元测试失败"
  ERRORS=$((ERRORS + 1))
fi
cd ..

# 2. 运行集成测试（快速模式）
echo "🔗 运行集成测试..."
cd backend
if ! npm run test:integration; then
  echo "❌ 集成测试失败"
  ERRORS=$((ERRORS + 1))
fi
cd ..

# 3. 构建测试
echo "🏗️  测试构建..."
cd admin
if ! npm run build-only; then
  echo "❌ Admin 构建失败"
  ERRORS=$((ERRORS + 1))
fi
cd ..

if [ $ERRORS -eq 0 ]; then
  echo "✅ Pre-push 检查通过！"
  exit 0
else
  echo ""
  echo "❌ Pre-push 检查失败"
  echo "如需强制推送（不推荐），使用 'git push --no-verify'"
  exit 1
fi
```

### 6.3 安装 Hooks

```bash
#!/bin/bash
# scripts/install-hooks.sh

echo "安装 Git Hooks..."

# 复制 hooks 到 .git/hooks/
cp .claude/hooks/pre-commit .git/hooks/pre-commit
cp scripts/hooks/pre-push .git/hooks/pre-push

# 设置可执行权限
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

echo "✅ Git Hooks 安装完成"
```

---

## 7. CI/CD流程

### 7.1 GitHub Actions 配置

创建 `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # Job 1: Lint 检查
  lint:
    name: Code Linting
    runs-on: ubuntu-latest

    strategy:
      matrix:
        module: [backend, admin]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ${{ matrix.module }}/package-lock.json

      - name: Install dependencies
        working-directory: ./${{ matrix.module }}
        run: npm ci

      - name: Run ESLint
        working-directory: ./${{ matrix.module }}
        run: npm run lint

  # Job 2: 单元测试
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint

    strategy:
      matrix:
        module: [backend, admin]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ${{ matrix.module }}/package-lock.json

      - name: Install dependencies
        working-directory: ./${{ matrix.module }}
        run: npm ci

      - name: Run unit tests
        working-directory: ./${{ matrix.module }}
        run: npm run test:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./${{ matrix.module }}/coverage/coverage-final.json
          flags: ${{ matrix.module }}

  # Job 3: 集成测试
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-tests

    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        env:
          MONGO_INITDB_ROOT_USERNAME: test
          MONGO_INITDB_ROOT_PASSWORD: test

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run integration tests
        working-directory: ./backend
        run: npm run test:integration
        env:
          MONGODB_URI: mongodb://test:test@localhost:27017/test?authSource=admin
          NODE_ENV: test

  # Job 4: E2E 测试（仅 PR）
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install backend dependencies
        working-directory: ./backend
        run: npm ci

      - name: Install admin dependencies
        working-directory: ./admin
        run: npm ci

      - name: Start backend server
        working-directory: ./backend
        run: |
          npm start &
          sleep 10
        env:
          NODE_ENV: test

      - name: Run Cypress E2E tests
        working-directory: ./admin
        run: npx cypress run
        env:
          CYPRESS_BASE_URL: http://localhost:3000

      - name: Upload Cypress screenshots
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: cypress-screenshots
          path: admin/cypress/screenshots

  # Job 5: 安全扫描
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run npm audit
        run: |
          cd backend && npm audit --audit-level=high
          cd ../admin && npm audit --audit-level=high

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: test
          args: --severity-threshold=high

  # Job 6: 构建测试
  build:
    name: Build Test
    runs-on: ubuntu-latest
    needs: unit-tests

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install admin dependencies
        working-directory: ./admin
        run: npm ci

      - name: Build admin
        working-directory: ./admin
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: admin-build
          path: admin/dist
```

### 7.2 定期任务配置

创建 `.github/workflows/scheduled.yml`:

```yaml
name: Scheduled Tasks

on:
  schedule:
    # 每天 02:00 AM UTC (北京时间 10:00 AM)
    - cron: '0 2 * * *'
  workflow_dispatch: # 允许手动触发

jobs:
  full-test-suite:
    name: Full Test Suite
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Run all tests
        run: |
          # 运行所有测试套件
          cd backend && npm ci && npm run test
          cd ../admin && npm ci && npm run test:unit && npm run test:e2e

      - name: Generate test report
        run: |
          # 生成测试报告
          echo "Test report generation..."

      - name: Send notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  dependency-update:
    name: Dependency Update Check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Check for outdated packages
        run: |
          cd backend && npm outdated
          cd ../admin && npm outdated

      - name: Run npm audit
        run: |
          cd backend && npm audit
          cd ../admin && npm audit
```

---

## 8. 测试工具与依赖

### 8.1 Backend 依赖

```json
// backend/package.json
{
  "devDependencies": {
    // 现有依赖
    "mocha": "^10.8.2",
    "chai": "^4.5.0",
    "sinon": "^17.0.1",
    "chai-http": "^4.4.0",
    "supertest": "^6.3.4",
    "proxyquire": "^2.1.3",
    "nyc": "^15.1.0",
    "mongodb-memory-server": "^9.5.0",

    // 新增依赖
    "artillery": "^2.0.0", // 性能测试
    "newman": "^6.0.0", // API 契约测试
    "@faker-js/faker": "^8.3.1", // 测试数据生成
    "nock": "^13.5.0" // HTTP Mock
  }
}
```

### 8.2 Admin 依赖

```json
// admin/package.json
{
  "devDependencies": {
    // 新增依赖
    "vitest": "^1.0.0", // 单元测试框架
    "@vue/test-utils": "^2.4.0", // Vue 测试工具
    "@vitest/ui": "^1.0.0", // 测试UI界面
    "cypress": "^13.0.0", // E2E 测试（已有配置）
    "@cypress/vue": "^6.0.0", // Cypress Vue 支持
    "c8": "^9.0.0", // 覆盖率工具
    "happy-dom": "^12.0.0" // 测试DOM环境
  }
}
```

### 8.3 安装所有依赖

```bash
# Backend
cd backend
npm install --save-dev artillery newman @faker-js/faker nock

# Admin
cd ../admin
npm install --save-dev vitest @vue/test-utils @vitest/ui @cypress/vue c8 happy-dom

# Root（如有必要）
cd ..
npm install --save-dev concurrently
```

---

## 9. 预期反馈时间

| 测试阶段     | 本地开发 | CI/CD | 说明                 |
| ------------ | -------- | ----- | -------------------- |
| **ESLint**   | 30秒     | 1分钟 | 并行检查所有模块     |
| **Prettier** | 10秒     | 30秒  | 格式验证             |
| **单元测试** | 2分钟    | 3分钟 | Backend + Admin 并行 |
| **集成测试** | 3分钟    | 5分钟 | 需启动数据库         |
| **E2E测试**  | 5分钟    | 8分钟 | 需启动完整应用       |
| **构建测试** | 1分钟    | 2分钟 | Vite 构建            |
| **性能测试** | 3分钟    | 5分钟 | 仅手动/定期          |
| **安全扫描** | N/A      | 2分钟 | npm audit + Snyk     |

**总计时间**:

- **Pre-commit**: ~3分钟（快速模式）
- **Pre-push**: ~6分钟（完整本地测试）
- **CI (Push)**: ~10分钟（并行执行）
- **CI (PR)**: ~15分钟（包含E2E）
- **定期任务**: ~20分钟（全量测试）

---

## 10. 实施步骤

### 阶段1: 修复现有测试（1-2天）

**优先级**: P0（立即执行）

```bash
# 1. 修复 Backend 集成测试的 beforeAll 问题
- 替换所有 beforeAll/afterAll 为 before/after
- 增加超时时间配置
- 验证所有测试通过

# 2. 确保单元测试覆盖率达标
- Backend: 70%+
- 检查未覆盖的关键路径

# 3. 修复测试配置
- 更新 .mocharc.json
- 配置 nyc 覆盖率工具
```

### 阶段2: 配置Git Hooks（半天）

**优先级**: P0（立即执行）

```bash
# 1. 创建增强版 pre-commit hook
- 复制上文的 pre-commit 脚本
- 测试各项检查功能
- 确保错误信息清晰

# 2. 创建 pre-push hook
- 运行完整单元测试
- 运行集成测试
- 测试构建流程

# 3. 安装脚本
chmod +x scripts/install-hooks.sh
./scripts/install-hooks.sh
```

### 阶段3: 添加Admin单元测试（2-3天）

**优先级**: P1（高优先级）

```bash
# 1. 配置 Vitest
- 创建 vitest.config.ts
- 配置测试环境（happy-dom）
- 配置覆盖率工具

# 2. 编写组件测试
- 先测试工具函数（utils）
- 再测试公共组件（components）
- 最后测试页面组件（views）

# 3. 目标覆盖率: 60%
- 优先覆盖关键业务逻辑
- 表单验证和数据处理
```

### 阶段4: 配置CI/CD（1天）

**优先级**: P1（高优先级）

```bash
# 1. 创建 GitHub Actions 配置
mkdir -p .github/workflows
# 创建 ci.yml（复制上文配置）
# 创建 scheduled.yml（定期任务）

# 2. 配置 Secrets
- SNYK_TOKEN（安全扫描）
- SLACK_WEBHOOK（通知）
- CODECOV_TOKEN（覆盖率）

# 3. 测试 CI 流程
- 提交测试PR
- 验证所有job正常运行
- 检查反馈时间
```

### 阶段5: 添加E2E测试（2-3天）

**优先级**: P2（中优先级）

```bash
# 1. 配置 Cypress
- 已有 cypress.config.js
- 添加自定义命令（cy.login 等）
- 配置测试环境变量

# 2. 编写核心场景测试
- 登录流程
- 小凡看见管理
- 用户管理
- 期次管理

# 3. 集成到CI
- 仅在 PR 时运行
- 上传失败截图
```

### 阶段6: 添加性能测试（1-2天）

**优先级**: P3（低优先级）

```bash
# 1. 配置 Artillery
- 创建 load-test.yml
- 定义测试场景
- 设置性能基准

# 2. 手动运行和分析
npm run test:load

# 3. 定期监控
- 加入定期任务
- 性能趋势分析
```

### 阶段7: 小程序测试（按需）

**优先级**: P3（低优先级）

```bash
# 1. 工具函数单元测试
- 使用 Jest 测试 utils
- 目标覆盖率: 80%

# 2. 自动化测试（可选）
- miniprogram-automator
- 测试核心页面逻辑

# 3. 手动测试清单
- 维护测试用例文档
- 每次发版前执行
```

---

## 11. 测试失败处理流程

### 11.1 本地开发

```
Pre-commit 失败
  ↓
查看错误信息
  ↓
修复代码
  ↓
重新提交
  ↓
（如紧急）git commit --no-verify
```

### 11.2 CI/CD

```
CI 测试失败
  ↓
查看 GitHub Actions 日志
  ↓
本地复现问题
  ↓
修复并推送新提交
  ↓
CI 重新运行
  ↓
通过后合并PR
```

### 11.3 E2E测试失败

```
E2E 失败
  ↓
下载 Cypress 截图
  ↓
分析失败步骤
  ↓
本地运行 cypress open 调试
  ↓
修复并推送
```

---

## 12. 覆盖率要求

### 12.1 代码覆盖率目标

| 模块                | 行覆盖率 | 分支覆盖率 | 函数覆盖率 | 语句覆盖率 |
| ------------------- | -------- | ---------- | ---------- | ---------- |
| Backend Controllers | 80%      | 75%        | 85%        | 80%        |
| Backend Models      | 70%      | 65%        | 75%        | 70%        |
| Backend Utils       | 90%      | 85%        | 90%        | 90%        |
| Admin Components    | 60%      | 55%        | 65%        | 60%        |
| Admin Utils         | 80%      | 75%        | 80%        | 80%        |

### 12.2 覆盖率报告

```bash
# Backend
cd backend
npm run test:coverage
# 打开 coverage/index.html 查看详细报告

# Admin（待配置）
cd admin
npm run test:coverage
# 打开 coverage/index.html
```

### 12.3 CI 覆盖率检查

```yaml
# .github/workflows/ci.yml 中添加
- name: Check coverage threshold
  run: |
    npx nyc check-coverage --lines 70 --branches 65 --functions 75
```

---

## 13. 测试最佳实践

### 13.1 单元测试

✅ **Do**:

- 测试一个功能点
- 使用 describe/it 清晰描述
- Mock 外部依赖
- 测试边界条件
- 快速运行（< 100ms/test）

❌ **Don't**:

- 测试实现细节
- 依赖外部服务
- 测试第三方库
- 过度Mock

### 13.2 集成测试

✅ **Do**:

- 测试完整流程
- 使用真实数据库（Memory Server）
- 测试错误场景
- 验证数据一致性

❌ **Don't**:

- 依赖生产数据
- 测试过于细节
- 忽略清理逻辑

### 13.3 E2E测试

✅ **Do**:

- 模拟真实用户行为
- 测试关键业务流程
- 使用Page Object模式
- 捕获失败截图

❌ **Don't**:

- 测试太多细节
- 依赖不稳定的元素选择器
- 忽略等待时间
- 测试非关键流程

---

## 14. 监控和报告

### 14.1 测试报告生成

```bash
# Mocha HTML 报告
npm run test -- --reporter mochawesome

# Cypress 报告
npx cypress run --reporter mochawesome

# 覆盖率报告
npm run coverage:report
```

### 14.2 集成 Codecov

```yaml
# .github/workflows/ci.yml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: ./coverage/coverage-final.json
    flags: backend
    name: backend-coverage
```

### 14.3 Slack 通知

```yaml
# .github/workflows/ci.yml（失败时通知）
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: failure
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
    text: 'CI Tests Failed! Check the logs.'
```

---

## 15. 常见问题FAQ

### Q1: Pre-commit Hook 太慢怎么办？

**A**:

- 使用 `git commit --no-verify` 临时跳过（不推荐）
- 优化：只检查 staged 文件
- 关闭快速单元测试，仅在 pre-push 运行

### Q2: 集成测试偶尔失败？

**A**:

- 检查是否有竞态条件
- 增加超时时间
- 使用 `this.retries(2)` 重试机制
- 确保数据库清理干净

### Q3: E2E 测试在 CI 上失败但本地通过？

**A**:

- 检查环境变量配置
- 增加等待时间（CI 环境较慢）
- 使用 headless 模式
- 检查浏览器版本差异

### Q4: 覆盖率无法达到目标？

**A**:

- 优先覆盖关键业务逻辑
- 忽略自动生成的代码
- 检查是否有死代码
- 使用 `istanbul ignore` 注释

---

## 16. 总结

本测试策略提供了一个完整的、可持续运行的测试和验证机制，涵盖：

✅ **完整的测试金字塔**: 70% 单元 + 25% 集成 + 5% E2E
✅ **自动化Git Hooks**: Pre-commit + Pre-push 质量保证
✅ **完善的CI/CD**: GitHub Actions 并行测试
✅ **清晰的反馈时间**: 本地3分钟，CI 10-15分钟
✅ **三端测试方案**: Backend + Admin + Miniprogram
✅ **性能和安全**: 性能测试 + 依赖扫描

**下一步行动**:

1. 修复现有 Backend 测试问题（优先级P0）
2. 配置增强版 Git Hooks（优先级P0）
3. 添加 Admin 单元测试（优先级P1）
4. 配置 CI/CD（优先级P1）
5. 按需添加 E2E 和性能测试（优先级P2-P3）

---

**文档维护**: 此文档应随项目发展持续更新
**问题反馈**: 请在 GitHub Issues 中提出测试相关问题
**贡献指南**: 欢迎提交测试用例和改进建议
