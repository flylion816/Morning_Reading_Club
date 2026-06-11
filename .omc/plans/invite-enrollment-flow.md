# 晨读营小程序邀请报名流程设计方案

**状态**: pending approval  
**日期**: 2026-05-21  
**涉及模块**: miniprogram/pages/invite、enrollment、payment；backend enrollment/payment 路由

---

## 一、需求背景

当前招募路径：海报 → jsj.top 外部表单 → 线下收款  
目标路径：小程序分享卡片 → 小程序落地页 → 小程序报名表 → 微信支付 → 自动入营

---

## 二、整体流程

```
老学员/运营 → 点击"邀请好友"
    ↓
生成带 inviterId + periodId 的分享卡片
    ↓
好友点击卡片 → 进入 /pages/invite/invite
    ↓
落地页：展示期次主题 + 邀请人 + 报名入口
    ↓
点击"立即报名" → /pages/enrollment/enrollment?periodId=xxx&referrer=xxx
    ↓
填写报名表（整合后）→ 提交
    ↓
期次有价格 → /pages/payment/payment → 微信支付
期次免费   → 直接入营
    ↓
支付成功 → 报名确认页 → 进入营地
```

---

## 三、分享卡片设计

### 3.1 卡片内容（onShareAppMessage 返回值）

| 字段 | 内容 | 说明 |
|------|------|------|
| title | `第X期·[主题名]｜21天七个习惯晨读营` | 最多32字，突出期次和主题 |
| imageUrl | 期次封面图（竖版 5:4） | 复用海报风格，从 Period.coverImage 取 |
| path | `/pages/invite/invite?periodId=xxx&inviterId=xxx` | 携带邀请人ID用于溯源 |

**示例**：  
- title: `第15期·丰盛之流｜21天七个习惯晨读营`  
- 封面：绿色大理石纹背景 + 书封 + 主题文字（与海报同款）

### 3.2 触发入口

- **期次详情页**：已报名学员看到"邀请好友"按钮（`<button open-type="share">`）
- **营地首页**：顶部"邀请好友加入本期"横幅
- **个人中心**：历史期次卡片上的分享按钮

### 3.3 Period 模型补充字段

```js
// 新增到 Period 模型
coverImage: { type: String }  // 期次封面图 URL（用于分享卡片）
inviteTitle: { type: String } // 自定义分享标题，不填则自动生成
```

---

## 四、落地页设计（/pages/invite/invite）

### 4.1 页面结构

```
┌─────────────────────────────┐
│  凡人学堂 · 第15期           │  品牌 + 期次
│                             │
│  [封面图/主题背景]            │  海报风格，占屏幕60%
│  丰盛之流                   │
│  21天七个习惯晨读营           │
│                             │
│  清晨6:00-7:00              │  核心信息
│  与6位同行者，在线共读        │
│  2026.06.01 - 06.21         │
│                             │
│  ┌─────────────────────┐   │
│  │ 👤 [邀请人头像+昵称]  │   │  邀请人信息
│  │ 邀请你加入本期晨读营  │   │
│  └─────────────────────┘   │
│                             │
│  ¥ 199  ~~¥299~~           │  价格
│                             │
│  [立即报名]  [了解更多]      │  CTA 按钮
└─────────────────────────────┘
```

### 4.2 页面逻辑

```js
// onLoad(options)
// options.periodId → 加载期次信息
// options.inviterId → 加载邀请人信息（昵称+头像）
// 存入 storage: inviteSource = { periodId, inviterId }
// 点击"立即报名" → navigateTo enrollment，带 periodId + referrerId
```

### 4.3 状态处理

| 场景 | 处理 |
|------|------|
| 已登录且已报名本期 | 显示"你已报名，进入营地" |
| 已登录未报名 | 正常显示报名入口 |
| 未登录 | 显示报名入口，点击后触发登录 |
| 期次已满/已结束 | 显示"本期已结束，查看下一期" |
| periodId 无效 | 显示错误提示 |

---

## 五、报名表整合方案

### 5.1 现有字段对比

| 字段 | jsj.top 表单 | 小程序现有表单 | 整合后 |
|------|-------------|--------------|--------|
| 姓名 | ✅ | ✅ name | ✅ 保留 |
| 手机号 | ✅ | ❌（在User模型） | ✅ 新增到表单 |
| 性别 | ❌ | ✅ gender | ✅ 保留（可选） |
| 省份 | ❌ | ✅ province | ✅ 保留（可选） |
| 年龄 | ❌ | ✅ age | ✅ 保留（可选） |
| 是否读过书 | ❌ | ✅ hasReadBook | ✅ 保留 |
| 读了几遍 | ❌ | ✅ readTimes | ✅ 保留（条件显示） |
| 报名原因 | ✅ | ✅ enrollReason | ✅ 保留 |
| 期待收获 | ❌ | ✅ expectation | ✅ 保留 |
| 承诺全程 | ❌ | ✅ commitment | ✅ 保留 |
| 推荐人 | ❌ | ✅ referrer | ✅ 自动填入（来自邀请链接） |

### 5.2 手机号获取方案

优先使用微信授权手机号（`<button open-type="getPhoneNumber">`），无需手动输入：

```js
// enrollment.js
onGetPhoneNumber(e) {
  if (e.detail.code) {
    // 调用后端用 code 换取手机号，存入 form.phone
    api.getPhoneByCode(e.detail.code).then(phone => {
      this.setData({ 'form.phone': phone });
    });
  }
}
```

### 5.3 表单分步设计（提升完成率）

**Step 1 - 基本信息**（必填）
- 姓名
- 手机号（微信授权一键获取）
- 承诺全程参加（yes/no）

**Step 2 - 了解你**（选填，可跳过）
- 是否读过《七个习惯》
- 报名原因（文本）
- 期待收获（文本）

**Step 3 - 确认报名**
- 期次信息确认
- 价格确认
- 提交 → 支付

### 5.4 Enrollment 模型新增字段

```js
// 新增
phone: { type: String, trim: true }  // 报名时留存的手机号
inviterId: {                          // 邀请人ID（用于裂变统计）
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
}
```

---

## 六、支付流程（复用现有能力）

现有 `payment.controller.js` 已支持微信支付，流程如下：

```
提交报名表
    ↓
POST /api/enrollment/submit
    ↓ (返回 enrollmentId)
POST /api/payment/initiate { enrollmentId }
    ↓ (返回 prepayId)
wx.requestPayment({ ... prepayId ... })
    ↓
微信回调 POST /api/payment/wechat-callback
    ↓
更新 Enrollment.paymentStatus = 'paid'
    ↓
跳转报名成功页
```

**关键**：期次 `price = 0` 时跳过支付，直接将 paymentStatus 设为 `free`。

---

## 七、邀请溯源统计

在 Enrollment 模型中记录 `inviterId`，后台可统计：
- 每个学员带来了多少新学员
- 邀请转化率（点击卡片 → 完成报名）

后续可扩展：邀请奖励机制（如邀请3人减免下期费用）。

---

## 八、实施步骤

### Phase 1：落地页（1-2天）
1. 新建 `miniprogram/pages/invite/` 页面
2. Period 模型加 `coverImage`、`inviteTitle` 字段
3. 后端新增 `GET /api/periods/:id/invite-info` 接口（返回期次+邀请人信息）
4. 落地页 UI 实现

### Phase 2：报名表整合（1天）
1. Enrollment 模型加 `phone`、`inviterId` 字段
2. 报名页支持 `referrerId` 参数自动填入
3. 加入微信授权手机号按钮
4. 表单分步 UI（可选，先做单页版）

### Phase 3：分享卡片（0.5天）
1. 期次详情页加"邀请好友"按钮
2. `onShareAppMessage` 返回带 `inviterId` 的路径
3. 管理后台支持上传期次封面图

### Phase 4：支付打通（已有基础，0.5天）
1. 确认现有支付流程在新报名路径下正常工作
2. 测试免费期次直接入营逻辑

---

## 九、验收标准

- [ ] 老学员在期次详情页点击分享，生成带自己ID的卡片
- [ ] 好友点击卡片进入落地页，看到期次信息和邀请人头像
- [ ] 点击报名，referrer 字段自动填入邀请人昵称
- [ ] 手机号通过微信授权一键获取，无需手动输入
- [ ] 付费期次：提交表单后跳转支付，支付成功后 paymentStatus = 'paid'
- [ ] 免费期次：提交表单后直接入营，paymentStatus = 'free'
- [ ] 期次已满时落地页显示"本期已满"，不显示报名按钮
- [ ] Enrollment 记录中 inviterId 正确保存

---

## 十、风险与注意事项

| 风险 | 缓解措施 |
|------|---------|
| 微信授权手机号需要用户主动点击按钮 | 提供手动输入备选方案 |
| 期次封面图需要运营上传 | 先用 coverColor + coverEmoji 生成纯色封面作为默认值 |
| 支付回调需要公网可访问的服务器 | 已有生产环境，测试时用微信沙箱 |
| 重复报名检测 | 现有 userId+periodId 唯一索引已处理 |
