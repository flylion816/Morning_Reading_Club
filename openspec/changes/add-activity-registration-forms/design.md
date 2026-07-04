# Design: Configurable Activity Registration Forms

## Context

现有活动已经支持：
- 管理后台创建活动、设置价格、可见范围和报名人数上限。
- 小程序活动详情页免费/付费报名，付费活动已有 pending 支付状态和支付确认弹窗。
- 手机端管理后台查看报名名单、付款状态、报名人数统计。

这次扩展不改现有期次报名系统，只扩展社区活动 `CommunityActivity` 和 `ActivityRegistration`。

## Goals / Non-Goals

Goals:
- 后台能为每个活动配置报名字段。
- 用户报名时必须按配置填写字段。
- 免费活动提交表单后直接完成报名；付费活动提交表单后进入现有支付流程。
- 管理员能在 PC 后台和手机端管理后台查看每个人的报名信息。
- 管理员能按字段维度统计人员，例如“城市=上海 8人”“是否带朋友=是 3人”。
- 用户能在“我的活动”和活动详情页查看自己提交过的报名信息。

Non-Goals:
- 不做跨活动复用的表单模板库。
- 不做复杂条件逻辑表单，例如选 A 后才展示 B。
- 不做文件上传字段。
- 不改期次报名表单和期次支付流程。

## Data Model

### CommunityActivity.registrationForm

新增字段：

```js
registrationForm: {
  enabled: { type: Boolean, default: false },
  fields: [{
    fieldId: { type: String, required: true },
    label: { type: String, required: true, maxlength: 40 },
    type: {
      type: String,
      enum: ['text', 'textarea', 'number', 'phone', 'single_select', 'multi_select', 'date', 'boolean'],
      required: true
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '', maxlength: 80 },
    options: [{
      optionId: { type: String, required: true },
      label: { type: String, required: true, maxlength: 40 }
    }],
    includeInStats: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 }
  }]
}
```

Notes:
- `fieldId` and `optionId` use generated stable ids, for example `f_...` and `o_...`; do not derive them from labels.
- Only select/boolean fields are enabled for first-phase field statistics by default. Text-like fields can be displayed and exported later but should not create high-cardinality summary blocks unless explicitly supported.

### ActivityRegistration.formSnapshot / formAnswers

新增字段：

```js
formSnapshot: {
  enabled: Boolean,
  fields: [/* activity.registrationForm.fields at submission time */]
},
formAnswers: [{
  fieldId: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true },
  value: mongoose.Schema.Types.Mixed,
  valueText: { type: String, default: '' }
}]
```

Notes:
- `formSnapshot` captures the activity form when the user submits registration.
- `formAnswers` is normalized for display and stats; `value` keeps structured values, `valueText` is a display string.
- If an activity form changes later, historical registration detail still renders from the snapshot and submitted answers.

## Backend API

### Activity detail

`GET /api/v1/community-activities/:id` SHALL include:

```js
registrationForm: {
  enabled,
  fields: [public field config]
},
userRegistration: {
  paymentStatus,
  paymentId,
  registrationId,
  formAnswers,
  formSubmitted: Boolean
}
```

Only expose public form metadata needed by the mini program. Do not expose internal Mongo fields beyond ids and labels.

### Register activity

`POST /api/v1/community-activities/:id/register` accepts:

```js
{
  reminderGranted,
  reminderGrant,
  formAnswers: {
    [fieldId]: value
  }
}
```

Validation:
- If `registrationForm.enabled` is true, validate all configured required fields.
- `phone` accepts mobile number text and stores masked/display value consistently.
- `single_select` value must match an option id.
- `multi_select` values must be an array of option ids from configured options.
- `number` must be numeric.
- Unknown field ids are ignored or rejected consistently; preferred behavior is reject with a clear 400 to catch stale clients.
- If a user has a pending paid registration and submits again, update form answers and create a new payment as the current paid flow already does.
- If a user already has `free` or `paid` registered status, return the existing “您已报名该活动” behavior unless editing registration details is explicitly added later.

Payment order:
1. Validate form answers.
2. Create or update `ActivityRegistration` with `formSnapshot` and `formAnswers`.
3. If activity is free, mark registration complete.
4. If activity is paid, keep `paymentStatus='pending'` and return existing payment payload.
5. Payment confirmation continues to mark `paymentStatus='paid'`.

### Registration list and stats

PC admin `GET /api/v1/admin/community-activities/:id/registrations` and mobile admin `GET /api/v1/mobile-admin/workbench/activities/:activityId/registrations` SHALL include each registration's `formAnswers`.

Add a stats endpoint or embed stats in existing list response:

```js
formStats: [{
  fieldId,
  label,
  type,
  totalAnswered,
  options: [{
    optionId,
    label,
    count,
    registrationIds
  }]
}]
```

For mobile admin first phase, embedding stats in the existing registration list response is acceptable because the list already loads the activity summary.

### My activity registration detail

Add one of:
- `GET /api/v1/community-activities/my/:registrationId`
- or include `formAnswers`, `paymentStatus`, `paidAmount`, and `registrationId` in `GET /api/v1/community-activities/my`.

Preferred implementation: add `GET /api/v1/community-activities/my/:registrationId` for a detail view, and keep list payload compact.

## UI Design

### PC Admin: activity editor

Add an unframed section inside the existing create/edit dialog after “是否付费/活动价格” and before “可见范围”.

Section title: `报名表单`

Controls:
- Switch: `收集报名信息`
- Toolbar buttons when enabled:
  - `添加字段`
  - `预览表单`
- Field list as compact rows:
  - Drag handle / sort index
  - Field label
  - Field type tag
  - Required switch
  - Stats switch for selectable fields
  - Edit and delete icon buttons

Field edit dialog:
- 字段名称
- 字段类型: 单行文本、多行文本、数字、手机号、单选、多选、日期、是/否
- 是否必填
- 提示文案
- 选项编辑器 for 单选/多选:
  - Add option
  - Delete option
  - Reorder option
- 纳入统计 for 单选/多选/是或否

Admin list improvements:
- Activity table gets a small `表单` tag when `registrationForm.enabled`.
- Existing “查看报名” dialog becomes wider or an `el-drawer` with tabs:
  - `名单`: table columns include nickname, phone, payment, registeredAt, and compact answer chips.
  - `统计`: field cards with option counts and a “查看人员” action.
  - `详情`: opened by clicking a row, showing all submitted answers.

### Mini Program: activity detail and registration flow

Registration bottom action remains visually consistent with Image #1.

When the user taps `立即报名`:
- If form is disabled, keep existing flow.
- If form is enabled, open a bottom sheet titled `填写报名信息`.
- Show fields in the configured order.
- Use native controls:
  - text/phone/number: input
  - textarea: textarea
  - single_select: radio-like rows or picker
  - multi_select: checkbox rows
  - date: date picker
  - boolean: switch or two-option segmented control
- Footer buttons:
  - Free activity: `提交报名`
  - Paid activity: `提交并支付 ¥xx.xx`

After successful submission:
- Free: show success toast and refresh detail.
- Paid: show existing payment confirmation modal using returned payment info.

If the user is already registered, add a `我的报名信息` card below the activity info or above description:
- Status line: 已报名 / 待支付 / 已支付
- Answer list: label + value
- For pending paid registrations, keep `继续支付`.

### Mobile Admin: registration list

On the Image #3 page:
- Keep the summary card at the top.
- Add a two-tab segmented control below summary:
  - `名单`
  - `统计`
- `名单` tab:
  - Keep existing person cards.
  - Add answer chips below existing payment chips, for example `城市 上海` `同行 2人`.
  - Tapping a card opens a bottom sheet with full报名信息 and payment/order details.
- `统计` tab:
  - Show one block per `includeInStats` field.
  - Each option row shows option label, count, and a “看名单” button.
  - Tapping an option filters the list tab to matching registrations.

### My Activities

On the Image #4 page:
- Each card keeps current layout.
- Add a small status row for `报名信息已提交` / `待支付`.
- Add a secondary text button `查看报名信息` when a registration has form answers.
- Tapping it opens a bottom sheet:
  - Activity title and registration time.
  - Payment/free status.
  - Submitted answer list.

## Risks / Trade-offs

- Editing form fields after users have registered can make current config differ from historical answers. The snapshot approach avoids data loss and ambiguous rendering.
- Free-text statistics can become noisy. First phase limits field statistics to single select, multi select, and boolean fields.
- Paid pending registrations already reuse records. Updating form answers before a new payment is acceptable, but the UI must make clear that payment is still required.

## Migration Plan

- Existing activities default `registrationForm.enabled=false`.
- Existing registrations have empty `formSnapshot` and `formAnswers`.
- No database reset, initialization, or destructive migration is required.
- Backfill is not required; old registrations display “未填写报名表单”.

## Open Questions

- 是否允许用户报名成功后修改报名表单？建议第一阶段不支持，避免和付费订单/线下名单确认产生冲突。
- PC 后台是否需要导出报名信息 CSV/Excel？本次先预留数据结构，若需要可作为后续小功能加入。
