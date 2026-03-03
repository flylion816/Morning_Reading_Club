# 凡人共读小程序 - 完整PRD文档（业务逻辑版）

> **文档版本**: v5.0（完整业务逻辑版）
> **创建日期**: 2026-03-03
> **基于代码**: GitHub 最新提交 aa6a96a
> **作者**: Claude Code + Backend Team
> **状态**: ✅ 已实现并通过 WeChat 审核

---

## 一、产品概述

### 1.1 产品名称与定位

**产品名**: 凡人共读（原名：凡人晨读营）

**核心定位**: 基于《高效能人士的七个习惯》的晨读打卡小程序，通过21-23天的持续晨读和社群互动，帮助用户养成阅读习惯，理解并实践七个习惯的核心理念。

### 1.2 关键改进（v5.0）

#### WeChat 审核合规性调整
- ✅ **改进**: 支持未登录用户浏览首页课程列表
- ✅ **改进**: 未登录用户可以体验应用，只在需要时才要求授权
- ✅ **改进**: 所有需要身份认证的操作都有明确的登录检查

#### 应用名称统一
- ✅ **改进**: "凡人晨读营" → "凡人共读"（全局25+处）
- ✅ **改进**: 分享图片、导航栏、页面标题全部统一

---

## 二、用户流程与权限模型

### 2.1 用户分类与权限矩阵

```
┌─────────────────────────────────────────────────────────────┐
│                     用户权限矩阵 v5.0                         │
├────────────────┬──────┬──────┬──────┬─────────┬──────────────┤
│     功能       │未登录│已登录│已报名│已支付  │ 说明          │
├────────────────┼──────┼──────┼──────┼─────────┼──────────────┤
│浏览首页期次    │  ✅  │  ✅  │  ✅  │   ✅    │无需授权      │
│查看期次详情    │  ✅  │  ✅  │  ✅  │   ✅    │无需授权      │
│点击期次        │  ❌* │  ✅  │  ✅  │   ✅    │*导航登录页   │
│报名新期次      │  ❌* │  ✅  │  -   │   -     │*导航登录页   │
│进入支付流程    │  ❌  │  ✅  │  ✅  │   -     │报名后才可见  │
│进入课程内容    │  ❌  │  -   │  ✅  │   ✅    │报名+支付后  │
│进行打卡        │  ❌  │  -   │  ✅  │   ✅    │报名+支付后  │
│查看小凡看见    │  ❌  │  -   │  ✅  │   ✅    │报名+支付后  │
│查看通知        │  ❌* │  ✅  │  ✅  │   ✅    │*导航登录页   │
│查看个人中心    │  ❌* │  ✅  │  ✅  │   ✅    │*导航登录页  │
└────────────────┴──────┴──────┴──────┴─────────┴──────────────┘

* 表示点击时直接导航到登录页（不显示弹窗）
```

### 2.2 应用启动流程（app.js）

```
小程序启动
    │
    ├─ onLaunch()
    │   ├─ checkLoginStatus() 
    │   │   └─ 检查本地存储 (TOKEN & USER_INFO)
    │   │       ├─ 存在 → globalData.isLogin = true
    │   │       └─ 不存在 → globalData.isLogin = false
    │   │
    │   ├─ navigateToStartPage()
    │   │   ├─ 生产环境(prod):
    │   │   │   └─ 所有用户 → 导航到 /pages/index/index
    │   │   │       (支持未登录用户浏览首页，符合WeChat要求)
    │   │   │
    │   │   └─ 开发环境(dev):
    │   │       └─ 不自动导航(方便调试)
    │   │
    │   ├─ getSystemInfo() → 获取系统信息
    │   └─ checkUpdate() → 检查小程序更新
    │
    └─ onShow()
        └─ 每次显示时重新 checkLoginStatus()
            (防止token过期或globalData重置)
```

**关键设计**:
- ✅ 入口页改为首页（pages[0] = index/index），不是登录页
- ✅ 所有用户都能进入首页浏览
- ✅ 登录状态通过全局 `app.globalData.isLogin` 管理
- ✅ onShow 中持续同步登录状态

---

## 三、页面流程详解

### 3.1 首页（/pages/index/index）

#### 3.1.1 页面初始化流程

```
首页 onLoad
    │
    ├─ checkLoginStatus()
    │   └─ 同步 app.globalData.isLogin 到页面 this.data.isLogin
    │
    ├─ loadPeriods()
    │   ├─ 调用 API: GET /api/v1/courses/periods
    │   ├─ 获取所有期次列表
    │   │
    │   └─ 处理响应:
    │       ├─ 计算每个期次的状态 (calculatedStatus)
    │       │   ├─ not_started(未开始): 当前时间 < startTime
    │       │   ├─ ongoing(进行中): startTime ≤ 当前时间 ≤ endTime
    │       │   └─ completed(已完成): 当前时间 > endTime
    │       │
    │       ├─ 按结束时间倒序排列 (最新的在前)
    │       │
    │       ├─ 初始化所有期次的报名状态(periodEnrollmentStatus):
    │       │   {
    │       │     isEnrolled: false,
    │       │     paymentStatus: null,
    │       │     enrollmentId: null
    │       │   }
    │       │
    │       └─ 如果已登录:
    │           └─ checkEnrollmentStatus(periods)
    │               ├─ 并行检查所有期次的报名状态
    │               ├─ 调用 API: GET /api/v1/enrollments/check/:periodId
    │               └─ 更新 this.data.periodEnrollmentStatus
    │
    └─ 渲染期次列表
```

#### 3.1.2 期次卡片点击流程

**重点**: 这是最关键的流程，涉及登录检查

```
用户点击期次卡片
    │
    └─ course-card 组件的 onCardTap()
        │
        ├─【最前置检查】检查用户登录状态
        │   └─ const isLogin = app.globalData.isLogin
        │
        ├─ 【分支1】未登录用户 (isLogin === false)
        │   ├─ 日志: "⚠️ 未登录用户，直接导航到登录页面"
        │   └─ 执行: wx.navigateTo('/pages/login/login')
        │       └─ 用户跳转到登录页，不显示任何提示
        │
        └─ 【分支2】已登录用户 (isLogin === true)
            │
            └─ 期次模式判断
                ├─ mode === 'period' ✅
                │   │
                │   ├─【分支2.1】未报名 (!isEnrolled)
                │   │   │
                │   │   ├─【分支2.1.1】期次已完成 (calculatedStatus === 'completed')
                │   │   │   └─ 显示 Toast: "此期晨读营已结束，请报名最新一期，谢谢！"
                │   │   │
                │   │   └─【分支2.1.2】期次进行中或未开始
                │   │       └─ 导航: wx.navigateTo('/pages/enrollment/enrollment?periodId=XXX')
                │   │           └─ 进入报名流程
                │   │
                │   ├─【分支2.2】已报名
                │   │   │
                │   │   ├─【分支2.2.1】支付状态 = 'paid' (已支付)
                │   │   │   └─ 导航: wx.navigateTo('/pages/courses/courses?periodId=XXX')
                │   │   │       └─ 进入课程列表
                │   │   │
                │   │   ├─【分支2.2.2】支付状态 = 'pending' (待支付)
                │   │   │   └─ 显示 Toast: "请先完成支付"
                │   │   │
                │   │   ├─【分支2.2.3】支付状态 = 'free' (免费)
                │   │   │   └─ 导航: wx.navigateTo('/pages/courses/courses?periodId=XXX')
                │   │   │       └─ 进入课程列表
                │   │   │
                │   │   └─【分支2.2.4】其他状态 (异常)
                │   │       └─ 显示 Toast: "报名状态异常，请联系客服"
                │   │
                │   └─ 返回 return (流程结束)
                │
                └─ mode === 'section'
                    └─ 触发自定义事件 'tap' 给父组件处理
```

**核心设计要点**:
- ✅ **最前置检查**: 登录检查在最开始，未登录直接导航登录页
- ✅ **无弹窗提示**: 直接 navigateTo，不显示 showModal 或 showToast
- ✅ **期次状态优先**: 判断期次是否完成，完成的不能报名
- ✅ **报名状态完整**: 支持 paid/pending/free 三种支付状态
- ✅ **异常处理**: 未知状态也有提示

#### 3.1.3 首页 onShow 流程

```
首页每次显示 (从其他页面返回时)
    │
    ├─ checkLoginStatus()
    │   └─ 重新检查登录状态
    │
    └─ 如果已登录:
        ├─ loadUserInfo() 
        │   └─ 强制重新加载用户信息(不使用缓存)
        │
        └─ checkEnrollmentStatus()
            └─ 重新检查报名状态(用户可能在报名页面新增报名或已支付)
```

---

### 3.2 登录页（/pages/login/login）

#### 3.2.1 页面结构与业务逻辑

```
登录页面布局:
├─ 顶部 Logo & 欢迎语
│   ├─ Logo: 📚
│   ├─ 标题: 《高效能人士的七个习惯》凡人共读
│   └─ Slogan: 一个起床、读书、谈心的地方
│
├─ 登录卡片
│   ├─ 标题: 明理实修，同见同行
│   ├─ 描述: 我们一起观心，谈心，用心，修心，明心
│   │
│   ├─【仅开发环境】快速测试登录
│   │   └─ 显示5个测试账号按钮
│   │       ├─ 管理员 (admin1)
│   │       ├─ 测试用户1-4
│   │       └─ 点击直接登录(绕过授权流程)
│   │
│   ├─ 隐私政策同意
│   │   ├─ Checkbox: "我已阅读并同意"
│   │   ├─ 链接: 《用户协议》& 《隐私政策》
│   │   └─ 限制: 必须勾选才能登录
│   │
│   └─ 微信一键登录按钮
│       ├─ 状态: agreePolicy = false → 禁用(灰色)
│       ├─ 状态: agreePolicy = true → 启用(蓝色)
│       └─ 点击触发: handleWechatLoginWithAgreement()
│
└─ 错误提示 (如有)
    └─ 显示登录失败信息
```

#### 3.2.2 微信登录完整流程

```
用户点击"微信一键登录"按钮
    │
    ├─【前置检查】
    │   ├─ agreePolicy === true ✓
    │   ├─ loading === false (非加载中)
    │   └─ 两个条件都满足才启用按钮
    │
    └─ handleWechatLoginWithAgreement()
        │
        ├─ 1. 调用 wx.getUserProfile()
        │   ├─ 获取用户微信头像、昵称等信息
        │   ├─ 用户弹框授权
        │   └─ 获得 encryptedData & iv (加密的用户信息)
        │
        ├─ 2. 调用 wx.login()
        │   ├─ 获得临时 code (一次性)
        │   └─ 有效期: 5分钟
        │
        ├─ 3. 调用微信服务器 jscode2session
        │   ├─ 发送: AppID + AppSecret + code
        │   ├─ 获得: session_key & openid
        │   └─ [生产环境] 微信官方服务器
        │       [开发环境] Mock 返回假数据
        │
        ├─ 4. 解密用户信息
        │   ├─ 使用 session_key 解密 encryptedData
        │   ├─ 提取: nickName, avatarUrl, gender 等
        │   └─ 生成 userId (与 openid 绑定)
        │
        ├─ 5. 调用后端登录接口
        │   ├─ POST /api/v1/auth/wechat/login
        │   ├─ 请求体:
        │   │   {
        │   │     openid: "用户的微信openid",
        │   │     nickName: "用户昵称",
        │   │     avatarUrl: "头像URL",
        │   │     gender: 0|1|2
        │   │   }
        │   │
        │   └─ 响应体:
        │       {
        │         code: 200,
        │         data: {
        │           accessToken: "JWT token (2小时过期)",
        │           refreshToken: "刷新token (30天过期)",
        │           user: {
        │             _id: "用户ID",
        │             openid: "微信openid",
        │             nickName: "昵称",
        │             avatarUrl: "头像",
        │             createdAt: "创建时间"
        │           }
        │         }
        │       }
        │
        ├─ 6. 保存登录信息
        │   ├─ localStorage:
        │   │   {
        │   │     token: accessToken,
        │   │     user_info: user对象 (JSON字符串)
        │   │   }
        │   │
        │   ├─ globalData:
        │   │   {
        │   │     isLogin: true,
        │   │     userInfo: user对象,
        │   │     token: accessToken
        │   │   }
        │   │
        │   └─ 自动保存 refreshToken (用于30天后刷新)
        │
        └─ 7. 导航返回
            ├─ 关闭登录页
            ├─ 返回到首页
            └─ 首页检查到 isLogin=true,显示用户信息
```

#### 3.2.3 Token 自动刷新机制

```
AccessToken 过期处理 (2小时后)
    │
    ├─ API 请求返回 401 Unauthorized
    │   │
    │   └─ 在 request.js 的拦截器中处理
    │       │
    │       ├─【判断】是否为公开端点?
    │       │   ├─ /auth/wechat/login → 公开(直接返回错误)
    │       │   ├─ /auth/refresh → 公开(直接返回错误)
    │       │   └─ 其他端点 → 受保护(尝试刷新)
    │       │
    │       └─【受保护端点的处理】
    │           │
    │           ├─ 1. 调用刷新接口
    │           │   ├─ POST /api/v1/auth/refresh
    │           │   ├─ 请求体: { refreshToken: xxx }
    │           │   │
    │           │   └─ 响应:
    │           │       {
    │           │         accessToken: "新的JWT token",
    │           │         refreshToken: "新的刷新token (可选)"
    │           │       }
    │           │
    │           ├─【分支A】刷新成功
    │           │   ├─ 更新本地 token
    │           │   ├─ 保存新 refreshToken
    │           │   ├─ 重试原始请求
    │           │   └─ 用户无感知(继续操作)
    │           │
    │           └─【分支B】刷新失败 (30天过期或其他)
    │               ├─ 清除 token & userInfo
    │               ├─ globalData.isLogin = false
    │               ├─ 显示 Toast: "请重新登录"
    │               └─ 导航到登录页
```

---

### 3.3 报名页（/pages/enrollment/enrollment）

#### 3.3.1 页面流程

```
报名页初始化
    │
    ├─ 从首页传入参数: periodId
    │   └─ 页面加载期次信息
    │
    ├─【分支1】如果未登录
    │   └─ 页面 onLoad 检查登录状态
    │       └─ 如果 isLogin === false
    │           └─ reLaunch 回到首页(或导航登录页)
    │
    └─【分支2】如果已登录
        │
        ├─ 检查是否已报名该期次
        │   ├─ 已报名 → 显示已报名状态
        │   ├─ 未报名 → 显示报名表单
        │   └─ 根据 enrollmentStatus 判断
        │
        └─ 用户点击"确认报名"
            │
            └─ POST /api/v1/enrollments
               ├─ 请求体:
               │   {
               │     periodId: "期次ID",
               │     userId: "用户ID"
               │   }
               │
               └─ 响应:
                   {
                     code: 200,
                     data: {
                       enrollmentId: "报名ID",
                       paymentStatus: "pending|paid|free"
                     }
                   }
                   │
                   ├─【分支2.1】paymentStatus === 'free'
                   │   └─ 直接显示报名成功
                   │       └─ 返回首页
                   │
                   └─【分支2.2】paymentStatus === 'pending'
                       └─ 导航到支付页面
```

---

### 3.4 支付页（/pages/payment/payment）

#### 3.4.1 支付流程

```
支付页初始化
    │
    ├─ 从报名页或首页传入参数:
    │   ├─ enrollmentId: 报名ID
    │   ├─ periodId: 期次ID
    │   ├─ amount: 金额 (99元)
    │   ├─ isResumePayment: 是否续费
    │   └─ 其他信息: 期次名称、日期等
    │
    └─ 用户点击"确认支付"
        │
        ├─ 1. 调用 wx.requestPayment() (Mock)
        │   ├─ 调用微信支付接口
        │   ├─ 用户授权支付
        │   └─ [生产环境] 调用真实微信支付
        │       [开发环境] Mock 返回成功
        │
        ├─ 2. 后端更新支付状态
        │   ├─ PATCH /api/v1/payments/:paymentId
        │   ├─ 更新: paymentStatus = 'paid'
        │   └─ 记录: 支付时间、订单号等
        │
        └─ 3. 支付成功处理
            ├─ 更新本地报名状态缓存
            ├─ 显示成功提示
            ├─ 返回首页
            └─ 首页刷新后,该期次可进入课程列表
```

---

### 3.5 课程内容页（/pages/courses/courses）

#### 3.5.1 进入条件与权限检查

```
进入课程列表的完整条件:
    │
    ├─【条件1】已登录 (isLogin === true)
    │   └─ 否则: 返回首页或登录页
    │
    ├─【条件2】已报名该期次 (isEnrolled === true)
    │   └─ 否则: 显示"未报名"提示
    │
    ├─【条件3】已支付或免费 (paymentStatus === 'paid' || 'free')
    │   └─ 否则: 显示"请先支付"提示
    │
    └─【条件4】期次有效(不检查期次是否完成)
        └─ 注意: 即使期次已完成,支付过的用户仍可查看课程
            (这是设计特性,支持用户查看历史课程)
```

#### 3.5.2 课程列表展示

```
课程列表页面:
    │
    ├─ 顶部信息
    │   ├─ 期次名称
    │   ├─ 课程总数
    │   └─ 个人进度 (x/y)
    │
    ├─ 课节卡片列表
    │   └─ 每个课节卡片显示:
    │       ├─ 课节标题
    │       ├─ 教师名称
    │       ├─ 简介
    │       └─ 【操作按钮】
    │           ├─ 打卡按钮 (未打卡时)
    │           ├─ 已打卡标签 (已打卡时)
    │           └─ 补打卡按钮 (错过时间后)
    │
    └─ 下拉刷新
        └─ 重新加载课程列表和打卡状态
```

---

### 3.6 打卡页（/pages/checkin/checkin）

#### 3.6.1 打卡触发与权限

```
点击"打卡"按钮
    │
    ├─【权限检查】
    │   ├─ 已登录? (isLogin === true)
    │   ├─ 已报名? (isEnrolled === true)
    │   ├─ 已支付? (paymentStatus === 'paid' || 'free')
    │   └─ 三个条件都满足 → 允许打卡
    │       否则 → 返回首页
    │
    └─ 进入打卡页面
        │
        ├─ 页面加载检查:
        │   ├─ 检查今天是否已打卡
        │   ├─ 检查打卡是否在时间范围内
        │   └─ 计算连续打卡天数
        │
        ├─【分支1】已打卡过
        │   ├─ 显示"今日已打卡"提示
        │   ├─ 显示打卡时间
        │   └─ 禁用打卡按钮
        │
        └─【分支2】未打卡
            │
            ├─ 显示打卡表单
            │   ├─ 五步学习法输入框
            │   │   ├─ 入静: 文字输入
            │   │   ├─ 带问题学习: 文字输入
            │   │   ├─ 阅读: 文字输入
            │   │   ├─ 反思: 文字输入
            │   │   └─ 行动: 文字输入
            │   │
            │   ├─ 图片上传 (可选)
            │   ├─ 打卡照片
            │   └─ 分享开关
            │
            └─ 用户点击"提交打卡"
                │
                ├─ POST /api/v1/insights/checkin
                │   ├─ 请求体:
                │   │   {
                │   │     userId: "用户ID",
                │   │     periodId: "期次ID",
                │   │     courseId: "课节ID",
                │   │     quiet: "入静感受",
                │   │     question: "问题",
                │   │     reading: "阅读内容",
                │   │     reflection: "反思",
                │   │     action: "行动计划",
                │   │     image: "图片URL (可选)",
                │   │     isShared: true|false
                │   │   }
                │   │
                │   └─ 响应: { code: 200, checkinId: "xxx" }
                │
                ├─ 保存打卡记录
                │   └─ 本地缓存: 避免重复提交
                │
                └─ 更新UI
                    ├─ 显示"打卡成功"提示
                    ├─ 刷新连续打卡天数
                    ├─ 禁用打卡按钮
                    └─ 返回课程列表
```

---

### 3.7 小凡看见页（/pages/insights/insights）

#### 3.7.1 权限与显示逻辑

```
进入小凡看见列表
    │
    ├─【权限检查】
    │   ├─ 已登录? (isLogin === true)
    │   │   └─ 否: 返回登录页
    │   │
    │   └─ 已报名任何期次?
    │       └─ 用于筛选用户的小凡看见
    │
    ├─ 页面模式
    │   ├─ 【模式1】"我的小凡看见" (Tab)
    │   │   ├─ 显示当前用户的所有打卡记录
    │   │   ├─ API: GET /api/v1/insights/my
    │   │   │   └─ 筛选: userId === 当前用户ID
    │   │   │
    │   │   └─ 按时间倒序显示
    │   │
    │   └─ 【模式2】"全部小凡看见" (Tab)
    │       ├─ 显示所有用户在同期课程的打卡
    │       ├─ API: GET /api/v1/insights/period/:periodId
    │       │   └─ 返回:
    │       │       [
    │       │         {
    │       │           _id: "打卡ID",
    │       │           userId: { _id, nickName, avatarUrl },
    │       │           quiet: "...",
    │       │           reflection: "...",
    │       │           createdAt: "时间",
    │       │           likeCount: 0,
    │       │           commentCount: 0
    │       │         }
    │       │       ]
    │       │
    │       └─ 支持:
    │           ├─ 点赞
    │           ├─ 评论
    │           └─ 查看详情
    │
    ├─ 小凡看见卡片展示
    │   ├─ 用户信息: 头像、昵称
    │   ├─ 打卡内容摘要
    │   ├─ 时间戳
    │   ├─ 点赞数、评论数
    │   └─ 【操作】
    │       ├─ 点击卡片 → 进入详情页
    │       ├─ 点赞按钮
    │       └─ 评论按钮
    │
    └─ 下拉刷新
        └─ 重新加载小凡看见列表
```

#### 3.7.2 小凡看见详情页

```
点击小凡看见卡片
    │
    └─ 进入详情页 (/pages/insight-detail/insight-detail)
        │
        ├─ 完整展示打卡内容
        │   ├─ 五步学习法全文
        │   ├─ 打卡图片 (如有)
        │   ├─ 用户信息
        │   ├─ 打卡时间
        │   └─ 点赞数、评论数
        │
        ├─ 评论系统
        │   ├─ 显示所有评论
        │   │   ├─ 评论者头像、昵称
        │   │   ├─ 评论内容
        │   │   ├─ 评论时间
        │   │   ├─ 点赞数
        │   │   └─ 【操作】
        │   │       ├─ 回复
        │   │       └─ 点赞
        │   │
        │   └─ 输入框
        │       ├─ 文本输入
        │       ├─ 提交评论按钮
        │       └─ POST /api/v1/comments
        │           └─ insightId: "打卡ID"
        │               content: "评论内容"
        │
        └─ 分享按钮
            ├─ 分享到朋友圈
            ├─ 分享给好友
            └─ 复制链接
```

---

### 3.8 个人中心页（/pages/profile/profile）

#### 3.8.1 权限与页面结构

```
个人中心页面
    │
    ├─【权限检查】(onLoad)
    │   ├─ 检查 isLogin
    │   │   ├─ true → 继续加载个人中心
    │   │   └─ false → wx.reLaunch('/pages/login/login')
    │   │              (完全替换页面栈,用户无法返回)
    │   │
    │   └─【重要】onShow 处理
    │       ├─ 检查 localStorage 中是否有 token
    │       ├─ 有 token → 恢复 globalData, 不跳转
    │       │   (防止频繁跳转)
    │       │
    │       └─ 无 token → 调用 reLaunch 跳转登录
    │
    ├─ 页面内容
    │   ├─ 用户头像 (可点击修改)
    │   ├─ 用户昵称
    │   ├─ 统计信息
    │   │   ├─ 报名期次数
    │   │   ├─ 累计打卡天数
    │   │   └─ 连续打卡天数
    │   │
    │   ├─ 我的课程 (已报名的期次)
    │   │   └─ 列表
    │   │       ├─ 期次名称
    │   │       ├─ 进度条
    │   │       ├─ 打卡状态
    │   │       └─ 支付状态
    │   │
    │   ├─ 功能菜单
    │   │   ├─ 打卡记录
    │   │   ├─ 我的排行
    │   │   ├─ 小凡看见
    │   │   ├─ 通知中心
    │   │   ├─ 用户协议
    │   │   ├─ 隐私政策
    │   │   └─ 关于凡人共读
    │   │
    │   └─ 退出登录按钮
    │       └─ 点击触发:
    │           ├─ 清除 localStorage token & user_info
    │           ├─ 清除 globalData
    │           ├─ globalData.isLogin = false
    │           └─ 导航到首页或登录页
    │
    └─ tabBar 底部导航
        ├─ 首页 (点击返回 /pages/profile/profile → 不是首页!)
        │   └─ 注意: tabBar 第一项是个人中心,不是首页
        │       (但页面列表第一项是首页,加载时进入首页)
        │
        └─ 晨读营 (点击进入 /pages/index/index)
            └─ 这里是真正的首页
```

---

### 3.9 通知页（/pages/notifications/notifications）

#### 3.9.1 权限与流程

```
点击通知徽章 (notification-badge 组件)
    │
    ├─【权限检查】
    │   ├─ handleNotificationTap() 中检查登录状态
    │   ├─ const isLogin = app.globalData.isLogin
    │   │
    │   ├─【分支1】未登录 (isLogin === false)
    │   │   └─ wx.navigateTo('/pages/login/login')
    │   │       (直接导航,不显示弹窗)
    │   │
    │   └─【分支2】已登录 (isLogin === true)
    │       └─ wx.navigateTo('/pages/notifications/notifications')
    │
    └─ 通知页面初始化
        │
        ├─ 加载未读通知
        │   ├─ GET /api/v1/notifications/unread
        │   └─ 返回列表:
        │       [
        │         {
        │           _id: "通知ID",
        │           type: "checkin|comment|like|system",
        │           title: "通知标题",
        │           content: "通知内容",
        │           relatedUser: { _id, nickName, avatarUrl },
        │           isRead: false,
        │           createdAt: "时间"
        │         }
        │       ]
        │
        ├─ 显示通知列表
        │   ├─ 按时间倒序 (最新在前)
        │   └─ 支持操作:
        │       ├─ 点击通知 → 跳转到相关页面 (打卡详情/评论等)
        │       ├─ 标记已读 (单个)
        │       ├─ 标记全部已读
        │       └─ 删除通知
        │
        └─ WebSocket 实时推送 (可选)
            ├─ 建立 WebSocket 连接
            │   ├─ 服务器地址: wss://api.shubai01.com/ws
            │   └─ 传入: userId (用于识别)
            │
            └─ 监听新通知事件
                ├─ 收到新通知时实时刷新列表
                └─ 徽章数更新
```

---

## 四、错误处理与边界情况

### 4.1 登录状态异常处理

```
【场景1】Token 过期
    │
    ├─ 问题: AccessToken 超过2小时
    └─ 处理: request.js 拦截器
        ├─ 自动调用刷新接口
        ├─ 刷新成功 → 重试原请求
        └─ 刷新失败 → 清除登录状态,导航登录页

【场景2】RefreshToken 过期
    │
    ├─ 问题: 超过30天未登录
    └─ 处理:
        ├─ 刷新接口返回 401
        ├─ 清除所有登录信息
        ├─ 显示 Toast: "登录已过期,请重新登录"
        └─ 导航登录页

【场景3】用户在其他设备登录
    │
    ├─ 问题: 同一账号多地登录
    └─ 处理:
        ├─ 新设备登录时,旧 token 仍有效
        ├─ 暂无主动下线机制 (v5.0)
        └─ 建议 v5.1 中实现

【场景4】LocalStorage 被清除
    │
    ├─ 问题: 用户清除缓存或卸载重装
    └─ 处理:
        ├─ onLoad 检查 token 不存在
        ├─ isLogin = false
        └─ 导航登录页
```

### 4.2 报名与支付异常

```
【场景1】重复报名
    │
    ├─ 问题: 用户多次点击报名
    └─ 处理:
        ├─ 前端: 禁用按钮 (loading = true)
        ├─ 后端: 唯一性约束 (userId + periodId)
        └─ 返回: "已报名过此期次"

【场景2】支付中断
    │
    ├─ 问题: 用户支付中途取消
    └─ 处理:
        ├─ 支付状态保持 pending
        ├─ 首页显示"待支付"提示
        └─ 用户可再次点击期次继续支付

【场景3】期次已结束
    │
    ├─ 问题: 用户试图报名已完成的期次
    └─ 处理:
        ├─ course-card 检查 calculatedStatus
        ├─ calculatedStatus === 'completed' → 显示 Toast
        └─ 内容: "此期晨读营已结束,请报名最新一期"

【场景4】 同时操作多个期次
    │
    ├─ 问题: 用户在多个浏览器标签页操作
    └─ 处理:
        ├─ 首页 onShow 会重新同步状态
        ├─ 最新的报名/支付状态生效
        └─ 用户可能看到不一致的缓存数据 (待改进)
```

### 4.3 网络异常处理

```
【场景1】请求超时
    │
    ├─ 问题: API 响应超时 (>10秒)
    └─ 处理:
        ├─ request.js 的 timeout 配置
        ├─ 显示 Toast: "请求超时,请重试"
        └─ 允许用户重新发起请求

【场景2】无网络连接
    │
    ├─ 问题: 完全离线
    └─ 处理:
        ├─ 前端无法拦截 (小程序特性)
        ├─ 用户会看到请求挂起
        └─ 建议添加网络监听 (wx.onNetworkStatusChange)

【场景3】服务器错误
    │
    ├─ 问题: API 返回 500/502/503
    └─ 处理:
        ├─ request.js 检查 response.code !== 200
        ├─ 显示错误提示
        └─ 日志记录用于后续调试
```

---

## 五、数据模型与API 接口规范

### 5.1 核心数据结构

#### 用户对象
```javascript
{
  _id: "ObjectId",                // 用户唯一ID
  openid: "微信openid",            // 微信标识
  nickName: "用户昵称",
  avatarUrl: "头像URL",
  gender: 0|1|2,                  // 0未知, 1男, 2女
  phone: "手机号 (可选)",
  email: "邮箱 (可选)",
  createdAt: "2026-03-03T10:00:00Z",
  updatedAt: "2026-03-03T10:00:00Z",
  isActive: true,
  lastLoginAt: "上次登录时间"
}
```

#### 期次对象
```javascript
{
  _id: "ObjectId",
  name: "平衡之道 - 七个习惯晨读营",
  subtitle: "七个习惯深度学习",
  description: "详细介绍...",
  startTime: "2026-02-01T06:00:00Z",
  endTime: "2026-02-23T23:59:59Z",
  totalDays: 23,
  price: 99,
  sections: [ObjectId],           // 课节IDs
  createdBy: ObjectId,            // 创建者ID
  status: "draft|active|archived",
  maxParticipants: 1000,
  currentParticipants: 450,
  createdAt: "2026-02-01T00:00:00Z",
  updatedAt: "2026-03-03T10:00:00Z"
}
```

#### 报名对象
```javascript
{
  _id: "ObjectId",
  userId: ObjectId,
  periodId: ObjectId,
  enrollmentDate: "2026-02-05T10:30:00Z",
  paymentStatus: "pending|paid|free",
  paymentId: ObjectId,            // 支付记录ID
  cancelledAt: null,              // 取消时间(如取消)
  totalCheckIns: 15,              // 总打卡数
  lastCheckInDate: "2026-03-02T06:30:00Z",
  currentStreak: 8,               // 连续打卡天数
  createdAt: "2026-02-05T10:30:00Z",
  updatedAt: "2026-03-03T10:00:00Z"
}
```

#### 打卡对象
```javascript
{
  _id: "ObjectId",
  userId: ObjectId,
  periodId: ObjectId,
  sectionId: ObjectId,
  checkInDate: "2026-03-03T06:30:00Z",
  quiet: "入静的感受...",
  question: "我的问题是...",
  reading: "我理解的内容...",
  reflection: "我的反思...",
  action: "我的行动...",
  image: "图片URL (可选)",
  isShared: true,
  likeCount: 5,
  commentCount: 2,
  createdAt: "2026-03-03T06:35:00Z",
  updatedAt: "2026-03-03T10:00:00Z"
}
```

### 5.2 关键 API 端点

#### 认证相关
```
POST /api/v1/auth/wechat/login
  Request: { openid, nickName, avatarUrl, gender }
  Response: { accessToken, refreshToken, user }

POST /api/v1/auth/refresh
  Request: { refreshToken }
  Response: { accessToken, refreshToken }
```

#### 期次相关
```
GET /api/v1/courses/periods
  Response: [Period]

GET /api/v1/courses/periods/:periodId
  Response: Period (详细信息)
```

#### 报名相关
```
POST /api/v1/enrollments
  Request: { periodId, userId }
  Response: { enrollmentId, paymentStatus }

GET /api/v1/enrollments/check/:periodId
  Response: { isEnrolled, paymentStatus, enrollmentId }

PATCH /api/v1/enrollments/:enrollmentId
  Request: { status: "active|cancelled" }
```

#### 打卡相关
```
POST /api/v1/insights/checkin
  Request: { userId, periodId, sectionId, quiet, question, ... }
  Response: { checkinId, createdAt }

GET /api/v1/insights/period/:periodId
  Response: [Insight]

GET /api/v1/insights/my
  Response: [Insight] (当前用户的打卡)
```

---

## 六、重要设计决策

### 6.1 登录与权限模型的演进

```
v3.0: 强制登录模式
  └─ 进入首页就要求登录
  └─ WeChat 审核被驳回 ❌

v4.0: 增加登录页面
  └─ 支持微信和测试账号登录
  └─ 但仍然强制导航到登录页 ❌

v5.0: WeChat 审核合规
  └─ 未登录用户可浏览首页和期次列表 ✅
  └─ 只在需要时才要求登录 ✅
  └─ 点击操作直接导航登录页(无弹窗) ✅
```

### 6.2 期次状态的计算逻辑

```
不依赖数据库 status 字段,而是基于时间计算:

calculatedStatus = calculatePeriodStatus(startTime, endTime)
  │
  ├─ 当前时间 < startTime → 'not_started'
  ├─ startTime ≤ 当前时间 ≤ endTime → 'ongoing'
  └─ 当前时间 > endTime → 'completed'

优点:
  ✅ 无需后端维护状态转移逻辑
  ✅ 实时准确
  ✅ 前端可离线计算

缺点:
  ❌ 前后端时间可能不一致 (需要同步)
```

### 6.3 报名与支付的分离

```
报名 (Enrollment) 和 支付 (Payment) 是分开的:

报名流程:
  1. 用户报名期次 → paymentStatus = 'pending'
  2. 用户支付 → paymentStatus = 'paid'
  3. 用户可取消报名 → 标记为 cancelled

优点:
  ✅ 支持免费期次 (paymentStatus = 'free')
  ✅ 支持暂不支付,后续补支付
  ✅ 灵活的商业模式

设计:
  ✅ 报名后立即进入课程列表 (如果免费)
  ✅ 报名后需要支付才能打卡 (如果付费)
```

---

## 七、性能与可靠性考虑

### 7.1 缓存策略

```
本地存储 (localStorage):
  ├─ token: 用于 API 认证
  ├─ user_info: 用户信息 (JSON)
  └─ 其他临时数据

内存缓存 (globalData):
  ├─ isLogin: 登录状态
  ├─ userInfo: 用户对象
  ├─ token: AccessToken
  └─ 系统信息 (分辨率、平台等)

API 缓存:
  ├─ 期次列表: 首页加载一次,下拉刷新重新加载
  ├─ 用户信息: onShow 强制重新加载 (不使用缓存)
  ├─ 报名状态: onShow 异步检查
  └─ 打卡记录: 课程列表加载
```

### 7.2 网络优化

```
请求并发:
  ├─ 首页加载期次和报名状态: 并行请求
  │   └─ loadPeriods() 与 checkEnrollmentStatus() 并行
  │
  ├─ 通知系统: 定时轮询或 WebSocket
  │   ├─ 优先使用 WebSocket (实时)
  │   └─ 降级到轮询 (30秒一次)
  │
  └─ 图片加载: 使用缓存,避免重复下载

错误重试:
  ├─ 自动刷新 token (最多1次)
  ├─ API 错误: 显示提示,允许用户手动重试
  └─ 网络超时: 10秒超时,提示用户
```

---

## 八、已知限制与未来改进

### 8.1 v5.0 的已知限制

| 限制项 | 当前实现 | 改进方向 |
|--------|---------|---------|
| **账号互联** | 不支持 | v5.1 支持微博/QQ 登录 |
| **多设备登录** | 支持,无冲突 | v5.1 实现单设备登录 |
| **离线模式** | 不支持 | v5.1 本地缓存支持离线浏览 |
| **数据同步** | 一致性 | v5.1 冲突解决机制 |
| **性能优化** | 基础 | v5.1 图片压缩/CDN |

### 8.2 建议的改进方向

```
v5.1 计划:
  ├─ 单账号主设备登录保护
  ├─ 打卡数据本地缓存(离线支持)
  ├─ 图片压缩上传 (减少流量)
  ├─ 推荐系统 (基于打卡内容)
  └─ 深链接支持 (分享链接直达)

v5.2 计划:
  ├─ AI 打卡内容质量评分
  ├─ 自动推荐互动话题
  ├─ 虚拟徽章和成就系统
  └─ 直播课堂集成
```

---

## 九、测试与验证清单

### 9.1 关键业务流程测试

- [ ] **未登录用户**: 进入首页 → 浏览课程 → 点击期次 → 导航登录页
- [ ] **新用户**: 登录 → 报名期次 → 支付(Mock) → 进入课程 → 打卡
- [ ] **已报名用户**: 登录 → 进入已报名期次 → 续写打卡 → 查看小凡看见
- [ ] **token 过期**: 操作API → 自动刷新 → 重试请求
- [ ] **RefreshToken 过期**: 操作API → 刷新失败 → 导航登录页
- [ ] **已完成期次**: 点击 → 显示"已结束"提示

### 9.2 兼容性测试

- [ ] iOS 最新版微信
- [ ] Android 最新版微信
- [ ] 不同网络速度 (4G/WiFi/弱网)
- [ ] 不同屏幕尺寸 (iPhone SE/Plus/Android 各类)

---

## 十、版本历史

| 版本 | 日期 | 主要改动 |
|------|------|---------|
| v1.0 | 2025-11 | 基础功能实现 |
| v2.0 | 2025-12 | 添加社交和 WebSocket |
| v3.0 | 2026-01 | 添加小凡看见和支付 |
| v4.0 | 2026-02 | 微信登录、JWT 刷新 |
| v5.0 | 2026-03 | **WeChat 审核合规、应用名称统一** ✅ |

---

**文档最后更新**: 2026-03-03
**GitHub Commit**: aa6a96a (最新)
**状态**: ✅ 完成并已提交 GitHub

