# Phase 4: API 端点实现与测试修复

**日期**: 2025-12-16
**目标**: 修复集成测试路径问题并实现缺失的 API 端点
**预期收益**: 集成测试从 23 通过 → 90+ 通过

---

## 📋 任务分解

### 1️⃣ 诊断: API 路径不匹配问题

**问题分析:**
- 测试期望: `GET /api/v1/user/current`
- 实际实现: `GET /api/v1/users/me`
- 根本原因: 路由前缀不同 (`/users` vs `/user`)

**诊断步骤:**
```bash
# 1. 检查当前路由注册
grep -n "app.use" backend/src/app.js

# 2. 检查 user.routes.js 中的路由
grep -n "router.get\|router.put" backend/src/routes/user.routes.js

# 3. 理解实际的 API 路径
# /api/v1/users/me → 获取当前用户
# /api/v1/users/profile → 更新用户资料
```

**修复选项:**
- **选项 A**: 修改测试以匹配实际路由 (推荐 ✅)
  - 快速、简单、不改变生产代码
  - 测试目的是验证实现，而非定义 API

- **选项 B**: 修改路由以匹配测试
  - 需要修改 11 个路由
  - 影响面大，需要更新文档

**决策**: 选择选项 A - 修改测试

---

### 2️⃣ 修复集成测试中的路径不匹配

**受影响的测试:**
1. `auth.integration.test.js` - 13 个测试使用 `/api/v1/user/current`
2. `error-handling.integration.test.js` - 多个测试使用同一路径

**修改清单:**
- [ ] 更新 auth.integration.test.js
  - `GET /api/v1/user/current` → `GET /api/v1/users/me`
  - `PUT /api/v1/user/profile` → `PUT /api/v1/users/profile`

- [ ] 更新 error-handling.integration.test.js
  - 同上

- [ ] 验证其他文件中是否有类似问题
  - 检查 checkin 测试
  - 检查 insight 测试
  - 检查 period 测试

**修改代码示例:**
```javascript
// 之前
const res = await request(app)
  .get('/api/v1/user/current')
  .set('Authorization', `Bearer ${token}`);

// 之后
const res = await request(app)
  .get('/api/v1/users/me')
  .set('Authorization', `Bearer ${token}`);
```

---

### 3️⃣ 实现缺失的 API 端点

**已有端点:**
- ✅ `GET /api/v1/users/me` - 获取当前用户
- ✅ `PUT /api/v1/users/profile` - 更新用户资料
- ✅ `GET /api/v1/auth/wechat/login` - 微信登录

**缺失端点:**
- ❌ `POST /api/v1/period` - 创建期次
  - 依赖: Period 模型已存在
  - 文件: `backend/src/controllers/period.controller.js`
  - 函数: `createPeriod` 应已实现

- ❌ `POST /api/v1/insights` - 创建小凡看见
  - 依赖: Insight 模型已存在
  - 文件: `backend/src/controllers/insight.controller.js`
  - 函数: `createInsight` 应已实现

**检查步骤:**
```bash
# 检查路由是否注册
grep -n "POST.*period\|POST.*insight" backend/src/routes/*.js

# 检查控制器函数
grep -n "exports.createPeriod\|exports.createInsight" backend/src/controllers/*.js
```

**如果缺失，需要:**
1. 检查 period.controller.js 中的 createPeriod 函数
2. 检查 insight.controller.js 中的 createInsight 函数
3. 检查对应的路由是否注册
4. 如果缺失则实现

---

### 4️⃣ 验证修复

**验证步骤:**
```bash
# 1. 修改测试文件
# - auth.integration.test.js
# - error-handling.integration.test.js
# - 其他受影响的测试文件

# 2. 运行集成测试
cd backend
npm test -- tests/integration

# 3. 预期结果
# 之前: 23 通过, 34 失败
# 之后: 50+ 通过, 少于 10 个失败 (只与真实 API 缺失相关)
```

**成功标志:**
- ✅ 路径不匹配的 404 错误消失
- ✅ 认证相关测试通过
- ✅ 打卡、小凡看见相关测试通过
- ✅ 错误处理测试通过

---

## 📊 实施时间表

| 阶段 | 任务 | 预估时间 | 状态 |
|------|------|--------|------|
| 1 | 诊断 API 路径问题 | 15 分钟 | 待开始 |
| 2 | 修改集成测试 | 30 分钟 | 待开始 |
| 3 | 验证路由和控制器 | 20 分钟 | 待开始 |
| 4 | 运行完整测试 | 15 分钟 | 待开始 |
| 5 | 提交和文档更新 | 15 分钟 | 待开始 |
| **总计** | | **95 分钟** | |

---

## 🎯 成功标准

1. ✅ 集成测试通过率 > 50%（从 25% 提升）
2. ✅ 路由路径问题全部修复
3. ✅ 所有认证相关测试通过
4. ✅ 新的 Git 提交已推送到 GitHub

---

## 📝 后续工作 (Phase 4+)

完成本阶段后的下一步:

1. **实现完整的 CRUD API**
   - Period CRUD
   - Insight CRUD
   - Section CRUD
   - Comment CRUD
   - 等等

2. **提升覆盖率**
   - 目标: 70%+
   - 重点: 业务逻辑复杂的控制器

3. **设置 CI/CD**
   - GitHub Actions
   - 自动运行测试
   - 自动生成覆盖率报告

4. **E2E 测试** (可选)
   - Cypress 测试框架
   - 完整的用户流程验证

---

## 📌 注意事项

1. **不要改变 API 路径**：保持 `/api/v1/users` 前缀，修改测试而非路由

2. **保持向后兼容**：如果有现有客户端，不要破坏现有 API

3. **更新文档**：修改测试后更新 TESTING_GUIDE.md

4. **提交规范**：
   ```
   fix: Correct integration test API paths

   - Updated auth.integration.test.js to use /api/v1/users/me instead of /api/v1/user/current
   - Updated error-handling.integration.test.js with correct paths
   - Increased passing tests from 23 to 50+
   ```

---

**预计完成时间: 2-3 小时（包括所有验证和文档更新）**
