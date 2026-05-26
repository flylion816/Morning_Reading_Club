# Tasks: Add Paid Activity Registration with Coupon System

实施前必读：`openspec/changes/add-paid-activity-coupon/design.md`

---

## Agent A — 后端模型层

- [x] A1. `CommunityActivity.js`：新增 `isPaid`（Boolean, default false）、`price`（Number, default 0, min 0）字段
- [x] A2. `ActivityRegistration.js`：新增 `paymentStatus`（enum: free/pending/paid, default free）、`paymentId`（ObjectId, default null）、`couponId`（ObjectId, default null）、`paidAmount`（Number, default 0）字段
- [x] A3. `Payment.js`：`enrollmentId` 去掉 `required: true`，改为 `required: false, default: null`；新增 `registrationId`（ObjectId, ref: ActivityRegistration, default null, index: true）；扩展 `createOrder` 静态方法支持 sourceType 参数
- [x] A4. 新建 `backend/src/models/ActivityCoupon.js`：字段见 design.md，含两个复合索引
- [x] A5. `mysql-schema.sql`：payments 表 `enrollment_id` 改为 NULL，新增 `registration_id CHAR(24) NULL` 列
- [x] A6. 新建 `backend/src/routes/activityCoupon.routes.js` 和 `backend/src/controllers/activityCoupon.controller.js`：实现管理端 CRUD（list/create/update/delete）和用户端 getMyCoupons 接口
- [x] A7. 在 `backend/src/app.js`（或主路由文件）注册 activityCoupon 路由

---

## Agent B — 后端支付流程改造（依赖 Agent A 完成后开工）

- [x] B1. `communityActivity.controller.js` — `registerActivity`：付费活动分支（查优惠券、计算价格、创建 Registration+Payment、返回支付参数）；`getActivity`：isRegistered 查询加 paymentStatus 条件
- [x] B2. `payment.controller.js` — `initiatePayment`：新增 registrationId 入参分支（原 enrollmentId 路径不变）
- [x] B3. `payment.controller.js` — `confirmPayment`：按 payment.registrationId 是否存在分支处理（更新 ActivityRegistration + 标记优惠券已使用）
- [x] B4. `payment.controller.js` — `wechatCallback`：同 B3，在支付成功分支里按 registrationId 分支处理
- [x] B5. `payment.controller.js` — `adminResetPaymentToPending`：按 registrationId 分支处理（重置 ActivityRegistration.paymentStatus，撤销优惠券）
- [x] B6. `mongo-mysql-sync-filter.service.js`：payments case 中 enrollmentId 校验改为仅当 enrollmentId 存在时才校验
- [x] B7. `mysql-backup.service.js`：syncPayment 新增 registration_id 字段同步

---

## Agent C — 小程序端

- [x] C1. `communityActivity.service.js`：register 方法透传后端完整响应（含 paymentId、价格、微信支付参数）
- [x] C2. `community-activity-detail.js`：data 新增 showPayModal、payInfo、paying 字段；loadDetail 后处理付费活动的 pending 状态（显示"继续支付"）
- [x] C3. `community-activity-detail.js`：handleRegister 新增付费活动分支（调接口 → 展示弹窗 → wx.requestPayment → confirmPaymentWithBackend → loadDetail）
- [x] C4. `community-activity-detail.js`：新增 handlePayConfirm、handlePayCancel、confirmPaymentWithBackend 方法
- [x] C5. `community-activity-detail.wxml`：新增支付确认弹窗（原价/优惠券/实付三行，取消+立即支付按钮）；底部按钮新增付费状态分支（显示价格、继续支付）
- [x] C6. `community-activity-detail.wxss`：弹窗样式

---

## Agent D — 管理后台

- [x] D1. `ActivitiesManagementView.vue`：formData 新增 isPaid/priceYuan；表单新增"是否付费"开关和"活动价格"输入框（v-if isPaid）；提交时转换为分；列表新增"价格"列
- [x] D2. 新建 `admin/src/views/CouponsManagementView.vue`：列表 + 创建弹窗（券名、适用活动、折扣类型+值、有效期、发放用户多选）；支持批量发放
- [x] D3. `admin/src/types/api.ts`：Payment 新增 registrationId 字段；新增 ActivityCoupon 接口定义
- [x] D4. `admin/src/router/index.ts`：注册 /coupons 路由，侧边栏加"优惠券管理"入口
- [x] D5. 新建 `admin/src/services/activityCoupon.service.ts`：封装优惠券 CRUD API 调用
