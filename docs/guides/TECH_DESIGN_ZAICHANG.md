# 「在场」功能技术设计文档

> 基于 PRD_ZAICHANG.md v1.1
> 日期：2026-06-02
> 状态：代码同步版，增量范围为 2026-05-22 12:32:24 之后至 `9813149 fix: 修复结营视频分享图和埋点` 的提交

---

## 一、整体架构

```
miniprogram/pages/zaichang/     # 小程序页面（列表、详情、发布/编辑）
backend/src/models/             # 新增 4 个 Model
backend/src/controllers/        # 新增 imprint.controller.js
backend/src/routes/             # 新增 imprint.routes.js
backend/src/app.js              # 注册路由
miniprogram/app.json            # 新增页面 + Tab
admin/src/views/                # 新增 ImprintsManagementView.vue
```

当前已实现范围：列表、详情、发布/编辑、在场人、共鸣、评论、Tab 入口、动态活动类型、图片/视频上传、分享、通知、行为埋点、管理后台列表/编辑/删除。
地图视图和在场卡片长图仍未实现。

---

## 二、数据模型

### 2.1 Imprint（印记）

文件：`backend/src/models/Imprint.js`

```js
{
  tenantId:      ObjectId (ref: Tenant, index)
  authorId:      ObjectId (ref: User, required)
  title:         String (required, maxlength: 30)
  description:   String (maxlength: 200)
  activityType:  String (required) // 由 ImprintActivityType 动态配置，保留默认兜底 key
  location:      String (maxlength: 20)
  // P1: coordinates: { type: 'Point', coordinates: [lng, lat] }
  mediaList: [{
    type:     String (enum: image|video)
    url:      String (required)
    thumbUrl: String          // 视频封面 or 图片缩略图
  }]
  attendees: [{
    userId:       ObjectId (ref: User, nullable)  // 注册用户
    name:         String (required)               // 显示名，注册用户冗余存昵称
    isRegistered: Boolean (default: false)
    addedBy:      String (enum: author|self)      // author=发布者添加, self=本人认领
  }]
  periodId:       ObjectId (ref: Period, nullable)
  happenedAt:     Date (default: now)
  reactionCounts: {
    gonming: Number (default: 0)   // 共鸣
    ran:     Number (default: 0)   // 燃
    xiangqu: Number (default: 0)   // 想去
  }
  commentCount:   Number (default: 0)
  createdAt, updatedAt
}
```

索引：
- `{ tenantId: 1, happenedAt: -1 }` — 列表分页主索引
- `{ tenantId: 1, activityType: 1, happenedAt: -1 }` — 按类型筛选
- `{ tenantId: 1, periodId: 1, happenedAt: -1 }` — 按营期筛选
- `{ authorId: 1 }` — 查询某用户发布

### 2.2 ImprintReaction（共鸣）

文件：`backend/src/models/ImprintReaction.js`

```js
{
  tenantId:   ObjectId (ref: Tenant, index)
  imprintId:  ObjectId (ref: Imprint, required)
  userId:     ObjectId (ref: User, required)
  type:       String (enum: gonming|ran|xiangqu, required)
  createdAt:  Date (default: now)
}
```

唯一索引：`{ imprintId: 1, userId: 1 }` — 每人每条印记只能有一条反应记录。

### 2.3 ImprintComment（评论）

文件：`backend/src/models/ImprintComment.js`

```js
{
  tenantId:   ObjectId (ref: Tenant, index)
  imprintId:  ObjectId (ref: Imprint, required)
  authorId:   ObjectId (ref: User, required)
  content:    String (required, maxlength: 500)
  parentId:   ObjectId (ref: ImprintComment, nullable)  // 回复某条评论
  replyToUserId: ObjectId (ref: User, nullable)         // 被回复人（展示用）
  createdAt:  Date (default: now)
}
```

索引：`{ imprintId: 1, createdAt: 1 }` — 评论列表正序。

### 2.4 ImprintActivityType（活动类型）

文件：`backend/src/models/ImprintActivityType.js`

```js
{
  tenantId:   ObjectId (ref: Tenant, index)
  key:        String (required, maxlength: 30)
  label:      String (required, maxlength: 20)
  emoji:      String (required, maxlength: 10)
  sortOrder:  Number (default: 0)
  isActive:   Boolean (default: true)
  createdAt, updatedAt
}
```

索引：
- `{ tenantId: 1, sortOrder: 1 }` — 小程序列表展示排序
- `{ tenantId: 1, key: 1 } unique` — 同租户内活动类型 key 唯一

---

## 三、后端接口设计

### 3.1 路由文件

文件：`backend/src/routes/imprint.routes.js`

小程序列表、发布、编辑、上传和互动接口挂载 `authMiddleware + userTenantContext + requirePaidEnrollment`。详情接口使用可选认证，支持分享落地访问。管理后台接口使用 `adminAuthMiddleware + adminTenantContext`。

| 方法 | 路径 | Controller 方法 | 说明 |
|------|------|-----------------|------|
| GET | `/api/v1/imprints` | `list` | 印记列表（分页+筛选） |
| POST | `/api/v1/imprints` | `create` | 发布印记 |
| GET | `/api/v1/imprints/:id` | `detail` | 印记详情 |
| PUT | `/api/v1/imprints/:id` | `update` | 编辑（仅作者） |
| DELETE | `/api/v1/imprints/:id` | `remove` | 删除（仅作者） |
| POST | `/api/v1/imprints/:id/attend` | `attend` | 我也在场 |
| DELETE | `/api/v1/imprints/:id/attend` | `cancelAttend` | 取消在场 |
| POST | `/api/v1/imprints/:id/reactions` | `react` | 添加/切换共鸣 |
| DELETE | `/api/v1/imprints/:id/reactions` | `cancelReaction` | 取消共鸣 |
| GET | `/api/v1/imprints/:id/comments` | `listComments` | 评论列表 |
| POST | `/api/v1/imprints/:id/comments` | `createComment` | 发布评论 |
| DELETE | `/api/v1/imprints/:id/comments/:cid` | `deleteComment` | 删除评论 |
| GET | `/api/v1/imprints/activity-types` | `activityTypeController.list` | 小程序活动类型列表 |
| POST | `/api/v1/imprints/upload` | inline upload | 小程序上传图片/视频 |
| GET | `/api/v1/imprints/admin/list` | `adminList` | 管理后台印记列表 |
| PUT | `/api/v1/imprints/admin/:id` | `adminUpdate` | 管理后台编辑印记 |
| DELETE | `/api/v1/imprints/admin/:id` | `adminRemove` | 管理后台删除印记 |
| POST | `/api/v1/imprints/admin/upload` | inline upload | 管理后台上传图片/视频 |
| GET/POST/PUT/DELETE | `/api/v1/imprints/admin/activity-types...` | activityTypeController | 管理后台维护活动类型 |

路由顺序约束：
- `/admin/*` 必须在用户鉴权 `router.use()` 之前注册。
- `/activity-types` 必须在 `/:id` 之前注册，否则会被当成印记 ID。
- `/upload` 必须在 `/:id` 写接口之前注册。

### 3.2 接口详情

#### GET /api/v1/imprints

Query 参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| page | Number | 默认 1 |
| pageSize | Number | 默认 10，最大 20 |
| activityType | String | 筛选活动类型 |
| periodId | String | 筛选营期 |
| startDate | String | ISO 日期，筛选 happenedAt >= |
| endDate | String | ISO 日期，筛选 happenedAt <= |

返回：

```json
{
  "success": true,
  "data": {
    "list": [ /* Imprint 列表，含 author 基本信息、attendees 前8个 */ ],
    "total": 42,
    "page": 1,
    "pageSize": 10,
    "myReactions": { "imprintId": "gonming" }  // 当前用户对列表中各印记的反应
  }
}
```

#### POST /api/v1/imprints

Body：

```json
{
  "title": "We来坊，下午茶",
  "description": "一起聊聊生命故事",
  "activityType": "tea",
  "location": "We来坊",
  "mediaList": [
    { "type": "image", "url": "https://...", "thumbUrl": "https://..." }
  ],
  "attendees": [
    { "userId": "xxx", "name": "可心", "isRegistered": true },
    { "name": "小明", "isRegistered": false }
  ],
  "periodId": "xxx",
  "happenedAt": "2026-05-22T14:00:00Z"
}
```

#### POST /api/v1/imprints/:id/attend

无 body。将当前用户加入 attendees，`addedBy: 'self'`。
若已在场则返回 400。

#### POST /api/v1/imprints/:id/reactions

Body：`{ "type": "gonming" | "ran" | "xiangqu" }`

逻辑：
1. 查找该用户是否已有反应记录
2. 若无：创建，对应 `reactionCounts` +1
3. 若有且类型相同：返回 200（幂等）
4. 若有且类型不同：更新类型，旧类型 -1，新类型 +1

#### DELETE /api/v1/imprints/:id/reactions

删除反应记录，对应 `reactionCounts` -1（最小为 0）。

#### GET /api/v1/imprints/:id/comments

Query：`page`, `pageSize`（默认 20）
返回评论列表，按 `createdAt` 正序，populate `authorId`（昵称、头像）。

#### PUT /api/v1/imprints/:id

作者编辑自己的印记。当前支持更新 `title`、`description`、`activityType`、`location`、`attendees`、`periodId`、`mediaList`。

#### GET /api/v1/imprints/:id

详情接口使用可选认证。未登录或无当前用户时返回印记详情；已登录时同时返回 `myReaction`，便于详情页高亮当前用户反应。

---

## 四、小程序页面设计

### 4.1 页面列表

| 页面路径 | 说明 |
|----------|------|
| `pages/zaichang/list/list` | 在场列表（Tab 页） |
| `pages/zaichang/detail/detail` | 印记详情 |
| `pages/zaichang/publish/publish` | 发布印记 |

### 4.2 app.json 变更

**新增页面**（pages 数组）：
```json
"pages/zaichang/list/list",
"pages/zaichang/detail/detail",
"pages/zaichang/publish/publish"
```

**tabBar 变更**（4 个 Tab）：
```json
{
  "color": "#999999",
  "selectedColor": "#2D5A3D",
  "backgroundColor": "#F5F0E8",
  "borderStyle": "black",
  "list": [
    { "pagePath": "pages/index/index", "text": "首页", ... },
    { "pagePath": "pages/periods/periods", "text": "晨读营", ... },
    { "pagePath": "pages/zaichang/list/list", "text": "在场",
      "iconPath": "assets/icons/zaichang.png",
      "selectedIconPath": "assets/icons/zaichang-active.png" },
    { "pagePath": "pages/profile/profile", "text": "我的", ... }
  ]
}
```

### 4.3 列表页（list）

**数据结构**：
```js
data: {
  list: [],
  loading: false,
  page: 1,
  hasMore: true,
  activeType: 'all',   // 活动类型筛选
  typeList: [          // 筛选 chip 数据
    { key: 'all', label: '全部' },
    { key: 'reading', label: '📚 读书会' },
    { key: 'cooking', label: '🍳 做饭' },
    { key: 'tea', label: '☕ 喝茶' },
    { key: 'walk', label: '🚶 散步' },
    { key: 'create', label: '🎨 创作' },
    { key: 'other', label: '✨ 其他' }
  ]
}
```

**关键方法**：
- `onLoad` → `loadList()`
- `onReachBottom` → 加载下一页
- `onPullDownRefresh` → 重置 page=1 重新加载
- `onTypeChange(e)` → 切换筛选类型，重置列表
- `onTapCard(e)` → 跳转详情页
- `onTapPublish` → 跳转发布页

**卡片 WXML 结构**：
```xml
<view class="imprint-card" bindtap="onTapCard" data-id="{{item._id}}">
  <!-- 封面拼图 -->
  <view class="cover cover-{{item.mediaList.length > 4 ? '5plus' : item.mediaList.length}}">
    <image src="{{item.mediaList[0].thumbUrl || item.mediaList[0].url}}" mode="aspectFill"/>
    <!-- 根据数量渲染不同拼图布局 -->
  </view>
  <!-- 活动类型徽章 -->
  <view class="badge badge-{{item.activityType}}">{{activityTypeLabel[item.activityType]}}</view>
  <!-- 信息区 -->
  <view class="info">
    <text class="date">{{item.happenedAt | formatDate}}</text>
    <text class="dot"> · </text>
    <text class="location">{{item.location}}</text>
    <text class="title">{{item.title}}</text>
    <text class="desc">{{item.description}}</text>
  </view>
  <!-- 在场人头像墙 -->
  <view class="attendees">
    <block wx:for="{{item.attendees.slice(0,8)}}" wx:key="index">
      <image wx:if="{{item.avatarUrl}}" src="{{item.avatarUrl}}" class="avatar"/>
      <view wx:else class="avatar-text">{{item.name[0]}}</view>
    </block>
    <text wx:if="{{item.attendees.length > 8}}" class="more">+{{item.attendees.length - 8}}</text>
  </view>
  <!-- 底部：作者 + 互动数 -->
  <view class="footer">
    <view class="author">
      <image src="{{item.author.avatarUrl}}" class="author-avatar"/>
      <text>{{item.author.nickname}}</text>
    </view>
    <view class="stats">
      <text>🌱 {{item.reactionCounts.gonming + item.reactionCounts.ran + item.reactionCounts.xiangqu}}</text>
      <text>💬 {{item.commentCount}}</text>
    </view>
  </view>
</view>
```

### 4.4 详情页（detail）

**数据结构**：
```js
data: {
  imprint: null,
  comments: [],
  myReaction: null,       // 'gonming' | 'ran' | 'xiangqu' | null
  iAmAttending: false,
  commentInput: '',
  replyTo: null,          // { commentId, authorName }
  loading: true,
  commentPage: 1,
  commentHasMore: true
}
```

**关键方法**：
- `onLoad({ id })` → 并行加载印记详情 + 评论列表 + 我的反应状态
- `onTapReaction(e)` → 切换/取消共鸣
- `onTapAttend` → 我也在场 / 取消在场
- `onTapReply(e)` → 设置 replyTo，聚焦输入框
- `onSubmitComment` → 发布评论
- `onDeleteComment(e)` → 删除评论（作者或评论者）
- `onReachBottom` → 加载更多评论

**页面结构**：
```
详情页
├── 图片轮播（swiper）
├── 活动类型徽章 + 日期 + 地点
├── 标题（大字）
├── 描述文字
├── 在场人区域
│   ├── 头像墙（可展开）
│   └── 「我也在场」按钮（已在场则高亮）
├── 共鸣区域（三个反应按钮，选中高亮）
├── 分割线
└── 评论区
    ├── 评论列表（正序）
    │   └── 每条：头像 + 昵称 + 内容 + 时间 + 回复按钮
    └── 底部输入框（固定）
```

### 4.5 发布页（publish）

**发布流程**（单页，不分步骤，减少跳转）：

```
发布页
├── 图片选择区（最多9张，点击添加）
├── 标题输入（必填）
├── 活动类型选择（图标网格，单选）
├── 地点输入（选填）
├── 描述输入（选填，多行）
├── 在场人区域
│   ├── 已添加的人（可删除）
│   └── 「+ 添加在场人」→ 弹出选择器
└── 「留下印记」按钮
```

**在场人选择器**（半屏弹窗）：
- 搜索框：输入昵称搜索注册书友（调 `/api/v1/users/search?q=xxx`）
- 搜索结果列表：点击添加
- 「手动输入名字」入口：输入非注册用户名字

**数据结构**：
```js
data: {
  mediaList: [],          // 已选图片列表
  title: '',
  activityType: '',
  location: '',
  description: '',
  attendees: [],          // 已添加在场人
  submitting: false,
  showAttendeePanel: false,
  attendeeSearch: '',
  searchResults: [],
  manualName: ''
}
```

**关键方法**：
- `onChooseImage` → `wx.chooseMedia`，上传后追加到 mediaList
- `onRemoveImage(e)` → 删除某张图片
- `onSelectType(e)` → 选择活动类型
- `onSearchAttendee(e)` → 防抖搜索书友
- `onAddAttendee(e)` → 添加注册书友
- `onAddManualAttendee` → 添加手动输入的名字
- `onSubmit` → 校验 + 发布

**图片上传逻辑**：
```
选图 → wx.chooseMedia
→ 逐张调用 wx.uploadFile 到 /api/v1/imprints/upload
→ 返回 { url, thumbUrl }
→ 追加到 mediaList
→ 发布时 mediaList 已是服务端 URL
```

注：需要为小程序用户新增一个图片上传接口（区别于现有的 admin 上传接口）。

---

## 五、图片/视频上传接口

现有上传接口仅供管理后台使用（`adminAuthMiddleware`）。需新增一个供小程序用户使用的上传接口。

**路由**：`POST /api/v1/imprints/upload`
**中间件**：`authMiddleware + userTenantContext`
**限制**：
- 文件类型：jpeg/jpg/png/webp/mp4/mov/m4v
- 单文件大小：后端 ≤ 50MB；小程序端图片 ≤ 2MB、视频 ≤ 50MB
- 每次请求：1 个文件
- 存储目录：`backend/uploads/tenants/<tenantSlug>/`

实现要点：在进入 multer 前通过 `setResolvedTenantId` 写入 `req._resolvedTenantId`，防止上传异步回调中租户上下文丢失。

**返回**：
```json
{
  "success": true,
  "data": {
    "url": "https://domain/uploads/tenants/xxx/filename.jpg",
    "thumbUrl": "https://domain/uploads/tenants/xxx/filename.jpg",
    "type": "image"
  }
}
```

MVP 阶段 thumbUrl 与 url 相同，P1 再做缩略图生成。

管理后台复用同一存储逻辑，路由为 `POST /api/v1/imprints/admin/upload`。

---

## 六、样式规范

### 颜色变量（zaichang.wxss 全局引入）

```css
/* 在场频道色彩系统 */
--zc-bg: #F5F0E8;
--zc-primary: #2D5A3D;
--zc-accent: #C4873A;
--zc-text: #2C2C2C;
--zc-text-secondary: #888888;
--zc-card-bg: #FFFFFF;
--zc-card-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
--zc-radius-card: 24rpx;
--zc-radius-img: 16rpx;
```

### 活动类型颜色

```css
.badge-reading  { background: #2D5A3D; color: #fff; }
.badge-cooking  { background: #C4873A; color: #fff; }
.badge-tea      { background: #8B6355; color: #fff; }
.badge-walk     { background: #4A7FA5; color: #fff; }
.badge-create   { background: #7B5EA7; color: #fff; }
.badge-other    { background: #888888; color: #fff; }
```

### 封面拼图 CSS 方案

```css
/* 2张：左右各半 */
.cover-2 { display: flex; gap: 4rpx; }
.cover-2 image { width: 50%; height: 400rpx; }

/* 3张：上大下两小 */
.cover-3 { display: flex; flex-direction: column; gap: 4rpx; }
.cover-3 .main { height: 300rpx; }
.cover-3 .sub { display: flex; gap: 4rpx; height: 200rpx; }
.cover-3 .sub image { width: 50%; }

/* 4张：田字格 */
.cover-4 { display: grid; grid-template-columns: 1fr 1fr; gap: 4rpx; }
.cover-4 image { height: 250rpx; }

/* 5+张：左大右2×2 */
.cover-5plus { display: flex; gap: 4rpx; }
.cover-5plus .main { width: 60%; height: 400rpx; }
.cover-5plus .grid { width: 40%; display: grid; grid-template-columns: 1fr 1fr; gap: 4rpx; }
.cover-5plus .grid image { height: 196rpx; }
```

---

## 七、工作量估算

| 模块 | 工作量 | 说明 |
|------|--------|------|
| 后端 Model（4个） | 0.5天 | Imprint / ImprintReaction / ImprintComment / ImprintActivityType |
| 后端 Controller + Routes | 1天 | 13个接口 |
| 图片上传接口 | 0.5天 | 复用现有 multer 逻辑 |
| 小程序列表页 | 1天 | 含封面拼图、筛选 chip |
| 小程序详情页 | 1天 | 含共鸣、在场人、评论 |
| 小程序发布页 | 1天 | 含图片上传、在场人搜索 |
| Tab 入口 + 图标 | 0.5天 | app.json + 图标资源 |
| 联调测试 | 1天 | |
| **合计** | **~6.5天** | |

---

## 七点一、当前实现差异（2026-06-02）

| 能力 | 当前状态 | 实现位置 |
|------|----------|----------|
| 多图/单视频 | 已实现，图片最多 9 张，视频单独 1 个，禁止混选 | `miniprogram/pages/zaichang/publish/publish.js` |
| 拖拽排序 | 已实现，发布页长按媒体后可调整顺序 | `publish.js` |
| 登录/付费守卫 | 已实现，小程序端和后端双重校验 | `period-access.js`、`imprint.routes.js` |
| 动态活动类型 | 已实现，后台可维护，前端有默认兜底 | `ImprintActivityType.js` |
| 列表排序 | 已改为 `updatedAt` 倒序 | `imprint.controller.js` |
| 分享 | 已实现列表/详情分享，预下载首张图片 | `list.js`、`detail.js` |
| 通知 | 已实现共鸣、评论、被提及通知 | `imprint.controller.js` |
| 行为埋点 | 已实现列表/详情/发布/共鸣/评论 | `activity.service.js` 调用点 |
| 管理后台 | 已实现列表、筛选、编辑、删除、上传、活动类型管理 | `ImprintsManagementView.vue` |

---

## 八、实施顺序

```
Day 1: 后端 Model + 基础 CRUD 接口（list/create/detail/delete）
Day 2: 后端 反应/在场人/评论 接口 + 图片上传接口
Day 3: 小程序列表页（含 Tab 入口）
Day 4: 小程序详情页
Day 5: 小程序发布页（含图片上传）
Day 6: 联调 + 修复 + 测试
```

---

## 九、待确认事项

1. **图片存储**：目前图片存本地 `uploads/` 目录，在场功能图片量会更大，是否需要接入 OSS？不用，就用`uploads/` 目录先，后续要改造成 OSS再说。
2. **Tab 图标**：需要设计「在场」Tab 图标（两人轮廓），提供 png 格式（未选中/选中各一张）。提供的文件在 assets/images/下的zaichang-hui.png和zaichang-lan.png
3. **用户搜索接口**：发布时搜索书友，是否复用现有 `/api/v1/users` 接口，还是新增专用搜索接口？这个如果可以复用就复用，如果效率太低就重写。
4. **非注册用户名字**：手动输入的名字是否需要做敏感词过滤？要的。
5. **内容审核**：MVP 阶段是否需要管理后台审核印记？（PRD 中列为 P2）先不审核，但是后台可以有删除，编辑功能。

## 十、仍未实现/后续设计

- 地图视图和 `/api/v1/imprints/map` 聚合接口尚未落地。
- 在场卡片长图生成尚未落地；当前只有微信分享入口。
- 发生时间 `happenedAt` 发布页暂未开放编辑，补记历史活动仍需后续实现。
- 非注册用户名字敏感词过滤尚未在当前代码中看到独立校验，应在后续内容审核能力中补齐。
