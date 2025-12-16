# Token Authentication Bug Fix - 2025-12-06

## Problem Description

用户在保存个人签名时收到 "保存失败，请重试" 错误，虽然实际上登录成功但后续API调用返回401 "Token无效"。

## Root Cause Analysis

**字段命名不一致导致Token未被正确存储到globalData**

后端返回的登录响应使用驼峰命名:

```json
{
  "code": 200,
  "data": {
    "accessToken": "eyJ...",      // ← camelCase
    "refreshToken": "eyJ...",
    "user": {...}
  }
}
```

但前端代码期望的是蛇形命名:

```javascript
// 错误的代码
app.globalData.token = loginData.access_token; // 获取undefined!
```

## Impact

1. **globalData.token 为 undefined**: 虽然auth.service.js正确地保存token到localStorage，但login.js中的globalData.token被设置为undefined
2. **401认证失败**: 由于字段名称不匹配，某些使用globalData.token的代码路径会失败
3. **签名保存失败**: 用户保存签名时收到"保存失败，请重试"错误

## Solution Implemented

### 修改1: login.js (Line 67)

```javascript
// Before
app.globalData.token = loginData.access_token;

// After
app.globalData.token = loginData.accessToken;
```

### 修改2: auth.service.js (Lines 71-84)

统一Mock模式的字段命名，保持与生产环境一致:

```javascript
// Before
const mockLoginData = {
  access_token: 'mock_token_' + Date.now(),     // snake_case
  refresh_token: 'mock_refresh_token_' + Date.now(),
  user: {...}
};

// After
const mockLoginData = {
  accessToken: 'mock_token_' + Date.now(),      // camelCase
  refreshToken: 'mock_refresh_token_' + Date.now(),
  user: {...}
};
```

## Testing Results

✅ 完整流程测试通过:

1. Login API 返回正确的accessToken
2. PUT /users/profile 使用Bearer token成功
3. Signature被正确保存到数据库

```bash
# Test command
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/users/profile \
  -X PUT -d '{"signature":"测试签名"}'
# Result: 200 OK ✅
```

## Files Changed

- miniprogram/pages/login/login.js (1 line)
- miniprogram/services/auth.service.js (8 lines)

**Commit**: 87531c9

## Key Learnings

1. **前后端字段命名要统一**: 特别是在认证系统中，snake_case vs camelCase的混用容易导致bug
2. **Mock和生产环境要保持一致**: auth.service.js的Mock登录和生产登录返回的格式不同，这会隐藏实际环境中存在的问题
3. **Token存储位置**:
   - localStorage (长期存储，持久化) ✓ request.js 从这里读取
   - globalData (会话内存储) 应该与localStorage保持同步

## Prevention

- 在API设计文档中明确指定返回值的字段命名规范
- 在单元测试中验证Mock模式和生产模式返回结构一致
- 使用TypeScript/JSDoc定义清晰的接口类型，防止字段名错误

## User Testing Checklist

在微信小程序中验证以下场景:

- [ ] 点击微信登录
- [ ] 看到登录成功toast
- [ ] 进入个人资料页面
- [ ] 编辑签名
- [ ] 点击保存
- [ ] 看到"保存成功"toast
- [ ] 再次进入个人资料页面，确认签名已保存
- [ ] 在首页可看到签名显示
