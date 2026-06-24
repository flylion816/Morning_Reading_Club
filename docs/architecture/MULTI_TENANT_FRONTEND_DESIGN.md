# 小程序前端多租户设计方案（方案 A：单代码库 + 构建期注入）

> **定位**：本文是「前端多租户」的设计与实施方案，是对已有《MULTI_TENANT_REFACTOR_DESIGN.md》（后端多租户）的补充。后端多租户已实施完成；本文解决「一套小程序代码如何承载多个独立品牌（独立 appId、独立审核、不同样式/Logo/名称/支付）」的问题。
>
> **基线时间**：2026-06-25
> **作者**：方案讨论稿（待评审后转实施）
> **关联文档**：`docs/architecture/MULTI_TENANT_REFACTOR_DESIGN.md`

---

## 0. 结论先行（TL;DR）

- **采用方案 A**：单代码库，每个租户一份配置（`config/tenants/<slug>.js`），构建期用脚本把对应配置「注入」到代码里，再分别打包上传到各自的微信 appId。**不 fork 代码库。**
- **配置分两层**：
  - **Tier 1 构建期固化**（不可运行时变）：appId、apiBaseUrl、微信支付商户号、订阅消息模板 ID、云开发 env、品牌名/主色/Logo/导航栏颜色/Tab 图标。
  - **Tier 2 运行时软下发**（可后台改、无需发版）：Banner、公告、客服信息、协议补充文案等运营内容。后端 `Tenant.branding` 已具备下发能力。
- **视觉身份（颜色/Logo/名称）以构建期为准**，不走运行时下发，避免首屏闪烁和审核时身份不一致。运行时下发只承载「软内容」。
- **现状已具备的基础**：后端 `Tenant` 模型（含 `branding`/`wechatLogin`/`wechatPay`）、前端 `config/tenant.js`、`config/env.js`（已含 `superman_dev`）、`tenantStorage`（appId 前缀缓存隔离）。
- **TabBar 用原生、构建期注入，不用自定义 TabBar**：经核实 `custom-tab-bar/` 是死代码（app.json 无 `custom:true`、无页面调用 `getTabBar()`、无任何引用），且自定义 TabBar 的运行时动态切换本身坑多。多租户每个壳独立打包，tab 结构构建期即定，**无需运行时动态 tab**，因此一律用原生 tabBar，由 `apply-tenant.js` 改写 `app.json`。
- **必须补齐的盲点**（现有文档未覆盖）：
  1. 订阅消息模板 ID 硬编码在 `utils/subscribe-auto-topup.js`，模板 ID 绑定 appId，必须纳入租户配置。
  2. 云开发 env id 硬编码在 `app.js`（`cloudbase-d1gulwh3a82346ea9`）。
  3. `project.config.json` / `project.private.config.json` 的 `appid` 硬编码。
  4. `app.json` 的 `tabBar`、`navigationBarTitleText`、`navigationBarBackgroundColor`、`plugins.WechatSI.provider`、`requiredPrivateInfos` 都是静态的，无法运行时切换。
  5. 微信平台侧（非代码）的逐租户配置：合法域名、用户隐私保护指引、ICP 备案、服务类目、插件授权。

---

## 1. 现状评估

### 1.1 已经具备的

| 能力 | 位置 | 状态 |
|------|------|------|
| 后端租户模型（品牌/登录/支付） | `backend/src/models/Tenant.js` | ✅ 已实施，含 `branding.{logo,primaryColor,brandName}`、`wechatLogin`、`wechatPay` |
| 后端按 appId 解析租户 | `Tenant.findByWxAppId` + `tenantContext` 中间件 | ✅ 已实施 |
| 前端多环境（含超人测试） | `config/env.js` | ✅ 已有 `dev/test/prod/superman_dev`，每个含独立 `wxAppId` |
| 前端租户静态配置壳 | `config/tenant.js` | ⚠️ 存在但硬编码单租户（凡人共读），未与构建流程打通 |
| ~~自定义 TabBar~~ | ~~`custom-tab-bar/`~~ | 🗑️ **已删除**（2026-06-25）：原为死代码，app.json 无 `custom:true`、无页面调用 `getTabBar()`、全项目无引用。现网用原生 tabBar（3 个），多租户继续用原生 |
| 本地缓存隔离 | `utils/storage.js` 的 `tenantStorage`（appId 前缀） | ✅ 已实施 |

### 1.2 待解决的硬编码点（逐租户必须不同，但当前写死）

| 硬编码项 | 位置 | 影响 |
|----------|------|------|
| 云开发 env | `app.js` `wx.cloud.init({ env: 'cloudbase-d1gulwh3a82346ea9' })` | 各租户若用各自云环境会串台 → P3 改为读 `current-tenant.cloudEnv`（§7.9） |
| 订阅消息模板 ID（11 个） | `utils/subscribe-auto-topup.js` | 模板 ID 绑定 appId，跨租户发订阅消息会失败 → P3 改为读 `current-tenant.subscribeTemplates`（§7.8） |
| appId | `project.config.json` / `project.private.config.json` | 开发者工具 / CI 上传目标错乱 → apply 改写（§7.2） |
| 标题/导航色/TabBar | `app.json` | 静态字段无法运行时切换 → apply 改写（§7.2） |
| WechatSI 插件 provider | `app.json` `plugins.WechatSI` | 插件需在每个 appId 后台单独授权（平台侧，一般无需改 provider） |

---

## 2. 设计目标与原则

1. **一处改动，全租户受益**：业务代码、Bug 修复、功能迭代只维护一份。
2. **租户差异集中到一个配置文件**：新增租户只改 `config/tenants/<slug>.js` + 放素材，不改业务代码。
3. **构建期确定身份**：颜色/Logo/名称/appId 在打包时就固化，运行时零闪烁、可离线、过审一致。
4. **运行期只承载软内容**：能后台改的（Banner/公告/客服）才走接口下发。
5. **可脚本化、可 CI**：「切换租户 + 打包 + 上传」一条命令完成，支持发布矩阵。
6. **失败安全**：缺少租户配置时构建直接报错，绝不静默用错 appId 上传。

---

## 3. 租户差异点全清单

按「在哪里配置」分类，便于新增租户时逐项对照。

### 3.1 微信平台侧（非代码，需在各自小程序后台操作）

| 项 | 说明 |
|----|------|
| 小程序 appId / AppSecret | 主理人以独立主体申请，AppSecret 配到后端 `Tenant.wechatLogin` |
| 小程序名称 / 头像 / 简介 | 微信后台填写（与代码内品牌名应一致） |
| 服务类目 | 影响可用接口与审核 |
| 微信支付商户号 / API Key / 证书 | 主理人开通，配到后端 `Tenant.wechatPay` |
| request/socket/uploadFile/downloadFile **合法域名** | 各 appId 后台白名单必须含 `apiBaseUrl` 域名 |
| 用户隐私保护指引 | 每个 appId 单独填写（`requiredPrivateInfos`/`getLocation` 等需声明） |
| ICP 备案 | 每个小程序需独立备案（国内强制） |
| 订阅消息模板 | 每个 appId 单独申请，得到的模板 ID 不同 → 写入租户配置 |
| 插件授权（WechatSI 同声传译等） | 每个 appId 后台单独添加插件 |
| 云开发环境（如使用） | 各租户可独立开通 env |

### 3.2 构建期固化（Tier 1，写入 `config/tenants/<slug>.js`）

| 项 | 字段 | 当前来源 |
|----|------|----------|
| 微信 appId | `wxAppId` | `config/env.js` |
| 接口地址 | `apiBaseUrl` | `config/env.js` |
| 品牌名 | `brandName` | `config/tenant.js` |
| 主色 | `primaryColor` | `config/tenant.js` / `app.json` |
| Logo / Tab 图标 | `logo` + `assets/tenants/<slug>/` | `assets/` |
| 导航栏标题/背景色/文字色 | `navBar.{title,bgColor,textStyle}` | `app.json` |
| 订阅消息模板 ID | `subscribeTemplates{}` | `utils/subscribe-auto-topup.js`（硬编码，待迁移） |
| 云开发 env | `cloudEnv` | `app.js`（硬编码，待迁移） |
| 法人主体/客服邮箱 | `legalEntity` / `contactEmail` | `config/tenant.js` |

### 3.3 运行期软下发（Tier 2，来自后端 `/common/config` 或 `Tenant.branding`）

| 项 | 说明 |
|----|------|
| 首页 Banner / 运营位图 | 后台可改，URL 下发 |
| 公告 / 弹窗文案 | 后台可改 |
| 客服联系方式（可变部分） | 后台可改 |
| 协议页补充条款文本 | 后台可改（基础协议仍建议构建期固化以保证过审稳定） |

### 3.4 后端已自动处理（前端无需逐租户改）

| 项 | 机制 |
|----|------|
| 登录鉴权 | 前端请求带 `wxAppId` → 后端用 `Tenant.wechatLogin` 校验 |
| 支付下单 | 前端调下单接口 → 后端用 `Tenant.wechatPay` 生成参数 → 前端 `wx.requestPayment` 直接用返回参数 |
| 数据隔离 | 后端 ALS tenant 上下文按 appId 自动隔离 |
| 缓存隔离 | 前端 `tenantStorage` appId 前缀 + 后端 Redis key 带 tenantId |

---

## 4. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  config/tenants/                                             │
│    fanren.js     ← 凡人共读（appId/色/Logo/模板/云env/...）    │
│    chaoren.js    ← 超人读书会                                  │
│    <slug>.js     ← 未来租户                                    │
└───────────────┬─────────────────────────────────────────────┘
                │  npm run tenant:apply -- chaoren
                ▼
┌─────────────────────────────────────────────────────────────┐
│  scripts/apply-tenant.js  （构建期注入，改动面最小）           │
│   生成 + 改写（均入库，保持 fanren 默认态，提交前 reset）：     │
│     1. config/current-tenant.js（运行时唯一读取入口）         │
│     2. theme.wxss（CSS 变量）                                 │
│     3. app.json（标题/导航色/TabBar 色/TabBar 图标路径）       │
│     4. project.config.json(+private)（appid）                 │
│   不改写（运行时由 current-tenant.js 读取）：                   │
│     · app.js 云 env · subscribeTemplates · brandName 等        │
│   不拷贝（直接引用各租户目录）：                                │
│     · assets/tenants/<slug>/* 由 app.json/页面按路径引用       │
└───────────────┬─────────────────────────────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
   开发者工具预览    miniprogram-ci 上传到对应 appId
                          │
                          ▼
                   提交审核 / 发布（各租户独立）
```

运行时，业务代码统一通过 `config/current-tenant.js` 读取当前租户配置；样式通过 `theme.wxss` 的 CSS 变量生效；软内容启动时从后端拉取覆盖。

### 4.1 改动面最小化原则（核心设计约束）

切租户时，**能不动源码就不动源码**。判定规则：

> **凡是 JS 能在运行时读取的值，一律从 `current-tenant.js` 读，不做源码改写；只有 WeChat 要求的静态配置文件（`app.json`、`project.config.json`）无法被 JS 读取，才不得不改写。**

由此把「切租户」的文件影响面收敛为 4 类，便于审计与回滚：

| 类别 | 文件 | 处理方式 | 是否入库 |
|------|------|----------|----------|
| **生成 + 改写（均入库，保持 fanren 默认态）** | `config/current-tenant.js`、`theme.wxss`、`app.json`、`project.config.json`、`project.private.config.json` | apply 重新生成 / 外科式改写 | ✅ 入库（fanren 默认态，提交前 `tenant:reset`） |
| **运行时读取（零改写）** | `app.js`(云env)、`subscribe-auto-topup.js`(模板)、品牌名/主体/客服等 | 改为 `require('config/current-tenant')` 读取 | ✅ 入库（一次性改造，全租户共用） |
| **资源（零拷贝）** | `assets/tenants/<slug>/*` | 各租户独立目录，`app.json`/页面按路径直接引用 | ✅ 入库（各租户素材并存） |

> **为什么生成物也入库、不 gitignore**：`config/tenant.js` 垫片 `require('./current-tenant')`、`app.wxss` `@import './theme.wxss'` 都硬依赖这两个文件。若 gitignore，**新克隆仓库时文件缺失 → require 失败 + wxss 编译报错 → 小程序打不开**（违反「克隆即可跑 / 失败安全」）。因此与 `app.json` 统一处理：committed + 保持 fanren 默认态 + apply 改写 + 提交前 reset。等于「把 fanren 当默认构建态固化在仓库里」。

**带来的好处**：
- 切租户只改少数文件的少量字段，`git diff` 极小、可读、可审；新克隆开箱即 fanren 态。
- `app.js`、`subscribe-auto-topup.js`、各页面**永远不被 apply 脚本改写**（只在 P3 一次性改造为「读配置」），消除正则改 JS 源码的脆弱性。
- `assets/icons/` 不再被覆盖，多个租户素材在仓库中并存，互不干扰。

> 对比早期设想（patch app.js、拷贝覆盖 assets/icons）：那会让脚本每次切租户都改写 JS 源码和二进制素材，diff 噪声大、易出错、难回滚。本原则是对早期设想的修正。

---

## 5. 配置分层模型

### 5.1 Tier 1：构建期固化（不可运行时变）

判定标准：**与 appId 强绑定、或影响首屏身份、或微信平台静态字段**。

`wxAppId` · `apiBaseUrl` · `wechatPay.mchId`（前端仅展示用，密钥在后端）· `subscribeTemplates` · `cloudEnv` · `brandName` · `primaryColor` · `logo` · `navBar` · `tabBar 图标/颜色` · `legalEntity` · 基础协议文案。

### 5.2 Tier 2：运行期软下发（后台可改）

判定标准：**运营高频调整、且变化时不需要重新过审**。

Banner · 公告 · 可变客服信息 · 协议补充条款。

### 5.3 为什么视觉身份走 Tier 1 而非运行时下发

| 维度 | 构建期（推荐） | 运行时下发 |
|------|----------------|------------|
| 首屏闪烁 | 无 | 有（先默认色→拉到再变） |
| 离线/弱网 | 正常 | 退化为默认 |
| 审核一致性 | 截图与线上一致 | 可能审核态≠下发态，有风险 |
| TabBar/导航色 | 可注入 app.json | app.json 静态，无法运行时改背景 |

> 每个壳 = 一个 appId = 一个租户，颜色/Logo 本就「一壳一套、打包即定」，没有运行时切换需求，因此构建期是最自然且最稳的方案。

---

## 6. 目录结构设计

```
miniprogram/
  config/
    tenants/
      _schema.js          # 配置字段契约 + 校验（新增租户对照）
      fanren.js           # 凡人共读（默认/主租户）
      chaoren.js          # 超人读书会
    current-tenant.js     # ← apply 生成，入库(fanren默认态)，运行时唯一读取入口
    env.js                # 仅环境(apiBaseUrl/debug/log/mock)，移除 wxAppId 与 superman_dev
    tenant.js             # 兼容垫片：改为 module.exports = require('./current-tenant')
  assets/
    tenants/              # 各租户素材并存，互不覆盖（零拷贝，直接引用）
      fanren/
        logo.png
        tab-home.png  tab-home-active.png
        tab-book.png  tab-book-active.png
        tab-my.png    tab-my-active.png
        share-cover.png
      chaoren/
        ...（同结构）
    icons/                # 保留：非租户相关的通用图标（不再被覆盖）
  theme.wxss              # ← apply 生成（CSS 变量），被 app.wxss @import，入库(fanren默认态)
  scripts/
    apply-tenant.js       # 注入脚本
    upload-tenant.js      # miniprogram-ci 上传
```

**关键点**：
- TabBar 图标与 Logo **不再拷贝到 `assets/icons/`**，而是各租户放在 `assets/tenants/<slug>/`；`app.json` 的 `tabBar.list[].iconPath` 和页面 `<image src>` 直接指向当前租户目录（路径由 apply 写入 app.json / 由 current-tenant.js 提供）。这样多租户素材在仓库并存、互不污染。
- `current-tenant.js`、`theme.wxss`、`app.json`、`project.config.json(+private)` **全部入库并长期保持 fanren 默认态**；切到其他租户属临时工作区改动，提交前用 `npm run tenant:reset`（= apply fanren）还原。详见 §6.1。

### 6.1 生成物与 Git 策略（运维正确性关键）

**统一规则**：所有「会被 apply 改写的文件」一律 **committed + fanren 默认态 + 提交前 reset**，不设 gitignore 生成物（避免新克隆缺文件导致打不开）。

| 文件 | 状态 | 提交纪律 |
|------|------|----------|
| `config/current-tenant.js` | 生成（入库 fanren 态） | 提交前 `tenant:reset` 还原 fanren |
| `theme.wxss` | 生成（入库 fanren 态） | 提交前 `tenant:reset` 还原 fanren |
| `app.json` | 半生成（入库 fanren 态） | 提交前 `tenant:reset` 还原 fanren |
| `project.config.json`(+private) | 半生成（入库 fanren 态） | 提交前 `tenant:reset` 还原 fanren |
| `config/tenants/*.js` | 源 | 入库，所有租户定义的唯一真相 |
| `assets/tenants/<slug>/*` | 源 | 入库，各租户素材并存 |

**约束手段**（建议 1+3 叠加）：
1. `package.json` 加 `tenant:reset` = `apply fanren`；发版/提交前手动跑。
2. pre-commit hook 检测上述生成文件是否处于非 fanren 态，是则拒绝提交并提示先 reset。
3. CI 上传脚本结束时自动 `apply fanren`，保证本地回到默认态（已在 §8 `upload-tenant.js` 实现）。

> **为什么不 gitignore 生成物**：`tenant.js`→`require('./current-tenant')`、`app.wxss`→`@import './theme.wxss'` 硬依赖这些文件；gitignore 会让新克隆缺文件而编译失败。**为什么不把 app.json 模板化全 gitignore**：它含 `pages`（30+ 页）等大量共享内容，gitignore 会丢版本管理。两者折中一致：committed + 保持 fanren 默认 + 提交前 reset。

---

## 7. 核心机制详解

### 7.1 租户配置定义

**`config/tenants/fanren.js`（凡人共读，用现状真实值落成，作为默认/主租户）**：

```js
// 凡人共读 —— 当前线上租户，作为默认态
module.exports = {
  slug: 'fanren',
  brandName: '凡人共读',

  // —— 与 appId 强绑定（构建期固化）——
  wxAppId: 'wx2b9a3c1d5e4195f8',
  cloudEnv: 'cloudbase-d1gulwh3a82346ea9',   // 不用云开发则置 null
  wechatPayMchId: null,                       // 仅前端展示用；密钥在后端 Tenant
  subscribeTemplates: {                       // 对应 subscribe-auto-topup.js 的场景键
    // 场景键名 → 该 appId 后台申请到的模板 ID（保持与现状一致）
    // checkinReminder: 'Qzn9auOyMjCKUaHrfekzK0XMaQ64nO0mfdikQNXjbdo',
    // ...（迁移时把现有 11 个 templateId 按场景填入，见 §7.8）
  },

  // —— 视觉身份 ——
  primaryColor: '#4a90e2',
  logo: '/assets/tenants/fanren/logo.png',
  navBar: {
    title: '凡人共读',
    bgColor: '#4a90e2',
    textStyle: 'white'                         // 'white' | 'black'
  },
  // TabBar（数量/页面全租户一致，仅颜色与图标随租户变）
  tabBar: {
    color: '#999999',
    selectedColor: '#4a90e2',
    backgroundColor: '#ffffff',
    iconsDir: '/assets/tenants/fanren'         // 内含 tab-home(.png/-active.png) 等
  },

  // —— 文案/主体 ——
  legalEntity: '凡人共读 团队',
  contactEmail: 'support@fanren.club',

  // —— 接口地址：留空则用 env.js 按环境给的默认；仅独立后端域名时覆盖 ——
  apiBaseUrl: null
};
```

**`config/tenants/chaoren.js`（超人读书会，新租户模板）**：与上同构，填入超人的 appId / 云env / 模板 ID / `#e2562f` 主色 / `assets/tenants/chaoren/` 素材等。

> `apiBaseUrl` 与 `env.js` 正交：环境（dev/test/prod）决定连哪个后端，租户决定带哪个 appId。`apiBaseUrl: null` 时由 `env.js` 兜底，避免在每个租户重复维护后端地址。

#### `config/tenants/_schema.js`（配置契约 + 校验）

apply 脚本加载租户配置后先过此校验，**任一必填项缺失即 `process.exit(1)`**（失败安全，绝不带着残缺配置去改 app.json / 上传）。

```js
// 字段契约：required 必填，validate 可选格式校验
const RULES = {
  slug:        { required: true,  validate: v => /^[a-z][a-z0-9_-]*$/.test(v) },
  brandName:   { required: true,  validate: v => typeof v === 'string' && v.length <= 50 },
  wxAppId:     { required: true,  validate: v => /^wx[0-9a-f]{16}$/i.test(v) },
  cloudEnv:    { required: false }, // null = 不启用云开发
  primaryColor:{ required: true,  validate: v => /^#[0-9a-fA-F]{6}$/.test(v) },
  logo:        { required: true,  validate: v => v.startsWith('/assets/') },
  navBar:      { required: true,  validate: v => v && v.title && /^#[0-9a-fA-F]{6}$/.test(v.bgColor) && ['white','black'].includes(v.textStyle) },
  tabBar:      { required: true,  validate: v => v && v.iconsDir && /^#[0-9a-fA-F]{6}$/.test(v.selectedColor) },
  legalEntity: { required: true },
  contactEmail:{ required: false, validate: v => v == null || /@/.test(v) },
  subscribeTemplates: { required: true, validate: v => v && typeof v === 'object' },
  apiBaseUrl:  { required: false } // null = 用 env.js 兜底
};

function validateTenant(cfg) {
  const errors = [];
  for (const [key, rule] of Object.entries(RULES)) {
    const val = cfg[key];
    const missing = val === undefined || val === null || val === '';
    if (rule.required && missing) { errors.push(`缺少必填字段: ${key}`); continue; }
    if (!missing && rule.validate && !rule.validate(val)) errors.push(`字段格式不合法: ${key} = ${JSON.stringify(val)}`);
  }
  return errors; // 空数组 = 通过
}

module.exports = { RULES, validateTenant };
```

### 7.2 构建期注入脚本 `scripts/apply-tenant.js`

职责（幂等、可重复执行）：**只做 4 件事**——生成 `current-tenant.js`、生成 `theme.wxss`、外科式改写 `app.json`、改写 `project.config.json(+private)`。不碰 `app.js`、不碰业务代码、不拷贝素材。

参考实现（Node，约 90 行）：

```js
#!/usr/bin/env node
// scripts/apply-tenant.js  —— 切换当前构建租户
const fs = require('fs');
const path = require('path');
const { validateTenant } = require('../config/tenants/_schema');

const ROOT = path.resolve(__dirname, '..');           // miniprogram/
const slug = process.argv[2];
if (!slug) { console.error('用法: node scripts/apply-tenant.js <slug>'); process.exit(1); }

// 1) 加载并校验租户配置（失败安全）
const tenantPath = path.join(ROOT, 'config/tenants', `${slug}.js`);
if (!fs.existsSync(tenantPath)) { console.error(`❌ 租户配置不存在: ${tenantPath}`); process.exit(1); }
const cfg = require(tenantPath);
const errors = validateTenant(cfg);
if (errors.length) { console.error(`❌ 租户 ${slug} 配置校验失败:\n - ` + errors.join('\n - ')); process.exit(1); }

// 校验素材存在（TabBar 图标必须本地文件）
const need = ['tab-home.png','tab-home-active.png','tab-book.png','tab-book-active.png','tab-my.png','tab-my-active.png'];
const iconsDir = path.join(ROOT, cfg.tabBar.iconsDir.replace(/^\//,''));
for (const f of need) {
  if (!fs.existsSync(path.join(iconsDir, f))) { console.error(`❌ 缺少 TabBar 图标: ${path.join(cfg.tabBar.iconsDir, f)}`); process.exit(1); }
}

// 2) 生成 config/current-tenant.js（运行时唯一入口）
const banner = '// ⚠️ 本文件由 scripts/apply-tenant.js 自动生成，勿手改。源: config/tenants/' + slug + '.js\n';
fs.writeFileSync(
  path.join(ROOT, 'config/current-tenant.js'),
  banner + 'module.exports = ' + JSON.stringify(cfg, null, 2) + ';\n'
);

// 3) 生成 theme.wxss（CSS 变量；wxss 无法 require JS，必须生成）
fs.writeFileSync(
  path.join(ROOT, 'theme.wxss'),
  `/* 由 apply-tenant.js 生成，勿手改 */\npage {\n  --theme-primary: ${cfg.primaryColor};\n  --theme-on-primary: #ffffff;\n}\n`
);

// 4) 外科式改写 app.json（仅改租户字段，保留其余）
const appJsonPath = path.join(ROOT, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
appJson.window.navigationBarTitleText = cfg.navBar.title;
appJson.window.navigationBarBackgroundColor = cfg.navBar.bgColor;
appJson.window.navigationBarTextStyle = cfg.navBar.textStyle;
appJson.tabBar.color = cfg.tabBar.color;
appJson.tabBar.selectedColor = cfg.tabBar.selectedColor;
appJson.tabBar.backgroundColor = cfg.tabBar.backgroundColor;
// TabBar 图标指向当前租户目录（list 顺序固定: 首页/晨读营/我的）
const dir = cfg.tabBar.iconsDir;
const map = [['tab-home','tab-home-active'],['tab-book','tab-book-active'],['tab-my','tab-my-active']];
appJson.tabBar.list.forEach((item, i) => {
  item.iconPath = `${dir.replace(/^\//,'')}/${map[i][0]}.png`;
  item.selectedIconPath = `${dir.replace(/^\//,'')}/${map[i][1]}.png`;
});
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');

// 5) 改写 project.config.json(+private) 的 appid
for (const name of ['project.config.json', 'project.private.config.json']) {
  const p = path.join(ROOT, '..', name);              // 仓库根
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.appid = cfg.wxAppId;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}

// 6) 打印摘要供人工确认
console.log(`✅ 已切换到租户「${cfg.brandName}」(${slug})`);
console.log(`   appId      : ${cfg.wxAppId}`);
console.log(`   cloudEnv   : ${cfg.cloudEnv || '（未启用）'}`);
console.log(`   primaryColor: ${cfg.primaryColor}`);
console.log(`   ⚠️ 上传前请再次确认目标 appId 与微信后台一致`);
```

`package.json` 脚本：

```jsonc
{
  "scripts": {
    "tenant:apply": "node scripts/apply-tenant.js",
    "tenant:reset": "node scripts/apply-tenant.js fanren",
    "tenant:upload": "node scripts/upload-tenant.js"
  }
}
```

调用：

```bash
npm run tenant:apply -- chaoren        # 切到超人读书会
npm run tenant:reset                    # 还原为 fanren（提交前必跑）
```

> **安全红线**：①配置或素材校验不过直接退出，绝不带残缺配置改 app.json；②只改租户字段，业务代码与 `app.js` 永不被脚本触碰；③打印目标 appId 要求人工确认，避免把 A 租户的包传到 B 的 appId。

### 7.3 主题 / 换肤机制（CSS 变量）

微信 WXSS 支持 CSS 自定义属性。构建期生成 `theme.wxss`：

```css
/* theme.wxss —— 由 apply-tenant.js 生成，勿手改 */
page {
  --theme-primary: #e2562f;
  --theme-primary-light: #f2c9bd;
  --theme-on-primary: #ffffff;
}
```

`app.wxss` 顶部 `@import './theme.wxss';`，业务样式逐步把硬编码 `#4a90e2` 替换为 `var(--theme-primary)`。

- **导航栏背景色**：app.json 静态字段已被注入（首选）；若个别页面需运行时改，用 `wx.setNavigationBarColor`。
- **迁移策略**：先全局替换最显眼的主色使用处（按钮、强调文本、TabBar 选中色），其余按页面渐进替换。可先 `grep -rn "#4a90e2"` 列出清单分批处理。

### 7.4 TabBar（用原生，构建期注入，**不用自定义 TabBar**）

**结论先行**：多租户的 TabBar 走**原生 tabBar**，差异（颜色、图标、文字）由 `apply-tenant.js` 构建期写入 `app.json`。不引入、不复用 `custom-tab-bar/`。

**为什么不用自定义 TabBar**：

1. 现网根本没启用它——`app.json` 没有 `"custom": true`、没有页面调用 `getTabBar()/setActivePage()`、全项目无引用，`custom-tab-bar/` 是历史遗留死代码。
2. 自定义 TabBar 的运行时动态切换（如曾尝试的「登录后 3 tab→4 tab」）坑多：每个 tab 页各自实例化组件、必须在每页 `onShow` 手动 `getTabBar().setActivePage()` 同步、列表项数变化导致索引错位与闪烁。这正是当初「4 tab 变 3 tab 失败」的原因。
3. **多租户没有运行时动态 tab 的需求**：每个租户 = 独立 appId = 独立打包，tab 数量/页面/图标/颜色在构建期就定死在该租户 `app.json` 里。

**注入方式**：

- TabBar **颜色**（`color`/`selectedColor`/`backgroundColor`）：原生 tabBar 不支持 CSS 变量，由 `apply-tenant.js` 直接改写 `app.json` 的 `tabBar` 字段。
- TabBar **图标**：必须本地文件（原生 tabBar 不支持网络图）。注入脚本把 `app.json` 的 `iconPath`/`selectedIconPath` 指向 `assets/tenants/<slug>/tab-*.png`（**不拷贝**，直接引用各租户目录）。
- TabBar **数量与页面：全租户一致**（固定 3 个：首页 / 晨读营 / 我的）。因此 `app.json` 的 `tabBar.list` 结构全租户共用，注入脚本**只改颜色与图标，不改列表结构**，`_schema.js` 无需设计 tab 列表字段。
- `custom-tab-bar/` 目录已于 2026-06-25 删除（原为死代码）。

### 7.5 Logo / 图标资源管理（零拷贝，直接引用）

- 每租户素材放各自目录 `assets/tenants/<slug>/`，**不拷贝、不覆盖** `assets/icons/`。多租户素材在仓库并存。
- **TabBar 图标**：必须本地文件（原生 tabBar 不支持网络图）。apply 脚本把 `app.json` 的 `iconPath`/`selectedIconPath` 指向 `assets/tenants/<slug>/tab-*.png`（见 §7.2 代码）。
- **Logo / 分享封面**：页面 `<image src="{{logo}}">` 与 `wx.shareAppMessage({ imageUrl })` 从 `current-tenant.js` 读路径（`cfg.logo` / `assets/tenants/<slug>/share-cover.png`），不走拷贝。
- 命名约定（apply 脚本按此查找与校验）：`logo.png`、`tab-home.png`/`tab-home-active.png`、`tab-book.png`/`tab-book-active.png`、`tab-my.png`/`tab-my-active.png`、`share-cover.png`。

### 7.6 文案与协议页

- `privacy-policy` / `user-agreement` 页内的主体名、品牌名改为读 `current-tenant.js`（`brandName` / `legalEntity`）。
- 基础协议正文建议构建期固化（过审稳定）；可变补充条款走 Tier 2 软下发。

### 7.7 登录与支付（前端基本无需逐租户改）

- 登录：请求统一带 `wxAppId`（**唯一真相源 `current-tenant.js`**，见 §7.11），后端按 `Tenant.wechatLogin` 校验。需确认 `utils/request.js` 已注入 `X-Wx-AppId` 头、`auth.service` 登录带 `wxAppId`（对照后端文档 §9.2/§9.3）。
- 支付：前端调后端下单接口，后端用该租户 `wechatPay` 生成参数，前端 `wx.requestPayment` 直接消费返回值，**无租户特定前端逻辑**。

### 7.8 订阅消息模板 ID（重点盲点，运行时读配置）

当前 `utils/subscribe-auto-topup.js` 硬编码 11 个 `templateId`。按「改动面最小化」原则，**不让 apply 脚本改写此文件**，而是一次性改造为从 `current-tenant.js` 读取（P3）：

```js
// 改造前（硬编码，跨租户必失败）
const SCENES = {
  checkinReminder: { templateId: 'Qzn9auOyMjCKUaHrfekzK0XMaQ64nO0mfdikQNXjbdo', /* ... */ },
  // ...11 个
};

// 改造后（场景结构保留，ID 从当前租户读）
const currentTenant = require('../config/current-tenant');
const TPL = currentTenant.subscribeTemplates || {};
const SCENES = {
  checkinReminder: { templateId: TPL.checkinReminder, /* ...其余字段不变 */ },
  // ...11 个，仅 templateId 改为 TPL.<场景键>
};
```

要点：
- 各 appId 后台申请的模板**语义/字段结构一致，仅 ID 不同**；场景键名（`checkinReminder` 等）跨租户统一。
- 前端 `subscribeTemplates` 与**后端 Tenant 的模板配置必须同源**（建议以后端为准，前端启动时可对比告警），否则前端申请订阅、后端发送会对不上。
- 迁移时先把现有 11 个 ID 按场景键填入 `fanren.js.subscribeTemplates`，确保行为与现状完全一致。

### 7.9 云开发 env 与插件 provider（运行时读配置）

`app.js` 的云 env 改为读配置，**apply 脚本不改 app.js**：

```js
// 改造前
wx.cloud.init({ env: 'cloudbase-d1gulwh3a82346ea9', traceUser: true });

// 改造后
const currentTenant = require('./config/current-tenant');
if (wx.cloud && currentTenant.cloudEnv) {
  wx.cloud.init({ env: currentTenant.cloudEnv, traceUser: true });
}
// cloudEnv 为 null（不启用云开发）时跳过 init，避免报错
```

- WechatSI 等插件：`app.json` 的 `plugins.WechatSI.provider` 通常是插件自身 appid（各租户相同，一般无需改）；但**每个小程序后台需各自添加并授权该插件**，属 §3.1 平台侧操作。若未来出现 provider 因租户而异，再纳入 app.json patch。

### 7.10 本地缓存隔离

已由 `utils/storage.js` 的 `tenantStorage`（appId 前缀）解决。新增长期缓存一律走 `tenantStorage`，禁止裸用 `wx.setStorageSync`。

### 7.11 `env.js` 与 `current-tenant.js` 职责切分（消除双真相源）

**问题**：现状 `config/env.js` 把「环境」和「租户」混在一起——每个环境（dev/test/prod）各写一份 `wxAppId`，还有 `superman_dev` 这种「环境+租户」杂糅项。若租户配置也存 `wxAppId`，就出现**两个真相源**，极易不一致。

**切分规则**（正交，互不重叠）：

| 维度 | 归属 | 字段 |
|------|------|------|
| **环境**（连哪个后端、是否调试） | `env.js`（按 `currentEnv` 切） | `apiBaseUrl`、`enableDebug`、`enableLog`、`useMock`、`currentEnv` |
| **租户**（带哪个 appId、什么品牌） | `current-tenant.js`（按 apply 切） | `wxAppId`、`cloudEnv`、`subscribeTemplates`、`brandName`、`primaryColor`、`logo`、`navBar`、`legalEntity` 等 |

**改造动作**（P0/P3）：
1. `env.js` **移除各环境的 `wxAppId`** 与 `superman_dev` 整段——`wxAppId` 唯一真相源是 `current-tenant.js`。超人测试改为：环境仍选 `dev`/`prod`，租户用 `npm run tenant:apply -- chaoren`。
2. `env.js` 仅保留 `apiBaseUrl` 等环境字段；`apiBaseUrl` 合并规则：

```js
// 统一出口（如 config/runtime.js 或在 app.js globalData）
const env = require('./env');
const tenant = require('./current-tenant');
const apiBaseUrl = tenant.apiBaseUrl || env.apiBaseUrl;   // 租户可覆盖，否则按环境
const wxAppId = tenant.wxAppId;                           // 仅来自租户
```

3. 全局搜 `envConfig.wxAppId` 的引用点（`request.js` 的 `X-Wx-AppId`、`auth.service` 登录、`tenantStorage` 的 `_prefixKey`），改为读 `current-tenant.js` 的 `wxAppId`。

> **正交带来的好处**：可以「prod 环境 + chaoren 租户」自由组合，不必再为每个租户×环境造一个 env 枚举。`tenantStorage` 的 appId 前缀也自动跟随租户切换而正确隔离。

---

## 8. 发布流程（多租户上传矩阵）

推荐引入 **miniprogram-ci**（微信官方 CI 上传库），实现「切租户 + 上传」一条命令。

`scripts/upload-tenant.js` 骨架：

```js
#!/usr/bin/env node
// 用法: node scripts/upload-tenant.js <slug> [version] [desc]
const path = require('path');
const ci = require('miniprogram-ci');
const { execFileSync } = require('child_process');

const slug = process.argv[2];
const version = process.argv[3] || require('../package.json').version;
const desc = process.argv[4] || `release ${slug} ${new Date().toISOString()}`;
if (!slug) { console.error('用法: upload-tenant.js <slug> [version] [desc]'); process.exit(1); }

// 1) 先切租户（复用 apply，保证 appId/素材/主题一致）
execFileSync('node', [path.join(__dirname, 'apply-tenant.js'), slug], { stdio: 'inherit' });

const cfg = require(path.join('..', 'config/tenants', `${slug}.js`));

(async () => {
  // 2) 密钥按租户隔离存放（勿入库；路径用环境变量或约定目录）
  const privateKeyPath = process.env.MP_CI_KEY_DIR
    ? path.join(process.env.MP_CI_KEY_DIR, `private.${cfg.wxAppId}.key`)
    : path.join(__dirname, '..', '..', '.ci-keys', `private.${cfg.wxAppId}.key`);

  const project = new ci.Project({
    appid: cfg.wxAppId,
    type: 'miniProgram',
    projectPath: path.resolve(__dirname, '..'),   // miniprogram/
    privateKeyPath,
    ignores: ['node_modules/**/*']
  });

  const result = await ci.upload({
    project,
    version,
    desc,
    setting: { es6: true, minify: true },
    robot: 1
  });
  console.log(`✅ 已上传 ${cfg.brandName}(${slug}) appId=${cfg.wxAppId} v${version}`);
  console.log(result);

  // 3) 上传后还原默认态，避免本地停留在该租户
  execFileSync('node', [path.join(__dirname, 'apply-tenant.js'), 'fanren'], { stdio: 'inherit' });
})().catch(e => { console.error('❌ 上传失败:', e); process.exit(1); });
```

发布：

```bash
npm run tenant:upload -- chaoren 1.4.0 "修复打卡提醒"   # 单租户
# 全租户：脚本循环 config/tenants/*.js 依次 upload（CI 矩阵）
```

- 每个 appId 在微信后台生成「小程序代码上传密钥」+ 配置 IP 白名单；密钥按 appId 命名存放于**仓库外**目录（`.ci-keys/` 已 gitignore 或用 `MP_CI_KEY_DIR`），**严禁入库**。
- 版本号 / 审核各租户独立；脚本统一传 `version` + `desc`，`robot` 区分上传机器人。
- `ci.upload` 仅上传到「开发版」，仍需到各自微信后台**提交审核 / 发布**（审核无法自动化）。
- 上传脚本结束自动 `apply fanren`，落实 §6.1 的「回默认态」约束。

---

## 9. 新增一个租户的完整 Checklist

**A. 微信平台侧（主理人 + 你）**
- [ ] 申请小程序 appId、AppSecret
- [ ] 开通微信支付，拿到 mchId / API Key / 证书
- [ ] 配置 request/socket 合法域名（含 `apiBaseUrl`）
- [ ] 填写用户隐私保护指引（覆盖 `requiredPrivateInfos`）
- [ ] 完成 ICP 备案
- [ ] 申请订阅消息模板，记录各场景模板 ID
- [ ] 后台添加并授权所需插件（WechatSI 等）
- [ ] 生成代码上传密钥（用于 CI）

**B. 后端**
- [ ] 新建 `Tenant` 记录：`slug`/`name`/`wxAppIds`/`wechatLogin`/`wechatPay`/`branding`
- [ ] 配置该租户订阅消息模板 ID（与前端一致）

**C. 前端**
- [ ] 新建 `config/tenants/<slug>.js`
- [ ] 放置 `assets/tenants/<slug>/` 素材（Logo / Tab 图标 / 分享封面）
- [ ] `npm run tenant:apply -- <slug>` 并在开发者工具自测
- [ ] 验证：登录、支付、订阅消息、主色、TabBar、协议页主体名
- [ ] `npm run tenant:upload -- <slug>` 上传 → 微信后台提交审核

---

## 10. 微信平台侧注意事项

| 项 | 说明 |
|----|------|
| 合法域名 | 每个 appId 后台独立白名单，缺失会导致请求/支付全失败 |
| 隐私保护指引 | 未配置会触发 `wx.getLocation` 等接口报错 / 审核驳回 |
| ICP 备案 | 国内小程序强制，未备案无法发布 |
| 服务类目 | 决定可用接口与审核口径，需与实际业务匹配 |
| 插件授权 | 插件按 appId 授权，新租户需重新添加 |
| 体验版/审核版/线上版 | `wx.getAccountInfoSync().miniProgram.envVersion` 区分，更新检查仅在 release 生效（现有 `app.js` 已处理） |

---

## 11. 风险与陷阱

1. **传错 appId**：注入脚本必须打印目标 appId 并要求确认；CI 密钥按租户隔离存放。
2. **生成文件残留非默认态**：`current-tenant.js`、`theme.wxss`、`app.json`、`project.config.json` 均入库且应保持 fanren 默认态，提交前必须 `npm run tenant:reset` 还原（见 §6.1）；不 gitignore（否则新克隆缺文件打不开）。资源采用零拷贝（各租户独立目录），不存在覆盖 `assets/icons` 的问题。
3. **模板 ID 前后端不一致**：前端 `subscribeTemplates` 与后端 Tenant 模板配置必须同源，建议以后端为准、前端启动时校验。
4. **首屏闪烁**：坚持视觉身份走构建期，勿用运行时下发主色/Logo。
5. **TabBar 网络图**：禁止；一律本地素材。
6. **合法域名遗漏**：新租户最易踩，纳入 Checklist 强制项。
7. **app.json 静态字段**：标题/导航色/TabBar 必须靠注入脚本改，不能指望运行时 API 全覆盖（背景色 app.json 优先）。
8. **云开发 env 串台**：未抽配置前，多租户共用一个 env 会数据混淆；抽 `cloudEnv` 或明确不使用云开发。

---

## 12. 实施阶段拆分（建议分期）

| 阶段 | 内容 | 产出 |
|------|------|------|
| P0 打基础 | 建 `config/tenants/` + `_schema.js`，现状凡人值落成 `fanren.js`；写 `apply-tenant.js`（current-tenant.js + theme.wxss + app.json + project.config.json，均入库不 gitignore）；加 `tenant:apply/reset` 脚本；`tenant.js` 改为转发垫片 | 可一键切租户，行为与现状一致，克隆即可跑 |
| P1 主题化 | 生成 `theme.wxss`，`app.wxss` @import；主色硬编码渐进替换为 `var(--theme-primary)`；app.json TabBar 颜色由 apply 注入 | 颜色随租户变 |
| P2 资源与文案 | 建 `assets/tenants/<slug>/` 素材目录（零拷贝，apply 改 app.json iconPath）；协议页/品牌名读配置；Logo/分享封面读 current-tenant | Logo/名称随租户变 |
| P3 盲点收口 | 订阅模板 ID、云 env 抽配置（改为运行时读，见 §7.8/§7.9）；**env.js 移除 wxAppId 与 superman_dev，wxAppId 单一真相源化（§7.11）**；登录/支付带 appId 复核 | 功能完整多租户，无双真相源 |
| P4 发布自动化 | 接入 miniprogram-ci，发布矩阵脚本 | 一条命令多租户上传 |
| P5 软下发（可选） | 后端 `/common/config` 下发 Banner/公告等 Tier 2 | 运营可后台改 |

> 建议先做 P0–P3 形成「能跑通的第二个租户（超人读书会）」，P4/P5 视运维频率再上。

---

## 13. 与后端多租户设计的衔接点

| 衔接项 | 后端（已实施） | 前端（本方案） |
|--------|----------------|----------------|
| 租户识别 | `Tenant.findByWxAppId` + `X-Wx-AppId` 头 | 请求统一带 `wxAppId` |
| 品牌信息 | `Tenant.branding` | 构建期固化为主；Tier 2 软内容可来自后端 |
| 登录 | `Tenant.wechatLogin` 校验 | 登录请求带 `wxAppId` |
| 支付 | `Tenant.wechatPay` 下单 | 透传后端返回参数 |
| 订阅消息 | 按租户模板发送 | `subscribeTemplates` 与后端同源 |
| 缓存隔离 | Redis key 带 tenantId | `tenantStorage` appId 前缀 |

---

## 附录：现状关键文件索引

| 文件 | 作用 |
|------|------|
| `backend/src/models/Tenant.js` | 租户模型（branding/wechatLogin/wechatPay） |
| `miniprogram/config/env.js` | 多环境（含 superman_dev） |
| `miniprogram/config/tenant.js` | 现状单租户静态配置（待并入 tenants/） |
| ~~`miniprogram/custom-tab-bar/`~~ | 已删除（死代码），多租户用原生 tabBar |
| `miniprogram/utils/storage.js` | `tenantStorage` 缓存隔离 |
| `miniprogram/utils/subscribe-auto-topup.js` | 订阅消息（模板 ID 待抽配置） |
| `miniprogram/app.js` | 云开发 env（待抽配置） |
| `miniprogram/app.json` | 标题/导航色/TabBar/插件（待注入） |
| `docs/architecture/MULTI_TENANT_REFACTOR_DESIGN.md` | 后端多租户设计 |
