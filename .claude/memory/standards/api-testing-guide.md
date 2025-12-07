# API 测试脚本维护指南

## 📍 脚本位置

```
.claude/commands/testing/test-all-apis.sh
```

## 🚀 快速开始

```bash
# 启动后端服务
bash .claude/commands/development/start-backend.sh

# 运行所有API测试
bash .claude/commands/testing/test-all-apis.sh
```

## 📝 如何添加新接口测试

### 步骤1: 编辑测试脚本

打开 `.claude/commands/testing/test-all-apis.sh` 文件

### 步骤2: 找到对应的API分类

脚本按照功能分类组织：

```
### 1️⃣  用户接口 (Users API)
### 2️⃣  小凡看见接口 (Insights API)  
### 3️⃣  系统接口 (System API)
```

如果新接口属于现有分类，就在该分类下添加；如果是新分类，则创建新的分类标题。

### 步骤3: 添加测试用例

使用 `test_api` 函数添加新的测试。函数签名：

```bash
test_api '接口名称' 'METHOD' '/endpoint' '[JSON_DATA]' 'HTTP_CODE'
```

**参数说明：**
- `接口名称`: 测试的描述名称（用于日志输出）
- `METHOD`: HTTP方法（GET、POST、PUT、DELETE）
- `/endpoint`: API端点（相对路径）
- `[JSON_DATA]`: 可选的JSON请求体（如果没有则留空""）
- `HTTP_CODE`: 预期的HTTP状态码（200、201、400、401等）

### 步骤4: 示例

```bash
# 例1: GET请求
test_api "获取用户列表" "GET" "/users" "" "200"

# 例2: POST请求
test_api "创建用户" "POST" "/users" '{"name":"test","email":"test@test.com"}' "201"

# 例3: 发生错误的情况
test_api "尝试重复申请" "POST" "/insights/requests" '{"toUserId":"same_id"}' "400"
```

## 📋 当前接口列表

| 日期 | 接口 | 方法 | 端点 | 说明 |
|------|------|------|------|------|
| 2025-12-04 | 获取用户信息 | GET | /users/:userId | 获取他人用户资料 |
| 2025-12-04 | 创建查看申请 | POST | /insights/requests | 申请查看小凡看见 |
| 基础 | 获取当前用户 | GET | /users/me | 获取当前登录用户信息 |
| 基础 | 健康检查 | GET | /health | 检查服务状态 |

## ✨ 最佳实践

### 1. 添加注释标记版本

```bash
# 新增: 2025-12-04 - 获取用户信息
test_api "GET /users/:userId" "GET" "/users/test_id" "" "404"
```

### 2. 测试成功和失败场景

```bash
# 成功场景
test_api "创建申请 - 成功" "POST" "/insights/requests" \
  '{"toUserId":"valid_user_id"}' "200"

# 失败场景 - 申请自己
test_api "创建申请 - 申请自己" "POST" "/insights/requests" \
  '{"toUserId":"same_user_id"}' "400"
```

### 3. 使用实际的测试数据

建议在测试脚本中添加变量来存储测试数据：

```bash
# 在main函数开始处添加
TEST_USER_ID="507f1f77bcf86cd799439011"  # 实际的MongoDB ObjectId
CURRENT_USER_ID="$TOKEN_USER_ID"  # 从Token解析
```

## 🔍 调试技巧

### 查看完整响应

如果测试失败，脚本会显示完整的API响应体。你可以：

1. 查看返回的错误信息
2. 检查HTTP状态码是否符合预期
3. 验证API逻辑是否正确

### 手动测试单个接口

```bash
# 获取Token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@morningreading.com","password":"admin123456"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 测试单个接口
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/users/test_id | python3 -m json.tool
```

## 📊 测试结果解读

脚本会输出测试总结：

```
========== 📊 测试总结 ==========
总测试数: 4
通过: 3
失败: 1
```

- **绿色✅**: 测试通过，返回预期的HTTP状态码
- **红色❌**: 测试失败，返回了意外的HTTP状态码

## 🔄 定期维护

建议的维护计划：

- **每次添加新API时**: 立即添加测试用例
- **每周**: 运行测试脚本确保现有API仍正常工作
- **每月**: 审查测试覆盖率，补充缺失的测试

## 📚 相关文件

- API实现: `backend/src/routes/` 和 `backend/src/controllers/`
- 前端调用: `miniprogram/services/`
- 数据模型: `backend/src/models/`

## 💬 常见问题

**Q: Token过期了怎么办？**
A: 脚本会自动尝试登录获取新Token。如果登录失败，请检查测试账户凭证。

**Q: 某个测试一直失败怎么办？**
A: 
1. 检查API是否已正确部署
2. 查看后端服务日志
3. 手动测试该接口确认问题
4. 更新测试的预期HTTP状态码

**Q: 如何测试需要特定用户ID的接口？**
A: 修改脚本中的 `TEST_USER_ID` 变量，或使用从实际数据库查询的用户ID。

---

**最后更新**: 2025-12-04
**维护者**: Claude Code
