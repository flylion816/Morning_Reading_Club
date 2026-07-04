# Change: Add configurable activity registration forms

## Why

活动报名现在只能记录“谁报名了”，无法让运营按活动收集自定义信息，例如姓名、手机号、同行人数、城市、餐食偏好或问题选项。线下聚会、付费活动和社群活动需要在报名时收集结构化信息，并在手机端管理后台快速查看和按字段统计人员。

## What Changes

- 管理后台活动编辑页新增“报名表单”配置区，支持启用/关闭自定义表单，添加、排序、编辑、删除字段，并设置字段类型、必填、选项、提示语和是否纳入统计。
- 小程序活动详情页报名时按后台配置展示表单；表单校验通过后再提交报名；付费活动在报名表单提交成功后进入现有支付确认流程，免费活动直接完成报名。
- `ActivityRegistration` 保存每次报名的表单快照和答案，保证活动表单后续修改不会破坏历史报名信息。
- 后台报名名单和手机端报名名单展示每个人的报名答案，支持按字段筛选/分组统计人员。
- “我的活动”支持查看自己的报名详情，包括报名状态、支付状态和已提交的表单内容。

## Impact

- Affected specs: `community-activity-registration-forms`
- Affected code:
  - `backend/src/models/CommunityActivity.js`
  - `backend/src/models/ActivityRegistration.js`
  - `backend/src/controllers/communityActivity.controller.js`
  - `backend/src/controllers/mobileAdminWorkbench.controller.js`
  - `backend/src/routes/communityActivity.routes.js`
  - `backend/src/routes/mobileAdminWorkbench.routes.js`
  - `admin/src/views/ActivitiesManagementView.vue`
  - `admin/src/types/api.ts`
  - `miniprogram/pages/community-activity-detail/*`
  - `miniprogram/pages/admin-activity-registrations/*`
  - `miniprogram/pages/my-community-activities/*`
  - `miniprogram/services/communityActivity.service.js`
  - `miniprogram/services/adminWorkbench.service.js`
  - Focused backend, admin, and mini program tests
