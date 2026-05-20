# 凡人播客功能设计文档

> 版本：v1.1  
> 日期：2026-05-20  
> 状态：待实现

---

## 一、需求背景

晨读营每天课程结束后，主理人会在微信群发布一段音频回放（凡人播客），配有一段介绍文字（书友故事摘要、金句等）。目前音频只在微信群分发，用户需要在群里找文件，体验割裂。

目标：将凡人播客集成到小程序课程页，让用户在课程详情页直接收听，并支持悬浮播放器跨页面持续播放。

**与正文音频的区别**：未来"读一读"模块也会有朗读音频（`audioUrl` 字段），属于正文配音。凡人播客是独立的节目形态，字段完全分开，互不干扰。

---

## 二、功能范围

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 后端数据模型 | Section 新增播客三字段 | P0 |
| 后端上传接口 | 支持 m4a/mp3/aac 文件类型 | P0 |
| 后端外部接口 | 上传播客音频、同步播客信息 | P0 |
| 管理后台 | 编辑课节弹窗新增播客区块 | P0 |
| 小程序课程页 | 播客卡片（播一播），无配置时不显示 | P0 |
| 小程序首页 | 今日播客卡片，无配置时不显示 | P0 |
| 小程序播放页 | 播客详情页（标题+进度+介绍）| P0 |
| 小程序悬浮播放器 | 全局浮动 mini 播放条（所有页面）| P0 |
| 文档 | EXTERNAL_API_GUIDE.md 补充 | P0 |

---

## 三、数据模型变更

### 3.1 Section 模型新增字段

文件：`backend/src/models/Section.js`

```js
podcastUrl: {
  type: String,
  maxlength: 500,
  default: null
},
podcastDescription: {
  type: String,
  maxlength: 3000,
  default: null
},
podcastDuration: {
  type: Number,   // 单位：秒
  default: null,
  min: 0
}
```

**保留字段（不动）**：
- `audioUrl` — 预留给正文朗读音频
- `duration` — 预留给正文音频时长（分钟）

### 3.2 MySQL 备份同步

`backend/src/services/mysql-backup.service.js` 中 sections 表的 coerce 映射需补充三个新字段：

```js
coerce(section.podcastUrl),
coerce(section.podcastDescription),
coerce(section.podcastDuration),
```

---

## 四、后端接口设计

### 4.1 上传路由扩展

文件：`backend/src/routes/upload.routes.js`

`fileFilter` 正则加入音频格式：

```js
const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|mp4|webm|m4a|mp3|aac/;
```

文件大小限制从 50MB 提升到 200MB（音频文件通常 30-100MB）：

```js
limits: { fileSize: 200 * 1024 * 1024 }
```

### 4.2 外部接口：上传播客音频

**路由**：`POST /api/v1/sections/external/upload-podcast`

**中间件**：`publicTenantContext`（与现有外部接口一致，无额外鉴权）

**请求**：
```
Content-Type: multipart/form-data
X-Tenant-ID: <tenant-id>

Body:
  file: <音频文件，支持 m4a/mp3/aac，最大 200MB>
```

**响应**：
```json
{
  "code": 0,
  "message": "上传成功",
  "data": {
    "podcastUrl": "https://wx.shubai01.com/uploads/tenants/default/1716192000000-abc123.m4a",
    "filename": "1716192000000-abc123.m4a",
    "size": 35258368,
    "uploadedAt": "2026-05-20T08:00:00.000Z"
  }
}
```

**错误响应**：
- `400` 缺少文件 / 文件类型不支持
- `403` 缺少租户上下文
- `413` 文件超过 200MB

### 4.3 外部接口：同步播客信息到课节

**路由**：`POST /api/v1/sections/external/sync-podcast`

**中间件**：`publicTenantContext`

**请求**：
```json
{
  "sessionId": "69f9bf45cb1c9ac0600ad55b",
  "podcastUrl": "https://wx.shubai01.com/uploads/tenants/default/xxx.m4a",
  "podcastDescription": "🌟 【晨读音频回放】以终为始...",
  "podcastDuration": 2000
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionId | string | 是 | 课节 ID（即 Section `_id`） |
| podcastUrl | string | 否 | 音频文件地址；传 null 可清空 |
| podcastDescription | string | 否 | 介绍文字，最大 3000 字；传 null 可清空 |
| podcastDuration | number | 否 | 时长（秒）；传 null 可清空 |

至少需要传一个非 sessionId 字段，否则返回 400。

**响应**：
```json
{
  "code": 0,
  "message": "同步成功",
  "data": {
    "sessionId": "69f9bf45cb1c9ac0600ad55b",
    "podcastUrl": "https://...",
    "podcastDuration": 2000,
    "updatedAt": "2026-05-20T08:00:00.000Z"
  }
}
```

**错误响应**：
- `400` sessionId 缺失 / 无有效更新字段
- `404` 课节不存在

### 4.4 外部接口典型工作流

```
1. 调 API #1（upload-podcast）上传 .m4a 文件 → 拿到 podcastUrl
2. 调 API #2（sync-podcast）把 podcastUrl + podcastDescription + podcastDuration 写入课节
```

也可以只调 API #2（如果音频已有外部 CDN 地址，直接传 URL）。

### 4.5 现有管理员接口扩展

`createSection` 和 `updateSection` 的 req.body 解构需加入三个新字段：

```js
const { ..., podcastUrl, podcastDescription, podcastDuration } = req.body;
```

`updateSection` 已用 `Object.keys(updates).forEach` 动态赋值，模型加字段后自动生效，**无需改动 controller**。

`createSection` 需在 `Section.create({...})` 中显式加入三个字段。

---

## 五、管理后台设计

文件：`admin/src/views/ContentManagementView.vue`

### 5.1 编辑课节弹窗新增区块

在"扩展信息"区块（`section-title` 为"扩展信息"）内，**时长字段下方**新增播客区块：

```
扩展信息
─────────────────────────────────────────────
时长（分钟）    [- 23 +]

─── 凡人播客 ───────────────────────────────

播客音频        [选择文件]
                ↳ 已上传：凡人播客：以终为始.m4a（33.6MB）[× 删除]
                ↳ 地址：https://wx.shubai01.com/uploads/...（只读）

播客时长（秒）  [______]  （上传后自动填入，也可手动修改）

播客介绍        ┌──────────────────────────────────────┐
                │ 🌟 【晨读音频回放】以终为始...        │
                │                                      │
                └──────────────────────────────────────┘
                0 / 3000

发布状态        ● 已发布
```

### 5.2 上传交互逻辑

1. 点击"选择文件"触发 `<input type="file" accept=".m4a,.mp3,.aac">`
2. 选中后立即调用 `POST /api/v1/upload`（现有管理员上传接口）
3. 上传中显示进度条（`el-progress`）
4. 上传成功后：
   - `editingSection.podcastUrl` 写入返回的 URL
   - 文件名和大小展示在按钮旁
5. 点击"× 删除"清空 `podcastUrl`，隐藏文件信息

### 5.3 TypeScript 类型扩展

```ts
interface Section {
  // 现有字段...
  podcastUrl?: string | null;
  podcastDescription?: string | null;
  podcastDuration?: number | null;
}
```

---

## 六、小程序设计

### 6.1 课程详情页新增「播一播」卡片

文件：`miniprogram/pages/course-detail/course-detail.wxml`

插入位置：在"说一说"（`course.sayVisible`）区块之后，打卡列表之前。

**显示条件**：仅当 `course.podcastUrl` 有值时显示，后台未配置则不渲染。

**卡片结构**：

```
┌─────────────────────────────────────────────┐
│  [播] 播一播                                  │
│                                              │
│  ┌───────────────────────────────────────┐  │
│  │  🎙  第7天 成长和改变的原则            │  │
│  │      33分20秒                         │  │
│  │                                       │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━  ▶ 播放     │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  🌟 今天的音频非常精彩且触动灵魂...           │
│  [展开介绍 ↓]                               │
└─────────────────────────────────────────────┘
```

- 卡片外壳沿用 `.content-section` 样式（白底圆角）
- 标题行图标色与其他 section 图标一致（蓝色渐变）
- 播放器内嵌区：图标 + 标题（课节 title）+ 时长 + 播放/暂停按钮
- 介绍文字默认折叠（显示 3 行），点"展开介绍"展开全文

**条件渲染**：

```xml
<view class="content-section" wx:if="{{course.podcastUrl}}">
  <view class="section-title">
    <view class="section-icon podcast">播</view>
    <text>播一播</text>
  </view>
  <!-- 播放器内嵌区 -->
  <!-- 介绍文字折叠区 -->
</view>
```

### 6.2 播客播放页（新页面）

路径：`miniprogram/pages/podcast-player/podcast-player`

**页面布局**：

```
┌─────────────────────────────────────┐
│  ← 返回                              │
│                                     │
│         [课程封面图 / 默认图]         │
│                                     │
│    凡人播客：以终为始                 │
│    第7天 · 七个习惯晨读营             │
│                                     │
│  00:13:58 ━━━━━━━━━━━━━━ 33:20     │
│                                     │
│         ⏪15s   ▶/⏸   ⏩15s         │
│                                     │
│  ─── 节目介绍 ───────────────────── │
│  🌟 【晨读音频回放】以终为始...       │
│  （可滚动长文）                      │
└─────────────────────────────────────┘
```

**页面参数**（通过 URL query 传入）：

| 参数 | 说明 |
|------|------|
| sectionId | 课节 ID |
| title | 播客标题（课节 title） |
| podcastUrl | 音频地址 |
| podcastDuration | 时长（秒） |

**音频控制**：使用 `wx.createInnerAudioContext()`，支持：
- 播放 / 暂停
- 快进 / 快退 15 秒
- 进度条拖拽
- 播放完毕自动停止

### 6.3 全局悬浮播放器

**实现方式**：自定义组件 `miniprogram/components/podcast-player-bar/`，在 `app.json` 的 `usingComponents` 全局注册，在**所有页面**的 wxml 中引入。

**显示条件**：`app.globalData.podcastActive === true`（有音频被加载，无论播放还是暂停均显示）

**样式参考**：小宇宙 App 底部播放条——一条横贯全屏的窄条，左侧封面/图标 + 标题 + 进度条，右侧播放/暂停按钮 + 播放列表按钮。

**组件结构**：

```
┌──────────────────────────────────────────────────┐
│ [🎙] 第7天 成长和改变的原则          ▶/⏸    ≡  │
│      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
└──────────────────────────────────────────────────┘
```

- `position: fixed; bottom: 0; left: 0; right: 0`，高度 112rpx（含进度条）
- 背景白色，顶部 1rpx 分割线，轻微阴影
- 进度条在底部，细条（8rpx 高），已播部分蓝色，未播部分灰色
- 左侧：圆角方形图标（40rpx）+ 标题（单行截断）
- 右侧：播放/暂停图标（48rpx）+ 播放列表图标（48rpx）
- 点击条体（非按钮区域）跳转到播放页
- 有音频加载时显示，无音频时隐藏（`wx:if="{{podcastActive}}"`）
- 页面底部需预留 112rpx padding，避免内容被遮挡

**全局状态**（`app.globalData`）：

```js
podcastActive: false,        // 是否有音频被加载（播放或暂停均为 true）
podcastPlaying: false,       // 是否正在播放
podcastTitle: '',            // 当前播客标题（课节 title）
podcastUrl: '',              // 当前音频地址
podcastDuration: 0,          // 总时长（秒）
podcastCurrentTime: 0,       // 当前进度（秒）
podcastSectionId: '',        // 来源课节 ID
```

**注意**：`InnerAudioContext` 实例挂在 `app.globalData.audioContext`，跨页面共享同一实例，避免切页面时音频中断。

### 6.4 首页今日播客卡片

文件：`miniprogram/pages/index/index.wxml`

**插入位置**：今日任务区块（`.task-section`）下方，紧接其后。

**显示条件**：`todaySection.podcastUrl` 有值时显示，否则不渲染。

**卡片结构**：

```
┌─────────────────────────────────────────────┐
│  🎙 今日播客                                  │
│                                              │
│  第7天 成长和改变的原则                       │
│  33分20秒                                    │
│                                              │
│                          [▶ 去收听 →]        │
└─────────────────────────────────────────────┘
```

- 白底圆角卡片，与今日任务卡片风格一致
- 标题使用课节 `title`
- 时长格式化显示（如"33分20秒"）
- 点击整个卡片或"去收听"按钮跳转到播放页
- 若当天已在播放该播客，按钮改为"继续收听 →"

**数据来源**：首页已有 `todaySection` 数据（来自 `GET /api/v1/sections/today/task`），该接口返回的 select 字段需补充 `podcastUrl podcastDuration`。

### 6.5 后端接口返回新字段

`getSectionDetail` 和 `getSectionsByPeriod` 的 select 字段需包含 `podcastUrl podcastDescription podcastDuration`。

`getSectionsByPeriod` 列表接口的 select 字符串（`backend/src/controllers/section.controller.js` 第 11 行）：

```js
'_id periodId day title subtitle icon duration sortOrder order isPublished checkinCount createdAt updatedAt podcastUrl podcastDuration'
```

`getTodayTask` 接口同样需要返回 `podcastUrl podcastDuration`（首页今日播客卡片依赖此数据）。

注意：列表接口和今日任务接口**不返回** `podcastDescription`（文字较长，列表不需要）。详情接口返回全部字段。

---

## 七、播客上传订阅通知

### 7.1 触发时机

`sync-podcast` 外部接口成功写入 `podcastUrl` 后（即首次设置或更新播客），**异步**向该课节所属期次的所有报名用户推送订阅消息。

仅在 `podcastUrl` 从无到有（新增）时推送，更新已有播客不重复推送。

### 7.2 新增订阅场景

文件：`backend/src/config/subscribe-message.config.js`

新增场景 `podcast_published`：

```js
podcast_published: {
  scene: 'podcast_published',
  title: '凡人播客上新',
  description: '当天课程的凡人播客上传后通知报名用户收听',
  templateId: '',  // 需在微信公众平台申请模板后填入
  page: 'pages/course-detail/course-detail',
  autoTopUpTarget: 50,
  fieldDefinitions: [
    { name: 'podcastTitle', label: '播客标题' },
    { name: 'dayInfo',      label: '课程信息' },
    { name: 'publishTime',  label: '发布时间' }
  ],
  defaultFieldKeyMap: {
    podcastTitle: 'thing1',
    dayInfo:      'thing2',
    publishTime:  'time3'
  },
  fieldKeyMapEnv: 'WECHAT_SUBSCRIBE_FIELD_KEYS_PODCAST_PUBLISHED'
}
```

**模板字段说明**（需在微信公众平台选择匹配的订阅消息模板）：

| 字段 | 示例值 |
|------|--------|
| podcastTitle | 第7天 成长和改变的原则 |
| dayInfo | 七个习惯晨读营 · 第7天 |
| publishTime | 2026-05-20 08:30 |

### 7.3 推送逻辑

文件：`backend/src/controllers/section.controller.js`（`syncPodcast` 函数内）

```
1. 检查 section.podcastUrl 是否为空（旧值）
2. 若旧值为空、新值非空 → 触发推送
3. 查询该 section.periodId 下所有 enrollment（报名记录），取 userId 列表
4. 遍历用户列表，调用 dispatchNotificationWithSubscribe：
   - notificationType: 'podcast_published'
   - title: '凡人播客上新'
   - content: section.title
   - subscribeFields: { podcastTitle, dayInfo, publishTime }
   - page: `pages/course-detail/course-detail?id=${sectionId}`
5. 推送为异步，不阻塞接口响应
```

### 7.4 环境变量

`.env` 需新增：

```
WECHAT_SUBSCRIBE_FIELD_KEYS_PODCAST_PUBLISHED=
```

格式与其他场景一致，值为 JSON 字符串，用于覆盖 `defaultFieldKeyMap`（微信模板字段 key 因模板不同而异）。

---

## 八、文件改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `backend/src/models/Section.js` | 修改 | 新增 podcastUrl / podcastDescription / podcastDuration |
| `backend/src/routes/upload.routes.js` | 修改 | fileFilter 加音频格式，文件大小上限改 200MB |
| `backend/src/routes/section.routes.js` | 修改 | 新增两条外部路由 |
| `backend/src/controllers/section.controller.js` | 修改 | createSection 加三字段；新增 uploadPodcast / syncPodcast 函数（含推送逻辑）；列表 select 加字段 |
| `backend/src/config/subscribe-message.config.js` | 修改 | 新增 podcast_published 场景 |
| `backend/src/services/mysql-backup.service.js` | 修改 | sections 表 coerce 补三字段 |
| `admin/src/views/ContentManagementView.vue` | 修改 | 编辑课节弹窗加播客区块 |
| `miniprogram/pages/index/index.wxml` | 修改 | 新增今日播客卡片 |
| `miniprogram/pages/index/index.wxss` | 修改 | 今日播客卡片样式 |
| `miniprogram/pages/index/index.js` | 修改 | 今日播客卡片数据和跳转逻辑 |
| `miniprogram/pages/course-detail/course-detail.wxml` | 修改 | 新增「播一播」卡片 |
| `miniprogram/pages/course-detail/course-detail.wxss` | 修改 | 播客卡片样式 |
| `miniprogram/pages/course-detail/course-detail.js` | 修改 | 播客播放逻辑、跳转播放页 |
| `miniprogram/pages/podcast-player/podcast-player.wxml` | 新增 | 播放页 |
| `miniprogram/pages/podcast-player/podcast-player.wxss` | 新增 | 播放页样式 |
| `miniprogram/pages/podcast-player/podcast-player.js` | 新增 | 播放页逻辑 |
| `miniprogram/pages/podcast-player/podcast-player.json` | 新增 | 播放页配置 |
| `miniprogram/components/podcast-player-bar/index.wxml` | 新增 | 悬浮播放条组件（小宇宙底部条样式） |
| `miniprogram/components/podcast-player-bar/index.wxss` | 新增 | 悬浮播放条样式 |
| `miniprogram/components/podcast-player-bar/index.js` | 新增 | 悬浮播放条逻辑 |
| `miniprogram/components/podcast-player-bar/index.json` | 新增 | 悬浮播放条配置 |
| `miniprogram/app.js` | 修改 | globalData 加播客状态；初始化 audioContext |
| `miniprogram/app.json` | 修改 | 注册 podcast-player 页面和 podcast-player-bar 全局组件 |
| `docs/guides/EXTERNAL_API_GUIDE.md` | 修改 | 补充两个新外部接口说明 |

---

## 九、实现顺序建议

1. **后端先行**：Section 模型 → 上传路由 → subscribe-message.config（新增场景）→ section controller（含推送逻辑）→ section routes（外部接口）→ mysql-backup
2. **管理后台**：编辑课节弹窗播客区块（依赖后端接口）
3. **小程序**：课程详情页「播一播」卡片 → 首页今日播客卡片 → 播放页 → 悬浮播放条组件 → app.js 全局状态
4. **文档**：EXTERNAL_API_GUIDE.md 补充

---

## 十、已确认事项

- [x] 音频文件服务器存储空间充足（服务器现有 10+ GB 可用）
- [x] 悬浮播放器在所有页面显示，样式参考小宇宙 App 底部播放条
- [x] 播客标题直接使用课节 `title` 字段，不单独维护 `podcastTitle`
- [x] 播客上传后推送订阅通知给期次内所有报名用户（仅首次上传触发）
- [x] 课程详情页和首页今日播客卡片：后台未配置 podcastUrl 时不显示
