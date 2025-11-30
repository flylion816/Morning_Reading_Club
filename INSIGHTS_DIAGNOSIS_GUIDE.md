# 小凡看见可见性问题诊断指南

## 问题现象

首页显示"本期暂无小凡看见记录"，但点击"查看更多历史"能看到insights数据。

## 根本原因分析

该问题由多个层级的代码交互引起：

### 后端：认证中间件配置

**文件**: `backend/src/routes/insight.routes.js` (第66行)

**问题代码**:
```javascript
// ❌ 问题：路由没有应用 authMiddleware
router.get('/period/:periodId', getInsightsForPeriod);
```

**正确代码**:
```javascript
// ✅ 正确：添加 authMiddleware
router.get('/period/:periodId', authMiddleware, getInsightsForPeriod);
```

**影响**：
- 没有 `authMiddleware`，后端无法从请求headers中解析`Authorization: Bearer token`
- `req.user` 永远是 `undefined`
- 在 `getInsightsForPeriod` 函数中，代码检查 `userId = req.user?.userId` 为`undefined`
- 查询逻辑降级到未登录模式：只返回`isPublished = true`的insights

### 后端：查询逻辑

**文件**: `backend/src/controllers/insight.controller.js` (第257-312行)

关键代码:
```javascript
async function getInsightsForPeriod(req, res, next) {
  const userId = req.user?.userId;  // 如果没有authMiddleware，这是undefined

  let orConditions = [];
  if (userId) {
    // 已登录：返回用户创建的或分配给用户的insights
    orConditions = [
      { userId, ...baseQuery },
      { targetUserId: userId, ...baseQuery }
    ];
  } else {
    // 未登录：只返回已发布的insights
    baseQuery.isPublished = true;
    orConditions = [{ ...baseQuery }];
  }
  // ...
}
```

**问题**：当userId为undefined时，只能查询到`isPublished=true`的insights

### 小程序：API调用

**文件**: `miniprogram/pages/profile/profile.js` (第309行)

代码:
```javascript
const res = await insightService.getInsightsForPeriod(periodId, { limit: 10 });
```

**链路**：
1. `insightService.getInsightsForPeriod()` → `request.get('/insights/period/{periodId}')`
2. `request.get()` 会自动添加token
3. 如果token未被正确保存，请求会返回401

### 小程序：Token存储

**文件**: `miniprogram/utils/request.js` (第42行)

代码:
```javascript
const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);
// ...
if (token) {
  requestHeader['Authorization'] = `Bearer ${token}`;
}
```

**可能的问题**：
- 登录后token未被正确保存
- Token已过期
- Token保存key与读取key不一致

## 解决方案

### 步骤1：应用认证中间件（必须）

修改 `backend/src/routes/insight.routes.js` 第66行：

```javascript
// 从这样：
router.get('/period/:periodId', getInsightsForPeriod);

// 改成这样：
router.get('/period/:periodId', authMiddleware, getInsightsForPeriod);
```

然后重启后端。

### 步骤2：验证token正确保存（检查）

在小程序中添加调试代码，检查`app.js`的`checkLoginStatus()`：

```javascript
checkLoginStatus() {
  const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);
  const userInfo = wx.getStorageSync(constants.STORAGE_KEYS.USER_INFO);

  console.log('=== 登录状态检查 ===');
  console.log('Token存在?:', !!token);
  console.log('Token值:', token);  // 调试用
  console.log('UserInfo存在?:', !!userInfo);
  console.log('UserInfo._id:', userInfo?._id);

  if (token && userInfo) {
    this.globalData.isLogin = true;
    this.globalData.userInfo = userInfo;
    this.globalData.token = token;
    console.log('✅ 登录状态恢复成功');
  } else {
    this.globalData.isLogin = false;
    console.log('❌ 登录状态未找到 - 需要重新登录');
  }
}
```

## 手动测试步骤

### 测试1：验证后端修复

后端应用了 `authMiddleware` 后，创建一个测试脚本来验证API：

```bash
# 需要手动从小程序获取valid token
curl -H "Authorization: Bearer {your_token_here}" \
  http://localhost:3000/api/v1/insights/period/{periodId}
```

### 测试2：在小程序中验证

1. 清除缓存：开发者工具 → 工具 → 清除缓存
2. 重新登录小程序
3. 进入首页，观察console输出：
   - 检查token是否被保存
   - 检查API响应是否包含insights数据
4. 查看首页是否现在显示insights

### 测试3：对比"查看更多历史"

"查看更多历史"能工作的原因可能是：
- 使用了不同的API端点（如`/insights/user`而非`/insights/period/{periodId}`）
- 该端点可能已有正确的认证配置

## 常见症状和对应原因

| 症状 | 原因 | 解决方案 |
|------|------|--------|
| 首页无insights，"查看更多"有数据 | 路由缺authMiddleware | 应用authMiddleware |
| 首页显示"登录已过期" | Token过期或未保存 | 重新登录 |
| 首页insights列表空，console无错误 | API返回空数组 | 检查数据是否真的存在;检查userId是否正确 |
| console显示401未授权 | Token未被添加到请求 | 检查token是否在localStorage中;检查storage key |
| API返回数据但首页不显示 | 前端数据处理问题 | 检查profile.js的loadRecentInsights();检查数据格式 |

## 完整的修复检查清单

- [ ] **后端**: 在 `insight.routes.js` 第66行添加 `authMiddleware`
- [ ] **后端**: 重启Node.js服务
- [ ] **小程序**: 清除缓存（开发工具 → 工具 → 清除缓存）
- [ ] **小程序**: 重新登录
- [ ] **小程序**: 进入首页，观察console输出
- [ ] **小程序**: 刷新首页，检查是否显示insights
- [ ] **验证**: "查看更多历史"是否仍然正常工作
- [ ] **日志**: 检查后端logs是否有错误
- [ ] **对比**: 对比两个API端点（`/period` vs `/user`）的响应

## 相关代码位置

**问题代码位置**:
- 路由配置: `backend/src/routes/insight.routes.js:66`
- 控制器逻辑: `backend/src/controllers/insight.controller.js:257-312`
- 小程序调用: `miniprogram/pages/profile/profile.js:309-316`
- Token存储: `miniprogram/utils/request.js:42-53`

**修复后应用重启顺序**:
1. 修改 `insight.routes.js`
2. 重启后端 (`npm run dev` in backend/)
3. 清除小程序缓存
4. 刷新小程序

## 调试技巧

### 后端日志

在 `insight.controller.js` 的 `getInsightsForPeriod` 开头添加：

```javascript
async function getInsightsForPeriod(req, res, next) {
  const userId = req.user?.userId;
  const { periodId } = req.params;

  console.log('=== getInsightsForPeriod 调用 ===');
  console.log('userId:', userId);
  console.log('periodId:', periodId);
  console.log('req.user:', req.user);  // 调试用
  console.log('req.headers:', req.headers);  // 调试用

  // ... rest of function
}
```

### 小程序API日志

修改 `miniprogram/pages/profile/profile.js` 的 `loadRecentInsights`：

```javascript
loadRecentInsights() {
  const periodId = this.data.currentPeriod?._id;
  const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);

  console.log('=== loadRecentInsights ===');
  console.log('periodId:', periodId);
  console.log('token存在:', !!token);
  console.log('token长度:', token?.length);

  insightService.getInsightsForPeriod(periodId, { limit: 10 })
    .then(res => {
      console.log('API响应:', res);
      console.log('insights数量:', res?.list?.length);
      // ... process response
    })
    .catch(err => {
      console.error('API错误:', err);
      console.error('错误码:', err?.statusCode);
      console.error('错误信息:', err?.message);
    });
}
```

## 预期结果

修复后，应该看到：

1. **后端日志**：
   ```
   === getInsightsForPeriod 调用 ===
   userId: 507f1f77bcf86cd799439011
   periodId: 507f191e810c19729de860ea
   req.user: { userId: ..., role: ... }
   ```

2. **小程序console**：
   ```
   === loadRecentInsights ===
   periodId: 507f191e810c19729de860ea
   token存在: true
   token长度: 100+
   API响应: { list: [{...}, {...}], pagination: {...} }
   insights数量: 3
   ```

3. **小程序页面**：
   首页显示3条最近的insights，不再显示"本期暂无小凡看见记录"

## 相关问题记录

- **问题编号**: 31
- **标题**: 路由认证中间件缺失导致$or查询失效问题
- **首次发现**: 2025-11-30
- **修复commit**: 需要提交
- **文档位置**: CLAUDE.md 中的问题31

---

**最后更新**: 2025-11-30
**作者**: Claude Code
