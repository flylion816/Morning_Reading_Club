# 小程序单元测试完整实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 为微信小程序创建 180+ 个单元测试，覆盖所有业务层（服务层、工具层、页面层、组件层），使用黑盒 UI 验证方式，与管理后台测试集成形成端到端验证。

**Architecture:** 采用 Jest + 工厂模式测试框架。分 6 个阶段：
1. **工具函数和请求层** - 基础设施(30 个测试)
2. **认证与用户管理** - 用户数据流(30 个测试)
3. **报名流程** - 核心业务(35 个测试)
4. **支付集成** - 支付模块(25 个测试)
5. **打卡与内容** - 学习流程(30 个测试)
6. **Insights 与社交** - 互动功能(40 个测试)

每阶段完成后验证：所有测试通过 ✅ + 管理后台二次验证 ✅

**Tech Stack:** Jest, 工厂函数, Mock API, wx.* API 模拟, 本地存储 Mock

---

## 准备工作

### P0: 创建测试框架和工厂函数

**Files:**
- Create: `miniprogram/__tests__/fixtures.js` - 所有 Mock 数据工厂
- Create: `miniprogram/__tests__/setup.js` - Jest 全局配置
- Create: `miniprogram/__tests__/mocks/wx.js` - 微信 API Mock
- Create: `miniprogram/__tests__/mocks/storage.js` - localStorage Mock
- Modify: `package.json` - 添加 Jest 配置和测试命令

**Step 1: 创建测试数据工厂** (`miniprogram/__tests__/fixtures.js`)

```javascript
/**
 * 测试数据工厂 - 所有 Mock 数据生成函数
 */

// 用户数据
function createMockUser(overrides = {}) {
  return {
    _id: 'user-' + Math.random().toString(36).substr(2, 9),
    openid: 'openid-' + Math.random().toString(36).substr(2, 9),
    nickname: '用户' + Math.floor(Math.random() * 1000),
    avatar: 'https://example.com/avatar.jpg',
    email: 'user@example.com',
    phone: '13800138000',
    status: 'normal',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

// 期次数据
function createMockPeriod(overrides = {}) {
  return {
    _id: 'period-' + Math.random().toString(36).substr(2, 9),
    name: '智慧与坚持 - 第一期',
    description: '通过晨读学习智慧和坚持',
    status: 'ongoing',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    price: 99,
    enrollmentCount: 42,
    capacity: 100,
    ...overrides
  };
}

// 课程数据
function createMockCourse(overrides = {}) {
  return {
    _id: 'course-' + Math.random().toString(36).substr(2, 9),
    periodId: 'period-123',
    dayOfPeriod: 1,
    title: '成功来自于专注与坚持',
    description: '今天分享成功的秘诀',
    content: '## 成功的三个要素\n1. 专注\n2. 坚持\n3. 反思',
    status: 'published',
    checkinsCount: 28,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

// 报名数据
function createMockEnrollment(overrides = {}) {
  return {
    _id: 'enrollment-' + Math.random().toString(36).substr(2, 9),
    userId: 'user-123',
    periodId: 'period-123',
    status: 'approved',
    enrollmentDate: new Date().toISOString(),
    approvalDate: new Date().toISOString(),
    notes: '',
    ...overrides
  };
}

// 打卡数据
function createMockCheckin(overrides = {}) {
  return {
    _id: 'checkin-' + Math.random().toString(36).substr(2, 9),
    userId: 'user-123',
    courseId: 'course-456',
    periodId: 'period-123',
    timestamp: new Date().toISOString(),
    notes: '今天学到了很多',
    status: 'success',
    ...overrides
  };
}

// Insights 数据
function createMockInsight(overrides = {}) {
  return {
    _id: 'insight-' + Math.random().toString(36).substr(2, 9),
    userId: 'user-123',
    targetUserId: 'user-456',
    periodId: 'period-123',
    content: '你在打卡中提到的"坚持"这个概念深深启发了我',
    type: 'thought_sharing',
    status: 'published',
    likesCount: 5,
    commentsCount: 2,
    sharesCount: 1,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

// 支付记录数据
function createMockPayment(overrides = {}) {
  return {
    _id: 'payment-' + Math.random().toString(36).substr(2, 9),
    userId: 'user-123',
    orderId: 'order-' + Math.random().toString(36).substr(2, 9),
    amount: 99,
    status: 'success',
    method: 'wechat',
    periodId: 'period-123',
    transactionId: 'txn-' + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

// 排行榜数据
function createMockRankingItem(overrides = {}) {
  return {
    userId: 'user-123',
    nickname: '用户名',
    avatar: 'https://example.com/avatar.jpg',
    checkinsCount: 28,
    rank: 1,
    ...overrides
  };
}

// 评论数据
function createMockComment(overrides = {}) {
  return {
    _id: 'comment-' + Math.random().toString(36).substr(2, 9),
    insightId: 'insight-123',
    userId: 'user-456',
    content: '非常赞同你的观点！',
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

module.exports = {
  createMockUser,
  createMockPeriod,
  createMockCourse,
  createMockEnrollment,
  createMockCheckin,
  createMockInsight,
  createMockPayment,
  createMockRankingItem,
  createMockComment
};
```

**Step 2: 创建 Jest 全局配置** (`miniprogram/__tests__/setup.js`)

```javascript
/**
 * Jest 全局测试配置
 */

// 清空 console 警告（除非测试显式检查）
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn()
};

// 全局变量
global.Math.random = jest.fn(() => 0.5);

// 模拟 wx 全局对象（基础）
global.wx = {
  getStorageSync: jest.fn(),
  setStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  clearStorageSync: jest.fn(),
  getStorage: jest.fn(({ success }) => success({ data: null })),
  setStorage: jest.fn(({ success }) => success()),
  removeStorage: jest.fn(({ success }) => success()),
  clearStorage: jest.fn(({ success }) => success()),
  request: jest.fn(),
  login: jest.fn(),
  getUserProfile: jest.fn(),
  choosePayment: jest.fn(),
  requestPayment: jest.fn(),
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  reLaunch: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  showToast: jest.fn(),
  showModal: jest.fn(),
  hideToast: jest.fn(),
  getSystemInfoSync: jest.fn(() => ({
    platform: 'devtools',
    system: 'Windows 10',
    pixelRatio: 1
  })),
  getNetworkType: jest.fn(({ success }) => success({ networkType: 'wifi' }))
};

// 测试超时
jest.setTimeout(5000);
```

**Step 3: 创建微信 API Mock** (`miniprogram/__tests__/mocks/wx.js`)

```javascript
/**
 * 微信小程序 API Mock
 */

class WxMock {
  constructor() {
    this.storage = {};
    this.requestQueue = [];
    this.loginToken = null;
  }

  // 存储 API
  getStorageSync(key) {
    return this.storage[key] ?? null;
  }

  setStorageSync(key, value) {
    this.storage[key] = value;
  }

  removeStorageSync(key) {
    delete this.storage[key];
  }

  clearStorageSync() {
    this.storage = {};
  }

  // 请求 API
  request(options) {
    const { url, method = 'GET', data, success, fail } = options;

    // 模拟网络延迟
    setTimeout(() => {
      const response = this._mockResponse(url, method, data);
      if (response.ok) {
        success?.(response);
      } else {
        fail?.(response.error);
      }
    }, 100);
  }

  _mockResponse(url, method, data) {
    // 返回 { ok: boolean, statusCode, data, error }
    // 实现在具体的服务测试中
    return { ok: true, statusCode: 200, data: {} };
  }

  // 认证 API
  login(options) {
    const { success } = options;
    setTimeout(() => {
      this.loginToken = 'mock-code-' + Date.now();
      success?.({ code: this.loginToken });
    }, 100);
  }

  // 支付 API
  requestPayment(options) {
    const { success, fail } = options;
    setTimeout(() => {
      if (Math.random() > 0.1) {
        success?.({ errMsg: 'requestPayment:ok' });
      } else {
        fail?.({ errMsg: 'requestPayment:fail cancel' });
      }
    }, 200);
  }

  // 导航 API
  navigateTo(options) {
    options.success?.();
  }

  navigateBack() {}

  // 提示 API
  showToast(options) {}
  showModal(options) { options.success?.({ confirm: true }); }
}

module.exports = WxMock;
```

**Step 4: 修改 package.json** - 添加 Jest 配置

```json
{
  "scripts": {
    "test:miniprogram": "jest miniprogram/__tests__ --coverage",
    "test:miniprogram:watch": "jest miniprogram/__tests__ --watch",
    "test:all": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "setupFilesAfterEnv": ["<rootDir>/miniprogram/__tests__/setup.js"],
    "testMatch": ["**/__tests__/**/*.spec.js"],
    "collectCoverageFrom": ["miniprogram/**/*.js"],
    "coveragePathIgnorePatterns": ["__tests__", "node_modules"]
  }
}
```

**Step 5: 验证框架**

```bash
npm install --save-dev jest

npm run test:miniprogram 2>&1 | head -20
# 预期输出: PASS/FAIL，显示测试文件数
```

**Step 6: 提交**

```bash
git add miniprogram/__tests__/fixtures.js miniprogram/__tests__/setup.js miniprogram/__tests__/mocks/ package.json
git commit -m "test: 小程序测试框架初始化 - Jest + 数据工厂"
```

---

## 阶段 1: 工具函数与请求层 (30 个测试)

### Task 1.1: Request 工具测试 (8 个测试)

**Files:**
- Create: `miniprogram/__tests__/utils/request.spec.js`
- Reference: `miniprogram/utils/request.js`

**Tests:**
- [REQ-1] 正常请求应返回响应数据
- [REQ-2] 请求错误应触发错误回调
- [REQ-3] 自动添加 Authorization 头（当有 token 时）
- [REQ-4] 自动重试失败请求（最多 3 次）
- [REQ-5] 请求超时应返回超时错误
- [REQ-6] 应支持 GET/POST/PUT/DELETE 方法
- [REQ-7] 应正确处理请求参数序列化
- [REQ-8] 应支持自定义请求头

### Task 1.2: Storage 工具测试 (6 个测试)

**Files:**
- Create: `miniprogram/__tests__/utils/storage.spec.js`
- Reference: `miniprogram/utils/storage.js`

**Tests:**
- [STOR-1] 保存数据应成功存储到本地
- [STOR-2] 读取数据应返回已保存的值
- [STOR-3] 删除数据应清除本地存储
- [STOR-4] 清空所有数据应删除所有键值
- [STOR-5] 读取不存在的键应返回 null
- [STOR-6] 应支持 JSON 对象序列化和反序列化

### Task 1.3: Formatters 工具测试 (8 个测试)

**Files:**
- Create: `miniprogram/__tests__/utils/formatters.spec.js`
- Reference: `miniprogram/utils/formatters.js`

**Tests:**
- [FMT-1] 格式化日期应返回正确格式
- [FMT-2] 格式化时间应返回 HH:mm:ss 格式
- [FMT-3] 格式化金额应显示两位小数
- [FMT-4] 格式化用户名应处理长度截断
- [FMT-5] 格式化手机号应隐藏中间数字
- [FMT-6] 格式化相对时间应显示"刚刚、1分钟前"等
- [FMT-7] 格式化统计数字应显示"1.2k、1.2m"等
- [FMT-8] 格式化文本应处理特殊字符转义

### Task 1.4: Validators 工具测试 (8 个测试)

**Files:**
- Create: `miniprogram/__tests__/utils/validators.spec.js`
- Reference: `miniprogram/utils/validators.js`

**Tests:**
- [VAL-1] 验证邮箱格式正确性
- [VAL-2] 验证手机号格式正确性
- [VAL-3] 验证密码强度（至少8字符，包含大小写和数字）
- [VAL-4] 验证 URL 格式
- [VAL-5] 验证身份证号码格式
- [VAL-6] 验证非空字段
- [VAL-7] 验证日期范围（开始日期 < 结束日期）
- [VAL-8] 验证金额范围（正数且最多两位小数）

---

## 阶段 2: 认证与用户管理 (30 个测试)

### Task 2.1: Auth Service 测试 (15 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/auth.service.spec.js`
- Reference: `miniprogram/services/auth.service.js`

**Tests:**
- [AUTH-1] 微信登录应调用 wx.login 获取 code
- [AUTH-2] 登录成功应返回 token 和用户信息
- [AUTH-3] 登录失败应返回错误信息
- [AUTH-4] 应自动保存 token 到本地存储
- [AUTH-5] 应自动保存用户信息到本地存储
- [AUTH-6] Token 过期应自动刷新
- [AUTH-7] 登出应清除 token 和用户信息
- [AUTH-8] 应检查 token 有效性（验证过期时间）
- [AUTH-9] 应支持静默登录（如果已有有效 token）
- [AUTH-10] 应处理登录被拒绝的情况（用户取消授权）
- [AUTH-11] 应支持获取用户授权状态
- [AUTH-12] 应正确处理多次登录请求（防重复）
- [AUTH-13] Token 刷新应更新本地存储
- [AUTH-14] 应支持清除所有认证信息
- [AUTH-15] 登录后应自动更新用户档案

### Task 2.2: User Service 测试 (15 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/user.service.spec.js`
- Reference: `miniprogram/services/user.service.js`

**Tests:**
- [USER-1] 获取当前用户信息应返回用户对象
- [USER-2] 获取用户信息应包含所有必要字段（_id、nickname、avatar等）
- [USER-3] 更新用户昵称应成功
- [USER-4] 更新用户头像应成功
- [USER-5] 更新用户信息应刷新本地缓存
- [USER-6] 获取用户列表应支持分页
- [USER-7] 获取用户列表应支持搜索（按昵称）
- [USER-8] 获取他人用户信息应成功
- [USER-9] 获取用户统计信息（打卡数、insights 数等）
- [USER-10] 关注用户应成功
- [USER-11] 取消关注用户应成功
- [USER-12] 获取关注列表应成功
- [USER-13] 获取粉丝列表应成功
- [USER-14] 用户信息缓存应在指定时间后过期
- [USER-15] 禁用用户不应能登录

---

## 阶段 3: 报名流程 (35 个测试)

### Task 3.1: Enrollment Service 测试 (20 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/enrollment.service.spec.js`
- Reference: `miniprogram/services/enrollment.service.js`

**Tests:**
- [ENROLL-1] 获取期次列表应返回期次数组
- [ENROLL-2] 期次列表应按开始日期排序
- [ENROLL-3] 获取期次详情应返回完整信息
- [ENROLL-4] 提交报名应返回报名记录
- [ENROLL-5] 报名应包含用户 ID 和期次 ID
- [ENROLL-6] 重复报名应返回错误
- [ENROLL-7] 获取我的报名列表应只返回当前用户的报名
- [ENROLL-8] 报名列表应支持按状态筛选（待审批、已批准、已拒绝）
- [ENROLL-9] 报名列表应支持分页
- [ENROLL-10] 取消报名应成功
- [ENROLL-11] 取消报名应在状态为待审批或已批准时才能执行
- [ENROLL-12] 已拒绝的报名无法取消
- [ENROLL-13] 获取报名统计（当前期次报名人数）
- [ENROLL-14] 报名后应自动同步到本地缓存
- [ENROLL-15] 期次满员时应返回错误
- [ENROLL-16] 应检查报名截止时间
- [ENROLL-17] 获取期次列表应显示当前用户是否已报名
- [ENROLL-18] 报名时应自动获取当前期次信息
- [ENROLL-19] 应支持批量获取多个期次信息
- [ENROLL-20] 报名状态变更应触发本地通知更新

### Task 3.2: Course Service 测试 (15 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/course.service.spec.js`
- Reference: `miniprogram/services/course.service.js`

**Tests:**
- [COURSE-1] 获取课程列表应返回按天次排序的课程
- [COURSE-2] 获取课程详情应返回完整内容
- [COURSE-3] 课程应包含 dayOfPeriod 字段表示第几天
- [COURSE-4] 获取当前期次的课程列表
- [COURSE-5] 获取课程打卡统计
- [COURSE-6] 课程内容应支持 Markdown 格式
- [COURSE-7] 获取课程的评论列表
- [COURSE-8] 获取课程的 insights 列表
- [COURSE-9] 应支持按期次和日期范围查询课程
- [COURSE-10] 课程发布状态应影响是否显示
- [COURSE-11] 课程时间信息应正确格式化
- [COURSE-12] 获取课程列表应显示每个课程的打卡状态（已打卡/未打卡）
- [COURSE-13] 课程数据应包含打卡数和 insights 数
- [COURSE-14] 应支持课程列表的本地缓存
- [COURSE-15] 课程更新应自动刷新缓存

---

## 阶段 4: 支付集成 (25 个测试)

### Task 4.1: Payment Service 测试 (25 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/payment.service.spec.js`
- Reference: `miniprogram/services/payment.service.js`

**Tests:**
- [PAY-1] 创建订单应返回订单号
- [PAY-2] 获取订单信息应返回订单详情
- [PAY-3] 订单应包含金额、期次、用户 ID 等信息
- [PAY-4] 发起支付应调用 wx.requestPayment
- [PAY-5] 支付成功应更新订单状态
- [PAY-6] 支付失败应返回错误信息
- [PAY-7] 支付取消应返回取消状态
- [PAY-8] 支付成功应自动更新报名状态为已批准
- [PAY-9] 支付成功应自动同步到本地缓存
- [PAY-10] 获取支付历史列表应返回用户的所有支付记录
- [PAY-11] 支付列表应按时间倒序排序
- [PAY-12] 支付列表应支持按状态筛选（成功、待支付、失败）
- [PAY-13] 支付列表应支持分页
- [PAY-14] 同一订单不应重复支付
- [PAY-15] 支付超时应自动取消订单
- [PAY-16] 应验证支付金额与订单金额一致
- [PAY-17] 应支持订单查询（确认支付状态）
- [PAY-18] 支付失败后应允许重新支付
- [PAY-19] 应记录支付交易 ID
- [PAY-20] 应支持发票信息保存
- [PAY-21] 获取支付统计（总收入、支付成功率等）
- [PAY-22] 应检查支付金额范围（最小 0.01 元）
- [PAY-23] 应支持支付方式选择（微信支付）
- [PAY-24] 订单创建时应记录时间戳
- [PAY-25] 已支付的订单应锁定，不允许修改

---

## 阶段 5: 打卡与内容 (30 个测试)

### Task 5.1: Checkin Service 测试 (15 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/checkin.service.spec.js`
- Reference: `miniprogram/services/checkin.service.js`

**Tests:**
- [CHECK-1] 提交打卡应返回打卡记录
- [CHECK-2] 打卡应包含课程 ID、用户 ID、时间戳
- [CHECK-3] 每个课程每个用户每天只能打卡一次
- [CHECK-4] 重复打卡应返回错误
- [CHECK-5] 打卡应保存用户笔记
- [CHECK-6] 获取打卡列表应返回用户的所有打卡记录
- [CHECK-7] 打卡列表应按时间倒序排序
- [CHECK-8] 获取打卡统计（今日打卡数、总打卡数）
- [CHECK-9] 打卡记录应显示打卡时间距离现在多久
- [CHECK-10] 应支持按课程查询打卡记录
- [CHECK-11] 应支持按期次查询打卡记录
- [CHECK-12] 打卡记录应包含关联的课程信息
- [CHECK-13] 删除打卡记录应成功（如果是自己的记录）
- [CHECK-14] 打卡成功应自动更新打卡统计
- [CHECK-15] 打卡记录应本地缓存

### Task 5.2: Course Content & Ranking 测试 (15 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/ranking.service.spec.js`
- Reference: `miniprogram/services/ranking.service.js`

**Tests:**
- [RANK-1] 获取排行榜列表应按打卡数倒序
- [RANK-2] 排行榜应显示用户昵称和头像
- [RANK-3] 排行榜应显示用户打卡数
- [RANK-4] 排行榜应显示用户排名
- [RANK-5] 应支持按期次查询排行榜
- [RANK-6] 获取当前用户在排行榜中的排名
- [RANK-7] 排行榜更新时应刷新本地缓存
- [RANK-8] 应支持周排行和月排行
- [RANK-9] 排行榜应只显示已报名的用户
- [RANK-10] 排行榜应按日期范围计算排名
- [RANK-11] 获取排行榜应支持分页
- [RANK-12] 排行榜应显示打卡进度百分比
- [RANK-13] 排行榜应支持按打卡数搜索用户
- [RANK-14] 获取排行榜缓存应在一天后过期
- [RANK-15] 排行榜变化应通过 WebSocket 实时推送

---

## 阶段 6: Insights 与社交 (40 个测试)

### Task 6.1: Insight Service 测试 (25 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/insight.service.spec.js`
- Reference: `miniprogram/services/insight.service.js`

**Tests:**
- [INSIGHT-1] 发布 insight 应返回 insight 对象
- [INSIGHT-2] Insight 应包含用户 ID、被看见人 ID、期次 ID
- [INSIGHT-3] Insight 应包含内容和发布时间
- [INSIGHT-4] 获取 insights 列表应返回按时间倒序的列表
- [INSIGHT-5] Insights 列表应支持分页
- [INSIGHT-6] 获取特定用户的 insights 列表
- [INSIGHT-7] 获取特定期次的 insights 列表
- [INSIGHT-8] 获取我收到的 insights 列表（别人发给我的）
- [INSIGHT-9] 获取我发出的 insights 列表
- [INSIGHT-10] 编辑 insight 应成功（如果是自己发布的）
- [INSIGHT-11] 其他用户不能编辑他人的 insight
- [INSIGHT-12] 删除 insight 应成功（如果是自己发布的）
- [INSIGHT-13] 获取 insight 详情应包含评论和点赞数
- [INSIGHT-14] Insight 应支持多种类型（思想分享、疑问、建议等）
- [INSIGHT-15] 发布 insight 时应验证内容非空
- [INSIGHT-16] 发布 insight 时应验证被看见人确实存在
- [INSIGHT-17] 发布 insight 时应验证期次确实存在
- [INSIGHT-18] Insight 列表应包含评论数和点赞数
- [INSIGHT-19] Insight 应包含发布者的用户信息（头像、昵称）
- [INSIGHT-20] 获取 insights 时应显示当前用户是否已点赞
- [INSIGHT-21] Insight 内容应支持 @mention 用户
- [INSIGHT-22] Insight 应自动链接课程
- [INSIGHT-23] 获取相关 insights（同期次、同用户）
- [INSIGHT-24] Insight 应支持本地草稿保存
- [INSIGHT-25] Insight 发布成功后应清除草稿

### Task 6.2: Comment & Interaction 测试 (15 个测试)

**Files:**
- Create: `miniprogram/__tests__/services/comment.service.spec.js`
- Reference: `miniprogram/services/comment.service.js`

**Tests:**
- [COMMENT-1] 发布评论应返回评论对象
- [COMMENT-2] 评论应包含 insight ID、用户 ID、内容、时间戳
- [COMMENT-3] 获取评论列表应按时间顺序排列
- [COMMENT-4] 编辑评论应成功（如果是自己发布的）
- [COMMENT-5] 删除评论应成功（如果是自己发布的）
- [COMMENT-6] 点赞 insight 应成功
- [COMMENT-7] 取消点赞应成功
- [COMMENT-8] 获取 insight 点赞列表应显示点赞人列表
- [COMMENT-9] 点赞数应实时更新
- [COMMENT-10] 获取评论列表应包含评论者的用户信息
- [COMMENT-11] 评论应支持 @mention
- [COMMENT-12] 发布评论应验证内容非空
- [COMMENT-13] 应支持删除他人对自己的 insight 的评论（moderation）
- [COMMENT-14] 评论列表应支持分页
- [COMMENT-15] 评论发布成功后应自动更新缓存

---

## 集成验证与提交

### Task 6.3: 完整测试运行与统计

**Step 1: 运行所有小程序测试**

```bash
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营
npm run test:miniprogram -- --coverage
```

**预期输出:**
```
Tests:       187 passed, 187 total
Suites:      18 test files
Coverage:    > 80% line coverage
```

**Step 2: 验证每个阶段**

- ✅ 阶段 1: 工具函数 - 30 个测试通过
- ✅ 阶段 2: 认证与用户 - 30 个测试通过
- ✅ 阶段 3: 报名流程 - 35 个测试通过
- ✅ 阶段 4: 支付集成 - 25 个测试通过
- ✅ 阶段 5: 打卡与内容 - 30 个测试通过
- ✅ 阶段 6: Insights 与社交 - 40 个测试通过

**Step 3: 管理后台二次验证清单**

为关键功能链接管理后台验证：

| 小程序用例 | 管理后台验证 |
|----------|----------|
| TC-AUTH-001（用户登录） | 用户管理 → 可查到该用户 |
| TC-ENROLL-003（报名成功） | 报名管理 → 出现新报名记录 |
| TC-PAY-001（支付成功） | 支付记录 → 状态变为已支付 |
| TC-CHECK-001（打卡成功） | 打卡管理 → 出现新打卡，今日打卡数+1 |
| TC-INSIGHT-001（发布 insight） | 小凡看见管理 → 出现新记录 |
| TC-COMMENT-001（评论） | 小凡看见 → 该条记录评论数增加 |

**Step 4: 最终提交**

```bash
git add miniprogram/__tests__/
git commit -m "test: 小程序单元测试完整实现 - 187个测试用例全覆盖

详细内容:
- 工具函数测试: request、storage、formatters、validators (30个)
- 认证层测试: auth、user services (30个)
- 报名流程测试: enrollment、course services (35个)
- 支付集成测试: payment service (25个)
- 打卡内容测试: checkin、ranking services (30个)
- 社交功能测试: insight、comment services (40个)

覆盖范围:
✅ 所有服务层 API
✅ 所有工具函数
✅ 所有业务流程
✅ 错误处理和边界情况
✅ 缓存和本地存储
✅ 与管理后台的数据一致性

🤖 Generated with Claude Code"
```

**Step 5: 验证完整性**

```bash
git log --oneline miniprogram/__tests__ | head -5
# 应显示 6+ 个提交（P0 框架 + 6 个阶段）
```

---

## 测试设计原则

1. **黑盒验证** - 测试 API 调用结果，不关心内部实现
2. **工厂模式** - 使用工厂函数生成 Mock 数据，确保数据一致
3. **独立性** - 每个测试独立运行，不依赖执行顺序
4. **完整覆盖** - 正常场景 + 错误场景 + 边界情况
5. **与后端一致** - 使用与管理后台相同的字段名和数据结构
6. **性能优化** - 测试超时设置合理，模拟网络延迟

---

## 常见测试模式

### 模式 1: 服务调用验证

```javascript
test('[AUTH-1] 微信登录应调用 wx.login 获取 code', async () => {
  const mockWx = new WxMock();
  const result = await authService.login();

  expect(result).toHaveProperty('code');
  expect(mockWx.loginToken).toBe(result.code);
});
```

### 模式 2: 缓存验证

```javascript
test('[USER-14] 用户信息缓存应在指定时间后过期', async () => {
  const user = await userService.getCurrentUser();
  expect(storageService.get('user_info')).toEqual(user);

  // 模拟时间推进
  jest.advanceTimersByTime(1 * 60 * 60 * 1000);

  // 缓存应过期
  expect(storageService.isCacheExpired('user_info')).toBe(true);
});
```

### 模式 3: 数据列表验证

```javascript
test('[ENROLL-8] 报名列表应支持按状态筛选', async () => {
  const enrollments = await enrollmentService.getMyEnrollments({
    status: 'approved'
  });

  enrollments.forEach(e => {
    expect(e.status).toBe('approved');
  });
});
```

---

## 预计工作量

- **准备工作 (P0)**: 2-3 小时
- **阶段 1-2**: 6-8 小时
- **阶段 3-4**: 8-10 小时
- **阶段 5-6**: 10-12 小时
- **集成与提交**: 2-3 小时

**总计**: 28-36 小时 (约 3-4 个工作日)

---

## 验证命令清单

```bash
# 运行所有小程序测试
npm run test:miniprogram

# Watch 模式（开发时使用）
npm run test:miniprogram:watch

# 生成覆盖率报告
npm run test:miniprogram -- --coverage

# 运行特定测试文件
npm test -- miniprogram/__tests__/services/auth.service.spec.js

# 运行特定测试用例
npm test -- --testNamePattern="AUTH-1"
```

---

> **创建者**: Claude Code
> **版本**: 1.0
> **日期**: 2026-03-04
> **状态**: 准备执行
