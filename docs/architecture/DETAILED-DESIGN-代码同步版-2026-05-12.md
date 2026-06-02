# 详细设计（代码同步版）

> 同步日期：2026-06-02
> 代码范围：`miniprogram/`、`backend/src/`、`admin/src/`
> 增量范围：2026-05-12 22:44:46 之后至 `9813149 fix: 修复结营视频分享图和埋点` 的提交

## 1. 总体架构

```
微信小程序 ─┐
           ├─ HTTPS /api/v1 ─ Express 后端 ─ MongoDB（多租户主库）
Vue 管理后台 ┘                         ├─ Redis（缓存/限流，可选）
                                      ├─ MySQL 热备份/同步服务
                                      └─ WebSocket（实时通知能力）
```

### 1.1 小程序分层

- `pages/`：页面与交互状态。
- `services/`：API 调用封装。
- `utils/request.js`：统一请求、token、错误处理。
- `utils/markdown.js`：Markdown/HTML 清洗与 rich-text 渲染。
- `utils/formatters.js`：头像色、显示文案、类型配置。
- `utils/subscribe-auto-topup.js`：订阅消息授权补量触发。
- `utils/storage.js`：租户隔离本地存储，避免跨租户 token、草稿和用户态混用。
- `utils/period-access.js`：付费/免费授权报名判断，用于在场、播客、活动等社区权益守卫。

### 1.2 后端分层

- `app.js`：中间件和路由挂载。
- `routes/`：URL 与中间件定义。
- `controllers/`：业务入口。
- `models/`：Mongoose 数据模型。
- `services/`：支付、备份、订阅、通知、审计、同步等跨控制器能力。
- `middleware/`：用户鉴权、管理员鉴权、审计、监控、限流、错误处理。
- `models/plugins/tenantPlugin`：为核心 Mongo 模型追加租户过滤和默认 tenantId 写入。

### 1.3 管理后台分层

- `views/`：页面。
- `services/api.ts`：Axios 封装和业务 API。
- `stores/`：认证、用户、期次、UI 状态。
- `types/api.ts`：接口类型。
- `components/`：管理布局和富文本编辑器。

## 2. 请求链路

1. 小程序或管理后台发起请求。
2. 后端 `app.js` 依次执行安全头、CORS、压缩、日志、body 解析、WebSocket 注入、监控。
3. 健康检查和会议跳转公开处理。
4. 管理写操作通过审计中间件记录。
5. `/api/v1/*` 路由分发到对应 controller。
6. Controller 读写 MongoDB，并按需要调用服务层。
7. 错误由统一 `errorHandler` 处理。

## 3. 核心数据流

### 3.1 登录

```
wx.login code
  -> auth.service.login()
  -> POST /api/v1/auth/wechat/login
  -> auth.controller.wechatLogin
  -> wechat.service 换取 openid
  -> User upsert / token 签发
  -> 小程序本地存储 TOKEN + USER_INFO
```

### 3.2 课程学习

```
首页/晨读营
  -> period/service 拉取期次
  -> section/service 拉取课节
  -> course-detail 展示课程内容、打卡社区和动态详情
```

### 3.3 打卡与评论

```
checkin page 提交内容
  -> POST /api/v1/checkins
  -> Checkin 唯一约束 userId + sectionId
  -> course-detail 拉取公开打卡
  -> comment.routes 处理评论、回复和点赞
```

### 3.4 打卡长图

实现文件：`miniprogram/pages/course-detail/course-detail.js`

关键设计：

- `POSTER_STYLE_PRESETS` 定义模板元数据。
- `buildPosterGalleryItems()` 先构造所有模板条目，未生成模板用 `previewClass` 显示骨架预览。
- `generatePosterGallery()` 只生成首张真实图。
- `handlePosterTemplateSelect()` 选中未生成模板时才生成真实图。
- `generatePosterForStyle()` 先尝试完整长图，失败后用 `{ maxHeight: POSTER_FALLBACK_MAX_HEIGHT }` 生成截断版。
- `exportPosterCanvasToTempFilePath()` 对超长图使用 JPG 和较低 scale，降低微信 canvas 失败概率。

### 3.5 小凡看见长图

实现文件：`miniprogram/pages/insight-detail/insight-detail.js`

关键设计：

- `renderRichTextContent()` 将 Markdown 转为富文本 HTML。
- `_parseHtmlToParagraphs()` 按 HTML 块解析可见内容，保留段落、列表、引用、标题和 div。
- `_parseRunsFromHtmlInner()` 识别 `<strong>/<b>` 并生成普通/加粗 runs。
- `_wrapRunsForCanvas()` 在 run 边界处按宽度换行，避免加粗首字符溢出。
- `_generateInsightLongImage()` 先测量高度，再绘制标题、期次、正文、引用线、二维码和品牌信息。

## 4. 权限设计

| 中间件 | 用途 | 典型路由 |
| --- | --- | --- |
| `authMiddleware` | 小程序用户 JWT | checkins、comments、notifications、payments |
| `optionalAuthMiddleware` | 可选用户态 | period 列表、insight detail |
| `adminMiddleware` | 用户 JWT 中的管理角色 | 部分旧管理接口 |
| `adminAuthMiddleware` | 管理员 JWT | admin、backup、upload、管理端 insights |
| `requireRole()` | 管理员角色约束 | superadmin 管理员账号操作 |
| `userTenantContext` | 小程序用户租户上下文 | imprints、enrollments、notifications |
| `adminTenantContext` | 管理后台租户上下文 | admin/imprints、admin/community-activities |
| `publicTenantContext` | 公开接口租户上下文 | community-activities popup/list/detail |
| `optionalUserOrPublicTenantContext` | 分享落地可选用户租户上下文 | imprint detail |

社区权益类页面还会在小程序端通过 `hasPaidEnrollment()` 检查报名记录，在后端通过 `requirePaidEnrollment` 校验 `paymentStatus in ['paid','free']` 且 `status in ['active','completed']`。

## 5. 数据一致性

- MongoDB 是主库。
- MySQL 作为热备份/同步库，由 backup/sync 服务维护。
- Redis 用于缓存、限流或实时状态，依部署配置启用。
- 审计日志记录管理员敏感操作，默认 TTL 30 天。
- 多租户数据以 `tenantId` 为隔离键；上传资源按租户 slug 落在 `uploads/tenants/<slug>/`。
- 上传接口在进入 multer 异步回调前写入 `req._resolvedTenantId`，避免 AsyncLocalStorage 上下文丢失。

## 6. 新增核心链路（2026-05-13 至 2026-05-31）

### 6.1 多租户请求链路

```
请求头 / token / 当前管理租户
  -> tenantContext 解析租户
  -> getCurrentTenantId()
  -> tenantPlugin 注入查询条件或写入 tenantId
  -> controller 读写当前租户数据
```

管理后台普通租户管理员登录后会自动写入 `admin_active_tenant`；超管在活动、上传、印记等管理场景通过 `X-Active-Tenant` 指定租户。

### 6.2 播客与结营视频

```
管理后台 ContentManagement
  -> uploadApi 上传音频 / 结营视频 / 视频封面
  -> section.routes 保存 Section.podcast_* 或 Section.closingVideo
  -> 小程序 course-detail / podcast-player 拉取并播放
  -> UserActivity 记录播放、分享、结营视频相关事件
```

播客浮层由小程序公共组件维护播放状态，页面通过 bottom offset 适配不同底部工具栏。结营视频封面由管理后台前端 canvas 从视频帧提取，并随课节内容保存。

### 6.3 在场印记

```
zaichang/list
  -> GET /api/v1/imprints/activity-types
  -> GET /api/v1/imprints?page&pageSize&activityType
  -> 列表按 updatedAt 倒序展示

zaichang/publish
  -> 付费报名守卫
  -> wx.chooseMedia 选择多图或单视频
  -> POST /api/v1/imprints/upload
  -> POST /api/v1/imprints 或 PUT /api/v1/imprints/:id

zaichang/detail
  -> GET /api/v1/imprints/:id（可选登录）
  -> POST/DELETE attend、reactions、comments
  -> 通知服务发送站内信和订阅消息
```

后端新增模型：

| 模型 | 关键字段 | 说明 |
| --- | --- | --- |
| `Imprint` | `tenantId`、`authorId`、`mediaList`、`attendees`、`reactionCounts`、`commentCount` | 印记主体，索引覆盖租户、活动类型、营期和发生时间 |
| `ImprintReaction` | `imprintId`、`userId`、`type` | 共鸣记录，`imprintId + userId` 唯一 |
| `ImprintComment` | `imprintId`、`authorId`、`parentId`、`replyToUserId` | 评论和一级回复 |
| `ImprintActivityType` | `key`、`label`、`emoji`、`sortOrder`、`isActive` | 租户级活动类型配置 |

路由挂载顺序要求：`/admin/*`、`/activity-types`、`/:id`、`router.use(auth + tenant + paid)`、`/upload`、CRUD/互动接口。`/activity-types` 必须在 `/:id` 前注册，避免被当成印记 ID。

### 6.4 社区活动与优惠券

```
首页 popup / 近期活动
  -> GET /api/v1/community-activities/popup
  -> GET /api/v1/community-activities（optionalAuth）
活动详情
  -> GET /api/v1/community-activities/:id
  -> POST /api/v1/community-activities/:id/register
  -> DELETE /api/v1/community-activities/:id/register
优惠券
  -> 管理后台 CouponsManagement
  -> ActivityCoupon / 用户券发放
  -> my-coupons 页面按活动跳转使用
```

活动列表和详情兼容旧数据：缺少 `visibilityType` 的活动按正常公开逻辑展示。优惠券支持指定活动、指定用户和全平台通用券 `scope=global`。

### 6.5 小凡看见搜索、弹幕和分享

- 小凡看见列表按天数倒序，同一天按 `updatedAt` 倒序。
- 搜索框位于 tab 上方，列表页传关键词，详情页执行高亮定位。
- 详情页弹幕与点赞共用视觉反馈；分享页允许未登录查看，互动操作通过登录引导拦截。
- 管理员创建、外部接口创建、小凡看见发布等场景会按订阅授权余量推送消息。

### 6.6 课程搜索、看一看和成员实录

- 课程列表与课程详情均支持关键词搜索，详情内定位并高亮命中内容。
- 课程详情新增“看一看”图片板块，支持上传、相对路径补全和预览。
- 成员实录报告通过管理后台维护，小程序新增报告列表/详情查看路径。

## 7. 兼容与遗留

- 小程序服务层存在旧接口命名，应逐步以 `backend/src/routes` 为准清理。
- 文档历史版本多，后续新增模块应同时更新 PRD、API 索引、数据模型和测试文档。
- OpenSpec 当前已有多个变更目录，例如 `add-immersive-reading-share`、`add-member-completion-reports`、`add-paid-activity-coupon`、`add-closing-section-video` 等；后续大功能应继续按 `openspec/AGENTS.md` 维护 proposal/design/tasks/spec。
- `backend/scripts/init-mongodb.js`、`backend/scripts/init-mysql.js` 仅作为明确授权后的初始化脚本，日常文档同步、测试或巡检不得自动执行。
