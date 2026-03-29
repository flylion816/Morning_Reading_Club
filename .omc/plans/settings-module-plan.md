# 设置模块实施计划：新增「我的」Tab + 账号管理 + 手机号绑定

## 需求摘要

1. 新增第三个 TabBar「我的」页面，承载个人中心功能
2. 移动通知设置入口从首页到「我的」
3. 支持微信手机号获取绑定（登录时可选 + 我的页面可操作）
4. 支持切换/换绑手机号
5. 账号信息显示 + 退出登录
6. 新建独立编辑资料页面（保留首页现有弹窗作为快速入口）

## 用户确认的设计决策

| 决策项 | 选择 |
|--------|------|
| 设置入口位置 | 新增第三个 Tab「我的」 |
| 通知设置入口 | 从首页移到「我的」页面 |
| 手机号绑定时机 | 登录后可选弹窗 + 我的页面可手动绑定 |
| 资料编辑 | 保留现有弹窗(快速编辑) + 新建独立编辑页面(完整编辑) |

## 验收标准

1. TabBar 显示 3 个 Tab：首页、晨读营、我的
2. 「我的」页面显示：用户头像/昵称/手机号/打卡天数、账号管理、通知设置入口、编辑资料入口、隐私政策/用户协议、退出登录
3. 首页移除通知设置卡片，其他内容不变
4. 登录成功后弹出手机号绑定提示，用户可绑定或跳过
5. 「我的」页面可绑定/换绑手机号
6. 退出登录清除本地存储并跳转到登录页
7. 独立编辑资料页面支持修改头像、昵称、签名
8. 手机号在页面上脱敏显示（如 138****1234）
9. 后端 User 模型新增 phone 字段
10. 后端新增手机号绑定 API（接收微信 code，调用微信接口解密手机号）

## 页面布局设计

### 「我的」页面布局

```
┌─────────────────────────────┐
│                             │
│      🦁                     │
│      阿泰             编辑 >│
│      138****1234            │
│      坚持晨读打卡第23天      │
│                             │
├─────────────────────────────┤
│                             │
│  📱 手机号管理          >   │  绑定/换绑手机号
│  🔔 消息提醒设置        >   │  跳转 notification-settings
│  📝 编辑资料            >   │  跳转 edit-profile 页面
│                             │
├─────────────────────────────┤
│                             │
│  📄 隐私政策            >   │
│  📄 用户协议            >   │
│                             │
├─────────────────────────────┤
│                             │
│        退出登录              │
│                             │
└─────────────────────────────┘
│  首页  │  晨读营  │  我的  │
```

### 登录后手机绑定弹窗

```
┌─────────────────────────────┐
│                             │
│    绑定手机号               │
│    绑定后可通过手机号找回账号  │
│                             │
│  ┌───────────────────────┐  │
│  │  微信授权绑定手机号    │  │  ← button open-type="getPhoneNumber"
│  └───────────────────────┘  │
│                             │
│        暂时跳过              │
│                             │
└─────────────────────────────┘
```

## 实施步骤

### 第 1 步：后端 - User 模型添加 phone 字段

**文件**: `backend/src/models/User.js`

- 添加 `phone` 字段 (String, optional, sparse unique index)
- 添加 `phoneBindAt` 字段 (Date, optional)

```javascript
phone: {
  type: String,
  trim: true,
  sparse: true,
  index: true
},
phoneBindAt: {
  type: Date
}
```

### 第 2 步：后端 - 手机号绑定 API

**文件**: `backend/src/controllers/user.controller.js` (新增方法)
**文件**: `backend/src/routes/user.routes.js` (新增路由)

新增 `POST /api/v1/users/bindPhone` 接口：
1. 接收前端传来的微信 `code`（getPhoneNumber 返回的）
2. 调用微信 `POST https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=ACCESS_TOKEN`，请求体 `{ code }`
3. 获取解密后的手机号 `purePhoneNumber`
4. 更新 User 的 phone 和 phoneBindAt 字段
5. 返回脱敏手机号

新增 `GET /api/v1/users/phone` 接口：
- 返回当前用户的脱敏手机号和绑定状态

### 第 3 步：前端 - 新增「我的」页面

**新增文件**:
- `miniprogram/pages/my/my.js`
- `miniprogram/pages/my/my.wxml`
- `miniprogram/pages/my/my.wxss`
- `miniprogram/pages/my/my.json`

**功能**:
- 顶部用户信息卡：头像、昵称、手机号（脱敏）、打卡天数
- 设置列表：手机号管理、消息提醒设置、编辑资料
- 底部：隐私政策、用户协议、退出登录
- 未登录状态：显示登录提示

**手机号管理**:
- 未绑定：显示「绑定手机号」按钮（open-type="getPhoneNumber"）
- 已绑定：显示脱敏手机号 + 「换绑」按钮（同样 open-type="getPhoneNumber"）

**退出登录**:
- 清除 wx.storage（token, refreshToken, userInfo）
- 重置 app.globalData
- wx.reLaunch 跳转到登录页

### 第 4 步：前端 - 新增独立编辑资料页面

**新增文件**:
- `miniprogram/pages/edit-profile/edit-profile.js`
- `miniprogram/pages/edit-profile/edit-profile.wxml`
- `miniprogram/pages/edit-profile/edit-profile.wxss`
- `miniprogram/pages/edit-profile/edit-profile.json`

**功能**:
- Emoji 头像选择（复用首页现有的 12 个 emoji 选项）
- 昵称输入（max 20 字）
- 个性签名输入（max 200 字）
- 保存按钮调用 `userService.updateProfile()`
- 保存成功后返回上一页，触发「我的」页面刷新

### 第 5 步：修改 app.json - TabBar 和页面注册

**文件**: `miniprogram/app.json`

```json
{
  "pages": [
    // 新增:
    "pages/my/my",
    "pages/edit-profile/edit-profile"
  ],
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/profile/profile",
        "text": "首页",
        "iconPath": "assets/icons/home.png",
        "selectedIconPath": "assets/icons/home-active.png"
      },
      {
        "pagePath": "pages/index/index",
        "text": "晨读营",
        "iconPath": "assets/icons/user.png",
        "selectedIconPath": "assets/icons/user-active.png"
      },
      {
        "pagePath": "pages/my/my",
        "text": "我的",
        "iconPath": "assets/icons/my.png",
        "selectedIconPath": "assets/icons/my-active.png"
      }
    ]
  }
}
```

**需要**: 新增 `my.png` 和 `my-active.png` 图标文件到 `miniprogram/assets/icons/`

### 第 6 步：修改首页 - 移除通知设置卡片

**文件**: `miniprogram/pages/profile/profile.wxml`
- 移除通知设置卡片区域（约 20 行 WXML）

**文件**: `miniprogram/pages/profile/profile.js`
- 移除 `loadSubscriptionSummary()` 调用
- 移除 `goToNotificationSettings()` 方法
- 移除相关 data 字段

**文件**: `miniprogram/pages/profile/profile.wxss`
- 移除通知设置卡片相关样式

### 第 7 步：修改登录页 - 添加手机号绑定弹窗

**文件**: `miniprogram/pages/login/login.wxml`
- 登录成功后显示绑定手机号弹窗
- 弹窗含：说明文字 + getPhoneNumber 按钮 + 跳过按钮

**文件**: `miniprogram/pages/login/login.js`
- 新增 `showPhoneBindModal` 状态
- 微信登录成功后设置 `showPhoneBindModal = true`
- `handleGetPhoneNumber(e)`: 获取 code → 调用后端绑定 API
- `handleSkipPhoneBind()`: 关闭弹窗，正常进入应用

**文件**: `miniprogram/pages/login/login.wxss`
- 新增弹窗样式

### 第 8 步：前端 Service 层

**文件**: `miniprogram/services/user.service.js` (扩展)

新增方法：
- `bindPhone(code)` - POST /api/v1/users/bindPhone
- `getPhoneInfo()` - GET /api/v1/users/phone

## 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 微信 getPhoneNumber 需要小程序已认证 | 未认证则无法获取手机号 | 先确认认证状态；未认证时隐藏手机号绑定功能 |
| TabBar 图标缺失 | 「我的」Tab 无图标 | 用简单的 SVG/PNG 图标，或暂用 emoji placeholder |
| 首页移除通知设置后布局变化 | 首页可能出现空白区域 | 调整间距，确保布局紧凑 |
| 退出登录后页面状态残留 | 返回其他页面仍显示旧数据 | 使用 wx.reLaunch 清除页面栈 |

## 验证步骤

1. **TabBar 测试**: 三个 Tab 切换正常，图标显示正确
2. **我的页面-已登录**: 显示用户信息、所有设置入口可点击
3. **我的页面-未登录**: 显示登录提示，点击跳转登录页
4. **手机号绑定**: 登录后弹窗出现，点击授权后手机号正确显示
5. **手机号跳过**: 点击跳过后正常进入应用，手机号显示"未绑定"
6. **换绑手机**: 已绑定用户可重新授权绑定新手机号
7. **编辑资料页**: 修改头像/昵称/签名后保存成功，返回「我的」页面数据刷新
8. **退出登录**: 点击后清除所有登录状态，跳转登录页
9. **首页验证**: 通知设置卡片已移除，其他功能正常
10. **通知设置入口**: 从「我的」页面点击可正常跳转 notification-settings 页面

## 工作量估算

| 步骤 | 涉及文件数 | 复杂度 |
|------|-----------|--------|
| 1. User 模型加 phone | 1 | 低 |
| 2. 手机号绑定 API | 2-3 | 中 |
| 3. 「我的」页面 | 4 (新增) | 中 |
| 4. 编辑资料页面 | 4 (新增) | 中 |
| 5. app.json + 图标 | 1 + 图标文件 | 低 |
| 6. 首页移除通知设置 | 3 | 低 |
| 7. 登录页手机绑定弹窗 | 3 | 中 |
| 8. Service 层扩展 | 1 | 低 |

总计：约 15-20 个文件变更，8 个新增文件
