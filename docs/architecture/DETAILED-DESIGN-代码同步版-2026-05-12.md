# 详细设计（代码同步版）

> 同步日期：2026-05-12  
> 代码范围：`miniprogram/`、`backend/src/`、`admin/src/`

## 1. 总体架构

```
微信小程序 ─┐
           ├─ HTTPS /api/v1 ─ Express 后端 ─ MongoDB
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

### 1.2 后端分层

- `app.js`：中间件和路由挂载。
- `routes/`：URL 与中间件定义。
- `controllers/`：业务入口。
- `models/`：Mongoose 数据模型。
- `services/`：支付、备份、订阅、通知、审计、同步等跨控制器能力。
- `middleware/`：用户鉴权、管理员鉴权、审计、监控、限流、错误处理。

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

## 5. 数据一致性

- MongoDB 是主库。
- MySQL 作为热备份/同步库，由 backup/sync 服务维护。
- Redis 用于缓存、限流或实时状态，依部署配置启用。
- 审计日志记录管理员敏感操作，默认 TTL 30 天。

## 6. 兼容与遗留

- 小程序服务层存在旧接口命名，应逐步以 `backend/src/routes` 为准清理。
- 文档历史版本多，后续新增模块应同时更新 PRD、API 索引、数据模型和测试文档。
- OpenSpec 当前只有 `add-immersive-reading-share` 变更目录，项目级上下文已补齐但 CLI 未安装。
