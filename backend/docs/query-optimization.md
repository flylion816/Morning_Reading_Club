# 查询优化指南

本文档提供了在项目中优化 MongoDB 查询的最佳实践。

## 🎯 核心原则

### 1. 字段投影 (Field Projection)

总是使用 `.select()` 显式选择需要的字段，避免返回不必要的数据：

```javascript
// ❌ 不好：返回所有字段
const users = await User.find({ active: true });

// ✅ 好：只选择需要的字段
const users = await User.find({ active: true }).select('_id name email avatar');
```

**好处**：

- 减少网络传输数据量
- 加速 JSON 序列化
- 降低内存占用

### 2. 使用 .lean() 用于只读查询

当不需要修改文档时，使用 `.lean()` 返回普通 JavaScript 对象而不是 Mongoose 文档：

```javascript
// ❌ 不好：返回 Mongoose 文档（有更多开销）
const enrollments = await Enrollment.find({ status: 'active' });

// ✅ 好：返回普通对象（更快）
const enrollments = await Enrollment.find({ status: 'active' }).lean();
```

**性能改善**：约 5-10 倍更快

### 3. 分页查询

总是实现分页以限制每次返回的数据量：

```javascript
// ✅ 正确的分页实现
async function getPaginatedEnrollments(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    Enrollment.find()
      .select('userId periodId status paymentStatus createdAt')
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .lean(),
    Enrollment.countDocuments()
  ]);

  return {
    data,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize)
  };
}
```

### 4. 合并查询以减少往返

使用 `Promise.all()` 合并独立查询：

```javascript
// ❌ 不好：三次往返数据库
const enrollments = await Enrollment.find();
const payments = await Payment.find();
const checkins = await Checkin.find();

// ✅ 好：一次往返获取所有数据
const [enrollments, payments, checkins] = await Promise.all([
  Enrollment.find().lean(),
  Payment.find().lean(),
  Checkin.find().lean()
]);
```

### 5. 索引使用

确保查询使用了适当的索引：

```javascript
// 查看查询执行计划
const explainResult = await Enrollment.find({ status: 'pending' }).explain('executionStats');
console.log(explainResult.executionStats.executionStages.stage); // COLLSCAN vs IXSCAN
```

**执行计划含义**：

- `COLLSCAN`：全表扫描（❌ 不好）
- `IXSCAN`：使用索引（✅ 好）
- `FETCH`：获取文档内容

### 6. 查询条件优化

#### 使用 $in 而不是多个 $or

```javascript
// ❌ 不好
await Enrollment.find({
  $or: [{ status: 'pending' }, { status: 'approved' }, { status: 'rejected' }]
});

// ✅ 好
await Enrollment.find({
  status: { $in: ['pending', 'approved', 'rejected'] }
});
```

#### 范围查询

```javascript
// ✅ 正确的日期范围查询
const startDate = new Date('2025-11-01');
const endDate = new Date('2025-11-30');

await Enrollment.find({
  createdAt: {
    $gte: startDate,
    $lt: endDate
  }
}).lean();
```

### 7. 避免大型 lookup

使用 `populate()` 时要选择字段：

```javascript
// ❌ 不好：populate 返回所有字段
await Enrollment.find().populate('userId');

// ✅ 好：只 populate 需要的字段
await Enrollment.find().populate('userId', 'name email avatar').lean();
```

### 8. 排序优化

确保排序字段有索引，且排序字段在查询条件之后：

```javascript
// ✅ 好的查询顺序：匹配 → 排序 → 投影
await Enrollment.find({ status: 'active' })
  .select('_id name createdAt')
  .sort({ createdAt: -1 })
  .limit(20)
  .lean();
```

## 📊 常见查询模式

### 报名列表（带筛选和排序）

```javascript
async function getEnrollments(filters = {}, page = 1, pageSize = 20) {
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }

  if (filters.periodId) {
    query.periodId = filters.periodId;
  }

  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.createdAt.$lt = new Date(filters.endDate);
    }
  }

  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    Enrollment.find(query)
      .select('userId periodId status paymentStatus createdAt')
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .lean(),
    Enrollment.countDocuments(query)
  ]);

  return { data, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}
```

### 支付统计

```javascript
async function getPaymentStats(startDate, endDate) {
  return await Payment.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lt: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
}
```

### 用户排行榜

```javascript
async function getUserRanking(periodId, limit = 10) {
  return await Checkin.aggregate([
    {
      $match: { periodId: ObjectId(periodId) }
    },
    {
      $group: {
        _id: '$userId',
        totalPoints: { $sum: '$points' },
        checkinCount: { $sum: 1 },
        lastCheckinDate: { $max: '$checkinDate' }
      }
    },
    {
      $sort: { totalPoints: -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $unwind: '$userInfo'
    },
    {
      $project: {
        _id: 1,
        totalPoints: 1,
        checkinCount: 1,
        lastCheckinDate: 1,
        userName: '$userInfo.nickname',
        userAvatar: '$userInfo.avatar'
      }
    }
  ]);
}
```

## 🔍 索引策略

### 现有索引

#### Enrollment 集合

```javascript
{ userId: 1, periodId: 1 }              // 唯一索引：防止重复报名
{ approvalStatus: 1, createdAt: -1 }    // 审批查询
{ paymentStatus: 1, createdAt: -1 }     // 支付查询
{ periodId: 1, approvalStatus: 1 }      // 期次的报名状态
{ createdAt: -1 }                        // 时间排序
{ enrolledAt: -1 }                       // 报名时间排序
```

#### Payment 集合

```javascript
{ status: 1, createdAt: -1 }            // 支付状态查询
{ userId: 1, createdAt: -1 }            // 用户支付历史
{ periodId: 1, status: 1 }              // 期次支付状态
{ createdAt: -1 }                        // 时间排序
{ paidAt: -1 }                           // 支付时间排序
{ reconciled: 1, createdAt: -1 }        // 核销状态查询
```

#### Checkin 集合

```javascript
{ userId: 1, periodId: 1, checkinDate: 1 } // 唯一索引：防止重复打卡
{ userId: 1, checkinDate: -1 }             // 用户打卡历史
{ periodId: 1, checkinDate: -1 }           // 期次打卡记录
{ sectionId: 1 }                            // 课节查询
{ isPublic: 1, createdAt: -1 }             // 公开打卡查询
{ isFeatured: 1, likeCount: -1 }           // 精选热门排序
{ periodId: 1, userId: 1 }                 // 用户期次打卡
{ createdAt: -1 }                           // 时间排序
{ mood: 1 }                                 // 心情筛选
```

### 添加新索引

```javascript
// 在 migration 或初始化脚本中添加
// 示例：为常见查询添加新索引
EnrollmentSchema.index({ periodId: 1, paymentStatus: 1, createdAt: -1 });
```

## ⚠️ 常见陷阱

### 1. N+1 查询问题

```javascript
// ❌ 不好：造成 N+1 查询
const enrollments = await Enrollment.find();
for (const enrollment of enrollments) {
  const user = await User.findById(enrollment.userId); // 每次循环都查询一次
}

// ✅ 好：使用 populate
const enrollments = await Enrollment.find().populate('userId').lean();
```

### 2. 过度 populate

```javascript
// ❌ 不好：过度关联
await Enrollment.find().populate('userId').populate('periodId').populate('periodId.sections'); // 深度 populate

// ✅ 好：只 populate 必要的字段
await Enrollment.find().populate('userId', 'name email').populate('periodId', 'title').lean();
```

### 3. 忽视索引

```javascript
// 检查是否使用了索引
const result = await Enrollment.find({ status: 'pending' }).explain('executionStats');
if (result.executionStats.executionStages.stage === 'COLLSCAN') {
  console.warn('⚠️ 警告：全表扫描！需要添加索引');
}
```

## 📈 性能测试

```javascript
// 测试查询性能
async function benchmarkQuery(queryFn, name) {
  const start = performance.now();
  const result = await queryFn();
  const duration = performance.now() - start;

  console.log(`${name}: ${duration.toFixed(2)}ms`);
  return { result, duration };
}

// 使用示例
await benchmarkQuery(() => Enrollment.find({ status: 'pending' }), 'Enrollment 查询');
```

## 🔗 相关链接

- [MongoDB 查询优化](https://docs.mongodb.com/manual/core/query-optimization/)
- [Mongoose 查询文档](https://mongoosejs.com/docs/queries.html)
- [MongoDB 索引最佳实践](https://docs.mongodb.com/manual/core/indexes/)
