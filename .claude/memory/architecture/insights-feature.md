# 架构决策：打卡记录功能架构

---

## 功能概述

**小凡看见 (Insights)** - 用户打卡记录管理系统

### 核心功能

1. **创建打卡记录** - 用户记录自己的打卡
2. **查看被看见列表** - 查看被其他用户分配给自己的打卡
3. **搜索用户** - 在创建打卡时搜索并分配给其他用户
4. **数据统计** - 统计个人打卡数据

---

## 数据模型

### Insight Schema

```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // 创建者ID
  targetUserId: ObjectId,     // 被看见人（被分配的用户）
  periodId: ObjectId,         // 期次ID

  // 打卡内容
  title: String,              // 标题
  content: String,            // 内容
  imageUrl: String,           // 图片URL

  // 时间
  createdAt: Date,
  updatedAt: Date,

  // 状态
  status: String,             // 'active', 'completed', 'archived'

  // 小凡看见相关
  isFavored: Boolean,         // 是否被赞
  comments: [String],         // 评论列表
}
```

---

## API 设计

### 获取用户的打卡和被分配的打卡

**端点**：`GET /api/v1/insights/period/:periodId`

**特点**：使用 `$or` 查询返回两种类型的记录

```javascript
// 后端查询逻辑
const insights = await Insight.find({
  $or: [
    { userId: req.user._id, periodId },      // 用户创建的
    { targetUserId: req.user._id, periodId } // 分配给用户的
  ]
});
```

**关键要点**：
- ⚠️ 必须应用 `authMiddleware` 确保 `req.user` 存在
- ⚠️ 使用 `$or` 查询时，两个条件都要包含 `periodId` 进行过滤
- ✅ 返回的数据已包含用户创建的和被分配的两种记录

**相关问题**：
- 问题31：认证中间件缺失导致查询失效
- 问题30：API响应格式不标准

---

## 前端页面流程

### Insights列表页面

```javascript
// 1. 获取数据
async getInsights() {
  const periodId = this.data.currentPeriod._id;
  const response = await wx.request({
    url: `/insights/period/${periodId}`
    // 注意：authMiddleware确保了req.user的存在
  });

  // 2. 处理响应（响应中已包含 _id 字段）
  const { data } = response.data;  // unwrap
  this.setData({
    insights: data
  });
}

// 3. 渲染数据
// <view wx:for="{{insights}}">
//   <view>{{item.title}}</view>
//   <view>by {{item.userId.nickname}}</view>
// </view>
```

### 关键要点

- ✅ 使用正确的API端点，包含periodId
- ✅ 等待authMiddleware完成认证
- ✅ 正确处理响应unwrapping
- ✅ 使用 `_id` 字段（统一后的标准）

---

## 常见问题及解决

### 问题：查询返回空数据

**原因**：
1. 认证中间件缺失 → `req.user` 为 undefined
2. `$or` 查询条件写法错误
3. periodId不存在或格式错误

**解决**：
```javascript
// ✅ 检查清单
- 路由已应用authMiddleware
- 查询使用了$or且包含两个条件
- periodId格式为有效的ObjectId
- 数据库中实际存在对应的Insight记录
```

### 问题：小程序显示"暂无记录"

**原因**：
1. API调用失败（没有token）
2. 响应格式不对（需要unwrap）
3. 模板绑定错误

**解决**：
```javascript
// 调试步骤
1. 检查Storage中是否有token
2. 在网络请求中添加Authorization header
3. 在响应后添加console.log查看data结构
4. 检查模板中的绑定路径
```

---

## 性能考虑

### 查询优化

```javascript
// ❌ 低效：每次都查整个表
await Insight.find({});

// ✅ 高效：过滤必要条件
await Insight.find({
  periodId: periodId,
  $or: [
    { userId: userId },
    { targetUserId: userId }
  ]
});

// ✅ 带分页
await Insight.find({...})
  .skip((page - 1) * pageSize)
  .limit(pageSize)
  .sort({ createdAt: -1 });
```

### 索引建议

```javascript
// 创建复合索引加快查询
db.insights.createIndex({ periodId: 1, userId: 1 });
db.insights.createIndex({ periodId: 1, targetUserId: 1 });
```

---

## 测试场景

### 场景1：用户创建并分配打卡给他人

```bash
1. 用户A创建insight，targetUserId=B
2. 用户B调用 GET /insights/period/:periodId
3. 结果应该包含这条记录（在targetUserId条件中匹配）
```

### 场景2：查看自己创建的和被分配的记录

```bash
1. 用户A创建了2条打卡
2. 用户B/C各分配1条给用户A
3. 用户A查询应该看到总共3条记录
```

### 场景3：认证失败

```bash
1. 不提供token调用API
2. 应该返回401 Unauthorized
3. 不应该返回空数据列表
```

---

## 最佳实践

✅ **应该这样做**
- 始终在需要用户身份的API应用authMiddleware
- 使用$or查询时明确条件
- 在响应层统一unwrap数据格式
- 添加日志便于调试

❌ **避免这样做**
- 忘记应用认证中间件
- $or查询条件写法混乱
- 响应格式不一致
- 没有错误处理

---

**决策日期**：2025-11-30
**相关问题**：问题30, 问题31
**影响范围**：小凡看见功能、insights API、前端列表页面

---

## 补充：发现的getInsightsForPeriod API bug (2025-11-30)

### 问题

小程序首页和insights页面查询小凡看见（被看见人数据）时返回空列表，但后台管理系统确实有该数据。

### 根本原因

`getInsightsForPeriod` API 有一个硬编码的 `type` 默认值：

```javascript
// ❌ 错误
const { type = 'insight', page = 1, limit = 20 } = req.query;
// ...
if (type) baseQuery.type = type;  // 强制过滤为 type='insight'
```

**问题**：
- 后端 API 默认只查询 `type: 'insight'` 的数据
- 但数据库中的被看见数据 `type: 'daily'`
- 所以查询结果为空

### 修复方案

移除 `type` 的默认值，允许查询所有类型的 insights：

```javascript
// ✅ 正确
const { type, page = 1, limit = 20 } = req.query;  // 无默认值
// ...
if (type) baseQuery.type = type;  // 只在明确传递时过滤
```

**修复文件**：`backend/src/controllers/insight.controller.js` 第260行
**修复时间**：2025-11-30
**相关提交**：`f6eafc0`

### 教训

- ⚠️ **API设计中的隐性假设**：默认参数值可能会限制查询范围，导致数据丢失
- ✅ **参数设计原则**：可选参数不应该有强制过滤的默认值，应该让调用者决定是否过滤
- ✅ **数据验证**：修改数据模型或API时，需要检查是否有现有数据不符合新的假设
