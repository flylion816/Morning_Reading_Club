# 测试系统 Package.json 更新建议

本文档列出了为实施完整测试策略需要添加的依赖和脚本。

---

## Backend (backend/package.json)

### 1. 添加新的依赖

```json
{
  "devDependencies": {
    // 现有依赖（保留）
    "mocha": "^10.8.2",
    "chai": "^4.5.0",
    "sinon": "^17.0.1",
    "chai-http": "^4.4.0",
    "supertest": "^6.3.4",
    "proxyquire": "^2.1.3",
    "nyc": "^15.1.0",
    "mongodb-memory-server": "^9.5.0",
    "eslint": "^8.57.1",
    "prettier": "^3.7.4",

    // 新增依赖
    "artillery": "^2.0.0", // 性能测试
    "newman": "^6.0.0", // API 契约测试（Postman collections）
    "@faker-js/faker": "^8.3.1", // 测试数据生成
    "nock": "^13.5.0" // HTTP 请求 Mock
  }
}
```

### 2. 添加新的脚本

```json
{
  "scripts": {
    // 现有脚本（保留）
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "NODE_ENV=test mocha 'tests/**/*.test.js' --timeout 10000 --exit",
    "test:unit": "NODE_ENV=test mocha 'tests/unit/**/*.test.js' --timeout 5000 --exit",
    "test:integration": "NODE_ENV=test mocha 'tests/integration/**/*.test.js' --timeout 10000 --exit",
    "test:coverage": "NODE_ENV=test nyc npm run test",
    "test:watch": "NODE_ENV=test mocha 'tests/**/*.test.js' --watch",
    "coverage:report": "nyc report --reporter=html && open coverage/index.html",

    // 新增脚本
    "test:load": "artillery run tests/performance/load-test.yml",
    "test:api-contracts": "newman run tests/api-contracts/auth.postman_collection.json",
    "lint": "eslint 'src/**/*.js' 'tests/**/*.js'",
    "lint:fix": "eslint 'src/**/*.js' 'tests/**/*.js' --fix",
    "format": "prettier --write 'src/**/*.js' 'tests/**/*.js'",
    "format:check": "prettier --check 'src/**/*.js' 'tests/**/*.js'"
  }
}
```

### 3. 安装命令

```bash
cd backend

# 安装新依赖
npm install --save-dev artillery newman @faker-js/faker nock

# 验证安装
npm list artillery newman
```

---

## Admin (admin/package.json)

### 1. 添加新的依赖

```json
{
  "devDependencies": {
    // 现有依赖（保留）
    "eslint": "^8.57.1",
    "prettier": "^3.7.4",
    "typescript": "~5.9.0",
    "vite": "^7.1.11",
    "vue-tsc": "^3.1.1",

    // 新增依赖
    "vitest": "^1.0.0", // 单元测试框架
    "@vue/test-utils": "^2.4.0", // Vue 组件测试工具
    "@vitest/ui": "^1.0.0", // Vitest UI 界面
    "c8": "^9.0.0", // 覆盖率工具（替代 nyc）
    "happy-dom": "^12.0.0", // 测试 DOM 环境
    "@types/node": "^22.18.11", // Node 类型定义（已有）
    "cypress": "^13.0.0", // E2E 测试（可能已有）
    "@cypress/vue": "^6.0.0" // Cypress Vue 支持
  }
}
```

### 2. 添加新的脚本

```json
{
  "scripts": {
    // 现有脚本（保留）
    "dev": "vite",
    "build": "run-p type-check \"build-only {@}\" --",
    "build-only": "vite build",
    "preview": "vite preview",
    "type-check": "vue-tsc --build",

    // 新增脚本
    "test": "vitest",
    "test:unit": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "lint": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --max-warnings 0",
    "lint:fix": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/"
  }
}
```

### 3. 安装命令

```bash
cd admin

# 安装新依赖
npm install --save-dev vitest @vue/test-utils @vitest/ui c8 happy-dom @cypress/vue

# 验证安装
npx vitest --version
npx cypress --version
```

---

## Root (根目录 package.json，可选)

如果需要在根目录统一管理所有模块的测试，可以创建一个根 `package.json`:

```json
{
  "name": "morning-reading-club",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "npm run test:backend && npm run test:admin",
    "test:backend": "cd backend && npm run test",
    "test:admin": "cd admin && npm run test:unit",
    "test:all": "npm run test:backend && npm run test:admin && npm run test:e2e",
    "test:e2e": "cd admin && npm run test:e2e",

    "lint": "npm run lint:backend && npm run lint:admin",
    "lint:backend": "cd backend && npm run lint",
    "lint:admin": "cd admin && npm run lint",

    "format": "prettier --write .",
    "format:check": "prettier --check .",

    "install:all": "npm run install:backend && npm run install:admin",
    "install:backend": "cd backend && npm ci",
    "install:admin": "cd admin && npm ci"
  },
  "devDependencies": {
    "concurrently": "^8.0.0",
    "prettier": "^3.7.4"
  }
}
```

**安装命令**:

```bash
# 在项目根目录
npm install --save-dev concurrently prettier

# 统一安装所有依赖
npm run install:all
```

---

## 配置文件更新

### 1. Backend: .mocharc.json（新建）

```json
{
  "require": ["tests/setup.js"],
  "timeout": 10000,
  "exit": true,
  "recursive": true,
  "spec": "tests/**/*.test.js",
  "reporter": "spec",
  "ui": "bdd"
}
```

### 2. Backend: .nycrc.json（新建）

```json
{
  "all": true,
  "check-coverage": true,
  "lines": 70,
  "statements": 70,
  "functions": 75,
  "branches": 65,
  "include": ["src/**/*.js"],
  "exclude": ["src/server.js", "tests/**", "scripts/**", "**/*.test.js"],
  "reporter": ["text", "html", "lcov"],
  "report-dir": "./coverage"
}
```

### 3. Admin: vitest.config.ts（已创建）

参见 `admin/vitest.config.ts`

### 4. 根目录: .prettierrc.json（新建或更新）

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 5. 根目录: .prettierignore（新建）

```
node_modules
dist
build
coverage
*.log
.env*
package-lock.json
miniprogram
```

---

## 验证安装

### Backend

```bash
cd backend

# 验证所有依赖已安装
npm list mocha chai sinon artillery newman

# 验证脚本可执行
npm run lint
npm run test:unit
npm run test:integration

# 验证覆盖率
npm run test:coverage
```

### Admin

```bash
cd admin

# 验证所有依赖已安装
npm list vitest @vue/test-utils c8

# 验证脚本可执行
npm run lint
npm run type-check
npm run test:unit

# 验证 UI 模式
npm run test:ui
```

---

## 分阶段实施建议

### 阶段1: 基础配置（1天）

```bash
# 1. 更新 Backend package.json
cd backend
npm install --save-dev artillery newman @faker-js/faker nock

# 2. 更新 Admin package.json
cd ../admin
npm install --save-dev vitest @vue/test-utils @vitest/ui c8 happy-dom

# 3. 创建配置文件
# - .mocharc.json
# - .nycrc.json
# - vitest.config.ts（已有）
# - .prettierrc.json

# 4. 验证安装
cd ../backend && npm run test:unit
cd ../admin && npm run test:unit
```

### 阶段2: 修复现有测试（半天）

```bash
# 运行修复脚本
./scripts/fix-mocha-tests.sh

# 验证所有测试通过
cd backend && npm run test
```

### 阶段3: 添加新测试（按需）

- Backend: 为新功能添加单元测试和集成测试
- Admin: 为组件添加单元测试
- 逐步提高覆盖率到目标值

---

## 常见问题

### Q1: npm install 失败怎么办？

**A**: 清理缓存重试:

```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Q2: 依赖冲突怎么办？

**A**: 使用 `--legacy-peer-deps`:

```bash
npm install --save-dev vitest --legacy-peer-deps
```

### Q3: 如何确认所有依赖都安装了？

**A**: 运行:

```bash
npm list --depth=0
```

查看所有顶级依赖是否都存在。

---

**文档版本**: 1.0.0
**最后更新**: 2025-12-17
