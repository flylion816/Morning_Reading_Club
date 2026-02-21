# 测试系统快速启动指南

**适用人群**: 新加入项目的开发者、需要快速上手测试系统的人员

**预计时间**: 30分钟

---

## 🚀 第1步: 安装依赖（10分钟）

### Backend 测试依赖

```bash
cd backend

# 检查现有依赖
npm list mocha chai sinon

# 如缺少，安装以下依赖
npm install --save-dev \
  artillery \
  newman \
  @faker-js/faker \
  nock

# 验证安装
npm run test:unit -- --version
```

### Admin 测试依赖

```bash
cd admin

# 安装 Vitest 和测试工具
npm install --save-dev \
  vitest \
  @vue/test-utils \
  @vitest/ui \
  c8 \
  happy-dom

# 验证安装
npx vitest --version
```

---

## 🔧 第2步: 修复现有测试（5分钟）

### 修复 Backend 集成测试

```bash
# 运行修复脚本
./scripts/fix-mocha-tests.sh

# 验证修复结果
cd backend
npm run test:integration
```

**常见错误处理**:

| 错误信息                         | 解决方案                            |
| -------------------------------- | ----------------------------------- |
| `beforeAll is not defined`       | 运行 `./scripts/fix-mocha-tests.sh` |
| `MongoMemoryServer not starting` | 检查 MongoDB 配置，增加超时时间     |
| `Cannot find module`             | 运行 `npm ci` 重新安装依赖          |

---

## 🪝 第3步: 安装 Git Hooks（5分钟）

```bash
# 从项目根目录运行
./scripts/install-test-hooks.sh

# 验证安装
ls -la .git/hooks/pre-commit
ls -la .git/hooks/pre-push

# 测试 Pre-commit Hook
git add .
git commit -m "test: 测试 Git Hooks"

# 如需跳过检查（不推荐）
git commit --no-verify
```

**Hook 功能概览**:

- **Pre-commit**: ESLint检查 + Prettier格式化 + 快速单元测试（~3分钟）
- **Pre-push**: 完整单元测试 + 集成测试 + 构建验证（~6分钟）

---

## 🧪 第4步: 运行测试（5分钟）

### Backend 测试

```bash
cd backend

# 1. 单元测试
npm run test:unit

# 2. 集成测试
npm run test:integration

# 3. 所有测试
npm run test

# 4. 测试覆盖率
npm run test:coverage

# 5. 打开覆盖率报告
npm run coverage:report
```

### Admin 测试

```bash
cd admin

# 1. 单元测试
npm run test:unit

# 2. 测试覆盖率
npm run test:coverage

# 3. UI 模式（开发时推荐）
npx vitest --ui

# 4. E2E 测试（需要后端运行）
npm run test:e2e
```

---

## 📊 第5步: 检查覆盖率（5分钟）

### Backend 覆盖率目标

```bash
cd backend
npm run test:coverage

# 查看覆盖率报告
open coverage/index.html
```

**覆盖率要求**:

- Controllers: 80%+
- Models: 70%+
- Utils: 90%+

**低覆盖率处理**:

1. 查看 `coverage/index.html` 中的红色部分
2. 为未覆盖的关键逻辑添加测试
3. 忽略无需测试的代码（使用 `istanbul ignore` 注释）

### Admin 覆盖率目标

```bash
cd admin
npm run test:coverage

# 查看报告
open coverage/index.html
```

**覆盖率要求**:

- Components: 60%+
- Utils: 80%+

---

## 🔄 第6步: CI/CD 验证（可选）

### 本地验证 CI 流程

```bash
# 模拟 CI Lint 检查
cd backend && npm run lint
cd ../admin && npm run lint

# 模拟 CI 单元测试
cd backend && npm run test:unit
cd ../admin && npm run test:unit

# 模拟 CI 集成测试
cd backend && npm run test:integration

# 模拟 CI 构建
cd admin && npm run build
```

### 推送到 GitHub 触发 CI

```bash
git add .
git commit -m "feat: 添加测试配置"
git push origin main

# 查看 GitHub Actions
# https://github.com/flylion816/Morning_Reading_Club/actions
```

---

## 📝 常用命令速查

### 日常开发

```bash
# 启动开发环境
npm run dev              # 启动后端
cd admin && npm run dev  # 启动前端

# 运行测试（监听模式）
npm run test:watch       # Backend
npx vitest --ui          # Admin（推荐）

# 格式化代码
npx prettier --write .
```

### 提交前

```bash
# 自动格式化和修复
npm run lint:fix         # Backend/Admin

# 运行完整测试
npm run test             # Backend
npm run test:unit        # Admin

# 提交（会自动触发 Pre-commit Hook）
git commit -m "feat: 新功能"
```

### 推送前

```bash
# 运行完整测试套件（模拟 Pre-push）
cd backend && npm run test
cd ../admin && npm run build

# 推送（会自动触发 Pre-push Hook）
git push
```

---

## ❓ 常见问题

### Q1: Pre-commit Hook 太慢怎么办？

**A**: 可以临时跳过:

```bash
git commit --no-verify -m "临时提交"
```

但请在下次提交时确保通过所有检查。

### Q2: 测试失败如何调试？

**A**: 使用详细模式:

```bash
# Mocha 详细输出
npm run test:unit -- --reporter spec

# Vitest UI 模式
npx vitest --ui
```

### Q3: 如何只运行单个测试文件？

**A**:

```bash
# Backend
npm run test:unit -- tests/unit/controllers/auth.controller.test.js

# Admin
npx vitest src/components/__tests__/InsightCard.spec.ts
```

### Q4: 如何卸载 Git Hooks？

**A**:

```bash
rm .git/hooks/pre-commit
rm .git/hooks/pre-push
```

### Q5: CI 失败但本地通过？

**A**: 检查以下几点:

1. 环境变量配置（CI 使用 `.env.test`）
2. 数据库连接（CI 使用 MongoDB Memory Server）
3. 依赖版本（运行 `npm ci` 而不是 `npm install`）
4. 超时时间（CI 环境较慢，增加超时）

---

## 🎯 下一步

### 1. 编写你的第一个测试

**Backend 单元测试示例**:

```javascript
// tests/unit/utils/myutil.test.js
const { expect } = require('chai');
const { myFunction } = require('../../../src/utils/myutil');

describe('MyUtil', () => {
  it('应该返回正确的结果', () => {
    const result = myFunction('input');
    expect(result).to.equal('expected');
  });
});
```

**Admin 组件测试示例**:

```typescript
// src/components/__tests__/MyComponent.spec.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import MyComponent from '../MyComponent.vue';

describe('MyComponent', () => {
  it('应该正确渲染', () => {
    const wrapper = mount(MyComponent);
    expect(wrapper.text()).toContain('期待的内容');
  });
});
```

### 2. 学习测试最佳实践

- 阅读 [`TESTING_STRATEGY.md`](./TESTING_STRATEGY.md) 了解完整策略
- 查看现有测试文件学习写法
- 遵循 AAA 模式: Arrange → Act → Assert

### 3. 参与 Code Review

- 新增功能必须包含测试
- 测试覆盖率不能下降
- PR 必须通过所有 CI 检查

---

## 📚 参考资源

- [Mocha 官方文档](https://mochajs.org/)
- [Chai 断言库](https://www.chaijs.com/)
- [Vitest 文档](https://vitest.dev/)
- [Vue Test Utils](https://test-utils.vuejs.org/)
- [Cypress 文档](https://docs.cypress.io/)

---

## 🆘 获取帮助

如遇到问题，请:

1. 查看本文档的常见问题部分
2. 查看 `TESTING_STRATEGY.md` 详细说明
3. 在 GitHub Issues 中提问
4. 联系项目维护者

---

**文档版本**: 1.0.0
**最后更新**: 2025-12-17
**维护者**: Claude Code
