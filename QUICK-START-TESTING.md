# 快速测试启动指南 (Quick Start Testing)

本指南帮助您快速开始运行晨读营系统的各类测试。

---

## 🚀 5 分钟快速开始

### 前置准备

```bash
# 1. 进入项目目录
cd "/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营"

# 2. 确保已安装依赖
npm install                    # 根目录
npm install --cwd backend      # 后端
npm install --cwd admin        # 前端

# 3. 启动所有服务
npm run dev --cwd backend &    # 后端 (3000 端口)
npm run dev --cwd admin &      # 前端 (5173 端口)
```

---

## 🧪 三种测试方式

### 方式 1: API 测试 (最快，10 秒)

```bash
cd backend
npm test
```

✅ 验证: 所有 API 端点是否正常工作
⏱️ 耗时: ~30 秒

---

### 方式 2: 性能测试 (中等，2 分钟)

```bash
# 确保后端已启动
node backend/tests/load-test.js
```

✅ 验证: API 性能和并发能力
📊 输出: Min/Avg/P95/P99/Max 响应时间统计

---

### 方式 3: UI 测试 (最全面，3 分钟)

#### 交互式运行（推荐用于开发）

```bash
npx cypress open
```

然后在打开的窗口中：
1. 选择 "E2E Testing"
2. 选择浏览器 (Chrome / Firefox)
3. 点击 `admin-dashboard.cy.js`

#### 命令行运行（推荐用于 CI/CD）

```bash
npx cypress run
```

✅ 验证: 完整的用户交互流程
📺 生成: 测试报告和截图

---

## 📊 一键运行所有测试

```bash
# 运行 API + 性能测试
npm run test:all --cwd backend

# 或完整的测试序列
bash << 'EOF'
echo "1️⃣ 运行 API 测试..."
npm test --cwd backend

echo -e "\n2️⃣ 运行性能测试..."
node backend/tests/load-test.js

echo -e "\n3️⃣ 运行 UI 测试..."
npx cypress run

echo -e "\n✅ 所有测试完成！"
EOF
```

---

## 🎯 常用命令速查表

| 命令 | 描述 | 耗时 |
|------|------|------|
| `npm test --cwd backend` | API 单元测试 | 30s |
| `node backend/tests/load-test.js` | 性能测试 | 2m |
| `npx cypress open` | 交互式 UI 测试 | 3m |
| `npx cypress run` | 命令行 UI 测试 | 3m |
| `npm run test:all --cwd backend` | API + 性能测试 | 3m |

---

## 📋 测试清单

### 每次开发前运行

- [ ] `npm test --cwd backend` - API 正常
- [ ] `npx cypress run --spec cypress/e2e/admin-dashboard.cy.js` - UI 正常

### 每次提交代码前运行

- [ ] 所有上述测试通过
- [ ] `git status` - 没有未提交的修改
- [ ] `npm run test:all --cwd backend` - 性能未降级

### 生产部署前运行

- [ ] 运行所有 3 种测试
- [ ] 查看性能报告 (Avg < 500ms)
- [ ] 检查测试覆盖率 (> 95%)
- [ ] 验证错误日志为空

---

## 🔧 故障排除

### 后端无法连接

```bash
# 检查后端是否正在运行
curl http://localhost:3000/api/v1/health

# 如果失败，手动启动
cd backend && npm run dev
```

### MongoDB 连接错误

```bash
# 检查 MongoDB 是否运行
mongosh admin --eval "db.adminCommand('ping')"

# 如果失败，启动 MongoDB
mongod --dbpath ~/data/db

# 或使用 Docker
docker run -d -p 27017:27017 mongo
```

### Cypress 找不到元素

- 确保前端已启动 (`npm run dev --cwd admin`)
- 增加超时时间: `cypress run --config defaultCommandTimeout=15000`

### 测试超时

```bash
# 增加 npm test 的超时
npm test --cwd backend -- --timeout 20000

# 增加 Cypress 的超时
npx cypress run --config defaultCommandTimeout=20000
```

---

## 📚 详细文档

想了解更多？查看这些文档：

1. **测试执行完整指南**
   ```
   docs/TEST-EXECUTION-GUIDE.md
   ```
   - 所有测试的详细说明
   - 常见问题和解决方案
   - CI/CD 集成配置

2. **E2E 测试计划**
   ```
   docs/E2E-TEST-PLAN.md
   ```
   - 20+ 个具体测试场景
   - 详细的期望结果和步骤

3. **性能优化指南**
   ```
   backend/docs/query-optimization.md
   ```
   - 数据库查询优化
   - 索引和缓存策略

4. **本周完成总结**
   ```
   docs/TESTING-SUMMARY.md
   ```
   - Week 2 的全面总结
   - 代码统计和质量指标

---

## 💡 Pro 技巧

### 只运行特定测试

```bash
# 只运行认证相关的 API 测试
npm test --cwd backend -- --grep "认证"

# 只运行特定的 UI 测试
npx cypress run --spec cypress/e2e/admin-dashboard.cy.js --config specPattern="报名"
```

### 生成测试报告

```bash
# 生成 HTML 报告
npx cypress run --reporter html

# 生成 JSON 报告
npm test --cwd backend -- --reporter json > test-results.json

# 查看性能报告
node backend/tests/load-test.js > performance-report.txt
```

### 调试测试

```bash
# 在调试模式下运行 Cypress
npx cypress open --debug

# 在 API 测试中添加详细日志
npm test --cwd backend -- --reporter spec
```

---

## 🎓 学习路径

### 初级开发者

1. 读这个文档 (5 分钟)
2. 运行 `npm test --cwd backend` (30 秒)
3. 运行 `npx cypress open` 看看 UI 测试 (3 分钟)

### 中级开发者

1. 阅读 `docs/TEST-EXECUTION-GUIDE.md` (20 分钟)
2. 理解各个测试的目的 (15 分钟)
3. 修改现有测试或添加新测试 (30 分钟)

### 高级开发者

1. 研究 `cypress.config.js` 和测试框架配置
2. 设置 CI/CD 集成
3. 优化测试运行时间和覆盖率

---

## 📞 需要帮助？

查看这些资源：

- 🔗 [Cypress 官方文档](https://docs.cypress.io/)
- 🔗 [Mocha 测试框架](https://mochajs.org/)
- 🔗 [Node.js HTTP 模块](https://nodejs.org/api/http.html)
- 📝 `docs/TEST-EXECUTION-GUIDE.md` - 故障排除部分

---

## ✅ 快速检查清单

在运行测试前，确认：

- [ ] 项目目录: `/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营`
- [ ] 后端运行: `http://localhost:3000` (或自定义端口)
- [ ] 前端运行: `http://localhost:5173` (或自定义端口)
- [ ] MongoDB 运行: `mongodb://localhost:27017`
- [ ] Node.js 版本 >= 16.x

---

**最后更新**: 2025-11-22
**维护者**: Claude Code
**版本**: 1.0

