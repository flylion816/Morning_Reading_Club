# 多租户 SaaS 改造设计文档（实施手册）

> **文档目标**：本文档面向"按文档执行的实施者"（人工或 AI 模型）。读者无需理解原始业务，只需按章节顺序、复制粘贴代码、运行命令即可完成改造。
>
> **改造目标**：将"凡人共读"晨读营平台从单租户改造为多租户 SaaS，使其能在不复制代码的情况下承载多个独立读书会/品牌（例如未来的"超人读书会"），各租户的数据、用户、管理员、小程序壳完全隔离。
>
> **预计工时**：单人 3–5 个工作日（含数据迁移与测试）。
>
> **当前版本**：v1.4（基线时间 2026-05-10，补齐 v1.3-review 后剩余 4 个落地必踩坑：小程序真机 ws header 限制 + 短期 wsToken 方案、nginx ws upgrade 配置、连接心跳清理、legacy 模式 appId 校验冲突修正）

---

## 目录

0. [设计审查结论](#0-设计审查结论)
1. [背景与术语](#1-背景与术语)
2. [整体架构](#2-整体架构)
3. [数据模型变更（14 个业务模型 + 1 个新模型 + 1 个改造）](#3-数据模型变更)
4. [租户上下文机制（核心）](#4-租户上下文机制核心)
5. [JWT 改造](#5-jwt-改造)
6. [后端中间件与路由改造](#6-后端中间件与路由改造)
7. [Controller 审查清单](#7-controller-审查清单)
8. [管理后台改造](#8-管理后台改造)
9. [小程序改造](#9-小程序改造)
10. [数据迁移脚本（一次性）](#10-数据迁移脚本一次性)
11. [实施步骤（严格顺序，禁止跳步）](#11-实施步骤严格顺序禁止跳步)
12. [测试与验证清单](#12-测试与验证清单)
13. [常见陷阱与禁止事项](#13-常见陷阱与禁止事项)
14. [附录：完整文件位置索引](#14-附录完整文件位置索引)

---

## 0. 设计审查结论

这版方案可以作为多租户改造基础，但落地前必须先处理下面几类风险，否则容易出现跨租户数据泄漏、公开接口被误拦、迁移后唯一索引仍按老规则生效等问题。

| 风险点 | 结论 | 文档修订位置 |
|--------|------|--------------|
| tenant plugin 在无上下文查询时默认放行 | 必须改成 fail closed。HTTP 请求缺少租户上下文应直接报错，只有显式 `withSystemContext(null, ...)` 才能跨租户 | §4.3 |
| 调用方显式传入其他 `tenantId` 时 plugin 会“尊重它” | 必须拒绝或覆盖。非 bypass 场景只能使用当前 ALS 中的 tenantId | §4.3 |
| 在 `app.use('/api/v1/xxx', authMiddleware, ...)` 统一挂载 | 不适合当前项目。现有 `periods/sections/payments` 路由混有公开、用户、管理员、回调接口，统一挂载会破坏公开接口和支付回调 | §6.3 |
| 微信登录 secret 写在 `wechatPay.apiKey` | 不应混用。登录凭证和支付凭证要分开建模 | §3.1、§6.2 |
| 只修改 schema unique，没有删除数据库旧索引 | 旧唯一索引会继续生效。迁移脚本必须显式 drop/recreate 相关索引 | §10 |
| Admin 角色从 `superadmin` 改名后，现有权限判断没同步 | 需要统一兼容或迁移 `requireRole`、前端 role 判断、审计中间件 | §8 |

本文件后续章节已经按这些结论修订。实施时以 v1.4 的章节内容为准，不要再复制 v1.0/v1.1 的旧中间件和索引策略。

### 0.2 v1.3 补齐的实施盲点

v1.2-review 已经修复了多个 bug，但仍有 3 个"必然撞墙"的实施盲点未给出可执行步骤。v1.3 补齐：

| 实施盲点 | v1.2-review 状态 | v1.3 补齐 |
|----------|------------------|-----------|
| WebSocket 协议矛盾（小程序原生 ws + 后端 Socket.IO） | 仅指出"二选一"，无具体代码 | §7.4.0 给出推荐选项与决策依据；§7.4.6 给出"后端改原生 ws"的完整改造模板 |
| PM2 cluster mode 下 `io.to(...).emit(...)` 只能广播本实例 | 未提及（存量问题但多租户后影响放大） | §7.4.7 给出 socket.io-redis-adapter（继续 Socket.IO）和 Redis pub/sub 转发（原生 ws）两套实现 |
| multer 写到 uploadRoot 后再 rename 到 tenant 子目录，跨设备/竞态风险 | 用了 `fs.renameSync` 后置移动 | §7.8.1 改为 multer 动态 `destination` 函数，从一开始写到 tenant 子目录；filename 改为高熵随机名（当前 `Date.now()+rand` 可枚举） |

### 0.3 v1.4 补齐的落地必踩坑

v1.3-review 修复了多个真实 bug，但 4 类**部署期才会撞到**的问题没给到操作方案。v1.4 补齐：

| 落地必踩坑 | v1.3-review 状态 | v1.4 补齐 |
|------------|------------------|-----------|
| 微信小程序 `wx.connectSocket` header 真机限制 | 假设自定义 header 一定能传 | §7.4.5.1 给出真机验证步骤；§7.4.5.2 给出"短期 wsToken 颁发接口"（Authorization 不可用时的兜底方案）|
| nginx 反向代理未配 ws upgrade，部署后 ws 全 502 | 未提及 | §7.4.6.5 给出 nginx `/ws` location 配置 |
| 异常断连导致 `userSockets` Set 内存泄漏 | 仅依赖 `ws.on('close')` | §7.4.6.6 给出心跳 ping/pong 检测 + 30s 巡检无效连接清理 |
| `ENABLE_LEGACY_DEFAULT_TENANT=true` 时 `wechatLogin.appId` 严格相等校验导致登录大面积失败 | legacy 路径仍走严格比对 | §6.2 改为 `tenant.wxAppIds.includes(useAppId)` 校验，兼容 legacy 与多 appId 场景 |

### 0.1 v1.2 新增的跨切面改造

v1.0/v1.1 集中处理了数据层与请求层（HTTP 路由），但项目里还有 5 类"非典型业务路径"会绕开 plugin 或泄漏租户边界。v1.2 把这些补齐：

| 跨切面改造 | 风险 | 文档位置 |
|--------|------|--------------|
| WebSocket / Socket.IO 房间命名 | 当前 `user:${userId}` 房间在多租户下会跨租户串台。socket 异步回调里 ALS 会丢，需重建上下文 | §7.4、§13.2 |
| cron 定时任务（period-status / study-reminder / backup） | 没有 HTTP 请求 → 没有 ALS → 触发 fail-closed 抛错。需按租户遍历或显式 bypass | §7.5 |
| Redis 响应缓存 | 当前 cache key 仅基于 path+query，A 租户的缓存会被 B 租户读到 | §7.6 |
| Redis rate limit | 当前 key 不含 tenantId，恶意租户用户会拖累其他租户的全局/认证 quota | §7.7 |
| 文件上传路径 | 当前所有上传堆在 `uploads/` 同目录，租户隔离失效，删租户也无法清理 | §7.8 |

---

## 1. 背景与术语

### 1.1 当前架构（改造前）

- **小程序**：单一仓库 `miniprogram/`，单一微信 `appId`（生产 `wx2b9a3c1d5e4195f8`）
- **后端**：Node.js + MongoDB，14 个业务模型
- **管理后台**：Vue 3 + Element Plus，单一域名 `https://wx.shubai01.com/admin`
- **数据**：所有数据都属于"凡人共读"，无租户区分

### 1.2 改造后架构

- **数据维度**：每条业务数据带 `tenantId` 字段，运行时强制按租户过滤
- **小程序维度**：一份代码，N 个 wxAppId，启动时根据 `appId` 解析所属租户
- **管理后台维度**：一个登录入口，admin 账号绑定到 tenantId；新增 `platform_superadmin` 角色可跨租户切换
- **后端维度**：单一部署，单一数据库，通过 Mongoose plugin 在 query 层自动注入 tenantId 过滤

### 1.3 术语

| 术语 | 含义 |
|------|------|
| **Tenant（租户）** | 一个独立的读书会品牌，例如"凡人共读"、"超人读书会"。对应 `Tenant` 集合的一条记录 |
| **tenantId** | MongoDB ObjectId，所有业务数据的隔离键 |
| **slug** | 租户的人类可读短代码，例如 `fanren`、`chaoren`，仅用于 URL 与日志，不参与数据隔离 |
| **platform_superadmin** | 新增的最高权限角色，可跨租户操作（仅平台运营者持有） |
| **tenant_admin** | 旧 `superadmin` 升级而来，仅在自己租户内有最高权限 |
| **tenant context** | 单次请求的租户上下文，通过 `AsyncLocalStorage` 在 Mongoose plugin 中读取 |

### 1.4 不在本次改造范围内

- ❌ 跨租户的数据共享/聚合视图（未来需求）
- ❌ 租户级别的资源配额（用户数上限、存储上限等）
- ❌ 租户独立计费
- ❌ 租户自定义域名

> 这些功能**故意不做**，避免一次改造范围失控。改造完成后，新增上述功能只需在 Tenant 模型上加字段。

---

## 2. 整体架构

### 2.1 数据流（小程序请求）

```
小程序启动
  ↓
读取 envConfig.wxAppId（每个租户的小程序 appId 不同）
  ↓
调用 POST /api/v1/auth/wechat/login
  ↓
后端 wechatService.getOpenidFromCode(code, appId)
  → 用 appId 反查 Tenant 集合，得到 tenantId
  → 用 (openid, tenantId) 复合键查 / 创建 User
  → 生成 JWT，payload 包含 { userId, tenantId, role }
  ↓
后续所有 API 请求带 JWT
  ↓
authMiddleware 解 JWT → req.user = { userId, tenantId, role }
  ↓
tenantContextMiddleware 把 tenantId 写入 AsyncLocalStorage
  ↓
Controller 调用 Model.find({...})
  ↓
Mongoose plugin 自动注入 { tenantId: <ALS 中的值> }
  ↓
查询只命中本租户数据
```

### 2.2 数据流（管理后台请求）

```
管理员登录 POST /api/v1/auth/admin/login
  → 验证 email + password
  → 生成 JWT，payload 包含 { adminId, tenantId, role }
  ↓
后续所有 API 请求带 JWT
  ↓
adminAuthMiddleware 解 JWT → req.admin
  ↓
tenantContextMiddleware 解析 effective tenantId：
  - 若 role !== 'platform_superadmin'：用 admin.tenantId
  - 若 role === 'platform_superadmin'：
     - 若请求头有 X-Active-Tenant：用该值（必须是合法 ObjectId）
     - 否则：bypassTenantFilter = true（看全部数据）
  ↓
Controller / Model 同小程序流程
```

### 2.3 关键约束

1. **所有业务模型必须带 tenantId**（除 `Tenant` 自己、`Admin` 由特殊处理；`AuditLog` 带 tenantId，但允许 `platform_superadmin` 跨租户动作记录为 `null`）
2. **所有写入必须有 tenantId**（plugin 自动填充，缺失则报错）
3. **跨租户引用禁止**：任何 ref 字段（如 Checkin.userId → User）的指向对象必须同租户。在创建/更新时校验
4. **唯一索引必须复合 tenantId**：例如 User.openid 当前是全局唯一，改造后改为 `{tenantId, openid}` 复合唯一

---

## 3. 数据模型变更

### 3.1 新建 Tenant 模型（核心）

**新文件**：`backend/src/models/Tenant.js`

```javascript
const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema(
  {
    // 人类可读短代码，用于 URL/日志/调试，不参与数据隔离
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 32,
      match: /^[a-z][a-z0-9_-]*$/
    },
    // 显示名称
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    // 描述
    description: {
      type: String,
      default: '',
      maxlength: 500
    },
    // 微信小程序 appId 列表（一个租户允许多个小程序，例如同名小程序+订阅号）
    // 关键：用于登录时反查 tenantId
    wxAppIds: {
      type: [String],
      default: [],
      index: true
    },
    // 微信登录配置（用于 code2session，不能和支付密钥混用）
    wechatLogin: {
      appId: { type: String, default: null },
      appSecret: { type: String, default: null, select: false }
    },
    // 微信支付配置（可选，未配置则该租户无法支付）
    wechatPay: {
      mchId: { type: String, default: null },
      apiKey: { type: String, default: null, select: false },
      appId: { type: String, default: null }
    },
    // 品牌定制
    branding: {
      logo: { type: String, default: null },
      primaryColor: { type: String, default: '#4a90e2' },
      brandName: { type: String, default: null }
    },
    // 状态
    status: {
      type: String,
      enum: ['active', 'suspended', 'archived'],
      default: 'active'
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'tenants'
  }
);

// 通过 wxAppId 反查租户（登录入口热路径，必须有索引）
TenantSchema.index({ wxAppIds: 1 });
TenantSchema.index({ 'wechatLogin.appId': 1 });
TenantSchema.index({ 'wechatPay.appId': 1, 'wechatPay.mchId': 1 });

// 静态方法：通过 wxAppId 查找租户
TenantSchema.statics.findByWxAppId = async function (wxAppId) {
  if (!wxAppId) return null;
  return this.findOne({
    status: 'active',
    $or: [
      { wxAppIds: wxAppId },
      { 'wechatLogin.appId': wxAppId }
    ]
  }).lean();
};

module.exports = mongoose.model('Tenant', TenantSchema);
```

> ⚠️ **不要** 给 Tenant 自己加 tenantId 字段（会导致循环引用）。

### 3.2 14 个业务模型加 tenantId

**通用规则**：

```javascript
tenantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Tenant',
  required: true,
  index: true
}
```

**修改清单**（按文件路径）：

| 文件 | 当前 unique 索引 | 改造后 unique 索引 |
|------|-----------------|--------------------|
| `backend/src/models/User.js` | `openid` 字段级 unique | 删字段级 unique，新增复合 `{tenantId: 1, openid: 1}` unique |
| `backend/src/models/Period.js` | 无 unique | 加 tenantId 字段 + index |
| `backend/src/models/Section.js` | `{periodId, day}` unique | 改为 `{tenantId: 1, periodId: 1, day: 1}` unique |
| `backend/src/models/Checkin.js` | `{userId, periodId, checkinDate}` unique | 改为 `{tenantId: 1, userId: 1, periodId: 1, checkinDate: 1}` unique |
| `backend/src/models/Enrollment.js` | `{userId, periodId}` unique | 改为 `{tenantId: 1, userId: 1, periodId: 1}` unique |
| `backend/src/models/Payment.js` | `orderNo` 字段级 unique | 删字段级 unique，改为复合 `{tenantId: 1, orderNo: 1}` unique；支付回调必须先解析 tenant 再按 orderNo 查询 |
| `backend/src/models/Insight.js` | 无 | 加 tenantId 字段 + index |
| `backend/src/models/InsightRequest.js` | `{fromUserId, toUserId, insightId, status}` 部分 unique | 改为 `{tenantId: 1, fromUserId: 1, toUserId: 1, insightId: 1, status: 1}` 部分 unique |
| `backend/src/models/Comment.js` | 无 | 加 tenantId 字段 + index |
| `backend/src/models/Notification.js` | 无 | 加 tenantId 字段 + index |
| `backend/src/models/UserActivity.js` | 无 | 加 tenantId 字段 + index |
| `backend/src/models/SubscribeMessageGrant.js` | `{userId, scene, templateId}` unique | 改为 `{tenantId: 1, userId: 1, scene: 1, templateId: 1}` unique |
| `backend/src/models/SubscribeMessageDelivery.js` | 无 | 加 tenantId 字段 + index |
| `backend/src/models/AuditLog.js` | 无 | 加 tenantId 字段 + index |

**示例 1：User.js 改造**

定位 `backend/src/models/User.js` 的 `openid` 字段（约第 5–10 行）：

```javascript
// 改造前
openid: {
  type: String,
  required: true,
  unique: true,    // ← 删除这一行
  maxlength: 64
},
```

改为：

```javascript
openid: {
  type: String,
  required: true,
  maxlength: 64
},
```

然后在文件末尾的索引区（约第 102–105 行）后追加：

```javascript
// 多租户：tenantId + openid 复合唯一
UserSchema.index({ tenantId: 1, openid: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, createdAt: -1 });
```

并在 schema 字段定义末尾（`phoneBindAt` 之后、`}` 之前）添加：

```javascript
tenantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Tenant',
  required: true,
  index: true
}
```

**示例 2：Payment.js 改造**

定位 `orderNo` 字段（约第 77–80 行）：

```javascript
// 改造前
orderNo: {
  type: String,
  unique: true   // ← 删除
},
```

改为：

```javascript
orderNo: {
  type: String
},
```

文件末尾追加：

```javascript
PaymentSchema.index({ tenantId: 1, orderNo: 1 }, { unique: true });
PaymentSchema.index({ tenantId: 1, createdAt: -1 });
```

**示例 3：其他 12 个模型**

对每个模型只需做两件事：
1. 在 schema 定义里加 `tenantId` 字段
2. 在末尾索引区加 `Schema.index({ tenantId: 1, createdAt: -1 })`（或对应的常用查询组合）

> ⚠️ **生产数据库里旧 unique 索引必须显式删除**，否则 schema 改了也没用，MongoDB 仍会继续按旧唯一约束拦截写入。具体 drop/recreate 步骤见 §10.2。非 unique 的旧索引可以保留，但常用查询应补充以 `tenantId` 为前缀的复合索引。

### 3.3 Admin 模型改造

**修改文件**：`backend/src/models/Admin.js`

在 `loginCount` 字段（约第 53 行）后追加：

```javascript
tenantId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Tenant',
  default: null,
  index: true
  // 注意：platform_superadmin 的 tenantId 为 null
  // 其他 role 必须有 tenantId
}
```

修改 `role` 字段的 enum（约第 35 行）：

```javascript
role: {
  type: String,
  enum: ['platform_superadmin', 'tenant_admin', 'admin', 'operator', 'superadmin'],
  default: 'operator'
  // 'superadmin' 保留是为了向后兼容，迁移脚本会把它重写为 'tenant_admin'
}
```

修改 email unique 索引：当前 email 是全局 unique，改造后**保持全局 unique**（避免不同租户的 admin 用同一邮箱登录时无法区分）。**这是一个有意的限制**：管理员邮箱在整个平台唯一。

### 3.4 AuditLog 特殊说明

`AuditLog.actionType` 已包含登录登出，跨租户审计需要记录到底是谁登录了哪个租户。`tenantId` 字段允许 null（用于 platform_superadmin 在跨租户切换时）。

---

## 4. 租户上下文机制（核心）

### 4.1 设计原理

为了避免在每个 controller 中手写 `Model.find({ tenantId, ... })`（容易遗漏导致租户数据泄漏），采用 **AsyncLocalStorage（ALS）+ Mongoose Plugin** 模式：

1. **请求入口**：中间件把 `tenantId` 写入 ALS
2. **Mongoose 查询**：plugin 在 `pre('find')`、`pre('save')` 等钩子里从 ALS 读 `tenantId`，自动注入查询条件
3. **跨租户操作**：通过 ALS 的 `bypassTenantFilter` 标志显式开洞（仅供 platform_superadmin 与系统脚本使用）

### 4.2 创建 ALS 上下文工具

**新文件**：`backend/src/utils/tenantContext.js`

```javascript
const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

/**
 * 在异步上下文中运行函数，附加租户上下文
 * @param {Object} ctx { tenantId, bypassTenantFilter, actor }
 * @param {Function} fn 要在该上下文中运行的函数
 */
function runWithTenant(ctx, fn) {
  return storage.run(ctx, fn);
}

/**
 * 获取当前请求的租户上下文（可能为 undefined，调用方需判空）
 */
function getTenantContext() {
  return storage.getStore();
}

/**
 * 显式获取 tenantId（无上下文则返回 null）
 */
function getCurrentTenantId() {
  const ctx = storage.getStore();
  return ctx ? ctx.tenantId : null;
}

/**
 * 是否绕过租户过滤
 */
function shouldBypassFilter() {
  const ctx = storage.getStore();
  return !!(ctx && ctx.bypassTenantFilter);
}

module.exports = {
  runWithTenant,
  getTenantContext,
  getCurrentTenantId,
  shouldBypassFilter
};
```

### 4.3 创建 Mongoose tenant plugin

**新文件**：`backend/src/models/plugins/tenantPlugin.js`

```javascript
const { getCurrentTenantId, shouldBypassFilter } = require('../../utils/tenantContext');

function toIdString(value) {
  if (!value) return '';
  return value.toString ? value.toString() : String(value);
}

function explicitTenantValue(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    value._bsontype === 'ObjectId' ||
    value._bsontype === 'ObjectID'
  ) {
    return value;
  }
  // 只允许 { tenantId: { $eq: currentTenantId } } 这种明确等值表达式。
  // $in/$ne/$exists 等表达式一律拒绝，避免绕开租户边界。
  if (Object.prototype.hasOwnProperty.call(value, '$eq')) return value.$eq;
  return undefined;
}

function requireTenant(operation) {
  if (shouldBypassFilter()) return null;
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error(`[tenantPlugin] ${operation} 缺少 tenantId 上下文。HTTP 请求请检查路由中间件；脚本请显式使用 withSystemContext。`);
  }
  return tenantId;
}

function applyTenantToQuery(query, tenantId) {
  const filter = query.getFilter();
  if (Object.prototype.hasOwnProperty.call(filter, 'tenantId')) {
    const explicit = explicitTenantValue(filter.tenantId);
    if (!explicit || toIdString(explicit) !== toIdString(tenantId)) {
      throw new Error('[tenantPlugin] 查询条件包含非当前租户 tenantId，已拒绝');
    }
  }
  query.setQuery({ ...filter, tenantId });
}

function applyTenantToMatch(match, tenantId) {
  if (Object.prototype.hasOwnProperty.call(match, 'tenantId')) {
    const explicit = explicitTenantValue(match.tenantId);
    if (!explicit || toIdString(explicit) !== toIdString(tenantId)) {
      throw new Error('[tenantPlugin] aggregate $match 包含非当前租户 tenantId，已拒绝');
    }
  }
  match.tenantId = tenantId;
}

/**
 * 多租户隔离插件
 * 用法：在每个需要租户隔离的 Schema 上调用 schema.plugin(tenantPlugin)
 *
 * 行为：
 * 1. 所有 find/findOne/count/update/delete 自动强制为当前 ALS tenantId
 * 2. 写入（save/insertMany）时自动填充 tenantId
 * 3. shouldBypassFilter() 返回 true 时不注入（仅系统脚本、platform_superadmin 跨租户只读视图使用）
 * 4. 上下文中没有 tenantId 且非 bypass 时一律抛错，避免遗漏中间件时静默跨租户查询
 */
function tenantPlugin(schema) {
  const queryHooks = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndRemove',
    'findOneAndReplace',
    'count',
    'countDocuments',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'replaceOne'
  ];

  queryHooks.forEach((hook) => {
    schema.pre(hook, function (next) {
      try {
        if (shouldBypassFilter()) return next();
        applyTenantToQuery(this, requireTenant(hook));
        return next();
      } catch (error) {
        return next(error);
      }
    });
  });

  schema.pre('aggregate', function (next) {
    try {
      if (shouldBypassFilter()) return next();

      const tenantId = requireTenant('aggregate');
      const pipeline = this.pipeline();
      const firstStage = pipeline[0];

      if (firstStage?.$match) {
        applyTenantToMatch(firstStage.$match, tenantId);
      } else if (firstStage?.$geoNear) {
        // $geoNear 必须是第一阶段，把 tenant 放进 query，避免先跨租户算距离。
        firstStage.$geoNear.query = {
          ...(firstStage.$geoNear.query || {}),
          tenantId
        };
      } else if (firstStage?.$search || firstStage?.$vectorSearch) {
        // Atlas Search / Vector Search 必须在第一阶段，只能把 $match 放到第二阶段。
        pipeline.splice(1, 0, { $match: { tenantId } });
      } else {
        pipeline.unshift({ $match: { tenantId } });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  });

  schema.pre('save', function (next) {
    try {
      if (shouldBypassFilter()) return next();
      const tenantId = requireTenant('save');
      if (this.tenantId && toIdString(this.tenantId) !== toIdString(tenantId)) {
        return next(new Error('[tenantPlugin] save 时 tenantId 与当前上下文不一致'));
      }
      this.tenantId = this.tenantId || tenantId;
      return next();
    } catch (error) {
      return next(error);
    }
  });

  schema.pre('insertMany', function (next, docs) {
    try {
      if (shouldBypassFilter()) return next();
      const tenantId = requireTenant('insertMany');
      if (Array.isArray(docs)) {
        docs.forEach((doc) => {
          if (doc.tenantId && toIdString(doc.tenantId) !== toIdString(tenantId)) {
            throw new Error('[tenantPlugin] insertMany 中存在非当前租户数据');
          }
          doc.tenantId = doc.tenantId || tenantId;
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  });
}

module.exports = tenantPlugin;
```

> `bulkWrite`、`Model.collection.*`、`mongoose.connection.db.collection(...)` 不依赖普通查询 hook，按高风险路径处理：业务代码禁止使用；迁移/备份脚本必须包在 `withSystemContext(...)` 中，并手动带 `tenantId`。

### 4.4 在每个业务模型中启用 plugin

在 14 个业务模型文件的**末尾、`module.exports` 之前**，统一添加：

```javascript
const tenantPlugin = require('./plugins/tenantPlugin');
// ↑ 路径根据文件位置调整，模型在 backend/src/models/ 下，所以是 './plugins/tenantPlugin'

XxxSchema.plugin(tenantPlugin);
```

**注意**：`Tenant.js`（自己）和 `Admin.js` **不要**启用此 plugin。`AuditLog.js` 启用，但允许 tenantId 为 null（在 plugin 中已处理：`shouldBypassFilter` 时不强制要求）。

### 4.5 创建 tenantContext 中间件

**新文件**：`backend/src/middleware/tenantContext.js`

```javascript
const { runWithTenant } = require('../utils/tenantContext');
const mongoose = require('mongoose');

/**
 * 用户路由的租户上下文中间件
 * 必须在 authMiddleware 之后使用
 */
function userTenantContext(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }
  if (!req.user.tenantId) {
    return res.status(403).json({ code: 403, message: '令牌缺少租户信息，请重新登录' });
  }

  runWithTenant(
    {
      tenantId: new mongoose.Types.ObjectId(req.user.tenantId),
      bypassTenantFilter: false,
      actor: { type: 'user', id: req.user.userId || req.user._id }
    },
    () => next()
  );
}

/**
 * 管理后台的租户上下文中间件
 * 必须在 adminAuthMiddleware 之后使用
 *
 * 规则：
 * - 普通 admin / tenant_admin / operator：用 admin.tenantId
 * - platform_superadmin：
 *   - 若请求头 X-Active-Tenant 存在且合法：作用于该租户
 *   - 否则：bypassTenantFilter = true（看全平台）
 */
function adminTenantContext(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  const role = req.admin.role;

  // platform_superadmin 路径
  if (role === 'platform_superadmin') {
    const activeTenantHeader = req.header('X-Active-Tenant');
    if (activeTenantHeader && mongoose.Types.ObjectId.isValid(activeTenantHeader)) {
      return runWithTenant(
        {
          tenantId: new mongoose.Types.ObjectId(activeTenantHeader),
          bypassTenantFilter: false,
          actor: { type: 'admin', id: req.admin.id, role }
        },
        () => next()
      );
    }
    // 未指定具体租户：跨租户视图
    return runWithTenant(
      {
        tenantId: null,
        bypassTenantFilter: true,
        actor: { type: 'admin', id: req.admin.id, role }
      },
      () => next()
    );
  }

  // 普通 admin 路径
  if (!req.admin.tenantId) {
    return res.status(403).json({ code: 403, message: '管理员未绑定租户，请联系平台管理员' });
  }
  runWithTenant(
    {
      tenantId: new mongoose.Types.ObjectId(req.admin.tenantId),
      bypassTenantFilter: false,
      actor: { type: 'admin', id: req.admin.id, role }
    },
    () => next()
  );
}

/**
 * 系统脚本/迁移用：手动设置租户上下文
 * 仅在数据迁移、定时任务等无 HTTP 请求场景使用
 */
function withSystemContext(tenantId, fn) {
  return runWithTenant(
    {
      tenantId: tenantId ? new mongoose.Types.ObjectId(tenantId) : null,
      bypassTenantFilter: !tenantId,
      actor: { type: 'system' }
    },
    fn
  );
}

module.exports = {
  userTenantContext,
  adminTenantContext,
  withSystemContext
};
```

---

## 5. JWT 改造

### 5.1 用户 JWT 加 tenantId

**修改文件**：`backend/src/utils/jwt.js`

定位 `generateTokens` 函数（约第 47–60 行），修改 `payload`：

```javascript
function generateTokens(user) {
  const payload = {
    userId: user.id || user._id,
    openid: user.openid,
    role: user.role || 'user',
    tenantId: user.tenantId ? user.tenantId.toString() : null  // ← 新增
  };
  // ...其余不变
}
```

### 5.2 管理员 JWT 加 tenantId

**修改文件**：`backend/src/controllers/admin.controller.js`

定位 `generateToken` 函数（约第 10–18 行），修改 sign payload：

```javascript
function generateToken(admin) {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      tenantId: admin.tenantId ? admin.tenantId.toString() : null  // ← 新增
    },
    process.env.JWT_SECRET || 'dev-secret-key-12345678',
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}
```

### 5.3 兼容性考虑

老 token（不含 tenantId）在改造后会被识别为"无租户"。`userTenantContext` 中间件会返回 403，前端 request.js 会触发刷新逻辑，最终引导用户重新登录。**无需额外向下兼容代码**。

> 部署当天会有一波短暂的强制重新登录，提前在公告里说明。

### 5.4 authMiddleware 自动续期查询

当前 `backend/src/middleware/auth.js` 会在 `userTenantContext` 之前执行，并在 token 快过期时调用 `User.findById(...)` 续期。启用 fail-closed tenant plugin 后，这个查询没有 ALS 上下文会抛错。

修改方式：续期查询用 JWT 里的 `tenantId` 建立临时上下文；老 token 没有 tenantId 时跳过续期，让后续 `userTenantContext` 返回 403。

```javascript
const { withSystemContext } = require('./tenantContext');

// authMiddleware 内部，decoded 已经解析后：
if (remainingTime < thirtyMinutes && remainingTime > 0 && decoded.tenantId) {
  try {
    const user = await withSystemContext(decoded.tenantId, () =>
      User.findById(decoded.userId || decoded._id)
    );
    if (user) {
      const newTokens = generateTokens(user);
      res.setHeader('X-New-Token', newTokens.accessToken);
      res.setHeader('X-New-Refresh-Token', newTokens.refreshToken);
    }
  } catch (renewError) {
    logger.error('Token自动续期失败', renewError, { userId: decoded.userId || decoded._id });
  }
}
```

---

## 6. 后端中间件与路由改造

### 6.1 用户登录 controller 改造

**修改文件**：`backend/src/controllers/auth.controller.js`

定位 `wechatLogin` 函数。当前在调用 `wechatService.getOpenidFromCode(code)` 之前，需要先解析租户。

修改方案（伪代码，按真实代码结构执行）：

```javascript
const Tenant = require('../models/Tenant');
const { withSystemContext } = require('../middleware/tenantContext');

async function wechatLogin(req, res, next) {
  try {
    const { code, nickname, avatarUrl, gender } = req.body;
    const wxAppId = req.body.wxAppId
      || req.header('X-Wx-AppId')
      || (process.env.ENABLE_LEGACY_DEFAULT_TENANT === 'true' ? process.env.WECHAT_APPID : null);
    // ↑ 新增 wxAppId 字段

    if (!code) return res.status(400).json(errors.badRequest('缺少微信授权码'));
    if (!wxAppId) return res.status(400).json(errors.badRequest('缺少 wxAppId'));

    // 第一步：通过 wxAppId 找到租户（系统级查询，绕过租户过滤）
    const tenant = await withSystemContext(null, () => Tenant.findByWxAppId(wxAppId));
    if (!tenant) {
      return res.status(403).json(errors.forbidden(`未识别的小程序 appId: ${wxAppId}`));
    }

    // 第二步：调用微信。wxAppId 只是租户候选值，最终以 code2session 成功为准。
    // 如果客户端伪造 wxAppId，使用该租户 appSecret 调 code2session 会失败。
    const wechatResult = await wechatService.getOpenidFromCode(code, {
      appId: wxAppId,
      tenantId: tenant._id
    });
    const openid = wechatResult.openid;

    // 第三步：在租户上下文中查/建用户
    const user = await withSystemContext(tenant._id, async () => {
      let u = await User.findOne({ tenantId: tenant._id, openid });
      if (!u) {
        u = await User.create({
          tenantId: tenant._id,
          openid,
          nickname: nickname || '晨读营用户',
          avatar: '🦁',
          avatarUrl,
          gender: gender || 'unknown',
          role: 'user',
          status: 'active',
          lastLoginAt: new Date()
        });
      }
      return u;
    });

    // 第四步：生成 token（generateTokens 已经改为读 user.tenantId）
    const tokens = generateTokens(user);

    return res.json(success({ user, tokens, tenant: { _id: tenant._id, slug: tenant.slug, name: tenant.name } }));
  } catch (error) {
    // ...原有错误处理
  }
}
```

> ⚠️ `ENABLE_LEGACY_DEFAULT_TENANT=true` 只用于生产过渡期：旧版小程序尚未发布时，登录请求没有 `wxAppId`，后端临时回退到当前单租户 `WECHAT_APPID`。新版小程序覆盖稳定后必须关闭该开关，否则未来真实多小程序租户会被错误归到默认租户。

### 6.2 wechat.service.js 改造

**修改文件**：`backend/src/services/wechat.service.js`

`getOpenidFromCode` 当前从环境变量读 `WECHAT_APPID/WECHAT_SECRET`，改造后必须按租户读：

```javascript
async getOpenidFromCode(code, ctx = {}) {
  const env = process.env.NODE_ENV;
  if (env === 'development' || env === 'test') {
    return await this.getMockOpenid(code);
  }
  if (env === 'production') {
    return await this.getRealOpenid(code, ctx);
  }
  throw new Error(`未知环境: ${env}`);
}

async getRealOpenid(code, { appId, tenantId } = {}) {
  // 优先使用调用方传入的 appId（多租户路径）
  // 兼容性：未传入则回退到环境变量（仅供单租户老配置）
  const useAppId = appId || process.env.WECHAT_APPID;

  // 通过 tenantId 查 Tenant 拿登录 secret。登录凭证和支付凭证必须分开。
  const Tenant = require('../models/Tenant');
  let secret = process.env.WECHAT_SECRET;
  if (tenantId) {
    const tenant = await Tenant.findById(tenantId)
      .select('+wechatLogin.appSecret wechatLogin')
      .lean();
    secret = tenant?.wechatLogin?.appSecret || process.env.WECHAT_SECRET;
    // v1.4：放宽校验。允许 useAppId 在以下任一处出现：
    //  - tenant.wechatLogin.appId（主登录 appId）
    //  - tenant.wxAppIds[]（同租户名下多个小程序 appId）
    // 这样既能在 ENABLE_LEGACY_DEFAULT_TENANT 模式下兼容旧版小程序登录，
    // 又支持一个租户挂多个小程序壳（同名小程序+订阅号等）
    const validAppIds = new Set(
      [tenant?.wechatLogin?.appId, ...(tenant?.wxAppIds || [])].filter(Boolean)
    );
    if (validAppIds.size > 0 && !validAppIds.has(useAppId)) {
      throw new Error(`wxAppId ${useAppId} 不属于租户 ${tenant.slug || tenantId} 配置`);
    }
  }
  if (!useAppId || !secret) {
    throw new Error('租户未配置微信登录凭证');
  }

  const response = await axios.get(this.wechatApiUrl, {
    params: { appid: useAppId, secret, js_code: code, grant_type: 'authorization_code' }
  });
  if (response.data.errcode) {
    throw new Error(`微信登录失败: ${response.data.errmsg}`);
  }
  return response.data;
}
```

> ⚠️ v1.4 的放宽校验只解决 legacy 默认 appId 与 `wechatLogin.appId` 未完全同步的问题。真正的微信 `code2session` 仍然要求 **appId 与 appSecret 成对匹配**。如果一个租户未来确实要绑定多个可登录小程序 appId，`Tenant` 模型需要扩展为 `wechatLogin.apps: [{ appId, appSecret }]` 这类结构；`wxAppIds[]` 只能用于“请求归属哪个租户”的识别，不能替代登录密钥映射。

### 6.3 路由层挂载租户上下文中间件

**不要**在 `app.js` 用 `app.use('/api/v1/periods', authMiddleware, userTenantContext, periodRoutes)` 这类方式统一挂载。当前项目的 route 文件内部已经混合了公开接口、用户接口、管理员接口和支付回调，例如：

- `period.routes.js` 的 `/` 是可选登录，`/:periodId` 是公开，`/sync-status` 是管理员
- `section.routes.js` 同时有公开课节详情和登录后的今日任务
- `payment.routes.js` 的 `/wechat/callback` 是微信回调，没有 JWT，不能经过用户认证中间件

正确做法是：`app.js` 继续只挂载 route module；在具体 route 文件里，把 tenant context 放到对应的认证中间件之后。

```javascript
// backend/src/app.js 保持这种挂载方式，不在 app.use 层额外加 auth/tenant context
app.use('/api/v1/periods', periodRoutes);
app.use('/api/v1/sections', sectionRoutes);
app.use('/api/v1/checkins', checkinRoutes);
app.use('/api/v1/payments', paymentRoutes);
```

**新增公开路由的租户解析中间件**（`backend/src/middleware/tenantContext.js` 末尾追加）：

```javascript
const Tenant = require('../models/Tenant');

/**
 * 公开路由的租户上下文：从 X-Wx-AppId 请求头解析
 * 用于未登录的小程序请求（如课程列表）
 */
async function publicTenantContext(req, res, next) {
  try {
    const wxAppId = req.header('X-Wx-AppId')
      || (process.env.ENABLE_LEGACY_DEFAULT_TENANT === 'true' ? process.env.WECHAT_APPID : null);
    if (!wxAppId) {
      return res.status(400).json({ code: 400, message: '缺少 X-Wx-AppId 请求头' });
    }
    const tenant = await Tenant.findByWxAppId(wxAppId);
    if (!tenant) {
      return res.status(403).json({ code: 403, message: '未识别的小程序 appId' });
    }
    runWithTenant(
      {
        tenantId: tenant._id,
        bypassTenantFilter: false,
        actor: { type: 'anonymous' }
      },
      () => next()
    );
  } catch (error) {
    next(error);
  }
}

module.exports.publicTenantContext = publicTenantContext;

function optionalUserOrPublicTenantContext(req, res, next) {
  if (req.user) return userTenantContext(req, res, next);
  return publicTenantContext(req, res, next);
}

module.exports.optionalUserOrPublicTenantContext = optionalUserOrPublicTenantContext;
```

> **注意**：`publicTenantContext` 内部调用 `Tenant.findByWxAppId` 时还在原始上下文中（无 tenantId）。Tenant 模型未启用 plugin，所以查询不会被注入 filter，安全。

**route 文件改造示例**：

```javascript
// backend/src/routes/period.routes.js
const {
  userTenantContext,
  publicTenantContext,
  optionalUserOrPublicTenantContext
} = require('../middleware/tenantContext');

router.get('/', optionalAuthMiddleware, optionalUserOrPublicTenantContext, (req, res, next) => {
  if (req.user) return getPeriodListForUser(req, res, next);
  return getPeriodList(req, res, next);
});

router.get('/user', authMiddleware, userTenantContext, getPeriodListForUser);
router.get('/:periodId', publicTenantContext, getPeriodDetail);
router.get('/:periodId/sections', publicTenantContext, getSectionsByPeriod);

router.post(
  '/sync-status',
  authMiddleware,
  userTenantContext,
  adminMiddleware,
  syncAllPeriodsStatus
);
router.post('/', authMiddleware, userTenantContext, adminMiddleware, createPeriod);
router.put('/:periodId', authMiddleware, userTenantContext, adminMiddleware, updatePeriod);
router.delete('/:periodId', authMiddleware, userTenantContext, adminMiddleware, deletePeriod);
```

```javascript
// backend/src/routes/payment.routes.js
router.post('/wechat/callback', wechatCallback); // 不挂 userTenantContext，controller 内部解析租户
router.post('/', authMiddleware, userTenantContext, initiatePayment);
router.get('/user/:userId?', authMiddleware, userTenantContext, getUserPayments);
router.get('/:paymentId', authMiddleware, userTenantContext, getPaymentStatus);
```

支付回调 controller 内部必须先解析租户，再进入租户上下文：

```javascript
const tenant = await withSystemContext(null, () =>
  Tenant.findOne({
    'wechatPay.appId': callbackAppId,
    'wechatPay.mchId': callbackMchId,
    status: 'active'
  }).lean()
);
if (!tenant) throw new Error('未识别的微信支付租户');

const payment = await withSystemContext(tenant._id, () =>
  Payment.findOne({ orderNo: outTradeNo })
);
```

对于 `checkins`、`comments`、`notifications` 这类全部需要登录的 route，可以在文件顶部公开路由之后使用 `router.use(authMiddleware, userTenantContext)`，再注册后续用户接口。不要给微信支付回调、健康检查、登录接口挂用户租户上下文。

### 6.4 管理后台路由挂载

**修改文件**：`backend/src/routes/admin.routes.js`

定位现有 `adminAuthMiddleware`，在所有需要租户上下文的路由前添加 `adminTenantContext`。

策略：在 router 顶部统一挂载，避免逐条修改：

```javascript
const { adminTenantContext } = require('../middleware/tenantContext');

// 公开路由（不需要 auth）
router.post('/auth/admin/login', adminController.login);
router.post('/auth/admin/init', adminController.initSuperAdmin);

// 受保护路由（认证 + 租户上下文）
router.use(adminAuthMiddleware);
router.use(adminTenantContext);

// 之后所有 router.get/post/put/delete 都自动带认证和租户上下文
router.get('/auth/admin/profile', adminController.getProfile);
// ... 其余原有路由保持不变
```

同时更新 `backend/src/middleware/adminAuth.js`：

```javascript
function isPlatformRole(role) {
  return role === 'platform_superadmin' || role === 'superadmin'; // superadmin 仅迁移期兼容
}

function isTenantAdminRole(role) {
  return role === 'tenant_admin' || role === 'admin' || role === 'operator';
}

// requirePermission 中的“超级管理员拥有所有权限”应改为：
if (isPlatformRole(req.admin.role) || req.admin.role === 'tenant_admin') {
  return next();
}
```

所有现有 `requireRole('superadmin')` 的路由都要重新判断语义：平台级接口改为 `requireRole('platform_superadmin')`，租户内管理接口改为允许 `tenant_admin`。迁移期可以同时接受 `superadmin`，但迁移完成后应清理旧角色。

---

## 7. Controller 审查清单

理论上启用 Mongoose plugin 后所有 query 都自动注入 `tenantId`，**绝大多数 controller 无需修改**。但以下场景必须人工审查：

### 7.1 必须审查的场景

| 场景 | 文件特征 | 处理方式 |
|------|---------|---------|
| 直接 `Model.collection.find` 绕过 Mongoose 的 native query | 搜索 `.collection.` | 手动加 `tenantId` 过滤 |
| `bulkWrite` / `collection.bulkWrite` | 搜索 `bulkWrite` | 不依赖普通 query hook，必须封装并逐条带 tenantId |
| Aggregate pipeline 中先用 `$lookup` 后 `$match` | 搜索 `$lookup` | 必须在 `$lookup` 的 pipeline 内也加 tenant 过滤 |
| Aggregate 使用 `$geoNear` / `$search` | 搜索 `$geoNear`、`$search` | `$geoNear` 必须把 tenantId 放进 query；`$search` 后第二阶段加 `$match` |
| 涉及多个集合的事务 | 搜索 `session.startTransaction` | 确认每个 Model 操作都在同一租户上下文内 |
| 数据库管理页面（DatabaseView） | `backend/src/controllers/backup.controller.js` | platform_superadmin only，使用 bypassTenantFilter |
| 数据备份/迁移脚本 | `backend/scripts/` | 使用 `withSystemContext(null, ...)` 显式 bypass |

### 7.2 审查命令

```bash
cd backend
# 找出可能绕过 plugin 的查询
grep -rn "\.collection\." src/controllers/
grep -rn "\$lookup" src/controllers/
grep -rn "bulkWrite" src/controllers/ src/services/
grep -rn "startTransaction" src/controllers/
grep -rn "\$geoNear\|\$search" src/controllers/ src/services/
```

每发现一处，按以下原则处理：
- 如果是租户内的复杂查询：在 pipeline 第一个 `$match` 里手动加 `tenantId: getCurrentTenantId()`
- 如果是 `$lookup`：必须使用 `pipeline` 写法，在被 lookup 的集合里也加 tenant 过滤；禁止只用 `localField/foreignField`
- 如果是跨租户的系统操作：包裹在 `withSystemContext(null, async () => { ... })` 中

`$lookup` 示例：

```javascript
const tenantId = getCurrentTenantId();
await Checkin.aggregate([
  { $match: { tenantId, isPublic: true } },
  {
    $lookup: {
      from: 'users',
      let: { userId: '$userId', tenantId: '$tenantId' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$_id', '$$userId'] },
                { $eq: ['$tenantId', '$$tenantId'] }
              ]
            }
          }
        },
        { $project: { nickname: 1, avatar: 1 } }
      ],
      as: 'user'
    }
  }
]);
```

### 7.3 创建数据时的引用校验（推荐）

**新文件**：`backend/src/utils/tenantValidator.js`

```javascript
const { getCurrentTenantId } = require('./tenantContext');

/**
 * 校验引用对象是否同租户
 * @param {Model} model Mongoose 模型
 * @param {ObjectId} id 引用的文档 ID
 * @returns {Promise<boolean>}
 */
async function ensureSameTenant(model, id) {
  if (!id) return true;
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('[tenantValidator] 缺少 tenantId 上下文，拒绝引用校验');
  }

  const doc = await model.findById(id).select('tenantId').lean();
  if (!doc) {
    throw new Error(`[tenantValidator] 引用对象不存在: ${model.modelName}#${id}`);
  }
  if (doc.tenantId && doc.tenantId.toString() !== tenantId.toString()) {
    throw new Error(`[tenantValidator] 跨租户引用拒绝: ${model.modelName}#${id}`);
  }
  return true;
}

module.exports = { ensureSameTenant };
```

**使用示例**（在 `checkin.controller.js` 创建打卡前）：

```javascript
const { ensureSameTenant } = require('../utils/tenantValidator');
const Period = require('../models/Period');
const Section = require('../models/Section');

async function createCheckin(req, res) {
  const { periodId, sectionId, ... } = req.body;
  await ensureSameTenant(Period, periodId);
  await ensureSameTenant(Section, sectionId);
  // ...原有创建逻辑
}
```

> 这是防御性编程，正常情况下小程序不会传跨租户 ID（因为它本身就只能登录到一个租户）。但一旦攻击者构造请求，校验能阻止数据污染。

### 7.4 WebSocket / Socket.IO 多租户改造

**背景**：`backend/src/utils/websocket.js` 的 `WebSocketManager` 用 `user:${userId}` 命名房间、维护 `userSockets` Map。多租户下两个租户允许出现同 `userId`（理论上极小概率，但跨租户 ObjectId 不应假设全局唯一），且 emit 调用方一般在 controller 里没有重新建立 ALS 上下文（socket 回调链路与 HTTP 请求是两条独立 async 链）。必须改造。

#### 7.4.0 ⚠️ 前置决策：协议二选一（必须先做）

**当前协议矛盾**：

- 后端：`backend/src/server.js` 用 `socket.io` 包，`new Server(server, ...)` 启动 Socket.IO server
- 小程序：`miniprogram/services/websocket.service.js` 用 `wx.connectSocket(...)` 走原生 WebSocket 协议

**Socket.IO ≠ 原生 WebSocket**。Socket.IO 在 WebSocket 之上加了自己的握手协议、packet 编码（`0`/`40`/`42[...]`）、心跳格式、命名空间。原生 WebSocket client 连 Socket.IO server 必然失败。

**这意味着**：当前生产环境的 WebSocket 通信**很可能本来就走不通**——这是多租户改造之前就存在的存量问题。多租户改造里如果不一并解决，后续推送/通知功能始终是坏的。

**推荐选择：后端改原生 `ws`**

| 维度 | 选 Socket.IO（小程序端用 weapp.socket.io） | 选原生 `ws`（后端改造） |
|------|--------------------------------------------|---------------------|
| 第三方依赖风险 | 高：weapp.socket.io / wx.socket.io 多年未更新，社区维护断断续续 | 低：`ws` 是 Node 生态标准库，小程序端不需要任何包 |
| 多端一致性 | 后续做 Web 端简单（Socket.IO 浏览器 client 完善） | 后续做 Web 端要自实现重连/心跳 |
| 代码改动量 | 小程序端：换 client + 适配构建工具 | 后端：替换 `socket.io` 为 `ws`，重写 io.use/io.on/io.to |
| 房间/广播 | 内置 `socket.join` / `io.to(room).emit` | 需自己维护房间 Map（`Map<room, Set<ws>>`） |
| 多实例广播 | 用 `@socket.io/redis-adapter` 一行配置 | 自实现 Redis pub/sub 转发（§7.4.7） |
| 当前业务消息 | 房间/广播多 → Socket.IO 友好 | 业务只有"给单用户推通知"+"租户公告" → 原生足够 |

**结论**：因为业务只用到"按 `tenantId+userId` 单推" + "租户公告"两类操作，原生 `ws` + 自维护房间 Map 完全够用，且彻底摆脱 weapp.socket.io 这种历史包袱。**v1.3 默认按原生 `ws` 方案给出完整代码**（§7.4.6）。

如果团队坚持继续用 Socket.IO，§7.4.1–§7.4.4 的代码示例可以直接复用（写法相同），但小程序端必须按 §7.4.5 的备选方案引入 weapp.socket.io，且 §7.4.7 的多实例广播改用 redis-adapter。

#### 7.4.1 后端：握手时校验 JWT，挂 tenantId 到 socket.data

**修改文件**：`backend/src/utils/websocket.js`

在 `WebSocketManager` 构造函数后、`initializeEvents` 之前增加握手中间件：

```javascript
const { verifyAccessToken } = require('./jwt');
const { runWithTenant } = require('./tenantContext');

class WebSocketManager {
  constructor(io) {
    this.io = io;
    // key: `${tenantId}:${userId}` → Set<socketId>
    this.userSockets = new Map();
    // socketId → { tenantId, userId }
    this.socketUsers = new Map();

    this._installAuthMiddleware();
    this.initializeEvents();
  }

  _installAuthMiddleware() {
    if (!this.io) return;
    this.io.use((socket, next) => {
      try {
        const auth = socket.handshake.auth?.token
          || (socket.handshake.headers.authorization || '').replace(/^Bearer /, '');
        if (!auth) return next(new Error('未提供认证令牌'));
        const decoded = verifyAccessToken(auth);
        if (!decoded.tenantId) return next(new Error('令牌缺少 tenantId'));
        socket.data.tenantId = decoded.tenantId;
        socket.data.userId = decoded.userId || decoded._id;
        return next();
      } catch (err) {
        return next(new Error('认证失败：' + err.message));
      }
    });
  }
```

#### 7.4.2 房间名加 tenant 维度，所有 emit 必须经过 ALS 包裹

```javascript
  initializeEvents() {
    if (!this.io) return;

    this.io.on('connection', socket => {
      const { tenantId, userId } = socket.data;
      const key = `${tenantId}:${userId}`;
      const room = `tenant:${tenantId}:user:${userId}`;

      socket.join(room);
      socket.join(`tenant:${tenantId}`); // 租户级公告房间
      if (!this.userSockets.has(key)) this.userSockets.set(key, new Set());
      this.userSockets.get(key).add(socket.id);
      this.socketUsers.set(socket.id, { tenantId, userId });

      logger.info('WebSocket 连接建立', { tenantId, userId, socketId: socket.id });

      // 客户端不再需要单独发 user:join，握手时已认证完毕
      socket.emit('user:joined', { status: 'success', userId });

      // 业务事件回调里如果要查 DB，必须重建 ALS 上下文，否则会触发 fail-closed
      socket.on('client:some_event', (payload) => {
        Promise.resolve(
          runWithTenant(
            { tenantId, bypassTenantFilter: false, actor: { type: 'user', id: userId, channel: 'ws' } },
            async () => {
              // ...在这里做需要 DB 查询的业务
            }
          )
        ).catch(error => {
          logger.error('WebSocket 业务事件处理失败', error, { tenantId, userId, event: 'client:some_event' });
          socket.emit('error', { message: '处理失败' });
        });
      });

      socket.on('disconnect', () => {
        const info = this.socketUsers.get(socket.id);
        if (info) {
          const k = `${info.tenantId}:${info.userId}`;
          const set = this.userSockets.get(k);
          if (set) {
            set.delete(socket.id);
            if (set.size === 0) this.userSockets.delete(k);
          }
        }
        this.socketUsers.delete(socket.id);
      });

      socket.on('ping', () => socket.emit('pong'));
      socket.on('error', error => logger.error('Socket 错误', error, { socketId: socket.id }));
    });
  }
```

#### 7.4.3 推送方法签名加 tenantId

所有 `pushNotificationToUser`、`pushNotificationToUsers`、`isUserOnline`、`getUserSocketCount`、`broadcastNotification` 都必须显式接收 `tenantId`。**禁止** `io.emit(...)` 无差别广播。

```javascript
  pushNotificationToUser(tenantId, userId, notification) {
    const room = `tenant:${tenantId}:user:${userId}`;
    this.io.to(room).emit('notification:new', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  pushNotificationToTenant(tenantId, notification) {
    // 仅在确实需要给整个租户广播时使用，例如租户级公告
    this.io.to(`tenant:${tenantId}`).emit('notification:tenant', {
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  // 移除 broadcastNotification(...)。如果一定要保留，仅供 platform_superadmin 使用，
  // 在调用处显式日志记录跨租户广播事件。
  isUserOnline(tenantId, userId) {
    const set = this.userSockets.get(`${tenantId}:${userId}`);
    return !!(set && set.size > 0);
  }
```

#### 7.4.4 调用方改造（notification.controller.js 等）

所有调用 `pushNotificationToUser(userId, ...)` 的位置必须改为带 `tenantId`：

```javascript
const { getCurrentTenantId } = require('../utils/tenantContext');

const tenantId = getCurrentTenantId();
wsManager.pushNotificationToUser(tenantId, userId, { type: 'comment_received', data: {...} });
```

`getCurrentTenantId` 在 HTTP 请求中由 `userTenantContext` 已注入；在 cron / 后台任务中调用方需自行传入。

#### 7.4.5 小程序端：握手带 token（按所选协议分两套）

**修改文件**：`miniprogram/services/websocket.service.js`

**A. 选原生 `ws`（推荐）**：保留当前 `wx.connectSocket`，先做以下基础改动；认证方式按 §7.4.5.1/§7.4.5.2 决策，生产建议默认启用 wsToken。

1. **保留 `Authorization` header 作为优先路径**（当前已有，确认），但不要把它当作唯一认证方式：

   ```javascript
   this.socket = wx.connectSocket({
     url: socketUrl,
     header: {
       Authorization: `Bearer ${wx.getStorageSync(constants.STORAGE_KEYS.TOKEN)}`
     }
   });
   ```

2. **登录前禁止建连**：在 `connect(userId)` 函数顶部加守卫：

   ```javascript
   const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);
   if (!token) {
     logger.warn('[WebSocket] 未登录，跳过连接');
     return Promise.reject(new Error('未登录'));
   }
   ```

3. **删除/不再发送 `user:join` 事件**：后端在握手时已经从 JWT 解析 `tenantId/userId`，无需客户端再发 `user:join`。

4. **消息 envelope 继续使用现有 `type` 字段**：当前小程序 `handleMessage` 按 `{ type: 'notification:new', ...payload }` 分发；后端原生 `ws` 模板必须保持这个格式，或同步改造小程序解析逻辑。本文后续模板默认保持 `type` 格式，避免协议二次迁移。

**B. 选 Socket.IO**：需引入小程序可用的 Socket.IO client（如 `weapp.socket.io`），改写 connect 流程：

```javascript
const io = require('weapp.socket.io');  // 需小程序构建工具支持 npm
const socket = io(socketUrl, {
  transports: ['websocket'],
  auth: { token: wx.getStorageSync(constants.STORAGE_KEYS.TOKEN) }
});
```

**两种方案共同要做**：在 `WebSocketService` 类中加切租户断连方法（防止开发者工具切 appId 时 token 残留）：

```javascript
disconnectAndClearForTenantSwitch() {
  this.manualClose = true;
  this.allowReconnect = false;  // ← 关键：不允许自动重连
  if (this.socket) this.socket.close({ code: 1000, reason: 'tenant switch' });
  this.isConnected = false;
  this.userId = null;
  this.eventListeners.clear();
  this.messageQueue = [];
}
```

> ⚠️ `allowReconnect` 设为 `false` 后，在下次 `loginPage.onLogin` 成功 callback 内必须显式调用 `wsService.connect(userId, { allowReconnect: true })` 重新建连，否则 ws 永远不会自动连。

##### 7.4.5.1 ⚠️ 真机 header 限制必须先验证

`wx.connectSocket` 的自定义 header 在不同基础库版本和不同手机平台上**表现不一致**：

- 开发者工具：`Authorization` header 一定能传（直接走 Node WebSocket）
- 真机 iOS / Android：部分基础库版本会**忽略**自定义 header，握手时后端 `req.headers['authorization']` 为空
- 现象：开发者工具一切正常，真机用户全部连不上 ws，但前端不报错（一直在重连）

如果团队想只用 header、省掉 `/auth/ws-token` 这一次 HTTP 请求，必须先做下面的强制验证；否则直接按 §7.4.5.2 上 wsToken，不要赌真机兼容性。

**强制验证步骤**（在 §7.4.6 后端部署到测试环境后立即做）：

1. 真机扫码进入小程序，触发登录与 ws 连接
2. 后端日志看 `WebSocket 握手失败 reason=未提供认证令牌` 出现频率
3. 如果真机几乎全失败 → 必须切到 §7.4.5.2 的 wsToken 方案

##### 7.4.5.2 兜底方案：短期 wsToken 颁发接口（推荐默认启用）

如果真机 header 不可靠，**不要**直接打开 `WS_ALLOW_QUERY_TOKEN=true` 把 access token 放 query——access token 长期有效，写到 nginx access log 里就是持久化泄漏。

正确做法：颁发一个**只用于 ws 握手、30 秒有效、一次性消费**的短期 wsToken。

###### 后端：新增 wsToken 颁发接口

**修改文件 1**：`backend/src/utils/redis.js` 增加原子 `SET NX EX` 工具，用于 wsToken 一次性消费：

```javascript
async setNxEx(key, seconds, value) {
  try {
    if (!this.isConnected || !this.client) {
      const existing = this.memoryCache.get(key);
      if (existing && existing.expireAt > Date.now()) return false;
      this.memoryCache.set(key, {
        data: value,
        expireAt: Date.now() + seconds * 1000
      });
      return true;
    }
    const result = await this.client.set(key, value, { NX: true, EX: seconds });
    return result === 'OK';
  } catch (error) {
    logger.error('Redis setNxEx 操作失败', error, { key, seconds });
    return false;
  }
}
```

> 生产多实例下必须使用 Redis；内存 fallback 只适合本地开发，不能保证 PM2 多进程间的一次性消费。

**修改文件 2**：`backend/src/utils/jwt.js` 末尾追加：

```javascript
const crypto = require('crypto');
const redisManager = require('./redis');

const WS_TOKEN_TTL_SECONDS = 30;

function generateWsToken(user) {
  const jti = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  return jwt.sign(
    {
      userId: user.id || user._id,
      tenantId: user.tenantId ? user.tenantId.toString() : null,
      kind: 'ws',  // ← 关键：标记为 ws 专用，verifyWsToken 拒绝其他 kind
      jti          // ← 一次性消费凭证
    },
    process.env.JWT_WS_SECRET || process.env.JWT_SECRET || 'dev-secret-key-12345678',
    { expiresIn: WS_TOKEN_TTL_SECONDS }
  );
}

function verifyWsToken(token) {
  const secret = process.env.JWT_WS_SECRET || process.env.JWT_SECRET || 'dev-secret-key-12345678';
  const decoded = jwt.verify(token, secret);
  if (decoded.kind !== 'ws') throw new Error('非 ws token');
  return decoded;
}

async function consumeWsToken(token) {
  const decoded = verifyWsToken(token);
  if (!decoded.jti) throw new Error('ws token 缺少 jti');

  const key = `ws-token:used:${decoded.jti}`;
  const ok = await redisManager.setNxEx(key, WS_TOKEN_TTL_SECONDS, '1');
  if (!ok) throw new Error('ws token 已使用或消费记录写入失败');
  return decoded;
}

module.exports.generateWsToken = generateWsToken;
module.exports.verifyWsToken = verifyWsToken;
module.exports.consumeWsToken = consumeWsToken;
module.exports.WS_TOKEN_TTL_SECONDS = WS_TOKEN_TTL_SECONDS;
```

**新增路由**：`backend/src/routes/auth.routes.js`（在已有受保护路由区追加）

```javascript
const { generateWsToken, WS_TOKEN_TTL_SECONDS } = require('../utils/jwt');

router.post(
  '/ws-token',
  authMiddleware,         // 必须已登录
  userTenantContext,
  (req, res) => {
    const wsToken = generateWsToken({
      _id: req.user.userId || req.user._id,
      tenantId: req.user.tenantId
    });
    res.json({
      code: 0,
      data: { wsToken, expiresIn: WS_TOKEN_TTL_SECONDS }
    });
  }
);
```

###### 后端：握手时同时支持 Authorization header 和 wsToken query

修改 §7.4.6 第 3 步的 `_installAuthAndConnection`，握手解 token 部分改为：

```javascript
const { verifyAccessToken, consumeWsToken } = require('./jwt');

// ...
this.wss.on('connection', async (ws, req) => {
  try {
    let decoded = null;

    // 优先：Authorization header（开发者工具 / 部分真机）
    const headerAuth = req.headers['authorization'] || '';
    const headerToken = headerAuth.replace(/^Bearer /, '');
    if (headerToken) {
      decoded = verifyAccessToken(headerToken);
    }

    // 兜底：query 中的短期 wsToken（真机 header 不可用时）
    if (!decoded) {
      const parsed = url.parse(req.url, true);
      const wsToken = parsed.query.wsToken;
      if (wsToken) decoded = await consumeWsToken(wsToken);
    }

    if (!decoded) throw new Error('未提供认证令牌');
    if (!decoded.tenantId) throw new Error('令牌缺少 tenantId');
    // ... 后续 tenantId/userId 解析与房间加入逻辑不变
  } catch (err) {
    logger.warn('WebSocket 握手失败', { reason: err.message });
    ws.close(1008, err.message);
  }
});
```

> ⚠️ 不再使用 `WS_ALLOW_QUERY_TOKEN` 模式（access token 进 query），用 wsToken 模式替代。如果项目里之前已经设置过这个 env，部署时记得移除。

###### 小程序：握手前先换 wsToken

**修改文件**：`miniprogram/services/websocket.service.js` 的 `connect(userId, options)`

```javascript
const request = require('../utils/request');

async connect(userId, options = {}) {
  const accessToken = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);
  if (!accessToken) {
    return Promise.reject(new Error('未登录'));
  }

  // 第一步：用 access token 换短期 wsToken（30 秒有效）
  let wsToken;
  try {
    const res = await request.post('/auth/ws-token');
    wsToken = res.wsToken;
  } catch (err) {
    logger.error('[WebSocket] 获取 wsToken 失败', err);
    return Promise.reject(err);
  }

  // 第二步：拼 ws URL，wsToken 走 query
  const apiUrl = envConfig.apiBaseUrl;
  const socketUrl = apiUrl
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
    .replace('/api/v1', '') + `/ws?wsToken=${encodeURIComponent(wsToken)}`;

  // 第三步：建立连接（不再依赖 header；真机/工具行为一致）
  this.socket = wx.connectSocket({ url: socketUrl });
  // ...其余 onOpen/onMessage/onClose 处理保持不变
}
```

> 优点：
> - wsToken 30 秒后失效，且握手成功消费后不能再次使用；即使写入 nginx access log，也只剩极短窗口风险
> - 真机 / 开发者工具行为统一，不依赖 `wx.connectSocket` 的 header 兼容性
> - 重连时自动换新 wsToken（每次 `connect()` 都先调 `/auth/ws-token`）
>
> 缺点：每次 ws 重连多 1 次 HTTP 调用，但 30 秒 TTL 足以覆盖建连+握手时延，极端场景才会过期。

#### 7.4.6 选项 B（推荐）：后端改原生 `ws` 完整模板

如果按 §7.4.0 选择"后端改原生 `ws`"，按以下步骤完整替换 `backend/src/utils/websocket.js`：

**1. 安装 ws 库，移除 socket.io**

```bash
cd backend
npm uninstall socket.io
npm install ws
```

**2. 改写 `backend/src/server.js` 的 socket 初始化**

定位 `const { Server } = require('socket.io');` 区域（约第 42 行），替换为：

```javascript
const { WebSocketServer } = require('ws');
const WebSocketManager = require('./utils/websocket');
```

同时删除只服务 Socket.IO 的 import / 配置，例如 `getSocketIoCorsOptions`。如果需要限制 WebSocket 来源，原生 `ws` 要在 `server.on('upgrade', ...)` 层校验 `Origin`，不能复用 Socket.IO 的 `cors` 配置项。

定位 `const io = new Server(server, {...})` 区域（约第 156 行），替换为：

```javascript
// 初始化 WebSocket（原生 ws）
const wss = new WebSocketServer({ server, path: '/ws' });
const wsManager = new WebSocketManager(wss);
app.locals.wsManager = wsManager;
logger.info('✅ WebSocket (native ws) 已初始化');
```

> ⚠️ 路径 `/ws` 必须与小程序 `wx.connectSocket` 拼接的 URL 一致：当前 `services/websocket.service.js` 用 `apiBaseUrl.replace('/api/v1','')` 拼接，需要改为 `${apiBaseUrl.replace('/api/v1','')}/ws`。

**3. 完整替换 `backend/src/utils/websocket.js`**

```javascript
const url = require('url');
const { WebSocket } = require('ws');
const { verifyAccessToken, consumeWsToken } = require('./jwt');
const { runWithTenant } = require('./tenantContext');
const logger = require('./logger');

class WebSocketManager {
  constructor(wss) {
    this.wss = wss;
    // key: `${tenantId}:${userId}` → Set<ws>
    this.userSockets = new Map();
    // key: `tenant:${tenantId}` → Set<ws>
    this.tenantRooms = new Map();
    // ws → { tenantId, userId }
    this.socketUsers = new WeakMap();

    this._installAuthAndConnection();
  }

  _installAuthAndConnection() {
    if (!this.wss) return;

    // 原生 ws 没有"中间件"概念，只能在 connection 回调里手动校验，
    // 校验失败立即 ws.close()。这意味着从 client 视角，连接先建立、再被关闭。
    // 如需在握手前拒绝，要改为 server.on('upgrade', ...) 手动处理 HTTP upgrade。
    this.wss.on('connection', async (ws, req) => {
      try {
        let decoded = null;

        // 优先从 Authorization header 取 access token（开发者工具 / 部分真机）
        const headerAuth = req.headers['authorization'] || '';
        const headerToken = headerAuth.replace(/^Bearer /, '');
        if (headerToken) {
          decoded = verifyAccessToken(headerToken);
        }

        // 兜底从 query 取一次性短期 wsToken（真机 header 不可用时）
        if (!decoded) {
          const parsed = url.parse(req.url, true);
          const wsToken = parsed.query.wsToken;
          if (wsToken) decoded = await consumeWsToken(wsToken);
        }

        if (!decoded) throw new Error('未提供认证令牌');
        if (!decoded.tenantId) throw new Error('令牌缺少 tenantId');

        const tenantId = String(decoded.tenantId);
        const userId = String(decoded.userId || decoded._id);
        const userKey = `${tenantId}:${userId}`;
        const tenantKey = `tenant:${tenantId}`;

        // 加入用户房间和租户房间
        if (!this.userSockets.has(userKey)) this.userSockets.set(userKey, new Set());
        this.userSockets.get(userKey).add(ws);
        if (!this.tenantRooms.has(tenantKey)) this.tenantRooms.set(tenantKey, new Set());
        this.tenantRooms.get(tenantKey).add(ws);
        this.socketUsers.set(ws, { tenantId, userId });

        logger.info('WebSocket 连接建立', { tenantId, userId });
        this._send(ws, { type: 'user:joined', status: 'success', userId });

        ws.on('message', (raw) => this._handleMessage(ws, raw));
        ws.on('close', () => this._handleClose(ws));
        ws.on('error', (err) => logger.error('WebSocket 错误', err, { tenantId, userId }));
      } catch (err) {
        logger.warn('WebSocket 握手失败', { reason: err.message });
        ws.close(1008, err.message); // 1008 = Policy Violation
      }
    });
  }

  _send(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  _handleMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
    const type = msg.type || msg.event; // 兼容少量历史 event 写法
    if (type === 'ping') return this._send(ws, { type: 'pong' });

    const ctx = this.socketUsers.get(ws);
    if (!ctx) return;

    // 业务事件必须在 ALS 里运行，错误要 catch 防止 unhandledRejection
    Promise.resolve(
      runWithTenant(
        { tenantId: ctx.tenantId, bypassTenantFilter: false, actor: { type: 'user', id: ctx.userId, channel: 'ws' } },
        async () => {
          // 在这里按 type 路由到具体 handler
          // 例如：if (type === 'client:read_notification') { ... }
        }
      )
    ).catch((error) => {
      logger.error('WebSocket 业务事件失败', error, { ...ctx, type });
      this._send(ws, { type: 'error', message: '处理失败' });
    });
  }

  _handleClose(ws) {
    const ctx = this.socketUsers.get(ws);
    if (!ctx) return;
    const userKey = `${ctx.tenantId}:${ctx.userId}`;
    const tenantKey = `tenant:${ctx.tenantId}`;
    const userSet = this.userSockets.get(userKey);
    if (userSet) {
      userSet.delete(ws);
      if (userSet.size === 0) this.userSockets.delete(userKey);
    }
    const tenantSet = this.tenantRooms.get(tenantKey);
    if (tenantSet) {
      tenantSet.delete(ws);
      if (tenantSet.size === 0) this.tenantRooms.delete(tenantKey);
    }
  }

  // === 推送方法 ===

  pushNotificationToUser(tenantId, userId, notification) {
    const set = this.userSockets.get(`${tenantId}:${userId}`);
    const data = { ...notification, timestamp: new Date().toISOString() };
    const payload = { type: 'notification:new', ...data };
    let sent = 0;
    if (set) set.forEach((ws) => { this._send(ws, payload); sent += 1; });

    // 多实例广播：每次都转发给其他实例；订阅端按 sender 跳过本实例，避免本地重复
    this._publishToOtherInstances('user', { tenantId, userId, notification: data });
    return sent;
  }

  pushNotificationToTenant(tenantId, notification) {
    const set = this.tenantRooms.get(`tenant:${tenantId}`);
    const data = { ...notification, timestamp: new Date().toISOString() };
    const payload = { type: 'notification:tenant', ...data };
    let sent = 0;
    if (set) set.forEach((ws) => { this._send(ws, payload); sent += 1; });

    // 跨实例转发（每个实例都会广播给本地连接，避免漏播）
    this._publishToOtherInstances('tenant', { tenantId, notification: data });
    return sent;
  }

  isUserOnline(tenantId, userId) {
    const set = this.userSockets.get(`${tenantId}:${userId}`);
    return !!(set && set.size > 0);
  }

  // 多实例广播 hook（在 §7.4.7 注入实现）
  _publishToOtherInstances(_kind, _payload) {
    // 默认空实现，由 ws-pubsub.js 在启动时通过 wsManager.setPubSub(...) 注入
  }
  setPubSub(pubsub) { this._publishToOtherInstances = pubsub; }
}

module.exports = WebSocketManager;
```

**4. 调用方改动**

所有用 `app.locals.io` 的位置（搜索 `app.locals.io`）都要改为 `app.locals.wsManager`。原 `io.to(...).emit(...)` 全部改为 `wsManager.pushNotificationToUser(tenantId, userId, ...)` 或 `wsManager.pushNotificationToTenant(tenantId, ...)`。

**5. nginx 反向代理配置（必做，否则 ws 全部 502）**

原生 ws 通过 HTTP Upgrade 协议升级，nginx 默认会拒绝 / 不正确转发。生产环境必须显式配置 `/ws` location：

```nginx
# /etc/nginx/sites-enabled/wx.shubai01.com.conf
upstream morning_reading_backend {
  server 127.0.0.1:3000;
  keepalive 32;
}

server {
  listen 443 ssl http2;
  server_name wx.shubai01.com;

  # ===== WebSocket 专用 location（必须在通用 / location 之前）=====
  location /ws {
    proxy_pass http://morning_reading_backend;
    proxy_http_version 1.1;

    # 关键：转发 Upgrade / Connection header，否则 nginx 会按普通 HTTP 处理直接断开
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # 透传客户端信息
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 长连接超时（默认 60s 会主动断开 ws，必须放大）
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    # 禁用缓冲，让 ws 消息实时通过
    proxy_buffering off;
  }

  # 普通 HTTP API
  location / {
    proxy_pass http://morning_reading_backend;
    proxy_set_header Host $host;
    # ... 原有配置
  }
}
```

**验证 nginx 配置生效**：

```bash
# 在服务器上
sudo nginx -t  # 语法检查
sudo systemctl reload nginx

# 用 wscat 测试连接（不需要小程序）
npx wscat -c "wss://wx.shubai01.com/ws?wsToken=<手动颁发的wsToken>"
# 期望：显示 Connected (press CTRL+C to quit)
# 错误：HTTP 502 → upgrade header 没配；HTTP 401/403 → wsToken 错；timeout → upstream 端口错
```

> ⚠️ PM2 cluster mode 下 4 个 Node 实例监听同一端口时，**不需要** sticky session（ws 升级后绑定单个 worker，不再切换实例），但跨实例广播必须靠 §7.4.7 的 Redis pub/sub。

**6. 心跳与无效连接清理（防止内存泄漏）**

异常断连场景（手机进入飞行模式、强杀进程、TCP FIN 丢包）下，`ws.on('close')` 不会触发，`userSockets`/`tenantRooms` Map 中的 ws 引用永远不会被清理。长期累积会导致：

- 内存膨胀（每条无效连接占用 ~10KB）
- 推送时遍历无效连接，浪费 CPU
- 连接计数失真，监控指标失真

**心跳 + 巡检方案**（在 `WebSocketManager` 构造函数末尾追加）：

```javascript
class WebSocketManager {
  constructor(wss) {
    this.wss = wss;
    this.userSockets = new Map();
    this.tenantRooms = new Map();
    this.socketUsers = new WeakMap();

    this._installAuthAndConnection();
    this._installHeartbeat();   // ← 新增
  }

  _installHeartbeat() {
    if (!this.wss) return;

    // 1. 每个新连接初始化 isAlive 标志，pong 时重置
    this.wss.on('connection', (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
    });

    // 2. 每 30 秒巡检一次：
    //    - 上一轮没回 pong → 视为已死，强制 terminate（触发 close 事件清理 Map）
    //    - 还活着 → 标记为 false，发 ping，等下一轮验证
    this._heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.warn('WebSocket 心跳超时，强制断开', this.socketUsers.get(ws) || {});
          return ws.terminate();
        }
        ws.isAlive = false;
        try { ws.ping(); } catch (_) { /* 已断开的连接 ping 会抛错，忽略 */ }
      });
    }, 30000);

    this.wss.on('close', () => clearInterval(this._heartbeatInterval));
  }

  // ...其余方法不变
}
```

> 注意：
> - `ws.terminate()` 会立即关闭并触发 `close` 事件，由 §7.4.6 第 3 步的 `_handleClose` 自动从 `userSockets`/`tenantRooms` 清理
> - 心跳间隔 30 秒是经验值。太短（< 10s）浪费带宽；太长（> 60s）nginx 默认 60s `proxy_read_timeout` 会主动断开。配合上面 nginx 配的 3600s 后，30s 是安全的
> - 微信小程序客户端**不需要**做任何改动，`wx.connectSocket` 默认会响应 ping/pong（基础 ws 协议帧）

#### 7.4.7 PM2 cluster mode 多实例广播

**问题**：项目部署用 PM2 cluster 4 实例，每个 Node 进程持有部分 ws 连接。若用户 A 的 ws 落在实例 #1，业务在实例 #3 触发 `pushNotificationToUser(tenantA, userA, ...)`，**实例 #3 找不到 A 的 socket，消息直接丢失**。这是存量问题，多租户改造后必须一并解决。

##### 7.4.7-A. 选 Socket.IO：用官方 redis-adapter

```bash
cd backend
npm install @socket.io/redis-adapter redis
```

`server.js` 初始化 `io` 后追加：

```javascript
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

之后 `io.to(room).emit(...)` 自动跨实例广播。**不需要修改 §7.4.3 推送方法签名**。

##### 7.4.7-B. 选原生 `ws`：自实现 Redis pub/sub 转发

```bash
cd backend
npm install ioredis
```

**新文件**：`backend/src/utils/ws-pubsub.js`

```javascript
const Redis = require('ioredis');
const logger = require('./logger');

const CHANNEL = 'ws:broadcast';

/**
 * 给 WebSocketManager 装上多实例广播能力
 * 调用方式（在 server.js wsManager 创建后）：
 *   const { initWsPubSub } = require('./utils/ws-pubsub');
 *   initWsPubSub(wsManager);
 */
function initWsPubSub(wsManager) {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('[ws-pubsub] REDIS_URL 未配置，跳过多实例广播');
    return;
  }
  const pub = new Redis(url);
  const sub = new Redis(url);

  // 订阅：收到其他实例的转发，投递给本实例的 ws 连接
  sub.subscribe(CHANNEL, (err) => {
    if (err) logger.error('[ws-pubsub] subscribe 失败', err);
  });
  sub.on('message', (channel, raw) => {
    if (channel !== CHANNEL) return;
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    // 加 sender 字段防止自己广播自己又收到（实际多实例下不会回到原实例，但单实例 e2e 测试时会）
    if (msg.sender === process.pid) return;

    if (msg.kind === 'user') {
      const set = wsManager.userSockets.get(`${msg.tenantId}:${msg.userId}`);
      if (set) set.forEach((ws) => wsManager._send(ws, { type: 'notification:new', ...msg.notification }));
    } else if (msg.kind === 'tenant') {
      const set = wsManager.tenantRooms.get(`tenant:${msg.tenantId}`);
      if (set) set.forEach((ws) => wsManager._send(ws, { type: 'notification:tenant', ...msg.notification }));
    }
  });

  // 发布：注入到 wsManager._publishToOtherInstances
  wsManager.setPubSub((kind, payload) => {
    pub.publish(CHANNEL, JSON.stringify({ kind, sender: process.pid, ...payload }))
       .catch((err) => logger.error('[ws-pubsub] publish 失败', err));
  });

  logger.info('✅ ws-pubsub 已启动（多实例广播）');
}

module.exports = { initWsPubSub };
```

`server.js` 在 `wsManager` 创建后追加：

```javascript
const { initWsPubSub } = require('./utils/ws-pubsub');
initWsPubSub(wsManager);
```

> ⚠️ §7.4.6 实现里 `pushNotificationToUser` 和 `pushNotificationToTenant` 都必须**每次**发布到 Redis。原因是同一个用户可能多设备在线，连接分散在多个 PM2 实例；如果只在本实例找不到 socket 时才发布，其他实例上的连接会漏收。订阅端通过 `sender` 跳过本实例，避免本地重复投递。
>
> 如果业务以"租户级公告"为主，且租户在线用户基数大，可以再给 payload 增加 `messageId`，由客户端或服务端做幂等去重；默认实现通过 `sender` 跳过发布实例，已能避免本实例重复投递。

#### 7.4.8 调用方代码改造（必读）

无论选哪种协议，所有原 `wsManager.pushNotificationToUser(userId, ...)` 调用必须加 `tenantId` 参数。改造步骤：

```bash
cd backend
grep -rn "pushNotificationToUser\|broadcastNotification\|isUserOnline" src/
```

每一处都按以下模板改：

```javascript
// 改前
wsManager.pushNotificationToUser(userId, { type: 'comment_received', data: {...} });

// 改后
const { getCurrentTenantId } = require('../utils/tenantContext');
const tenantId = getCurrentTenantId();
if (!tenantId) {
  // HTTP 请求里不应出现，但 cron/系统脚本里可能；显式传入
  throw new Error('缺少租户上下文');
}
wsManager.pushNotificationToUser(tenantId, userId, { type: 'comment_received', data: {...} });
```

cron / 系统任务里调用时必须显式传 tenantId（参考 §7.5）。

### 7.5 cron 定时任务的租户化改造

**背景**：项目使用 `node-cron` 注册了 3 个定时任务：

| 文件 | 任务 | 当前实现假设 |
|------|------|--------------|
| `backend/src/services/period-status.service.js` | 每天定时刷新所有期次状态 | `Period.find({})` 全表扫描 |
| `backend/src/services/study-reminder.service.js` | 次日学习提醒推送 | `SubscribeMessageGrant.find(...)` 不带租户 |
| `backend/src/services/backup.service.js` | 每天凌晨数据备份 | 跨集合全量备份 |

启用 fail-closed plugin 后，三者会因为没有 ALS 上下文立即抛错。改造原则：

- **跨租户全量任务**（如 backup、period-status 这类按对象本身状态计算的任务）：用 `withSystemContext(null, ...)` 绕过过滤
- **租户内业务任务**（如 study-reminder 涉及给具体用户发推）：必须按租户分组遍历，每个租户用 `withSystemContext(tenantId, ...)` 包裹

#### 7.5.1 period-status.service.js 改造

`syncAllPeriodsStatus` 改为：

```javascript
const { withSystemContext } = require('../middleware/tenantContext');

async function syncAllPeriodsStatus({ now = new Date(), emitSyncEvent = true } = {}) {
  return withSystemContext(null, async () => {
    const periods = await Period.find({}).select('_id tenantId name status startDate endDate');
    let updatedCount = 0;
    const updates = [];

    for (const period of periods) {
      const expectedStatus = calculatePeriodStatus(period, now);
      if (period.status !== expectedStatus) {
        const oldStatus = period.status;
        // 单条 save 必须切换到该 period 的 tenant 上下文，让 plugin 校验通过
        await withSystemContext(period.tenantId, async () => {
          period.status = expectedStatus;
          await period.save();
        });
        updatedCount += 1;
        updates.push({
          tenantId: period.tenantId.toString(),
          periodId: period._id.toString(),
          periodName: period.name,
          oldStatus,
          newStatus: expectedStatus
        });
      }
    }
    return { updatedCount, updates };
  });
}
```

#### 7.5.2 study-reminder.service.js 改造

`sendDueNextDayStudyReminders` 内部调用 `SubscribeMessageGrant.find(...)`、`Enrollment.find(...)`、`Period.findById(...)` 等，都会被 plugin 拦截。

改造方式：先用 bypass 拿到所有待发送 grant 的 `tenantId` 列表，再按租户分组发送。

```javascript
const { withSystemContext } = require('../middleware/tenantContext');

async function sendDueNextDayStudyReminders({ attemptType = 'scheduled' } = {}) {
  const now = new Date();
  // 第一步：跨租户拿出所有"到期未发送"的 grant，只读 tenantId 和 _id
  const allDueIds = await withSystemContext(null, () =>
    SubscribeMessageGrant.find({
      scene: SCENE,
      templateId: sceneConfig.templateId,
      availableCount: { $gt: 0 },
      scheduledSendDate: { $lte: now },
      $or: [{ retryAt: null }, { retryAt: { $lte: now } }]
    })
      .select('_id tenantId')
      .lean()
  );

  // 第二步：按 tenantId 分组
  const byTenant = new Map();
  for (const item of allDueIds) {
    const key = item.tenantId.toString();
    if (!byTenant.has(key)) byTenant.set(key, []);
    byTenant.get(key).push(item._id);
  }

  // 第三步：每个租户独立发送
  for (const [tenantId, ids] of byTenant) {
    await withSystemContext(tenantId, async () => {
      const grants = await SubscribeMessageGrant.find({ _id: { $in: ids } });
      for (const grant of grants) {
        await sendOneReminder(grant, { attemptType });
      }
    });
  }
}
```

> ⚠️ `sendOneReminder` 内部也会查 Enrollment/Period/Section/User，必须确保它**始终**在 `withSystemContext(tenantId, ...)` 链路里被调用，否则会抛错。

#### 7.5.3 backup.service.js 改造

数据备份本质上是跨租户操作（备份所有数据），统一在 `withSystemContext(null, ...)` 里跑：

```javascript
const { withSystemContext } = require('../middleware/tenantContext');

async function performMongoBackup() {
  return withSystemContext(null, async () => {
    // 原有 mongodump 逻辑
  });
}

async function performMysqlSync() {
  return withSystemContext(null, async () => {
    // 原有同步逻辑
    // 注意：如果 sync 涉及"按租户拆分备份文件"，则改为按租户分组
  });
}
```

未来如果租户管理员需要"只备份本租户数据"，应单独提供 controller 接口，由 `adminTenantContext` 注入 tenantId 后调用专用方法。

#### 7.5.4 通用 cron 改造模板

**新建辅助文件**：`backend/src/utils/tenantCron.js`

```javascript
const { withSystemContext } = require('../middleware/tenantContext');
const Tenant = require('../models/Tenant');

/**
 * 对所有活跃租户依次执行 fn(tenantId)
 * 用于"按租户独立处理"的定时任务
 */
async function forEachActiveTenant(fn) {
  const tenants = await withSystemContext(null, () =>
    Tenant.find({ status: 'active' }).select('_id slug').lean()
  );
  const results = [];
  for (const t of tenants) {
    try {
      const r = await withSystemContext(t._id, () => fn(t._id, t.slug));
      results.push({ tenantId: t._id, slug: t.slug, ok: true, value: r });
    } catch (err) {
      results.push({ tenantId: t._id, slug: t.slug, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = { forEachActiveTenant };
```

> 任何新增的定时任务都先问：是租户内任务还是跨租户任务？租户内必须用 `forEachActiveTenant`，跨租户用 `withSystemContext(null, ...)`，没有第三种合法方式。

### 7.6 Redis 响应缓存的租户隔离

**背景**：`backend/src/middleware/cache.js` 当前默认 keyGenerator：

```javascript
`cache:${req.path}:${JSON.stringify(req.query)}`
```

A 租户用户 GET `/api/v1/periods` 命中缓存后，B 租户同路径请求会**直接读到 A 租户的数据**。这是严重的数据泄漏，必须修复。

#### 7.6.1 cache.js 改造

```javascript
const redisManager = require('../utils/redis');
const logger = require('../utils/logger');
const { getCurrentTenantId } = require('../utils/tenantContext');

function buildDefaultKey(req) {
  const tenantId = getCurrentTenantId();
  // 公开接口（如 /health）确实可能没有租户上下文
  // 但已挂 publicTenantContext 的接口 tenantId 必然存在
  // 没上下文的接口绝不能用响应缓存（可能跨租户）—— 直接拒绝缓存
  if (!tenantId) {
    return null;
  }
  return `cache:tenant:${tenantId}:${req.path}:${JSON.stringify(req.query)}`;
}

function cacheMiddleware(options = {}) {
  const { ttl = 300, keyGenerator, enabled = true } = options;

  return async (req, res, next) => {
    if (!enabled || req.method !== 'GET') return next();

    try {
      const cacheKey = keyGenerator ? keyGenerator(req) : buildDefaultKey(req);
      if (!cacheKey) {
        // 没有租户上下文 → 不缓存（也不报错，让请求正常通过）
        res.set('X-Cache', 'SKIP_NO_TENANT');
        return next();
      }
      // ...原有逻辑不变
    } catch (error) {
      logger.warn('缓存中间件执行失败', { error: error.message });
      next();
    }
  };
}
```

#### 7.6.2 cacheInvalidationMiddleware 改造

当前 `redisManager.mDel(keys)` 只能删除明确 key，不能把 `cache:xxx:*` 当通配符删除。先在 `redisManager` 增加按前缀删除工具，再让失效逻辑使用租户前缀：

```javascript
// backend/src/utils/redis.js
async delByPrefix(prefix) {
  if (!this.isConnected || !this.client) {
    let count = 0;
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith(prefix) && this.memoryCache.delete(key)) count += 1;
    }
    return count;
  }

  let cursor = 0;
  let deleted = 0;
  do {
    const reply = await this.client.scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 });
    cursor = Number(reply.cursor);
    if (reply.keys.length > 0) {
      deleted += await this.client.del(reply.keys);
    }
  } while (cursor !== 0);
  return deleted;
}
```

`cacheInvalidationMiddleware`：

```javascript
function cacheInvalidationMiddleware(patterns = []) {
  return async (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const tenantId = getCurrentTenantId();
        if (tenantId) {
          patterns.forEach(pattern => {
            redisManager.delByPrefix(`cache:tenant:${tenantId}:${pattern}`)
              .catch(err => logger.warn('缓存清除失败', { error: err.message }));
          });
        }
      }
      return originalJson.call(this, data);
    };
    next();
  };
}
```

#### 7.6.3 自定义 keyGenerator 的调用方审查

凡是调用 `cacheMiddleware({ keyGenerator: (req) => '...' })` 的位置（搜索 `keyGenerator`），都必须改为读 `getCurrentTenantId()` 拼到 key 前缀。建议封装一个工具函数：

```javascript
// backend/src/utils/cacheKey.js
const { getCurrentTenantId } = require('./tenantContext');

function tenantCacheKey(suffix) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('[cache] 缺少 tenantId 上下文，无法生成缓存 key');
  return `cache:tenant:${tenantId}:${suffix}`;
}

module.exports = { tenantCacheKey };
```

调用方：

```javascript
const { tenantCacheKey } = require('../utils/cacheKey');

router.get(
  '/periods',
  publicTenantContext,
  cacheMiddleware({
    keyGenerator: (req) => tenantCacheKey(`periods:list:${req.query.page || 1}`),
    ttl: 600
  }),
  getPeriodList
);
```

### 7.7 Redis Rate Limit 的租户隔离

**背景**：`backend/src/middleware/ratelimit.js` 提供了三个预设：

- `globalRateLimit` 用 key `ratelimit:global:all`：**全平台共享配额**，A 租户高频访问会拖累 B 租户
- `userRateLimit` 用 key `ratelimit:user:${req.user?._id || req.ip}`：未登录时 fallback 到 IP，多个租户的同 IP 用户会互相拖累
- `authRateLimit` 用 key `ratelimit:auth:${req.ip}`：登录端点按 IP 限流，跨租户共享；改造后应拆成纯 IP 兜底 + wxAppId/IP 细粒度限流

#### 7.7.1 ratelimit.js 改造

```javascript
const { getCurrentTenantId } = require('../utils/tenantContext');

// 全局限流：拆成"每租户配额"和"全平台兜底"双层
const tenantGlobalRateLimit = rateLimitMiddleware({
  windowMs: 60000,
  maxRequests: 1000,
  keyGenerator: (req) => {
    const tenantId = getCurrentTenantId();
    return tenantId ? `ratelimit:tenant:${tenantId}:all` : `ratelimit:global:all`;
  },
  enabled: true
});

const platformGlobalRateLimit = rateLimitMiddleware({
  windowMs: 60000,
  maxRequests: 5000,  // 全平台兜底，远大于单租户配额
  keyGenerator: (_req) => 'ratelimit:platform:all',
  enabled: true
});

// 用户限流：必须带 tenantId
const userRateLimit = rateLimitMiddleware({
  windowMs: 60000,
  maxRequests: 100,
  keyGenerator: (req) => {
    const tenantId = getCurrentTenantId();
    const subject = req.user?._id || req.ip;
    return tenantId
      ? `ratelimit:tenant:${tenantId}:user:${subject}`
      : `ratelimit:anonymous:${subject}`;
  },
  enabled: true
});

// 认证端点第一层：纯 IP 兜底。wxAppId 来自客户端，不能只依赖 wxAppId+IP，否则可伪造 appId 绕过。
const authIpRateLimit = rateLimitMiddleware({
  windowMs: 300000,
  maxRequests: 20,
  keyGenerator: (req) => `ratelimit:auth:ip:${req.ip}`,
  enabled: true
});

// 认证端点第二层：登录请求里 tenantId 还没确定，但 wxAppId 已知；用 wxAppId+IP 做更细粒度配额
const authRateLimit = rateLimitMiddleware({
  windowMs: 300000,
  maxRequests: 5,
  keyGenerator: (req) => {
    const wxAppId = req.body?.wxAppId
      || req.header('X-Wx-AppId')
      || (process.env.ENABLE_LEGACY_DEFAULT_TENANT === 'true' ? process.env.WECHAT_APPID : null)
      || 'unknown';
    return `ratelimit:auth:${wxAppId}:${req.ip}`;
  },
  enabled: true
});

module.exports = {
  rateLimitMiddleware,
  tenantGlobalRateLimit,
  platformGlobalRateLimit,
  userRateLimit,
  authIpRateLimit,
  authRateLimit
};
```

#### 7.7.2 替换调用方

`platformGlobalRateLimit` 可以挂在 `app.js` 顶层，作为全平台兜底；`tenantGlobalRateLimit` 和 `userRateLimit` 依赖 ALS，必须挂在 `publicTenantContext/userTenantContext/adminTenantContext` 之后，不能直接放在所有路由之前。

```javascript
// app.js 顶层：只放不依赖 tenant context 的平台兜底
app.use(platformGlobalRateLimit);

// 公开路由：先解析租户，再做租户级限流
router.get('/', publicTenantContext, tenantGlobalRateLimit, cacheMiddleware(...), getPeriodList);

// 用户路由：先认证并写入 ALS，再做用户级限流
router.post('/', authMiddleware, userTenantContext, tenantGlobalRateLimit, userRateLimit, createCheckin);

// 登录路由：此时还没有 tenantId，先做纯 IP 兜底，再做 wxAppId + IP
router.post('/wechat/login', authIpRateLimit, authRateLimit, wechatLogin);
```

如果某个限流必须放在 `app.js` 顶层，则 keyGenerator 不能依赖 `getCurrentTenantId()`，只能从 `Authorization` 解 JWT 或从 `X-Wx-AppId` 推导租户，但这会重复认证逻辑，不推荐。

### 7.8 文件上传按租户隔离

**背景**：`backend/src/controllers/upload.controller.js` 当前所有文件平铺到 `backend/uploads/` 目录，访问 URL `/uploads/${filename}`。多租户下：

- 不同租户文件混在同一目录，难以审计
- 删除租户时无法批量清理对应文件
- 租户 A 用户可以拼 URL 访问租户 B 的文件（如果 filename 可枚举）

#### 7.8.1 upload.routes.js 与 upload.controller.js 改造

**关键设计修正（v1.3）**：v1.2-review 让 multer 先把文件写到 `uploadRoot`，再在 controller 里 `fs.renameSync` 移到 tenant 子目录。两个隐患：

1. **EXDEV 跨设备风险**：如果 multer dest 配在 `/tmp` 或别的挂载点，`renameSync` 会抛 `EXDEV: cross-device link not permitted`
2. **filename 可枚举**：当前代码用 `Date.now()-Math.round(Math.random()*1e9)`（约 30 bit 熵），攻击者可枚举猜测其他用户文件 URL

**v1.3 改为**：multer 用动态 `destination` 函数从一开始就写到 tenant 子目录，filename 用 `crypto.randomBytes(16)`（128 bit 熵，不可枚举）。

##### 7.8.1.1 upload.routes.js 完整重写

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uploadController = require('../controllers/upload.controller');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { adminTenantContext } = require('../middleware/tenantContext');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { withSystemContext } = require('../middleware/tenantContext');
const Tenant = require('../models/Tenant');
const { errors } = require('../utils/response');

const router = express.Router();

const uploadRoot = path.join(__dirname, '../../uploads');
const tenantsRoot = path.join(uploadRoot, 'tenants');
if (!fs.existsSync(tenantsRoot)) fs.mkdirSync(tenantsRoot, { recursive: true });

// === slug 缓存（5 分钟 TTL） ===
const slugCache = new Map();  // tenantId → { slug, expiresAt }
const SLUG_TTL = 5 * 60 * 1000;

async function resolveTenantSlug(tenantId) {
  const key = tenantId.toString();
  const now = Date.now();
  const hit = slugCache.get(key);
  if (hit && hit.expiresAt > now) return hit.slug;
  const t = await withSystemContext(null, () =>
    Tenant.findById(tenantId).select('slug').lean()
  );
  if (!t) throw new Error('租户不存在');
  slugCache.set(key, { slug: t.slug, expiresAt: now + SLUG_TTL });
  return t.slug;
}

function ensureTenantDir(slug) {
  const dir = path.join(tenantsRoot, slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// === multer 动态 destination：从一开始就写到 tenant 子目录 ===
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return cb(new Error('缺少租户上下文'));
      const slug = await resolveTenantSlug(tenantId);
      cb(null, ensureTenantDir(slug));
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // 高熵随机 filename：128 bit 不可枚举
    const random = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${random}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|mp4|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) return cb(null, true);
  cb(new Error('不支持的文件类型'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// === 前置中间件：platform_superadmin 必须先选 X-Active-Tenant 才能上传 ===
function requireActiveTenantForUpload(req, res, next) {
  if (!getCurrentTenantId()) {
    return res.status(403).json(errors.forbidden('上传前必须选择具体租户（platform_superadmin 需设置 X-Active-Tenant）'));
  }
  next();
}

// 必须按这个顺序：认证 → 租户上下文 → 校验有 tenantId → 才进入 multer
router.post(
  '/',
  adminAuthMiddleware,
  adminTenantContext,
  requireActiveTenantForUpload,
  upload.single('file'),
  uploadController.uploadFile
);

router.post(
  '/multiple',
  adminAuthMiddleware,
  adminTenantContext,
  requireActiveTenantForUpload,
  upload.array('files', 10),
  uploadController.uploadMultiple
);

router.delete(
  '/:filename',
  adminAuthMiddleware,
  adminTenantContext,
  requireActiveTenantForUpload,
  uploadController.deleteFile
);

module.exports = router;
```

##### 7.8.1.2 upload.controller.js 简化（multer 已写到正确位置，无需 rename）

由于 multer 在 §7.8.1.1 已经把文件写到 `uploads/tenants/<slug>/`，controller 不再需要 `fs.renameSync`。**`req.file.path` 此时已经是最终位置**。

```javascript
const path = require('path');
const fs = require('fs');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { getCurrentTenantId } = require('../utils/tenantContext');
const Tenant = require('../models/Tenant');
const { withSystemContext } = require('../middleware/tenantContext');

const uploadRoot = path.join(__dirname, '../../uploads');
const tenantsRoot = path.join(uploadRoot, 'tenants');

// 与 upload.routes.js 共享的 slug 缓存（实现重复，可抽到 utils；为保持示例独立性这里复制）
const slugCache = new Map();
const SLUG_TTL = 5 * 60 * 1000;
async function resolveTenantSlug(tenantId) {
  const key = tenantId.toString();
  const now = Date.now();
  const hit = slugCache.get(key);
  if (hit && hit.expiresAt > now) return hit.slug;
  const t = await withSystemContext(null, () =>
    Tenant.findById(tenantId).select('slug').lean()
  );
  if (!t) throw new Error('租户不存在');
  slugCache.set(key, { slug: t.slug, expiresAt: now + SLUG_TTL });
  return t.slug;
}

module.exports = {
  uploadFile: async (req, res) => {
    try {
      if (!req.file) return res.status(400).json(errors.badRequest('未找到上传的文件'));
      const tenantId = getCurrentTenantId();
      const slug = await resolveTenantSlug(tenantId);
      // multer 已经写到 /uploads/tenants/<slug>/<filename>，无需移动
      res.json(success({
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/tenants/${slug}/${req.file.filename}`,
        uploadedAt: new Date()
      }, '文件上传成功'));
    } catch (err) {
      logger.error('File upload error:', err);
      res.status(500).json(errors.internalServerError('文件上传失败'));
    }
  },

  uploadMultiple: async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json(errors.badRequest('未找到上传的文件'));
      }
      const tenantId = getCurrentTenantId();
      const slug = await resolveTenantSlug(tenantId);
      const uploadedFiles = req.files.map(file => ({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: `/uploads/tenants/${slug}/${file.filename}`,
        uploadedAt: new Date()
      }));
      res.json(success({ files: uploadedFiles, count: uploadedFiles.length }, '文件上传成功'));
    } catch (err) {
      logger.error('Multiple files upload error:', err);
      res.status(500).json(errors.internalServerError('文件上传失败'));
    }
  },

  deleteFile: async (req, res) => {
    try {
      const { filename } = req.params;
      if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json(errors.badRequest('无效的文件名'));
      }
      const tenantId = getCurrentTenantId();
      const slug = await resolveTenantSlug(tenantId);
      const tenantDir = path.join(tenantsRoot, slug);
      const filePath = path.join(tenantDir, filename);

      // 严格限制：只能删本租户目录下的文件（防 path traversal）
      if (!filePath.startsWith(tenantDir + path.sep)) {
        return res.status(400).json(errors.badRequest('无效的文件路径'));
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json(errors.notFound('文件不存在'));
      }
      fs.unlinkSync(filePath);
      res.json(success(null, '文件删除成功'));
    } catch (err) {
      logger.error('File deletion error:', err);
      res.status(500).json(errors.internalServerError('文件删除失败'));
    }
  }
};
```

#### 7.8.2 静态资源路由配置

图片、头像、富文本里的 `<img>` 或小程序 `<image>` 请求通常不能附带 `X-Wx-AppId` / `Authorization` 自定义头，所以不能直接把 `publicTenantContext` 放在静态图片访问链路上，否则前端图片会 403。

当前更稳妥的策略：

- 上传目录按租户 slug 分开：`uploads/tenants/<slug>/<filename>`
- URL 带 slug：`/uploads/tenants/<slug>/<filename>`
- filename 使用高熵随机名，避免枚举
- 这些 URL 视为“公开可读的静态资源 URL”。如果未来有私密文件，不能走 `express.static`，必须改成带签名/短期 token 的下载接口

`app.js` 静态路由应这样挂，注意 root 必须是 `uploads/tenants`，不能是 `uploads`。这是**替换**旧的 `app.use('/uploads', express.static(...))`，不要两个同时保留；否则旧路径仍可能暴露未迁移的根目录文件。

```javascript
const uploadRoot = path.join(__dirname, '../uploads');

app.use(
  '/uploads/tenants',
  express.static(path.join(uploadRoot, 'tenants'), {
    fallthrough: false,
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
  })
);
```

如果必须做严格租户授权，不要使用上面的静态路由，改为：

```javascript
app.get('/api/v1/files/:slug/:filename', authMiddleware, userTenantContext, async (req, res) => {
  // 校验当前 tenant.slug === req.params.slug，再用 res.sendFile 返回
});
```

#### 7.8.3 已有数据迁移

迁移脚本 `migrate-to-multi-tenant.js` 末尾追加：将 `backend/uploads/*` 下的所有文件移动到 `backend/uploads/tenants/fanren/` 目录：

```javascript
const fsExtra = require('fs');
const pathLib = require('path');
const uploadDir = pathLib.join(__dirname, '../uploads');
const fanrenDir = pathLib.join(uploadDir, 'tenants', 'fanren');
if (!fsExtra.existsSync(fanrenDir)) fsExtra.mkdirSync(fanrenDir, { recursive: true });
const items = fsExtra.readdirSync(uploadDir);
let moved = 0;
for (const name of items) {
  if (name === 'tenants') continue;
  const oldPath = pathLib.join(uploadDir, name);
  const stat = fsExtra.statSync(oldPath);
  if (stat.isFile()) {
    fsExtra.renameSync(oldPath, pathLib.join(fanrenDir, name));
    moved += 1;
  }
}
console.log(`[migrate] uploads 文件迁移: ${moved} 个`);
```

> ⚠️ 现有数据库里如果保存了旧 URL `/uploads/${filename}`（在 Insight.imageUrl、User.avatarUrl、Checkin.images 等字段），还要写一个 SQL/Mongo 命令把这些 URL 重写成 `/uploads/tenants/fanren/${filename}`。否则前端会 404。
>
> 除了下面示例里的字段，还要审查富文本和媒体字段：`Section.content`、`Section.description`、`Section.audioUrl`、`Section.videoCover`、`Period` 相关封面字段、`Comment.content`、`Notification.content` 等。只要保存过 `/uploads/...`，都要重写。

```javascript
// 在 migrate 脚本里追加
const Insight = require('../src/models/Insight');
const User = require('../src/models/User');
const Checkin = require('../src/models/Checkin');

await withSystemContext(null, async () => {
  await Insight.updateMany(
    { imageUrl: { $regex: /^\/uploads\/[^/]+$/ } },
    [{ $set: { imageUrl: { $replaceOne: { input: '$imageUrl', find: '/uploads/', replacement: '/uploads/tenants/fanren/' } } } }]
  );
  await User.updateMany(
    { avatarUrl: { $regex: /^\/uploads\/[^/]+$/ } },
    [{ $set: { avatarUrl: { $replaceOne: { input: '$avatarUrl', find: '/uploads/', replacement: '/uploads/tenants/fanren/' } } } }]
  );
  // Checkin.images 是数组，需要 $map
  await Checkin.updateMany(
    { 'images.0': { $regex: /^\/uploads\/[^/]+$/ } },
    [{
      $set: {
        images: {
          $map: {
            input: '$images',
            as: 'u',
            in: {
              $cond: [
                { $regexMatch: { input: '$$u', regex: /^\/uploads\/[^/]+$/ } },
                { $replaceOne: { input: '$$u', find: '/uploads/', replacement: '/uploads/tenants/fanren/' } },
                '$$u'
              ]
            }
          }
        }
      }
    }]
  );
});
```

> `$replaceOne` 与 `$regexMatch` 需要 MongoDB 4.4+；如果版本更老，改用 JS 端遍历重写。

---

## 8. 管理后台改造

### 8.1 admin Controller 改造

**修改文件**：`backend/src/controllers/admin.controller.js`

#### 8.1.1 创建 admin 时强制带 tenantId

定位 `createAdmin` 函数，在参数验证后增加：

```javascript
exports.createAdmin = async (req, res) => {
  const { name, email, password, role, permissions, tenantId } = req.body;

  // platform_superadmin 不需要 tenantId
  if (role !== 'platform_superadmin' && !tenantId) {
    return res.status(400).json(errors.badRequest('普通管理员必须指定 tenantId'));
  }

  // 只有 platform_superadmin 可以创建 platform_superadmin
  if (role === 'platform_superadmin' && req.admin.role !== 'platform_superadmin') {
    return res.status(403).json(errors.forbidden('权限不足'));
  }

  // 普通租户管理员只能在自己租户内创建账号
  let effectiveTenantId = tenantId;
  if (req.admin.role !== 'platform_superadmin') {
    effectiveTenantId = req.admin.tenantId;
  }

  const admin = await Admin.create({
    name, email, password, role, permissions,
    tenantId: role === 'platform_superadmin' ? null : effectiveTenantId
  });
  // ...
};
```

#### 8.1.2 列表查询按权限过滤

定位 `getAdmins` 函数，添加按角色的过滤逻辑：

```javascript
exports.getAdmins = async (req, res) => {
  const filter = {};
  if (req.admin.role !== 'platform_superadmin') {
    // 普通管理员只能看到自己租户的 admin
    filter.tenantId = req.admin.tenantId;
  } else {
    // platform_superadmin 可选按 X-Active-Tenant 过滤
    const activeTenant = req.header('X-Active-Tenant');
    if (activeTenant) filter.tenantId = activeTenant;
  }
  const admins = await Admin.find(filter).select('-password').sort({ createdAt: -1 });
  return res.json(success(admins));
};
```

> Admin 模型未启用 tenantPlugin（避免 platform_superadmin 自身查询被自动过滤），所以这里手动过滤。

### 8.2 新增租户管理 Controller

**新文件**：`backend/src/controllers/tenant.controller.js`

```javascript
const Tenant = require('../models/Tenant');
const { success, errors } = require('../utils/response');
const { withSystemContext } = require('../middleware/tenantContext');

/**
 * 列出所有租户（仅 platform_superadmin）
 */
exports.listTenants = async (req, res) => {
  if (req.admin.role !== 'platform_superadmin') {
    return res.status(403).json(errors.forbidden('仅平台管理员可访问'));
  }
  const tenants = await withSystemContext(null, () =>
    Tenant.find().sort({ createdAt: -1 }).lean()
  );
  return res.json(success(tenants));
};

/**
 * 创建租户（仅 platform_superadmin）
 */
exports.createTenant = async (req, res) => {
  if (req.admin.role !== 'platform_superadmin') {
    return res.status(403).json(errors.forbidden('仅平台管理员可访问'));
  }
  const { slug, name, description, wxAppIds, wechatLogin, wechatPay, branding } = req.body;
  if (!slug || !name) {
    return res.status(400).json(errors.badRequest('slug 和 name 必填'));
  }
  const tenant = await withSystemContext(null, () =>
    Tenant.create({
      slug,
      name,
      description,
      wxAppIds: wxAppIds || [],
      wechatLogin: wechatLogin || {},
      wechatPay: wechatPay || {},
      branding: branding || {}
    })
  );
  return res.json(success(tenant, '租户创建成功'));
};

/**
 * 更新租户（仅 platform_superadmin）
 */
exports.updateTenant = async (req, res) => {
  if (req.admin.role !== 'platform_superadmin') {
    return res.status(403).json(errors.forbidden('仅平台管理员可访问'));
  }
  const { tenantId } = req.params;
  const updates = req.body;
  delete updates._id;
  delete updates.slug; // slug 不允许修改（数据隔离键）

  const tenant = await withSystemContext(null, () =>
    Tenant.findByIdAndUpdate(tenantId, updates, { new: true })
  );
  if (!tenant) return res.status(404).json(errors.notFound('租户不存在'));
  return res.json(success(tenant, '更新成功'));
};

/**
 * 当前管理员所属租户信息
 */
exports.getCurrentTenant = async (req, res) => {
  if (req.admin.role === 'platform_superadmin') {
    const activeTenant = req.header('X-Active-Tenant');
    if (!activeTenant) return res.json(success(null));
    const tenant = await withSystemContext(null, () => Tenant.findById(activeTenant).lean());
    return res.json(success(tenant));
  }
  if (!req.admin.tenantId) {
    return res.status(403).json(errors.forbidden('管理员未绑定租户'));
  }
  const tenant = await withSystemContext(null, () => Tenant.findById(req.admin.tenantId).lean());
  return res.json(success(tenant));
};
```

### 8.3 注册租户路由

**修改文件**：`backend/src/routes/admin.routes.js`

在已有路由后追加：

```javascript
const tenantController = require('../controllers/tenant.controller');

// 租户管理（仅 platform_superadmin）
router.get('/admin/tenants', tenantController.listTenants);
router.post('/admin/tenants', tenantController.createTenant);
router.put('/admin/tenants/:tenantId', tenantController.updateTenant);
router.get('/admin/current-tenant', tenantController.getCurrentTenant);
```

### 8.4 admin 前端改造

#### 8.4.1 新增 `X-Active-Tenant` 请求头

**修改文件**：`admin/src/services/api.ts`

在 axios 实例的 request interceptor 中，加一段：

```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // 多租户：platform_superadmin 切换租户时附带
  const activeTenant = localStorage.getItem('admin_active_tenant');
  if (activeTenant) {
    config.headers['X-Active-Tenant'] = activeTenant;
  }
  return config;
});
```

#### 8.4.2 新增租户切换器组件

**新文件**：`admin/src/components/TenantSwitcher.vue`

```vue
<template>
  <div v-if="isPlatformSuperAdmin" class="tenant-switcher">
    <el-select
      v-model="activeTenantId"
      placeholder="所有租户"
      clearable
      size="small"
      style="width: 180px"
      @change="handleTenantChange"
    >
      <el-option label="所有租户（跨租户视图）" :value="''" />
      <el-option
        v-for="t in tenants"
        :key="t._id"
        :label="t.name"
        :value="t._id"
      />
    </el-select>
  </div>
  <div v-else-if="currentTenant" class="tenant-display">
    {{ currentTenant.name }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const tenants = ref<any[]>([]);
const activeTenantId = ref<string>(localStorage.getItem('admin_active_tenant') || '');
const currentTenant = ref<any>(null);

const isPlatformSuperAdmin = computed(() =>
  ['platform_superadmin', 'superadmin'].includes(authStore.adminInfo?.role)
);

async function loadTenants() {
  if (isPlatformSuperAdmin.value) {
    const res = await api.get('/admin/tenants');
    tenants.value = res;
  } else {
    const res = await api.get('/admin/current-tenant');
    currentTenant.value = res;
  }
}

function handleTenantChange(value: string) {
  if (value) {
    localStorage.setItem('admin_active_tenant', value);
  } else {
    localStorage.removeItem('admin_active_tenant');
  }
  ElMessage.success('已切换租户视图，刷新页面查看数据');
  // 强制重新加载当前页面以刷新数据
  setTimeout(() => window.location.reload(), 500);
}

onMounted(loadTenants);
</script>

<style scoped>
.tenant-switcher,
.tenant-display {
  margin-right: 16px;
}
.tenant-display {
  color: #888;
  font-size: 13px;
}
</style>
```

#### 8.4.3 在 AdminLayout 顶部嵌入切换器

**修改文件**：`admin/src/components/AdminLayout.vue`

在 header 区域 `header-user` 之前插入：

```vue
<div class="header-content">
  <div class="header-title">
    <h3>{{ pageTitle }}</h3>
    <p v-if="pageSubtitle">{{ pageSubtitle }}</p>
  </div>
  <div class="header-right">
    <TenantSwitcher />   <!-- ← 新增 -->
    <div class="header-user">
      <!-- ...原有内容 -->
    </div>
  </div>
</div>
```

并在 `<script setup>` 顶部 import：

```ts
import TenantSwitcher from './TenantSwitcher.vue';
```

#### 8.4.4 新增租户管理页

**新文件**：`admin/src/views/TenantsView.vue`

提供 CRUD 界面（列表、新建、编辑），仅在 `role === 'platform_superadmin'`（迁移期兼容 `superadmin`）时在侧边栏菜单显示。具体实现参照 `PeriodsView.vue` 的样式即可，字段对应 Tenant 模型：`slug, name, description, wxAppIds[], wechatLogin.appId, wechatLogin.appSecret, wechatPay.{appId,mchId,apiKey}, branding.{logo, primaryColor, brandName}, status`。密钥字段只允许写入或重置，不在列表中明文展示。

侧边栏菜单中新增（`AdminLayout.vue`）：

```vue
<el-menu-item-group title="平台管理" v-if="isPlatformSuperAdmin">
  <el-menu-item index="/tenants">
    <span>🏢 租户管理</span>
  </el-menu-item>
</el-menu-item-group>
```

并在 `admin/src/router/index.ts` 注册路由（参考其他 view）。

---

## 9. 小程序改造

### 9.1 新增 tenant 配置

**新文件**：`miniprogram/config/tenant.js`

```javascript
/**
 * 租户配置
 *
 * 每个租户对应一份小程序壳（独立微信 appId、独立审核），
 * 通过修改本文件 + envConfig 切换。
 *
 * 上线前必须确认本文件的 wxAppId 与 envConfig 中的 wxAppId 一致。
 */
module.exports = {
  // 显示用品牌名（用于首页标题、关于页等）
  brandName: '凡人共读',

  // 主色（如需运行时换肤可读取此值）
  primaryColor: '#4a90e2',

  // logo 路径
  logo: '/assets/icons/book.png',

  // 客服联系信息
  contactEmail: 'support@fanren.club',

  // 协议页文案中可能用到的法人主体
  legalEntity: '凡人共读 团队'
};
```

### 9.2 修改登录请求带 wxAppId

**修改文件**：`miniprogram/services/auth.service.js`

在 `wechatLogin` 函数中，调用 API 时附带 `wxAppId`：

```javascript
const envConfig = require('../config/env');

async wechatLogin(code, userInfo) {
  return await request.post('/auth/wechat/login', {
    code,
    nickname: userInfo.nickName,
    avatarUrl: userInfo.avatarUrl,
    gender: userInfo.gender,
    wxAppId: envConfig.wxAppId   // ← 新增
  });
}
```

### 9.3 公开请求统一带 X-Wx-AppId 请求头

**修改文件**：`miniprogram/utils/request.js`

定位 `request` 方法（约第 27 行），在 `requestHeader` 合并之后追加：

```javascript
const requestHeader = {
  ...this.header,
  ...header,
  'X-Wx-AppId': envConfig.wxAppId   // ← 新增，所有请求都带上
};
```

> 这样后端的 `publicTenantContext` 中间件可以从请求头解析租户。已登录请求中后端会优先用 JWT 里的 tenantId（因为 `userTenantContext` 在前），未登录请求才使用请求头。

### 9.4 小程序本地缓存隔离

多个小程序壳共用同一份代码时，开发者工具、灰度包或未来同端切换租户可能复用本地缓存。所有长期缓存 key 必须带 appId 前缀，至少包括 token、userInfo、报名状态缓存、订阅授权缓存。

```javascript
const envConfig = require('../config/env');

function tenantStorageKey(key) {
  return `${envConfig.wxAppId || 'unknown'}:${key}`;
}

wx.setStorageSync(tenantStorageKey('accessToken'), token);
wx.getStorageSync(tenantStorageKey('accessToken'));
```

上线前检查 `miniprogram/utils/storage.js`、`miniprogram/utils/period-access.js` 和直接调用 `wx.getStorageSync` 的页面，避免 A 租户 token 被 B 租户壳读取。

### 9.5 新增小程序壳的步骤（未来增加新租户时）

新增"超人读书会"的操作流程：

1. **微信公众平台**：注册新小程序，获得新 appId（例如 `wx_chaoren_xxx`）
2. **复制小程序代码**：`cp -r miniprogram miniprogram-chaoren`（仅用于独立打包，**不修改业务代码**）
3. **修改两个配置文件**：
   - `miniprogram-chaoren/config/env.js`：把 prod 环境的 `wxAppId` 改为新 appId
   - `miniprogram-chaoren/config/tenant.js`：改 `brandName`、`primaryColor`、`logo`、`contactEmail`、`legalEntity`
4. **替换品牌资源**：
   - `miniprogram-chaoren/assets/icons/book.png`（小程序内 logo）
   - 微信公众平台后台上传新的小程序图标
5. **管理后台**：用 `platform_superadmin` 登录 → 租户管理 → 新建租户 → 填写 slug、name、wxAppIds（填入新 appId）
6. **创建租户管理员**：在租户管理页创建一个 `tenant_admin` 角色的账号，绑定到新租户
7. **微信审核**：把新小程序提交微信审核（独立审核，无法绕过）
8. **完成**：审核通过后，新小程序登录会自动落到新租户

---

## 10. 数据迁移脚本（一次性）

### 10.0 当前数据订正策略

必须做数据订正。现有生产库是单租户数据，迁移时统一归属到初始租户 `fanren`（凡人共读）。这个步骤不是“补字段方便以后用”，而是多租户隔离能否生效的前置条件：启用 fail-closed tenant plugin 后，任何没有 `tenantId` 的业务数据都会在正常请求中查不到，写入也会被拒绝。

订正范围：

| 数据类型 | 订正动作 |
|----------|----------|
| 14 个业务集合 | 所有历史文档统一写入 `tenantId = fanrenTenantId` |
| `admins` 集合 | 历史 `superadmin/admin/operator` 写入 `tenantId = fanrenTenantId`；历史 `superadmin` 角色迁移为 `tenant_admin` |
| `auditlogs` 集合 | 历史审计日志写入 `tenantId = fanrenTenantId`；只有迁移后产生的平台级操作才允许 `tenantId = null` |
| 唯一索引 | 先回填 `tenantId`，再删除旧全局 unique 索引，重建 `{tenantId, ...}` 复合 unique 索引 |
| 跨集合引用 | 回填后检查 `checkins/enrollments/payments/comments/notifications` 等引用的 `userId/periodId/sectionId` 是否都能在同一租户找到 |

订正前先做 dry-run 统计，确认需要回填的数量：

```javascript
const collections = [
  'users',
  'periods',
  'sections',
  'checkins',
  'enrollments',
  'payments',
  'insights',
  'insight_requests',
  'comments',
  'notifications',
  'useractivities',
  'subscribe_message_grants',
  'subscribe_message_deliveries',
  'auditlogs'
];

for (const name of collections) {
  print(name, db.getCollection(name).countDocuments({ tenantId: { $exists: false } }));
}
print('admins', db.admins.countDocuments({ tenantId: { $exists: false } }));
```

订正后必须验证：

```javascript
for (const name of collections) {
  const missing = db.getCollection(name).countDocuments({ tenantId: { $exists: false } });
  if (missing !== 0) throw new Error(`${name} still has missing tenantId: ${missing}`);
}
```

> 如果未来发现老库里混入了多个真实租户的数据，不能再用统一回填策略，必须先制定“数据归属映射表”（例如按 `wxAppId`、课程/期次、管理员来源、支付商户号拆分），再按映射分批回填。

### 10.1 脚本目标

将现有数据库中所有业务数据回填 `tenantId`，指向初始租户"凡人共读"。

### 10.2 创建脚本

**新文件**：`backend/scripts/migrate-to-multi-tenant.js`

```javascript
/**
 * 一次性迁移脚本：将单租户数据迁移到多租户结构
 *
 * 执行步骤：
 * 1. 创建初始租户"凡人共读"
 * 2. 给所有业务集合的所有文档加 tenantId
 * 3. 删除旧全局 unique 索引，创建带 tenantId 的新 unique 索引
 * 4. 把现有 superadmin 重写为 tenant_admin（绑定到凡人共读）
 * 5. 创建一个 platform_superadmin 账号（用环境变量提供凭证）
 *
 * 使用方法：
 *   cd backend
 *   PLATFORM_ADMIN_EMAIL=root@platform.local \
 *   PLATFORM_ADMIN_PASSWORD=ChangeMeNow123 \
 *   node scripts/migrate-to-multi-tenant.js
 *
 * 安全：
 * - 脚本是幂等的：重复运行不会重复创建（通过 slug 去重）
 * - 全程使用 withSystemContext 绕过租户过滤
 * - 完成后立即修改 platform_superadmin 密码
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { withSystemContext } = require('../src/middleware/tenantContext');
const Tenant = require('../src/models/Tenant');
const Admin = require('../src/models/Admin');

const COLLECTIONS_TO_MIGRATE = [
  'users',
  'periods',
  'sections',
  'checkins',
  'enrollments',
  'payments',
  'insights',
  'insight_requests',
  'comments',
  'notifications',
  'useractivities',
  'subscribe_message_grants',
  'subscribe_message_deliveries',
  'auditlogs'
];

const UNIQUE_INDEX_MIGRATIONS = [
  {
    collection: 'users',
    oldKey: { openid: 1 },
    newKey: { tenantId: 1, openid: 1 },
    options: { unique: true, name: 'tenant_openid_unique' }
  },
  {
    collection: 'payments',
    oldKey: { orderNo: 1 },
    newKey: { tenantId: 1, orderNo: 1 },
    options: { unique: true, name: 'tenant_orderNo_unique' }
  },
  {
    collection: 'sections',
    oldKey: { periodId: 1, day: 1 },
    newKey: { tenantId: 1, periodId: 1, day: 1 },
    options: { unique: true, name: 'tenant_period_day_unique' }
  },
  {
    collection: 'checkins',
    oldKey: { userId: 1, periodId: 1, checkinDate: 1 },
    newKey: { tenantId: 1, userId: 1, periodId: 1, checkinDate: 1 },
    options: { unique: true, name: 'tenant_user_period_date_unique' }
  },
  {
    collection: 'enrollments',
    oldKey: { userId: 1, periodId: 1 },
    newKey: { tenantId: 1, userId: 1, periodId: 1 },
    options: { unique: true, name: 'tenant_user_period_unique' }
  },
  {
    collection: 'insight_requests',
    oldKey: { fromUserId: 1, toUserId: 1, insightId: 1, status: 1 },
    newKey: { tenantId: 1, fromUserId: 1, toUserId: 1, insightId: 1, status: 1 },
    options: {
      unique: true,
      partialFilterExpression: { status: 'pending' },
      name: 'tenant_pending_insight_request_unique'
    }
  },
  {
    collection: 'subscribe_message_grants',
    oldKey: { userId: 1, scene: 1, templateId: 1 },
    newKey: { tenantId: 1, userId: 1, scene: 1, templateId: 1 },
    options: { unique: true, name: 'tenant_user_scene_template_unique' }
  }
];

const INITIAL_TENANT = {
  slug: 'fanren',
  name: '凡人共读',
  description: '初始租户（自动迁移创建）',
  wxAppIds: [process.env.WECHAT_APPID || 'wx2b9a3c1d5e4195f8'],
  wechatLogin: {
    appId: process.env.WECHAT_APPID || 'wx2b9a3c1d5e4195f8',
    appSecret: process.env.WECHAT_SECRET || null
  },
  status: 'active'
};

function sameKey(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function dropIndexByKeyIfExists(collection, key) {
  const indexes = await collection.indexes();
  const existing = indexes.find(index => sameKey(index.key, key));
  if (!existing) return;
  await collection.dropIndex(existing.name);
  console.log(`[migrate] ${collection.collectionName}: 已删除旧索引 ${existing.name}`);
}

async function rebuildUniqueIndexes(db) {
  for (const migration of UNIQUE_INDEX_MIGRATIONS) {
    const col = db.collection(migration.collection);
    await dropIndexByKeyIfExists(col, migration.oldKey);
    await col.createIndex(migration.newKey, migration.options);
    console.log(`[migrate] ${migration.collection}: 已创建索引 ${migration.options.name}`);
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('未配置 MONGODB_URI');
  await mongoose.connect(mongoUri);
  console.log('[migrate] MongoDB 已连接');

  const result = await withSystemContext(null, async () => {
    // 1. 创建初始租户（幂等）
    let tenant = await Tenant.findOne({ slug: INITIAL_TENANT.slug });
    if (!tenant) {
      tenant = await Tenant.create(INITIAL_TENANT);
      console.log(`[migrate] 已创建初始租户: ${tenant.slug} (${tenant._id})`);
    } else {
      console.log(`[migrate] 初始租户已存在: ${tenant.slug} (${tenant._id})`);
    }

    // 2. 回填业务集合的 tenantId
    const db = mongoose.connection.db;
    for (const collName of COLLECTIONS_TO_MIGRATE) {
      const col = db.collection(collName);
      const filter = { tenantId: { $exists: false } };
      const count = await col.countDocuments(filter);
      if (count === 0) {
        console.log(`[migrate] ${collName}: 无需回填`);
        continue;
      }
      const res = await col.updateMany(filter, { $set: { tenantId: tenant._id } });
      console.log(`[migrate] ${collName}: 回填 ${res.modifiedCount} 条`);
    }

    // 3. 重建 unique 索引：必须在 tenantId 回填后执行
    await rebuildUniqueIndexes(db);

    // 4. 现有 admin 重写：把 superadmin → tenant_admin（绑定到初始租户）
    const adminUpdate = await Admin.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: tenant._id, role: 'tenant_admin' } }
    );
    console.log(`[migrate] admin 表回填: ${adminUpdate.modifiedCount} 条`);

    // 5. 创建 platform_superadmin（如果配置了凭证且不存在）
    const platformEmail = process.env.PLATFORM_ADMIN_EMAIL;
    const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD;
    if (platformEmail && platformPassword) {
      const exists = await Admin.findOne({ email: platformEmail });
      if (!exists) {
        await Admin.create({
          name: 'Platform Root',
          email: platformEmail,
          password: platformPassword,
          role: 'platform_superadmin',
          tenantId: null,
          status: 'active'
        });
        console.log(`[migrate] 已创建 platform_superadmin: ${platformEmail}`);
        console.log(`[migrate] ⚠️ 请立即登录修改密码！`);
      } else {
        console.log(`[migrate] platform_superadmin 已存在: ${platformEmail}`);
      }
    } else {
      console.log('[migrate] 未配置 PLATFORM_ADMIN_EMAIL/PASSWORD，跳过创建 platform_superadmin');
    }

    return { tenantId: tenant._id, slug: tenant.slug };
  });

  console.log('[migrate] ✅ 迁移完成', result);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] ❌ 迁移失败', err);
  process.exit(1);
});
```

### 10.3 运行迁移的安全检查清单

执行迁移前**必须**完成：

- [ ] 已对生产数据库做完整备份（导出 dump）
- [ ] 已在测试环境完整跑过一次脚本，验证数据无误
- [ ] 已完成 §10.0 的 dry-run 统计，确认所有老数据都应归属初始租户 `fanren`
- [ ] PLATFORM_ADMIN_PASSWORD 至少 12 位、包含大小写数字
- [ ] 已确认 `WECHAT_APPID` 环境变量是真实的生产 appId（脚本会用它写入 `tenant.wxAppIds`）
- [ ] 已确认 `WECHAT_SECRET` 环境变量是真实生产 secret（脚本会写入 `tenant.wechatLogin.appSecret`）
- [ ] 已用 `db.<coll>.getIndexes()` 记录旧索引，确认脚本里的 `UNIQUE_INDEX_MIGRATIONS` 覆盖所有旧 unique 索引
- [ ] 服务进程已停止或处于维护模式（防止迁移过程中产生新数据）

执行后**必须**验证：

- [ ] `db.tenants.find()` 显示一条 slug=fanren 的记录
- [ ] 每个业务集合 `db.<coll>.find({ tenantId: { $exists: false } }).count()` 返回 0
- [ ] 旧全局 unique 索引不存在，新 unique 索引都以 `tenantId` 为前缀
- [ ] 用现有管理员账号登录，前端数据正常显示
- [ ] 用 platform_superadmin 登录，可以看到租户管理页

---

## 11. 实施步骤（严格顺序，禁止跳步）

> **核心原则**：先做数据层（不影响运行的代码），再做上下文/中间件，最后做迁移与切流。每一步都要可独立验证。
>
> 如果要求不停机发布，`tenantId` 字段第一版先设为 `required: false`，完成回填和上下文接入后再改为 `required: true`。如果接受维护窗口，则可以按本文最终 schema 实现，但生产切流前必须停止写入。

### 阶段 0：准备（0.5 天）

1. **拉新分支**：`git checkout -b feature/multi-tenant`
2. **备份生产数据库**（在服务器上）
3. **本地搭建测试环境**（一份测试 MongoDB + 一份测试小程序 appId）

### 阶段 1：数据模型（0.5 天）

按 §3 实现：
1. 创建 `backend/src/models/Tenant.js`
2. 修改 14 个业务模型添加 `tenantId` 字段和索引
3. 修改 `Admin.js` 添加 `tenantId` 和扩展 role enum
4. **不要启用 plugin、不要修改任何 controller**

**验证**：
```bash
cd backend
node -e "require('./src/models/Tenant'); console.log('Tenant model loaded')"
# 全部模型加载无报错
node -e "require('./src/app'); console.log('App loaded')"
```

### 阶段 2：上下文与 plugin（0.5 天）

按 §4 实现：
1. 创建 `backend/src/utils/tenantContext.js`
2. 创建 `backend/src/models/plugins/tenantPlugin.js`
3. 在 14 个业务模型中启用 plugin（`AuditLog` 也启用）
4. 创建 `backend/src/middleware/tenantContext.js`

**验证**：
```bash
cd backend
npm test -- --testPathPattern=tenantContext   # 如果写了单元测试
# 或手动：
node -e "
  const m = require('./src/middleware/tenantContext');
  m.withSystemContext(null, async () => {
    const User = require('./src/models/User');
    console.log('Querying without tenantId in bypass mode:');
    const count = await User.countDocuments();
    console.log('User count:', count);
  });
"
```

### 阶段 3：JWT + 登录（0.5 天）

按 §5 + §6 实现：
1. 修改 `backend/src/utils/jwt.js`
2. 修改 `backend/src/controllers/admin.controller.js` 的 generateToken
3. 修改 `backend/src/controllers/auth.controller.js` 的 wechatLogin
4. 修改 `backend/src/services/wechat.service.js`

**验证**：
```bash
# 启动后端
cd backend && npm run dev
# 用现有数据库（已迁移过 tenantId）发起一次登录请求
curl -X POST http://localhost:3000/api/v1/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test","wxAppId":"wx2b9a3c1d5e4195f8"}'
# 应返回包含 tenantId 的 token
```

> 阶段 3 在阶段 6（迁移）之前做不了完整测试，可以先单元测试 generateTokens 函数。

### 阶段 4：路由挂载中间件（1 天）

按 §6.3、§6.4 实现：
1. `app.js` 只保持 route module 挂载，不统一加 auth/tenant context
2. 在具体用户 route 内，把 `userTenantContext` 放在 `authMiddleware` 后
3. 在公开 route 内挂 `publicTenantContext`；可选登录 route 用 `optionalUserOrPublicTenantContext`
4. 在 `admin.routes.js` 中挂载 `adminTenantContext`

**验证**：跑一遍现有 API 测试套件，所有用户请求都应该正常工作（因为只是添加了 ALS 上下文，未改变查询逻辑）。

### 阶段 4B：跨切面改造（1–1.5 天）⚠️ 不可跳过

按 §7.4–§7.8 顺序实现：

1. **WebSocket 协议决策**（§7.4.0）：先拍板用原生 `ws` 还是 Socket.IO，决定后再做 §7.4.1–§7.4.8
2. **WebSocket 后端**（§7.4.1–§7.4.4 或 §7.4.6）：握手中间件 + 房间命名 + emit 签名带 tenantId
3. **WebSocket 多实例广播**（§7.4.7）：装 redis-adapter 或 ws-pubsub.js，在 PM2 cluster 下必做
4. **WebSocket 调用方**（§7.4.8）：grep `pushNotificationToUser` 全部加 tenantId 参数
5. **WebSocket 小程序端**（§7.4.5）：按所选协议适配；生产建议默认走 §7.4.5.2 的 wsToken，若只用 header 必须先真机验证
6. **nginx ws upgrade 配置**（§7.4.6 第 5 步）：服务器上配 `/ws` location 的 upgrade header + 长连接超时
7. **WebSocket 心跳清理**（§7.4.6 第 6 步）：`_installHeartbeat` + 30 秒 ping/pong 巡检
8. **Cron**（§7.5）：改造 3 个 cron service（`period-status`、`study-reminder`、`backup`）；新建 `utils/tenantCron.js`
9. **Cache**（§7.6）：改造 `middleware/cache.js`；新建 `utils/cacheKey.js`；给 `redisManager` 加 `delByPrefix`；审查所有 `keyGenerator` 调用方
10. **Rate Limit**（§7.7）：改造 `middleware/ratelimit.js`；`platformGlobalRateLimit` 挂顶层，`tenantGlobalRateLimit` 必须挂在 tenant context 之后
11. **Upload**（§7.8）：改 `routes/upload.routes.js`（multer 动态 destination + 高熵 filename）+ `controllers/upload.controller.js`（去掉 rename）+ `app.js` 静态资源路由

**验证**：
```bash
# WebSocket：用未带 token 的连接应被拒绝（原生 ws 会 close 1008）
wscat -c "ws://localhost:3000/ws"
# Cron：手动触发 syncAllPeriodsStatus，日志中应显示 tenantId
node -e "require('./src/services/period-status.service').syncAllPeriodsStatus()"
# Cache：连续两次同 path 请求，第二次应 X-Cache: HIT；
# 然后切换 wxAppId 再请求，必须 X-Cache: MISS（说明按租户隔离）
# Rate Limit：故意触发 5 次错误登录，第 6 次返回 429
# Upload：上传后文件应在 backend/uploads/tenants/<slug>/ 下
```

> ⚠️ 跨切面改造和 controller 审查必须**在阶段 6 数据迁移之前**完成，否则迁移后的第一波请求就会触发 fail-closed 抛错（cron 立即报错、cache 失效、上传 404）。

### 阶段 5：管理后台前端（1 天）

按 §8.4 实现：
1. 创建 `TenantSwitcher.vue`
2. 创建 `TenantsView.vue` + 路由
3. 修改 `AdminLayout.vue`
4. 修改 `services/api.ts`

**验证**：本地启动 admin (`cd admin && npm run dev`)，用现有账号登录，前端不报错。

### 阶段 6：数据迁移（0.5 天）

按 §10 执行：
1. 在测试环境跑一遍 `migrate-to-multi-tenant.js`
2. 验证数据完整性
3. 在生产环境跑

**验证**：见 §10.3 清单。

### 阶段 7：小程序改造（0.5 天）

按 §9 实现：
1. 创建 `config/tenant.js`
2. 修改 `auth.service.js` 登录传 wxAppId
3. 修改 `request.js` 全请求带 X-Wx-AppId 头

**验证**：开发者工具登录 → 看课程列表 → 打卡，全程无报错。

> 生产发布时，小程序审核和用户更新不可控。后端上线初期如果仍有旧版小程序请求，应临时设置 `ENABLE_LEGACY_DEFAULT_TENANT=true`，待新版小程序发布稳定后关闭。更稳妥的节奏是先发布“带 wxAppId/X-Wx-AppId 但后端仍兼容旧逻辑”的小程序版本，再切多租户后端。

### 阶段 8：部署与切流（0.5 天）

1. 部署后端到生产；如仍有旧小程序版本在跑，临时开启 `ENABLE_LEGACY_DEFAULT_TENANT=true`
2. 上传新版本小程序，提交微信审核
3. 审核通过后发布
4. 新版稳定后关闭 `ENABLE_LEGACY_DEFAULT_TENANT`
5. 监控 24 小时，关注日志中的"租户上下文缺失"错误和 legacy fallback 命中次数

---

## 12. 测试与验证清单

### 12.1 自动化测试（推荐补充）

`backend/src/__tests__/multiTenant.test.js`：

```javascript
const mongoose = require('mongoose');
const { withSystemContext } = require('../middleware/tenantContext');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

describe('多租户隔离', () => {
  let tenantA, tenantB;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI);
    tenantA = await withSystemContext(null, () =>
      Tenant.create({ slug: 'a', name: 'A', wxAppIds: ['wxA'] })
    );
    tenantB = await withSystemContext(null, () =>
      Tenant.create({ slug: 'b', name: 'B', wxAppIds: ['wxB'] })
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('A 租户创建的用户不应被 B 租户看到', async () => {
    await withSystemContext(tenantA._id, () =>
      User.create({ openid: 'oA', nickname: 'UA' })
    );
    const inB = await withSystemContext(tenantB._id, () => User.find());
    expect(inB.length).toBe(0);
  });

  test('save 时缺少租户上下文应抛错', async () => {
    let err;
    try {
      await User.create({ openid: 'oX', nickname: 'X' });
    } catch (e) { err = e; }
    expect(err).toBeTruthy();
  });

  test('find 时缺少租户上下文应抛错，避免静默跨租户查询', async () => {
    await expect(User.find()).rejects.toThrow(/缺少 tenantId 上下文/);
  });

  test('显式查询其他 tenantId 应被拒绝', async () => {
    await expect(
      withSystemContext(tenantA._id, () => User.find({ tenantId: tenantB._id }))
    ).rejects.toThrow(/非当前租户/);
  });

  test('bypassTenantFilter 应能看到所有租户数据', async () => {
    const all = await withSystemContext(null, () => User.find());
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  test('租户内同 openid 唯一，跨租户允许同 openid', async () => {
    await withSystemContext(tenantA._id, () =>
      User.create({ openid: 'shared', nickname: 'inA' })
    );
    await withSystemContext(tenantB._id, () =>
      User.create({ openid: 'shared', nickname: 'inB' })
    );
    // 不抛错即通过
  });
});
```

### 12.2 手工验证场景

| # | 场景 | 期望结果 |
|---|------|---------|
| 1 | 凡人共读小程序登录 | 成功，token 含 fanren 的 tenantId |
| 2 | 凡人共读用户查看课程 | 只看到 fanren 租户的课程 |
| 3 | 用户打卡 | 数据带 tenantId=fanren 写入 |
| 4 | 用 fanren 的 tenant_admin 登录后台 | 只看到 fanren 数据，左上角无租户切换器 |
| 5 | 用 platform_superadmin 登录后台 | 看到所有数据（跨租户视图），有切换器 |
| 6 | platform_superadmin 切换到 fanren | 数据范围缩到 fanren |
| 7 | 创建新租户 chaoren | 在租户列表能看到 |
| 8 | 给 chaoren 创建管理员 | 该管理员登录后只看 chaoren 数据 |
| 9 | 用 chaoren 的 wxAppId（先在公众平台注册）登录 | 自动落到 chaoren 租户 |
| 10 | 老 token（无 tenantId）请求接口 | 返回 403，引导重新登录 |

### 12.3 性能验证

迁移后所有业务查询都多了一个 tenantId 过滤条件。需要确认：

- 所有常用查询的索引是否含 tenantId（已在 §3.2 复合索引中保证）
- 用 `db.<coll>.find({...}).explain('executionStats')` 看是否走索引

---

## 13. 常见陷阱与禁止事项

### 13.1 严禁

- ❌ **禁止**手动调用 `Model.find({}, ...)` 时不带 tenantId 但不在 bypass 上下文（会泄漏跨租户数据）
- ❌ **禁止**在 controller 里用 `mongoose.connection.db.collection('xxx').find()`（绕过 plugin）
- ❌ **禁止**给 `Tenant` 自己加 tenantId 字段
- ❌ **禁止**在迁移脚本之外，手动从代码里给 admin 账号设置 `tenantId: null`（仅 platform_superadmin 允许）
- ❌ **禁止**让 platform_superadmin 进行写操作时不指定具体租户（在 controller 中显式校验）
- ❌ **禁止**修改 Tenant.slug（数据隔离的人类可读键，改了会导致日志/URL 失效）

### 13.2 易错点

| 易错点 | 正确做法 |
|--------|---------|
| 微信支付回调没有 JWT，无法走 userTenantContext | 先用回调里的 `appid/mchid` 反查 Tenant，再 `withSystemContext(tenantId, ...)` 查询 Payment。仅当 `orderNo` 保持全局唯一时，才允许用 `withSystemContext(null, ...)` 按 orderNo 反查 tenant |
| 定时任务（如自动统计）没有 HTTP 请求 | 用 `withSystemContext(null, ...)` 跨租户遍历，或对每个租户分别 `withSystemContext(tenantId, ...)` |
| Mongoose populate 跨集合时是否带 tenant 过滤 | populate 内部走的是 `Model.find({ _id: { $in: [...] } })`，会被 plugin 自动注入 tenantId，**不会**跨租户泄漏，但会导致引用对象被过滤掉变成 null。如果业务上预期同租户，是正常的；如果有遗留跨租户数据，会显示为缺失 |
| Aggregate 中的 $lookup | $lookup 的 from collection 不会经过 plugin。**必须**手动在 lookup 的 pipeline 里加 `{ $match: { tenantId: <当前租户> } }` |
| 索引未带 tenantId 导致全表扫描 | 用 `explain` 验证；常用查询的索引前缀必须是 tenantId |
| WebSocket 房间只按 userId 命名 | 已在 §7.4 详细改造：握手校验 JWT、房间名 `tenant:${tenantId}:user:${userId}`、emit 必须传 tenantId、socket 回调里需 `runWithTenant` 重建 ALS |
| cron 定时任务不带租户上下文 | 已在 §7.5 详细改造：跨租户任务用 `withSystemContext(null, ...)`，租户内任务用 `forEachActiveTenant` |
| Redis 缓存 key 跨租户串台 | 已在 §7.6 详细改造：`tenantCacheKey()` 工具函数，无 tenantId 时拒绝缓存 |
| Rate limit 没有租户维度 | 已在 §7.7 详细改造：双层兜底（platform + tenant），认证端点用纯 IP + wxAppId/IP 两层限流 |
| 文件上传混在同一目录 | 已在 §7.8 详细改造：`uploads/tenants/<slug>/` 子目录 + 静态资源访问校验 |

### 13.3 部署后的回滚预案

如果上线后发现严重问题：

1. **代码回滚**：仅在没有 drop 旧索引、没有启用 required tenantId/plugin 前可以直接切回旧后端
2. **已执行索引迁移后回滚**：不能假设旧代码完全兼容。旧 schema 可能重新尝试创建全局 unique，或继续写入无 tenantId 数据；应优先回滚到备份或使用专门的反向索引脚本
3. **数据库回滚**：迁移脚本执行错误时从备份恢复，这是最可靠方案
4. **小程序回滚**：微信公众平台后台一键回退到上一个版本

---

## 14. 附录：完整文件位置索引

### 14.1 新建文件清单

| 文件路径 | 用途 | 章节 |
|---------|------|------|
| `backend/src/models/Tenant.js` | 租户模型 | §3.1 |
| `backend/src/models/plugins/tenantPlugin.js` | Mongoose 隔离插件 | §4.3 |
| `backend/src/utils/tenantContext.js` | ALS 上下文工具 | §4.2 |
| `backend/src/utils/tenantValidator.js` | 跨租户引用校验 | §7.3 |
| `backend/src/middleware/tenantContext.js` | 三种租户中间件 | §4.5、§6.3 |
| `backend/src/controllers/tenant.controller.js` | 租户管理接口 | §8.2 |
| `backend/src/utils/tenantCron.js` | cron 辅助：按租户遍历 | §7.5.4 |
| `backend/src/utils/cacheKey.js` | 缓存 key 工具：强制带 tenant 前缀 | §7.6.3 |
| `backend/src/utils/ws-pubsub.js`（仅原生 ws 方案） | PM2 cluster 多实例 ws 广播 | §7.4.7-B |
| `backend/scripts/migrate-to-multi-tenant.js` | 一次性数据迁移（含 unique 索引重建、文件目录迁移、URL 重写） | §10.2、§7.8.3 |
| `admin/src/components/TenantSwitcher.vue` | 租户切换器 | §8.4.2 |
| `admin/src/views/TenantsView.vue` | 租户管理页 | §8.4.4 |
| `miniprogram/config/tenant.js` | 小程序租户配置 | §9.1 |

### 14.2 修改文件清单

| 文件 | 修改内容 | 章节 |
|------|---------|------|
| `backend/src/models/User.js` | 加 tenantId、改 unique 索引、启用 plugin | §3.2、§4.4 |
| `backend/src/models/Admin.js` | 加 tenantId、扩展 role | §3.3 |
| `backend/src/models/Period.js` 等 13 个业务模型 | 加 tenantId、加索引、启用 plugin | §3.2、§4.4 |
| `backend/src/utils/jwt.js` | payload 加 tenantId；新增 `generateWsToken/verifyWsToken/consumeWsToken`（30s 短期、jti 一次性消费） | §5.1、§7.4.5.2 |
| `backend/src/utils/redis.js` | 新增 `setNxEx`，用于 wsToken 跨实例一次性消费 | §7.4.5.2 |
| `backend/src/routes/auth.routes.js` | 新增 `POST /auth/ws-token` 颁发短期 wsToken | §7.4.5.2 |
| `backend/src/services/wechat.service.js` | wxAppId 校验兼容 legacy；多登录 appId 场景需扩展 appId/appSecret 映射 | §6.2 |
| nginx 配置（`/etc/nginx/sites-enabled/*`） | 新增 `/ws` location 的 upgrade header + 长连接超时 | §7.4.6 第 5 步 |
| `backend/src/controllers/admin.controller.js` | 登录 token、createAdmin、getAdmins | §5.2、§8.1 |
| `backend/src/controllers/auth.controller.js` | wechatLogin 解析租户 | §6.1 |
| `backend/src/services/wechat.service.js` | 按租户读 secret | §6.2 |
| `backend/src/middleware/auth.js` | 用户 token 续期查询需要租户上下文或显式按 JWT tenant 查询；admin role 兼容新角色 | §6.3、§8 |
| `backend/src/middleware/adminAuth.js` | `requireRole/requirePermission` 兼容 `platform_superadmin/tenant_admin` | §6.4、§8 |
| `backend/src/app.js` | 保持 route module 挂载，不做全局用户认证挂载 | §6.3 |
| `backend/src/routes/admin.routes.js` | 加 adminTenantContext、租户路由 | §6.4、§8.3 |
| `backend/src/routes/*.routes.js` | 按公开/用户/管理员/回调类型分别挂 tenant context | §6.3 |
| `backend/src/utils/websocket.js` | 握手中间件 + 房间命名 + emit 签名加 tenantId | §7.4 |
| `backend/src/middleware/cache.js` | key 加 tenant 前缀；无 tenantId 时跳过缓存 | §7.6 |
| `backend/src/middleware/ratelimit.js` | 双层兜底（platform + tenant），认证端点用纯 IP + wxAppId/IP 两层限流 | §7.7 |
| `backend/src/routes/upload.routes.js` | multer 动态 destination + 高熵 filename + 前置 requireActiveTenant | §7.8.1.1 |
| `backend/src/controllers/upload.controller.js` | 文件按 `uploads/tenants/<slug>/` 子目录存放（去除 rename 逻辑） | §7.8.1.2 |
| `backend/src/server.js` | 替换 socket.io 初始化为 ws + 挂载 ws-pubsub（若选原生 ws 方案） | §7.4.6 |
| `backend/src/services/period-status.service.js` | `withSystemContext` + 按 period.tenantId 切换上下文保存 | §7.5.1 |
| `backend/src/services/study-reminder.service.js` | 按租户分组发送订阅消息 | §7.5.2 |
| `backend/src/services/backup.service.js` | 跨租户备份用 `withSystemContext(null, ...)` | §7.5.3 |
| `miniprogram/services/websocket.service.js` | 切换租户时主动断开重连 | §7.4.5 |
| `miniprogram/utils/storage.js` | 长期 key 加 wxAppId 前缀 | §9.4 |
| `admin/src/services/api.ts` | 加 X-Active-Tenant header | §8.4.1 |
| `admin/src/components/AdminLayout.vue` | 加切换器、平台管理菜单 | §8.4.3 |
| `admin/src/router/index.ts` | 注册 /tenants 路由 | §8.4.4 |
| `miniprogram/utils/request.js` | 全请求带 X-Wx-AppId | §9.3 |
| `miniprogram/services/auth.service.js` | 登录传 wxAppId | §9.2 |

### 14.3 不修改文件清单（已经够通用，无需改）

- `backend/src/utils/response.js`
- 其他 controller（**绝大多数**）—— plugin 自动隔离，但需按 §7.2 的命令快速 grep 检查特殊场景；凡是 `$lookup`、`bulkWrite`、native collection、支付回调、定时任务都必须人工处理

---

## 文档修订历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.4 | 2026-05-10 | 补齐 v1.3-review 后剩余 4 个落地必踩坑：§7.4.5.1/7.4.5.2 真机 header 验证步骤 + jti 一次性 wsToken 颁发/消费接口（取代 access token 走 query 方案）；§7.4.6 第 5 步 nginx `/ws` location 配置 + wscat 验证；§7.4.6 第 6 步 ping/pong 心跳 + 无效连接巡检清理；§6.2 兼容 legacy appId，并补充多 appId 必须有 appSecret 映射 |
| v1.3-review | 2026-05-10 | 审查 v1.3 后修正原生 ws 与小程序现有 `type` 消息 envelope 不一致、`WebSocket.OPEN` 判断、query token 风险、PM2 多实例单用户多连接漏推；补充旧小程序 `wxAppId` 过渡开关、登录纯 IP 兜底限流、旧 `/uploads` 静态路由必须替换而非并存 |
| v1.3 | 2026-05-10 | 补齐 v1.2-review 三个实施盲点：§7.4.0 给出 WebSocket 协议二选一决策依据（推荐原生 ws）+ §7.4.6 完整原生 ws 后端改造模板；§7.4.7 给出 PM2 cluster 多实例广播两套实现（redis-adapter 与自实现 ws-pubsub）；§7.8.1 改 multer 动态 destination + 高熵 filename，去除 fs.renameSync 跨设备风险 |
| v1.2-review | 2026-05-10 | 审查 v1.2 后补充 Socket.IO/原生 WebSocket 协议选择、租户房间 join、cache 按前缀删除、rate limit 挂载顺序、上传路由 active tenant 校验、静态资源访问策略与 URL 迁移字段 |
| v1.2 | 2026-05-10 | 补齐 5 个跨切面改造（§7.4–§7.8）：WebSocket 房间隔离、cron 租户化、Redis 缓存与 rate limit 加 tenant 维度、上传文件按 slug 子目录；更新实施步骤新增阶段 4B；附录补全所有跨切面文件 |
| v1.1 | 2026-05-10 | 修正 tenant plugin fail-closed、路由挂载、微信凭证、索引迁移、Admin 角色兼容等落地风险 |
| v1.0 | 2026-05-10 | 初版 |

---

## 实施者快速 checklist（贴在屏幕上）

打印或贴在显示器旁，按顺序勾选：

- [ ] **0.1** 拉分支 `feature/multi-tenant`
- [ ] **0.2** 备份生产数据库
- [ ] **1.1** 创建 Tenant 模型
- [ ] **1.2** 14 个业务模型加 tenantId 字段
- [ ] **1.3** Admin 模型加 tenantId、扩展 role
- [ ] **2.1** 创建 tenantContext.js
- [ ] **2.2** 创建 tenantPlugin.js
- [ ] **2.3** 14 个业务模型 schema.plugin(tenantPlugin)
- [ ] **2.4** 创建 middleware/tenantContext.js
- [ ] **3.1** 修改 jwt.js
- [ ] **3.2** 修改 admin.controller.js generateToken
- [ ] **3.3** 修改 auth.controller.js wechatLogin
- [ ] **3.4** 修改 wechat.service.js getOpenidFromCode
- [ ] **4.1** route 文件按公开/用户/管理员/回调分别挂中间件
- [ ] **4.2** admin.routes.js 挂载 adminTenantContext
- [ ] **4.3** 公开路由挂载 publicTenantContext / optionalUserOrPublicTenantContext
- [ ] **4B.0** WebSocket 协议拍板：原生 ws（推荐）或 Socket.IO（§7.4.0）
- [ ] **4B.1** WebSocket 后端改造：握手 + 房间命名 + emit 签名带 tenantId（§7.4.1–4 或 §7.4.6）
- [ ] **4B.1a** wsToken 颁发接口 + 握手同时支持 header / query wsToken（§7.4.5.2）
- [ ] **4B.1b** nginx `/ws` location upgrade header + 长连接超时配置（§7.4.6 第 5 步）
- [ ] **4B.1c** WebSocket 心跳 ping/pong 30 秒巡检（§7.4.6 第 6 步）
- [ ] **4B.2** WebSocket 多实例广播：redis-adapter 或 ws-pubsub.js（§7.4.7）
- [ ] **4B.3** WebSocket 调用方：grep 全部加 tenantId（§7.4.8）
- [ ] **4B.4** WebSocket 小程序端按所选协议适配（§7.4.5）；默认接入 wsToken，如只用 header 则必须真机扫码验证（§7.4.5.1）
- [ ] **4B.5** 3 个 cron service 改造 + 新建 utils/tenantCron.js（§7.5）
- [ ] **4B.6** middleware/cache.js + utils/cacheKey.js + redisManager.delByPrefix（§7.6）
- [ ] **4B.7** middleware/ratelimit.js 双层兜底 + 挂载顺序（§7.7）
- [ ] **4B.8** upload.routes.js multer 动态 dest + upload.controller.js 简化 + 静态路由（§7.8）
- [ ] **5.1** 创建 TenantSwitcher.vue
- [ ] **5.2** 创建 TenantsView.vue + 路由
- [ ] **5.3** 修改 AdminLayout.vue
- [ ] **5.4** 修改 services/api.ts
- [ ] **5.5** 创建 controllers/tenant.controller.js
- [ ] **6.1** 测试环境运行迁移脚本（含 unique 索引重建、uploads 文件迁移、URL 重写）
- [ ] **6.2** 测试环境完整功能验证（含 §4B 改造点：socket / cron / cache / rate limit / upload）
- [ ] **6.3** 生产环境运行迁移脚本
- [ ] **7.1** 创建 miniprogram/config/tenant.js
- [ ] **7.2** 修改 miniprogram/utils/request.js（X-Wx-AppId）
- [ ] **7.3** 修改 miniprogram/services/auth.service.js（登录传 wxAppId）
- [ ] **7.4** 修改 miniprogram/utils/storage.js（key 加 wxAppId 前缀）
- [ ] **7.5** 修改 miniprogram/services/websocket.service.js（切换租户主动断连）
- [ ] **8.1** 部署后端到生产
- [ ] **8.2** 提交小程序审核
- [ ] **8.3** 监控 24 小时

完成所有项目后，新增任何租户只需重复 §9.5 的步骤。

---

**文档结束**
