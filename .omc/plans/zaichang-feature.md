# 「在场」功能实施计划

**版本**：v1.0  
**日期**：2026-05-22  
**状态**：待执行  
**范围**：MVP P0（列表、详情、发布、在场人、共鸣、评论、Tab 入口）

---

## 背景与目标

在晨读营小程序新增「在场」频道，让书友记录线下聚会印记。  
基于已完成的 PRD（`docs/guides/PRD_ZAICHANG.md`）和技术设计（`docs/guides/TECH_DESIGN_ZAICHANG.md`）执行。

---

## RALPLAN-DR 摘要

### 原则（Principles）

1. **最小侵入**：新功能完全独立于现有模块，不修改已有 Model/Controller，仅在 app.js 追加路由注册。
2. **复用现有模式**：Model 用 tenantPlugin、Controller 用 `success/errors` 工具函数、路由用 `authMiddleware + userTenantContext`，与 checkin 模块保持一致。
3. **图片上传复用 multer 逻辑**：新增 `/api/v1/imprints/upload` 接口，复用 upload.routes.js 中的 multer storage 配置，改用 `authMiddleware`（非 adminAuthMiddleware）。
4. **Tab 图标资源已就位**：`assets/images/zaichang-hui.png` 和 `zaichang-lan.png` 已存在，直接引用。
5. **MVP 不过度设计**：地图视图、分享卡片、视频支持均为 P1，本次不实现。

### 决策驱动（Decision Drivers）

1. **后端先行**：小程序页面依赖后端接口，后端 Model + 基础接口必须先完成。
2. **图片上传独立**：发布页依赖图片上传接口，上传接口需在发布页之前完成。
3. **Tab 入口最后**：app.json 的 tabBar 修改影响全局，放在页面开发完成后统一提交。

### 可选方案

**方案 A（本计划采用）：后端串行 → 小程序并行**  
- Day 1-2 完成全部后端（Model + Controller + Routes + 上传接口）  
- Day 3-5 三个小程序页面可并行开发（列表/详情/发布互不依赖）  
- Day 6 联调 + Tab 入口 + 修复  
- 优点：后端稳定后前端不阻塞；缺点：需要 mock 数据或等后端完成

**方案 B：全串行逐页开发**  
- 后端 → 列表页 → 详情页 → 发布页 → Tab  
- 优点：每步可立即联调；缺点：总耗时更长，无法并行  
- 已排除：团队有能力并行时无需串行

---

## 依赖关系图

```
[Task 1] 后端 Model（3个）
    └─→ [Task 2] 后端 Controller + Routes（13接口）
            └─→ [Task 3] 图片上传接口（imprints/upload）
                    └─→ [Task 5] 小程序发布页（依赖上传接口）

[Task 2] 后端 Controller + Routes
    ├─→ [Task 4] 小程序列表页（依赖 list 接口）
    └─→ [Task 5] 小程序详情页（依赖 detail/reactions/comments 接口）

[Task 4] + [Task 5] + [Task 6 发布页]
    └─→ [Task 6] app.json Tab 入口 + 联调测试
```

**可并行**：Task 4（列表页）、Task 5（详情页）、Task 6（发布页）在 Task 2+3 完成后可并行。  
**必须串行**：Task 1 → Task 2 → Task 3；Task 3 完成后 Task 6 才能完整联调。

---

## 任务拆分

### Task 1：后端 Model（3个文件）

**文件**：
- `backend/src/models/Imprint.js`
- `backend/src/models/ImprintReaction.js`
- `backend/src/models/ImprintComment.js`

**关键实现点**：
- 所有 Model 末尾追加 `CheckinSchema.plugin(tenantPlugin)`（参考 Checkin.js 第113行）
- Imprint.js：`activityType` 枚举值为 `reading|cooking|tea|walk|create|other`
- Imprint.js：`attendees` 为嵌套数组，`userId` 可为 null（非注册用户）
- Imprint.js：`reactionCounts` 默认值 `{ gonming: 0, ran: 0, xiangqu: 0 }`
- ImprintReaction.js：唯一索引 `{ imprintId: 1, userId: 1 }`
- ImprintComment.js：`parentId` 可为 null（一级嵌套）
- Schema 选项：`{ timestamps: true, versionKey: false }`（与 Checkin.js 一致）

**验收标准**：
- [ ] 三个 Model 文件存在且语法正确（`node -e "require('./backend/src/models/Imprint')"` 无报错）
- [ ] 索引定义与技术设计文档 §2 一致
- [ ] tenantPlugin 已挂载

---

### Task 2：后端 Controller + Routes

**文件**：
- `backend/src/controllers/imprint.controller.js`
- `backend/src/routes/imprint.routes.js`
- `backend/src/app.js`（追加1行路由注册）

**接口清单（13个）**：

| 方法 | 路径 | Controller 方法 |
|------|------|-----------------|
| GET | `/api/v1/imprints` | `list` |
| POST | `/api/v1/imprints` | `create` |
| GET | `/api/v1/imprints/:id` | `detail` |
| PUT | `/api/v1/imprints/:id` | `update` |
| DELETE | `/api/v1/imprints/:id` | `remove` |
| POST | `/api/v1/imprints/:id/attend` | `attend` |
| DELETE | `/api/v1/imprints/:id/attend` | `cancelAttend` |
| POST | `/api/v1/imprints/:id/reactions` | `react` |
| DELETE | `/api/v1/imprints/:id/reactions` | `cancelReaction` |
| GET | `/api/v1/imprints/:id/comments` | `listComments` |
| POST | `/api/v1/imprints/:id/comments` | `createComment` |
| DELETE | `/api/v1/imprints/:id/comments/:cid` | `deleteComment` |

**关键实现点**：

`list`：
- Query 参数：`page`（默认1）、`pageSize`（默认10，最大20）、`activityType`、`periodId`、`startDate`、`endDate`
- 查询条件加 `tenantId: getCurrentTenantId()`
- populate `authorId`（取 nickname、avatarUrl）
- 返回 `myReactions`：批量查 ImprintReaction，key 为 imprintId，value 为 type

`create`：
- 必填校验：`title`（≤30字）、`activityType`（枚举）、`mediaList`（至少1项）
- `authorId` 从 `req.user` 取
- `tenantId` 从 `getCurrentTenantId()` 取

`attend`：
- 检查 attendees 中是否已有该 userId，有则返回 400
- `$push` attendees，`addedBy: 'self'`，name 取用户 nickname

`react`：
- 查 ImprintReaction 是否存在
- 无：创建 + `$inc reactionCounts.{type}: 1`
- 有且同类型：幂等返回 200
- 有且不同类型：更新 type + `$inc` 旧类型 -1、新类型 +1
- **[Critic 必须修复]** 捕获 MongoDB error code 11000（ImprintReaction 唯一索引冲突，并发双击场景）：回滚 `$inc reactionCounts.{type}: -1`，返回 200（幂等）。防止计数永久漂移。

`cancelReaction`：
- 删除 ImprintReaction + `$inc reactionCounts.{type}: -1`（`$max: 0` 防负数）
- 若 ImprintReaction 不存在（并发双取消），返回 200（幂等，不报错）

`attend`（补充）：
- `cancelAttend`（DELETE）：从 attendees 数组中 `$pull` 当前用户，若不在场则返回 200（幂等）
- // Known race: application-layer dedup has a race window; accepted for MVP given low concurrency.

`createComment`：
- `commentCount` 用 `$inc` +1
- `parentId` 可选，有则校验父评论存在

`deleteComment`：
- 权限：评论作者 OR 印记作者均可删除
- 删除后 `$inc commentCount: -1`

`remove`：
- 权限：仅印记作者（`authorId.toString() === userId`）

`update`：
- 权限：仅印记作者
- 可更新字段：title、description、activityType、location、attendees、periodId

**routes 模式**（参考 checkin.routes.js）：
```js
router.use(authMiddleware, userTenantContext);
// 注意：upload 路由需在 /:id 路由之前注册，避免路径冲突
router.post('/upload', upload.single('file'), uploadHandler);
router.get('/', list);
// ... 其余路由
```

**app.js 追加**（在 checkinRoutes 注册行附近）：
```js
const imprintRoutes = require('./routes/imprint.routes');
// ...
app.use('/api/v1/imprints', imprintRoutes);
```

**验收标准**：
- [ ] `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/imprints` 返回 `{ success: true, data: { list: [], total: 0 } }`
- [ ] POST 创建印记返回完整 imprint 对象
- [ ] react 接口幂等性：同类型重复请求返回 200，reactionCounts 不重复累加
- [ ] attend 接口：同一用户重复请求返回 400
- [ ] deleteComment 权限：非作者非印记发布者返回 403

---

### Task 3：图片上传接口

**文件**：`backend/src/routes/imprint.routes.js`（在 Task 2 基础上追加）

**路由**：`POST /api/v1/imprints/upload`

**关键实现点**：
- 复用 upload.routes.js 中的 multer storage 配置（`multer.diskStorage` + `resolveTenantSlug`）
- 中间件：`authMiddleware + userTenantContext`（非 adminAuthMiddleware）
- **[Critic 必须修复]** 在 `userTenantContext` 之后、multer 之前，显式设置 `req._resolvedTenantId = getCurrentTenantId()`，防止 multer destination 异步回调中 ALS 上下文丢失导致租户隔离穿透或 500 错误（参考 upload.routes.js:25 注释）
- fileFilter：仅允许 `jpeg|jpg|png|webp`，单文件 ≤ 10MB
- 返回格式：`{ success: true, data: { url: "https://domain/uploads/tenants/xxx/filename.jpg", thumbUrl: "..." } }`
- MVP 阶段 thumbUrl === url
- URL 拼接：`${process.env.BASE_URL}/uploads/tenants/${slug}/${filename}`

**注意**：`/upload` 路由必须注册在 `/:id` 路由之前，否则 Express 会将 "upload" 当作 id 参数。

**验收标准**：
- [ ] 小程序 `wx.uploadFile` 调用 `/api/v1/imprints/upload` 成功返回 url
- [ ] 返回的 url 可在浏览器直接访问（静态文件服务正常）
- [ ] 非图片文件（如 .pdf）返回 400 错误

---

### Task 4：小程序列表页

**文件**：
- `miniprogram/pages/zaichang/list/list.js`
- `miniprogram/pages/zaichang/list/list.wxml`
- `miniprogram/pages/zaichang/list/list.wxss`
- `miniprogram/pages/zaichang/list/list.json`

**关键实现点**：

`list.js`：
- `data.typeList`：7个活动类型 chip（含"全部"）
- `loadList(reset)`：reset=true 时清空列表、page=1
- `onReachBottom`：`hasMore` 为 true 时加载下一页，追加到 list
- `onPullDownRefresh`：调 `loadList(true)` 后 `wx.stopPullDownRefresh()`
- `onTypeChange`：切换 activeType，调 `loadList(true)`
- `onTapCard`：`wx.navigateTo({ url: '/pages/zaichang/detail/detail?id=' + id })`
- `onTapPublish`：`wx.navigateTo({ url: '/pages/zaichang/publish/publish' })`
- 日期格式化：`happenedAt` 转为 `YYYY年M月D日` 显示

`list.wxml`：
- 顶部筛选 chip 横向滚动（`scroll-view scroll-x`）
- 印记卡片：封面拼图 + 活动类型徽章 + 标题 + 在场人头像墙 + 底部作者/互动数
- 封面拼图：用 `cover-1/2/3/4/5plus` class 区分布局（参考技术设计 §6）
- 悬浮发布按钮：`position: fixed; right: 32rpx; bottom: 120rpx`
- 空状态：list 为空时显示"还没有印记，来留下第一个吧"

`list.wxss`：
- 引入色彩变量（`--zc-bg: #F5F0E8` 等，参考技术设计 §6）
- 卡片圆角 24rpx，图片圆角 16rpx
- 封面拼图 CSS（cover-2/3/4/5plus）

`list.json`：
```json
{
  "navigationBarTitleText": "在场",
  "enablePullDownRefresh": true,
  "usingComponents": {}
}
```

**验收标准**：
- [ ] 列表页正常加载，显示印记卡片
- [ ] 筛选 chip 切换后列表刷新，仅显示对应类型
- [ ] 下拉刷新、上拉加载更多正常工作
- [ ] 点击卡片跳转详情页，点击悬浮按钮跳转发布页
- [ ] 封面拼图：1/2/3/4/5+张图片各自呈现正确布局

---

### Task 5：小程序详情页

**文件**：
- `miniprogram/pages/zaichang/detail/detail.js`
- `miniprogram/pages/zaichang/detail/detail.wxml`
- `miniprogram/pages/zaichang/detail/detail.wxss`
- `miniprogram/pages/zaichang/detail/detail.json`

**关键实现点**：

`detail.js`：
- `onLoad({ id })`：并行请求印记详情 + 评论列表（`Promise.all`）
- `onTapReaction(e)`：
  - 若 `myReaction === type`：调 DELETE reactions（取消）
  - 若 `myReaction !== type`：调 POST reactions（切换/新增）
  - 乐观更新 UI，失败时回滚
- `onTapAttend`：
  - `iAmAttending` 为 false：调 POST attend，成功后更新 attendees 列表
  - `iAmAttending` 为 true：调 DELETE attend
- `onTapReply(e)`：设置 `replyTo`，`wx.focusInput` 聚焦评论框
- `onSubmitComment`：POST comment，成功后追加到 comments 列表，清空输入框
- `onDeleteComment(e)`：`wx.showModal` 确认后调 DELETE，从列表移除
- `onReachBottom`：加载更多评论（commentHasMore 控制）
- 判断 `iAmAttending`：检查 attendees 中是否有 `userId === currentUser._id`

`detail.wxml`：
- 图片轮播：`swiper` 组件，`indicator-dots`
- 在场人头像墙：最多显示8个，超出显示 "+N人在场"
- 「我也在场」按钮：已在场时高亮（绿色背景），未在场时描边样式
- 共鸣区域：三个按钮，选中时高亮对应颜色
- 评论区：`scroll-view` 或普通列表，底部固定输入框
- 回复状态：输入框上方显示"回复 @xxx"，带关闭按钮

`detail.json`：
```json
{
  "navigationBarTitleText": "印记详情",
  "usingComponents": {}
}
```

**验收标准**：
- [ ] 详情页正常加载印记数据
- [ ] 共鸣：点击切换反应，UI 即时更新，reactionCounts 正确变化
- [ ] 「我也在场」：点击后头像出现在在场人列表，再次点击取消
- [ ] 评论：发布评论后立即显示，回复功能正常
- [ ] 删除评论：仅印记作者或评论作者可见删除按钮

---

### Task 6：小程序发布页

**文件**：
- `miniprogram/pages/zaichang/publish/publish.js`
- `miniprogram/pages/zaichang/publish/publish.wxml`
- `miniprogram/pages/zaichang/publish/publish.wxss`
- `miniprogram/pages/zaichang/publish/publish.json`

**关键实现点**：

`publish.js`：
- `onChooseImage`：调 `wx.chooseMedia({ mediaType: ['image'], count: 9 - mediaList.length })`
- 图片上传：逐张调 `wx.uploadFile({ url: apiBase + '/imprints/upload', filePath, name: 'file', header: { Authorization: 'Bearer ' + token } })`，成功后追加到 mediaList
- `onRemoveImage(e)`：从 mediaList 删除对应项
- `onSelectType(e)`：单选活动类型，更新 activityType
- `onSearchAttendee(e)`：防抖300ms，调 `/api/v1/users?search=xxx&pageSize=10`
- `onAddAttendee(e)`：将选中用户加入 attendees（`{ userId, name, isRegistered: true }`）
- `onAddManualAttendee`：将 manualName 加入 attendees（`{ name, isRegistered: false }`）
- `onRemoveAttendee(e)`：从 attendees 删除
- `onSubmit`：
  1. 校验：mediaList ≥ 1、title 非空、activityType 非空
  2. POST `/api/v1/imprints`，body 含 mediaList（已是服务端 URL）
  3. 成功后 `wx.navigateBack()`，并触发列表页刷新（通过 `wx.setStorageSync` 标记或 EventChannel）

在场人选择器（半屏弹窗）：
- `showAttendeePanel: false` 控制显示
- 搜索框 + 结果列表 + 「手动输入」入口
- 手动输入：`wx.showModal` 弹出输入框，或页面内 input 组件

`publish.json`：
```json
{
  "navigationBarTitleText": "留下印记",
  "usingComponents": {}
}
```

**验收标准**：
- [ ] 选图后图片预览正常，可删除单张
- [ ] 活动类型单选，选中高亮
- [ ] 图片上传：每张图片上传成功后 mediaList 中 url 为服务端地址
- [ ] 在场人搜索：输入昵称后显示匹配用户列表，可添加
- [ ] 手动输入非注册用户名字，加入在场人列表
- [ ] 提交校验：缺少必填项时提示，不发请求
- [ ] 发布成功后返回列表页，列表页刷新显示新印记

---

### Task 7：app.json Tab 入口 + 页面注册

**文件**：`miniprogram/app.json`

**变更内容**：

1. pages 数组追加（在 profile 之前）：
```json
"pages/zaichang/list/list",
"pages/zaichang/detail/detail",
"pages/zaichang/publish/publish"
```

2. tabBar.list 插入第三位（index 2，在"晨读营"和"我的"之间）：
```json
{
  "pagePath": "pages/zaichang/list/list",
  "text": "在场",
  "iconPath": "assets/images/zaichang-hui.png",
  "selectedIconPath": "assets/images/zaichang-lan.png"
}
```

3. tabBar 颜色更新（在场频道主色）：
```json
"selectedColor": "#2D5A3D",
"backgroundColor": "#F5F0E8"
```

**注意**：tabBar selectedColor 从现有 `#4a90e2` 改为 `#2D5A3D`，会影响所有 Tab 选中颜色。如需保持其他 Tab 原色，需确认是否接受全局变更。

**验收标准**：
- [ ] 小程序底部出现4个 Tab：首页 | 晨读营 | 在场 | 我的
- [ ] 「在场」Tab 图标正常显示（未选中灰色，选中蓝/绿色）
- [ ] 点击「在场」Tab 跳转到列表页
- [ ] 其他 Tab 功能不受影响

---

### Task 8：联调测试

**测试场景**：

| 场景 | 步骤 | 预期结果 |
|------|------|----------|
| 完整发布流程 | 选图 → 填标题 → 选类型 → 添加在场人 → 发布 | 列表页出现新印记 |
| 在场人认领 | 另一用户打开详情页 → 点「我也在场」 | 头像出现在在场人列表 |
| 共鸣切换 | 点🌱 → 点🔥 | 🌱数-1，🔥数+1 |
| 共鸣取消 | 点已选中的反应 | 反应取消，计数-1 |
| 评论回复 | 点某条评论的「回复」→ 输入内容 → 发送 | 评论显示"回复@xxx" |
| 权限验证 | 非作者尝试删除印记 | 返回 403 |
| 筛选 | 列表页选「读书会」类型 | 仅显示 activityType=reading 的印记 |
| 分页 | 超过10条印记时上拉 | 加载第2页数据 |

**验收标准**：
- [ ] 上述8个场景全部通过
- [ ] 后端无 500 错误日志
- [ ] 小程序无 console.error 输出

---

## 执行顺序与并行策略

```
串行阶段 1（Day 1）：
  Task 1：后端 Model（3个）

串行阶段 2（Day 2）：
  Task 2：后端 Controller + Routes（13接口）
  Task 3：图片上传接口（可与 Task 2 同步完成，在同一文件内）

并行阶段（Day 3-5，可分配给不同执行者）：
  Task 4：小程序列表页
  Task 5：小程序详情页
  Task 6：小程序发布页

串行阶段 3（Day 6）：
  Task 7：app.json Tab 入口
  Task 8：联调测试 + 修复
```

---

## 关键技术约束

1. **tenantPlugin**：路径为 `./plugins/tenantPlugin`，所有新 Model 必须挂载。
2. **getCurrentTenantId()**：从 `../utils/tenantContext` 导入，Controller 中用于构建查询条件。
3. **response 工具**：从 `../utils/response` 导入 `success` 和 `errors`，统一响应格式。
4. **图片 URL 拼接**：参考 upload.controller.js 中的 URL 构建方式，确保与现有静态文件服务路径一致（`/uploads/tenants/{slug}/{filename}`）。
5. **小程序 API 调用**：复用现有 `miniprogram/utils/request.js`（或同等工具），携带 Authorization header。
6. **tabBar selectedColor 变更**：从 `#4a90e2` 改为 `#2D5A3D`，执行前需与用户确认是否接受全局 Tab 颜色变更。

---

## 开放问题（Open Questions）

见 `.omc/plans/open-questions.md`

---

## 成功标准

- [ ] 所有 Task 1-7 验收标准通过
- [ ] Task 8 联调测试8个场景全部通过
- [ ] 后端无 500 错误，小程序无 console.error
- [ ] 发布一条真实印记（含图片、在场人、共鸣、评论）全流程跑通
