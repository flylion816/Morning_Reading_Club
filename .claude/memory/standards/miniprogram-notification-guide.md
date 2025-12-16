# 小程序通知系统集成指南

## 📋 概述

本指南说明如何在微信小程序中集成通知系统，包括通知页面、徽章组件和服务集成。

## 🎯 核心组件

### 1. 通知服务 (`notification.service.js`)

所有通知相关的API调用都通过此服务进行。

**主要方法**:

```javascript
import notificationService from '@/services/notification.service';

// 获取通知列表
await notificationService.getNotifications(page, limit, isRead);

// 获取未读数量
await notificationService.getUnreadCount();

// 标记已读
await notificationService.markAsRead(notificationId);

// 标记全部已读
await notificationService.markAllAsRead();

// 删除通知
await notificationService.deleteNotification(notificationId);

// 获取通知类型标签/图标/颜色
notificationService.getTypeLabel(type);
notificationService.getTypeIcon(type);
notificationService.getTypeColor(type);

// 格式化时间
notificationService.formatTime(timestamp);
```

### 2. 通知页面 (`/pages/notifications/`)

独立的通知列表页面，显示所有用户通知。

**特性**:

- 📋 列表显示所有通知
- 🔽 选项卡过滤 (全部/未读/已读)
- 📌 点击通知自动标记为已读
- 🗑️ 删除单个或所有通知
- ⚡ 分页加载更多
- 🔔 未读数量徽章

**使用方式**:

```javascript
// 在需要跳转的地方
wx.navigateTo({
  url: '/pages/notifications/notifications'
});
```

### 3. 通知徽章组件 (`notification-badge`)

可复用的徽章组件，显示未读通知数量。

**使用方式**:

```json
// 在 page.json 或 component.json 中注册
{
  "usingComponents": {
    "notification-badge": "/components/notification-badge/notification-badge"
  }
}
```

```wxml
<!-- 在页面中使用 -->
<notification-badge
  unreadCount="{{unreadCount}}"
  bindnotificationTap="handleNotificationTap"
  bindunreadCountChange="handleUnreadCountChange"
/>
```

**事件**:

- `bindnotificationTap` - 用户点击徽章时触发
- `bindunreadCountChange` - 未读数量变化时触发

## 🚀 快速集成

### 第1步：注册路由

确保 `app.json` 中包含通知页面：

```json
{
  "pages": [
    "pages/index/index",
    "pages/notifications/notifications",
    ...
  ]
}
```

### 第2步：在首页添加徽章

```json
// pages/index/index.json
{
  "usingComponents": {
    "notification-badge": "/components/notification-badge/notification-badge"
  }
}
```

```wxml
<!-- pages/index/index.wxml -->
<view class="header">
  <text class="title">首页</text>
  <notification-badge
    unreadCount="{{unreadCount}}"
    bindnotificationTap="handleNotificationTap"
    bindunreadCountChange="handleUnreadCountChange"
  />
</view>
```

```javascript
// pages/index/index.js
import notificationService from '@/services/notification.service';

Page({
  data: {
    unreadCount: 0
  },

  onLoad() {
    this.loadUnreadCount();
  },

  onShow() {
    // 每次页面显示时刷新
    this.loadUnreadCount();
  },

  async loadUnreadCount() {
    try {
      const response = await notificationService.getUnreadCount();
      if (response.code === 200) {
        this.setData({ unreadCount: response.data.unreadCount });
      }
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  },

  handleNotificationTap() {
    wx.navigateTo({
      url: '/pages/notifications/notifications'
    });
  },

  handleUnreadCountChange(event) {
    const { unreadCount } = event.detail;
    this.setData({ unreadCount });
  }
});
```

## 📊 完整工作流程

### 用户完整操作流程

```
1. 用户在首页看到通知徽章 (红色圆点显示未读数)
   ↓
2. 用户点击徽章 → 导航到通知页面
   ↓
3. 通知页面显示所有通知列表
   ↓
4. 用户可以：
   a) 点击通知 → 自动标记为已读 → 跳转到相关申请
   b) 删除通知 → 确认后移除
   c) 切换选项卡查看不同状态的通知
   d) 点击"全部已读" → 标记所有为已读
   ↓
5. 页面刷新，未读数更新
```

### 服务端触发通知的流程

```
1. 用户操作 (创建申请、批准、拒绝等)
   ↓
2. 后端 API 响应并创建通知记录
   ↓
3. 小程序定期调用 getUnreadCount() 更新徽章
   或用户手动刷新/导航到通知页面时更新
```

## 🎨 自定义样式

### 修改徽章颜色

编辑 `notification-badge.wxss`:

```css
.badge {
  background: #your-color;
}
```

### 修改通知项颜色

编辑 `notifications.wxss`:

```css
.notification-item.unread {
  border-left-color: #your-color;
}
```

## 🔄 状态管理

### 本地缓存未读数

如果要在应用启动时快速显示未读数，可以使用本地缓存：

```javascript
// 保存未读数到本地
wx.setStorage({
  key: 'unreadNotificationCount',
  data: unreadCount
});

// 读取本地缓存
const { data } = wx.getStorageSync('unreadNotificationCount');
```

### 定时刷新

徽章组件会每30秒自动刷新一次未读数。如需自定义间隔：

```javascript
// 在 notification-badge.js 中修改
const refreshInterval = setInterval(() => {
  this.loadUnreadCount();
}, 60000); // 改为60秒
```

## 🧪 测试场景

### 场景1: 测试通知创建和显示

```
1. 打开小程序首页
2. 观察通知徽章 (应为0或之前的数值)
3. 在另一个账户中创建申请
4. 回到小程序，手动刷新或等待30秒
5. 徽章数应更新为1
```

### 场景2: 测试标记已读

```
1. 进入通知页面
2. 观察未读通知数
3. 点击一条未读通知
4. 该通知应变为已读状态
5. 未读数应减1
```

### 场景3: 测试全部已读

```
1. 进入通知页面，未读通知数 > 0
2. 点击"全部已读"
3. 确认操作
4. 所有通知应变为已读
5. 未读数应为0
```

### 场景4: 测试删除操作

```
1. 进入通知页面
2. 点击通知右上角的 ✕ 按钮
3. 确认删除
4. 通知应从列表中移除
```

## 📱 页面路由注册

确保在 `app.json` 中正确注册了所有页面：

```json
{
  "pages": [
    "pages/index/index",
    "pages/notifications/notifications",
    "pages/insight-request-detail/insight-request-detail",
    ...
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#fff",
    "navigationBarTitleText": "晨读营",
    "navigationBarTextStyle": "black"
  }
}
```

## 🔐 权限检查

通知系统已在后端进行权限检查：

- ✅ 用户只能查看自己的通知
- ✅ 用户只能删除自己的通知
- ✅ 未读状态准确反映用户的阅读状态

## 🚨 常见问题

### Q: 徽章不显示？

A: 检查以下几点：

1. 是否在 page.json 中注册了组件
2. 通知服务是否正确导入
3. API 是否返回正确的未读数

### Q: 通知页面显示为空？

A: 可能的原因：

1. 后端没有创建通知
2. API 认证失败
3. 网络连接问题

查看控制台输出确认错误。

### Q: 点击通知后没有跳转？

A: 检查以下几点：

1. 通知是否包含 `requestId`
2. 目标页面是否注册在路由中
3. 控制台是否有路由错误

### Q: 未读数更新延迟？

A: 这是正常的。由于以下原因可能导致延迟：

1. 徽章组件每30秒刷新一次
2. 网络延迟
3. 后端处理延迟

需要实时更新，可以减少刷新间隔或使用 WebSocket（待实现）。

## 📈 性能优化

### 1. 缓存优化

```javascript
// 避免频繁的 API 调用
const lastFetch = {};

async function getCachedUnreadCount() {
  const now = Date.now();
  if (lastFetch.time && now - lastFetch.time < 5000) {
    return lastFetch.data;
  }
  const data = await notificationService.getUnreadCount();
  lastFetch = { time: now, data };
  return data;
}
```

### 2. 分页加载

通知列表支持分页，避免一次加载过多数据：

```javascript
// 默认每页20条，支持通过参数调整
await notificationService.getNotifications(page, 50, 'all');
```

### 3. 异步加载

不阻塞主线程：

```javascript
// 页面显示时异步加载通知
onShow() {
  // 不使用 await，让其后台加载
  this.loadNotifications();
}
```

## 📚 文件结构

```
miniprogram/
├── services/
│   └── notification.service.js       # 通知服务
├── pages/
│   └── notifications/
│       ├── notifications.wxml        # 通知列表模板
│       ├── notifications.js          # 通知页面逻辑
│       ├── notifications.wxss        # 通知页面样式
│       └── notifications.json        # 页面配置
├── components/
│   └── notification-badge/
│       ├── notification-badge.wxml   # 徽章组件模板
│       ├── notification-badge.js     # 徽章组件逻辑
│       ├── notification-badge.wxss   # 徽章组件样式
│       └── notification-badge.json   # 组件配置
└── app.json                           # 应用配置
```

## 🔗 相关文档

- 后端通知 API: `.claude/memory/standards/notification-system-guide.md`
- 权限管理: `.claude/memory/standards/permission-management-guide.md`
- 小程序指南: `MINIPROGRAM_GUIDE.md`

---

**最后更新**: 2025-12-04
**维护者**: Claude Code
**状态**: 已实现，可用于集成
