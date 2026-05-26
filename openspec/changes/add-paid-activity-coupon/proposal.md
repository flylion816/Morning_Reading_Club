# Change: Add Paid Activity Registration with Coupon System

## Why

活动目前只支持免费报名。需要支持付费活动报名，并配套优惠券系统，让运营可以在管理后台给指定用户发放优惠券，用户报名付费活动时自动抵扣。

## What Changes

### 新增能力
- 活动支持设置价格（isPaid + price 字段）
- 新增 ActivityCoupon 模型：管理员可创建优惠券并发放给指定用户，支持固定减免和折扣两种类型，有有效期限制
- 付费活动报名流程：报名时自动查询可用优惠券，计算实付金额，在详情页内弹窗完成微信支付
- 支付成功后自动标记优惠券已使用

### 模型改动
- `CommunityActivity`：新增 `isPaid`、`price` 字段
- `ActivityRegistration`：新增 `paymentStatus`、`paymentId`、`couponId`、`paidAmount` 字段
- `Payment`：`enrollmentId` 改为可选（非 required），新增 `registrationId` 字段（活动支付时使用）
- 新增 `ActivityCoupon` 模型

### 不改动
- 现有期次报名支付流程（Payment.enrollmentId 路径）完全不变
- 现有 Payment 文档无需数据迁移

## Impact

- Affected code:
  - `backend/src/models/Payment.js`
  - `backend/src/models/ActivityRegistration.js`
  - `backend/src/models/CommunityActivity.js`
  - `backend/src/models/ActivityCoupon.js`（新建）
  - `backend/src/controllers/payment.controller.js`
  - `backend/src/controllers/communityActivity.controller.js`
  - `backend/src/routes/activityCoupon.routes.js`（新建）
  - `backend/src/controllers/activityCoupon.controller.js`（新建）
  - `backend/src/services/mongo-mysql-sync-filter.service.js`
  - `backend/src/services/mysql-backup.service.js`
  - `backend/database/mysql-schema.sql`
  - `miniprogram/pages/community-activity-detail/*`
  - `miniprogram/services/communityActivity.service.js`
  - `admin/src/views/ActivitiesManagementView.vue`
  - `admin/src/views/CouponsManagementView.vue`（新建）
  - `admin/src/types/api.ts`
  - `admin/src/router/index.ts`
