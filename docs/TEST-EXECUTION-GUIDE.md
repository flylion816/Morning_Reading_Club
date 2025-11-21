# 测试执行指南 (Test Execution Guide)

本文档详细说明了如何运行晨读营系统的完整测试套件，包括单元测试、集成测试、UI 测试和性能测试。

---

## 📋 测试概览

| 测试类型 | 工具 | 位置 | 命令 | 时长 |
|---------|------|------|------|------|
| **API 单元测试** | Mocha + Chai | `backend/tests/api.test.js` | `npm test` | ~30s |
| **UI E2E 测试** | Cypress | `cypress/e2e/admin-dashboard.cy.js` | `npx cypress open` | ~2-3m |
| **性能测试** | Node.js | `backend/tests/load-test.js` | `node backend/tests/load-test.js` | ~2-3m |
| **集成测试** | 自定义 | `backend/tests/integration/` | `npm run test:integration` | ~1m |

---

## 🚀 快速开始

### 前置条件

1. **Node.js** >= 16.x
2. **MongoDB** 正在运行
3. **后端服务** 启动在 `http://localhost:3000`
4. **前端服务** 启动在 `http://localhost:5173`（用于 UI 测试）

### 一键运行所有测试

```bash
# 进入项目根目录
cd "/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营"

# 运行所有测试（顺序：单元 → 集成 → 性能 → UI）
npm run test:all
```

---

## 📝 各类测试详细说明

### 1. API 单元测试 (Unit Tests)

**目的**: 验证 API 端点的正确性、错误处理和数据一致性

**运行方式**:

```bash
cd backend
npm test
```

**测试覆盖范围**:

```
✅ 认证 API
  ├─ 成功登录
  ├─ 错误密码处理
  └─ 无效 token 拒绝

✅ 期次 API
  ├─ 获取期次列表
  ├─ 创建新期次
  └─ 期次查询和筛选

✅ 报名 API
  ├─ 获取报名列表
  ├─ 批量批准报名
  ├─ 批量拒绝报名
  └─ 批量删除报名

✅ 支付 API
  ├─ 获取支付记录
  ├─ 支付状态筛选
  └─ 支付流程验证

✅ 数据分析 API
  ├─ 统计数据查询
  └─ 数据准确性验证

✅ 审计日志 API
  ├─ 获取审计日志
  ├─ 日志筛选
  └─ 日志导出

✅ 错误处理
  ├─ 未认证请求拒绝
  ├─ 无效 Token 处理
  ├─ 404 错误处理
  └─ 服务器错误处理

✅ 性能基准
  ├─ 列表查询 < 1s
  └─ 统计查询 < 500ms
```

**预期结果**:

```
  API 集成测试
    1. 认证 API
      ✓ 应该能成功登录 (123ms)
      ✓ 应该拒绝错误的密码 (89ms)

    2. 期次 API
      ✓ 应该能获取期次列表 (145ms)
      ✓ 应该能创建新期次 (156ms)

    ... (共 20 个测试)

  20 passing (2.5s)
```

**常见问题**:

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| `Connection refused` | MongoDB 未启动 | 启动 MongoDB: `mongod` |
| `Cannot find module 'chai'` | 依赖未安装 | 运行 `npm install` |
| `Port 3000 in use` | 后端未启动 | 先启动后端: `npm run dev` |

---

### 2. UI E2E 测试 (End-to-End Tests)

**目的**: 测试完整的用户交互流程，验证前后端集成

**安装 Cypress**:

```bash
npm install --save-dev cypress

# 可选：打开 Cypress UI 进行交互式测试
npx cypress open
```

**运行方式**:

#### 方式 1: 交互式模式（推荐用于开发）

```bash
npx cypress open

# 在打开的窗口中：
# 1. 选择 E2E Testing
# 2. 选择浏览器（Chrome、Firefox 等）
# 3. 点击测试文件运行
```

#### 方式 2: 命令行模式（推荐用于 CI/CD）

```bash
# 运行所有 E2E 测试
npx cypress run

# 运行特定测试文件
npx cypress run --spec cypress/e2e/admin-dashboard.cy.js

# 生成 HTML 报告
npx cypress run --reporter html
```

**测试场景**:

```
✅ 登录流程
  ├─ 成功登录
  ├─ 错误密码处理
  └─ 未登录状态处理

✅ 报名管理
  ├─ 加载报名列表
  ├─ 批量批准操作
  ├─ 批量拒绝操作
  └─ 筛选和排序

✅ 数据分析
  ├─ 加载分析仪表板
  ├─ 图表交互
  └─ 数据导出

✅ 审计日志
  ├─ 加载审计日志
  ├─ 日志筛选
  └─ 日志详情查看

✅ 支付管理
  ├─ 加载支付列表
  └─ 状态筛选

✅ 错误处理
  ├─ API 错误处理
  └─ 网络错误处理

✅ 性能
  ├─ 列表加载 < 2s
  └─ 分析加载 < 3s
```

**预期结果**:

```
Running:  admin-dashboard.cy.js                              (X of X)

  管理后台 E2E 测试
    1. 登录流程
      ✓ 应该能成功登录 (1.5s)
      ✓ 错误密码应该被拒绝 (1.2s)

    2. 报名管理
      ✓ 应该能加载报名列表 (0.8s)
      ✓ 应该能进行批量批准操作 (2.1s)
      ✓ 应该能进行批量拒绝操作 (1.9s)
      ✓ 应该能使用筛选器 (1.3s)

    ... (共 18 个测试)

  18 passing (45s)
```

**调试技巧**:

```bash
# 以调试模式运行（暂停执行）
npx cypress run --debug

# 显示详细日志
npx cypress run --config videoUploadOnPasses=false,video=true

# 运行时生成视频（保存失败场景）
npx cypress run --record
```

---

### 3. 性能和负载测试 (Performance Tests)

**目的**: 验证系统在并发负载下的性能表现

**运行方式**:

```bash
cd backend

# 确保后端正在运行
npm run dev &

# 在新的终端运行性能测试
node tests/load-test.js
```

**测试场景**:

```
📊 并发请求测试

1. 登录 API
   ├─ 并发数: 1
   ├─ 迭代: 1
   └─ 目标: 获取 admin token

2. 期次列表 (GET /periods)
   ├─ 并发数: 10
   ├─ 迭代: 5
   └─ 目标: < 200ms

3. 报名列表 (GET /enrollments?pageSize=50)
   ├─ 并发数: 20
   ├─ 迭代: 3
   └─ 目标: < 500ms

4. 统计数据 (GET /stats)
   ├─ 并发数: 15
   ├─ 迭代: 5
   └─ 目标: < 100ms

5. 审计日志 (GET /audit-logs)
   ├─ 并发数: 10
   ├─ 迭代: 3
   └─ 目标: < 300ms

6. 支付记录 (GET /payments)
   ├─ 并发数: 10
   ├─ 迭代: 3
   └─ 目标: < 300ms
```

**预期结果**:

```
╔════════════════════════════════════════════════════╗
║         API 性能和负载测试                         ║
╚════════════════════════════════════════════════════╝

🧪 开始测试: 登录 API
   并发数: 1, 迭代数: 1

✅ 测试结果: 登录 API
   总请求数: 1
   成功: 1 (100.00%)
   失败: 0

   响应时间统计 (ms):
   ├─ 最小: 45ms
   ├─ 平均: 45ms
   ├─ P95: 45ms
   ├─ P99: 45ms
   └─ 最大: 45ms

... (更多测试结果)

╔════════════════════════════════════════════════════╗
║              性能测试总结报告                       ║
╚════════════════════════════════════════════════════╝

📊 概览统计:
   测试场景: 6
   总请求数: 545
   成功请求: 542
   失败请求: 3
   总耗时: 15234ms

🎯 性能指标排序 (平均响应时间):

   1. ⚡ 统计数据查询: 58ms
   2. ⚡ 登录 API: 45ms
   3. ✅ 期次列表查询: 156ms
   4. ✅ 支付记录查询: 234ms
   5. ✅ 审计日志查询: 289ms
   6. ✅ 报名列表查询 (50条): 456ms

🏆 性能评级:

   ✅ 高效 (< 200ms): 3 个
   ⚠️  需优化 (> 500ms): 0 个

📈 异常延迟检测:

   ✅ 无异常延迟，延迟分布均匀

═══════════════════════════════════════════════════

📝 建议:

   1. 检查数据库查询性能
   2. 添加适当的索引
   3. 考虑缓存策略

✨ 测试完成！
```

**性能指标说明**:

| 指标 | 说明 | 目标 |
|------|------|------|
| **Min** | 最快响应时间 | N/A |
| **Avg** | 平均响应时间 | < 500ms |
| **P95** | 95% 请求的响应时间 | < 1s |
| **P99** | 99% 请求的响应时间 | < 2s |
| **Max** | 最慢响应时间 | < 5s |

**性能优化建议**:

- ✅ **Avg < 200ms**: 优秀，无需优化
- ✅ **200ms < Avg < 500ms**: 良好，可考虑微调
- ⚠️ **Avg > 500ms**: 需要优化，检查：
  - 数据库查询是否有索引
  - 是否有 N+1 查询问题
  - 返回数据量是否过大
  - 是否需要缓存

---

### 4. 集成测试 (Integration Tests)

**运行方式**:

```bash
cd backend
npm run test:integration
```

**测试内容**:

```
✅ 完整的报名流程
  ├─ 用户登录
  ├─ 填写报名表单
  ├─ 提交报名
  ├─ 管理员审批
  └─ 报名状态更新

✅ 完整的支付流程
  ├─ 创建支付订单
  ├─ 初始化支付
  ├─ 确认支付
  └─ 更新报名状态

✅ 审计日志记录
  ├─ 操作被正确记录
  ├─ 字段变更被追踪
  └─ 审计日志可查询

✅ 权限验证
  ├─ 未认证用户被拒绝
  ├─ 普通用户无法访问管理接口
  └─ 管理员有完全访问权限

✅ 数据一致性
  ├─ 报名人数统计准确
  ├─ 支付数据与报名同步
  └─ 审计日志完整性验证
```

---

## 🎯 完整测试工作流

### 开发阶段

```bash
# 1. 启动所有服务
npm run start:all  # 后端 + 前端 + MongoDB

# 2. 运行单元测试（快速反馈）
cd backend && npm test

# 3. 运行 UI 测试（验证集成）
npx cypress open

# 4. 修复失败的测试
# 修改代码...

# 5. 重新运行测试
npm test && npx cypress run
```

### 提交前检查清单

```bash
# 1. 确保后端启动
npm run dev --cwd backend

# 2. 运行所有测试
npm test --cwd backend        # API 测试
npx cypress run               # UI 测试
node backend/tests/load-test.js  # 性能测试

# 3. 检查覆盖率报告
# 检查 coverage/ 目录

# 4. 提交代码
git add .
git commit -m "feat: 新功能..."
```

### 预发布测试（正式部署前）

```bash
# 1. 清理环境
rm -rf node_modules/ package-lock.json
npm install

# 2. 启动完整环境
npm run start:all

# 3. 运行完整测试套件
npm run test:full

# 4. 生成测试报告
npm run test:report

# 5. 检查性能基准
node backend/tests/load-test.js > performance-report.txt

# 6. 验证所有指标
# 检查 performance-report.txt
```

---

## 📊 测试报告

### 生成测试报告

```bash
# API 测试报告
npm test -- --reporter json > test-results.json

# UI 测试报告（HTML）
npx cypress run --reporter html

# 覆盖率报告
npx nyc npm test
```

### 查看报告

```bash
# 打开 HTML 报告
open cypress/results/index.html

# 打开覆盖率报告
open coverage/index.html

# 查看性能报告
cat performance-report.txt
```

---

## 🔧 故障排除

### 常见问题

#### 1. MongoDB 连接错误

```
错误: connect ECONNREFUSED 127.0.0.1:27017

解决方案:
```bash
# 启动 MongoDB
mongod --dbpath ~/data/db

# 或使用 Docker
docker run -d -p 27017:27017 mongo
```

#### 2. 端口已被占用

```
错误: listen EADDRINUSE :::3000

解决方案:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或更改配置中的端口
PORT=3001 npm run dev
```

#### 3. Cypress 找不到元素

```
错误: Timed out retrying after 10000ms

解决方案:
# 1. 检查选择器是否正确
# 2. 增加超时时间
# 3. 等待元素加载
```bash
cy.get('[class*="el-table"]', { timeout: 15000 }).should('exist')
```

#### 4. 测试超时

```
解决方案:
# 增加超时配置
npx cypress run --config defaultCommandTimeout=20000

# 或在测试中设置
cy.get('.selector', { timeout: 20000 })
```

---

## 📈 持续集成 (CI/CD)

### GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: 测试

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: 安装依赖
        run: npm install

      - name: 运行 API 测试
        run: npm test --cwd backend

      - name: 运行性能测试
        run: node backend/tests/load-test.js

      - name: 上传测试结果
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results.json
```

---

## 📚 相关文档

- [E2E 测试计划](./E2E-TEST-PLAN.md) - 详细的测试场景和用例
- [性能优化指南](./backend/docs/query-optimization.md) - 数据库查询优化
- [API 文档](./API.md) - API 规范和端点说明
- [部署指南](./deployment.md) - 生产环境部署步骤

---

## 💡 最佳实践

### 1. 测试隔离性

✅ **好的做法**:
```javascript
beforeEach(() => {
  cy.login();  // 每个测试前重新登录
});

afterEach(() => {
  cy.logout();  // 每个测试后清理
});
```

❌ **避免**:
```javascript
// 测试间相互依赖，顺序敏感
it('test 1', () => { ... });
it('test 2 depends on test 1', () => { ... });
```

### 2. 避免硬等待

❌ **不好**:
```javascript
cy.wait(3000);  // 盲目等待
```

✅ **好的做法**:
```javascript
cy.get('.data').should('have.length', 10);  // 等待数据加载
cy.get('.loading').should('not.exist');     // 等待加载完成
```

### 3. 测试数据管理

✅ **好的做法**:
```javascript
beforeEach(() => {
  cy.request('POST', '/api/v1/test-data/setup');  // 准备测试数据
});

afterEach(() => {
  cy.request('POST', '/api/v1/test-data/cleanup');  // 清理测试数据
});
```

### 4. 性能基准

✅ **定期记录**:
```
- 2025-11-22: avg 156ms ✅
- 2025-11-23: avg 189ms ✅
- 2025-11-24: avg 234ms ⚠️ (需优化)
```

---

## 📞 获取帮助

### 测试失败怎么办？

1. **查看错误日志**:
   ```bash
   # 查看 API 测试日志
   cat test-results.json

   # 查看 Cypress 日志
   tail -f cypress/logs/*.log
   ```

2. **重现问题**:
   ```bash
   # 运行单个测试
   npx cypress run --spec cypress/e2e/admin-dashboard.cy.js

   # 添加调试信息
   DEBUG=* npm test
   ```

3. **检查系统状态**:
   ```bash
   # 检查后端是否运行
   curl http://localhost:3000/api/v1/health

   # 检查前端是否运行
   curl http://localhost:5173

   # 检查数据库连接
   mongosh admin --eval "db.adminCommand('ping')"
   ```

---

**最后更新**: 2025-11-22
**维护者**: Claude Code
**版本**: 1.0
