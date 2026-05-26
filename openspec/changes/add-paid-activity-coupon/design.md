# Design: Add Paid Activity Registration with Coupon System

## 核心决策

### Payment 模型改动策略
选择"enrollmentId 改可选 + 新增 registrationId"方案，而非 sourceId+sourceType 重构。
- 现有 Payment 文档零迁移
- 现有期次支付代码路径完全不变
- 新增活动支付走独立分支，互不干扰

### 支付入口
活动支付不跳转 `/pages/payment/payment` 页面（该页面强依赖 enrollmentId），
改为在活动详情页内弹窗完成支付，避免页面间参数耦合。

---

## 数据模型

### CommunityActivity 新增字段
```js
isPaid: { type: Boolean, default: false }
price:  { type: Number, default: 0, min: 0 }  // 单位：分
```

### ActivityRegistration 新增字段
```js
paymentStatus: {
  type: String,
  enum: ['free', 'pending', 'paid'],
  default: 'free'
},
paymentId:  { type: ObjectId, ref: 'Payment', default: null },
couponId:   { type: ObjectId, ref: 'ActivityCoupon', default: null },
paidAmount: { type: Number, default: 0 }  // 实际支付金额（分）
```

### Payment 模型改动（最小）
```js
// enrollmentId: required: true  →  required: false（唯一改动）
enrollmentId: {
  type: ObjectId,
  ref: 'Enrollment',
  required: false,
  default: null,
  index: true
},
// 新增：
registrationId: {
  type: ObjectId,
  ref: 'ActivityRegistration',
  default: null,
  index: true
}
```

`createOrder` 静态方法签名扩展：
```js
PaymentSchema.statics.createOrder = async function(
  sourceId,     // enrollmentId 或 registrationId 的值
  sourceType,   // 'enrollment' | 'activity_registration'
  userId,
  periodId,     // 活动支付时传 null
  amount,
  paymentMethod = 'wechat'
) {
  const doc = { userId, amount, paymentMethod, orderNo, status: 'pending', tenantId };
  if (sourceType === 'enrollment') {
    doc.enrollmentId = sourceId;
    doc.periodId = periodId;
  } else {
    doc.registrationId = sourceId;
  }
  return this.create(doc);
};
```

### ActivityCoupon 模型（新建）
```js
// backend/src/models/ActivityCoupon.js
{
  tenantId:    { type: ObjectId, ref: 'Tenant', required: true, index: true },
  activityId:  { type: ObjectId, ref: 'CommunityActivity', default: null },
    // null = 适用全部付费活动
  name:        { type: String, required: true },
  discountType:  { type: String, enum: ['fixed', 'percent'], required: true },
  discountValue: { type: Number, required: true },
    // fixed:   减免分数（如 1000 = 减10元）
    // percent: 折扣百分比（如 80 = 8折，计算：price * 80 / 100）
  validFrom:   { type: Date, required: true },
  validUntil:  { type: Date, required: true },
  userId:      { type: ObjectId, ref: 'User', required: true, index: true },
  status:      { type: String, enum: ['active', 'used', 'expired'], default: 'active' },
  usedAt:      { type: Date, default: null },
  usedByRegistrationId: { type: ObjectId, ref: 'ActivityRegistration', default: null }
}
// 索引
{ tenantId: 1, userId: 1, status: 1 }
{ tenantId: 1, activityId: 1, status: 1 }
```

---

## 后端接口

### 活动报名接口改造
`POST /api/v1/community-activities/:id/register`

免费活动：逻辑不变，paymentStatus = 'free'。

付费活动流程：
```
1. 查活动，确认 isPaid=true，price>0
2. 查用户可用优惠券：
   ActivityCoupon.findOne({
     tenantId, userId, status: 'active',
     validFrom: { $lte: now }, validUntil: { $gte: now },
     $or: [{ activityId: id }, { activityId: null }]
   })
3. 计算 finalPrice：
   - fixed:   max(price - discountValue, 0)
   - percent: Math.round(price * discountValue / 100)
   - 无券:    price
4. 创建/复用 ActivityRegistration（paymentStatus='pending', couponId）
5. 创建 Payment（registrationId=reg._id, enrollmentId=null）
6. 调用微信统一下单，获取支付参数
7. 返回：
   {
     registrationId, paymentId, orderNo,
     originalPrice, coupon: { id, name, discountType, discountValue } | null,
     finalPrice,
     timeStamp, nonceStr, package, signType, paySign  // 微信支付参数
   }
```

`getActivity` 接口查 isRegistered 时加条件：
```js
const reg = await ActivityRegistration.findOne({
  activityId: id, userId, status: 'registered',
  $or: [{ paymentStatus: 'free' }, { paymentStatus: 'paid' }]
});
```

### payment.controller.js 改动

**initiatePayment**：新增 registrationId 入参分支（enrollmentId 路径不变）：
```js
const { enrollmentId, registrationId, paymentMethod = 'wechat', amount = 9900 } = req.body;
if (registrationId) {
  // 活动支付路径：查 ActivityRegistration → 查活动价格 → 复用/创建 Payment
} else {
  // 原有期次报名支付路径，代码不变
}
```

**confirmPayment**（用户端手动确认）：
```js
if (payment.registrationId) {
  await ActivityRegistration.findByIdAndUpdate(payment.registrationId, {
    paymentStatus: 'paid', paidAmount: payment.amount, paymentId: payment._id
  });
  // 标记优惠券已使用
  const reg = await ActivityRegistration.findById(payment.registrationId);
  if (reg?.couponId) {
    await ActivityCoupon.findByIdAndUpdate(reg.couponId, {
      status: 'used', usedAt: new Date(), usedByRegistrationId: payment.registrationId
    });
  }
} else {
  // 原有逻辑：更新 Enrollment（不变）
}
```

**wechatCallback**：在 result_code=SUCCESS 分支里，按 payment.registrationId 是否存在分支处理（同 confirmPayment 逻辑）。

**adminResetPaymentToPending**：按 registrationId 分支处理（重置 ActivityRegistration.paymentStatus='pending'，撤销优惠券使用）。

### 优惠券管理接口（新建）
```
# 管理端（挂载到 /api/v1/admin/activity-coupons）
GET    /          列表（支持按 activityId/userId/status 筛选，分页）
POST   /          创建并发放（body.userIds 数组支持批量，每个用户创建一条记录）
PUT    /:id       编辑（仅 active 状态可编辑）
DELETE /:id       删除（仅 active 状态可删除）

# 用户端（挂载到 /api/v1/activity-coupons）
GET    /my?activityId=xxx   查询我的可用优惠券（有效期内、未使用、匹配活动）
```

### sync-filter 改动
`payments` case 中，enrollmentId 校验改为仅当 enrollmentId 存在时才校验：
```js
case 'payments':
  if (userId && !context.userIds.has(userId)) return `userId missing`;
  if (periodId && !context.periodIds.has(periodId)) return `periodId missing`;
  // 只有 enrollment 类型才校验（registrationId 类型跳过）
  if (enrollmentId && !context.enrollmentIds.has(enrollmentId)) return `enrollmentId missing`;
  return null;
```

### mysql-backup 改动
syncPayment 新增 registration_id 字段同步。

mysql-schema.sql payments 表：
```sql
enrollment_id CHAR(24) NULL,      -- NOT NULL → NULL
registration_id CHAR(24) NULL,    -- 新增
```

---

## 小程序端

### 活动详情页改造（community-activity-detail）

底部按钮状态：
| 状态 | 按钮文案 |
|---|---|
| 免费未报名 | 立即报名 |
| 付费未报名 | 立即报名（¥XX） |
| 付费待支付（pending） | 继续支付 |
| 已报名（free/paid） | 取消报名 |
| 活动已结束/取消 | 活动已结束/已取消 |

报名流程（付费活动）：
```
handleRegister():
  1. 调用 communityActivityService.register(activityId, { reminderGranted })
  2. 后端返回 { registrationId, paymentId, originalPrice, coupon, finalPrice, ...wxParams }
  3. setData({ showPayModal: true, payInfo: { ... } })  // 展示支付确认弹窗
  4. 用户点击"立即支付" → wx.requestPayment(wxParams)
  5. 支付成功 → confirmPaymentWithBackend(paymentId) → loadDetail()
  6. 支付取消/失败 → 提示，保留 pending 状态，下次进入显示"继续支付"
```

支付确认弹窗（内联在详情页）：
```
┌─────────────────────────┐
│  确认报名               │
│  [活动名称]             │
│  原价    ¥XX.00         │
│  优惠券  -¥XX.00 [券名] │  ← 无券时不显示此行
│  实付    ¥XX.00         │
│  [取消]    [立即支付]   │
└─────────────────────────┘
```

### communityActivity.service.js
register 方法透传后端完整响应（现在只返回 registration，需要透传 paymentId、价格、微信支付参数）。

---

## 管理后台

### ActivitiesManagementView.vue 新增字段
表单在"人数上限"之前新增：
- 是否付费（el-switch）
- 活动价格（el-input-number，单位元，v-if="formData.isPaid"）
- 提交时转换：price = Math.round(formData.priceYuan * 100)

列表新增"价格"列：付费活动显示金额，免费显示"免费"。

### CouponsManagementView.vue（新建）
功能：
- 列表：券名、适用活动、折扣、有效期、发放用户、状态
- 创建弹窗：券名、适用活动（下拉/全部）、折扣类型+值、有效期范围、发放用户（多选）
- 批量发放：一次给多个用户各创建一条记录

路由：`/coupons` → 侧边栏"优惠券管理"。

### api.ts 新增类型
```ts
interface Payment {
  // 原有字段不变
  registrationId?: string;  // 新增
}

interface ActivityCoupon {
  _id: string;
  name: string;
  activityId?: string;
  discountType: 'fixed' | 'percent';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  userId: string | User;
  status: 'active' | 'used' | 'expired';
  usedAt?: string;
}
```

---

## 数据库迁移

**MongoDB**：零迁移。现有 Payment 文档保持不变。

**MySQL**（如已有数据）：
```sql
ALTER TABLE payments
  MODIFY COLUMN enrollment_id CHAR(24) NULL COMMENT '报名 ID（期次报名支付）',
  ADD COLUMN registration_id CHAR(24) NULL COMMENT '活动报名 ID（活动支付）' AFTER enrollment_id;
```

---

## 并行开工任务拆分

| Agent | 任务 | 依赖 |
|---|---|---|
| Agent A | 后端模型层 | 无 |
| Agent B | 后端支付流程改造 | 依赖 Agent A 完成模型 |
| Agent C | 小程序端 | 无（接口契约已定） |
| Agent D | 管理后台 | 无 |

Agent A 和 Agent C、D 可以同时开工；Agent B 等 Agent A 完成后开工。
