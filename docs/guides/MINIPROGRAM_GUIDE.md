## 🎨 微信小程序开发规范

### ⚠️ 核心原则

1. **必须使用微信小程序原生框架**，不使用第三方框架（如 Taro、uni-app 等）
2. **样式库始终使用微信官方样式库 WeUI**
3. **遵循微信小程序开发最佳实践**
4. **使用微信官方组件库，不自行重复造轮子**

### 🧩 WeUI 使用规范

#### 引入方式

```bash
# 安装 WeUI 小程序版
npm install weui-miniprogram --save

# 在微信开发者工具中构建 npm
工具 -> 构建 npm
```

#### 组件使用

```json
// 在页面或组件的 json 文件中引入
{
  "usingComponents": {
    "mp-button": "weui-miniprogram/button/button",
    "mp-cell": "weui-miniprogram/cell/cell",
    "mp-cells": "weui-miniprogram/cells/cells",
    "mp-dialog": "weui-miniprogram/dialog/dialog",
    "mp-toast": "weui-miniprogram/toast/toast"
  }
}
```

#### 常用 WeUI 组件

- **基础组件**：button、icon、badge、loadmore、progress
- **表单组件**：input、checkbox、radio、switch、slider、uploader
- **操作反馈**：actionsheet、dialog、msg、toast、half-screen-dialog
- **导航组件**：tabbar、navbar、searchbar
- **展示组件**：article、gallery、panel、media-box、cells

### 📐 小程序架构规范

#### 目录结构

```
miniprogram/
├── app.js                    # 应用入口
├── app.json                  # 全局配置
├── app.wxss                  # 全局样式
├── config/                   # 配置管理
│   ├── env.js               # 环境配置
│   ├── constants.js         # 常量定义
│   └── api.config.js        # API配置
├── utils/                    # 工具函数
│   ├── request.js           # 网络请求封装
│   ├── storage.js           # 存储封装
│   ├── formatters.js        # 格式化工具
│   └── validators.js        # 验证工具
├── services/                 # 服务层（API调用）
│   ├── auth.service.js      # 认证服务
│   ├── user.service.js      # 用户服务
│   └── course.service.js    # 课程服务
├── pages/                    # 页面
│   └── index/
│       ├── index.js         # 页面逻辑
│       ├── index.json       # 页面配置
│       ├── index.wxml       # 页面结构
│       └── index.wxss       # 页面样式
├── components/               # 自定义组件
│   └── custom-component/
│       ├── index.js
│       ├── index.json
│       ├── index.wxml
│       └── index.wxss
└── assets/                   # 静态资源
    ├── images/
    └── icons/
```

#### 配置管理规范

**1. 环境配置 (config/env.js)**

```javascript
// 统一管理不同环境的配置
const currentEnv = 'dev';
const envConfig = {
  dev: {
    apiBaseUrl: 'https://dev-api.xxx.com',
    wxAppId: 'wxxxxxxxxxxx',
    enableDebug: true
  },
  prod: {
    apiBaseUrl: 'https://api.xxx.com',
    wxAppId: 'wxxxxxxxxxxx',
    enableDebug: false
  }
};
module.exports = { ...envConfig[currentEnv], currentEnv };
```

**2. 常量管理 (config/constants.js)**

```javascript
// 集中管理所有魔法数字和字符串
module.exports = {
  STORAGE_KEYS: {
    TOKEN: 'auth_token',
    USER_INFO: 'user_info'
  },
  COURSE_DURATION: 23,
  CHECKIN_MIN_LENGTH: 50
};
```

**3. API配置 (config/api.config.js)**

```javascript
// 统一管理API端点
module.exports = {
  auth: {
    wxLogin: '/auth/wx-login',
    getUserInfo: '/auth/user-info'
  },
  course: {
    list: '/courses',
    detail: '/courses/:id'
  }
};
```

### 🔧 开发最佳实践

#### 1. 网络请求封装

```javascript
// utils/request.js
const request = options => {
  const token = wx.getStorageSync('auth_token');
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: res => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // 处理未授权
          wx.navigateTo({ url: '/pages/login/login' });
          reject(res);
        } else {
          reject(res);
        }
      },
      fail: reject
    });
  });
};
```

#### 2. 服务层封装

```javascript
// services/course.service.js
const request = require('../utils/request');
const apiConfig = require('../config/api.config');

module.exports = {
  getCourseList(params) {
    return request({
      url: apiConfig.course.list,
      method: 'GET',
      data: params
    });
  },

  getCourseDetail(courseId) {
    return request({
      url: apiConfig.course.detail.replace(':id', courseId),
      method: 'GET'
    });
  }
};
```

#### 3. 页面开发规范

```javascript
// pages/index/index.js
const courseService = require('../../services/course.service');
const constants = require('../../config/constants');

Page({
  data: {
    courses: [],
    loading: false
  },

  onLoad() {
    this.loadCourses();
  },

  async loadCourses() {
    this.setData({ loading: true });
    try {
      const res = await courseService.getCourseList();
      this.setData({ courses: res.data });
    } catch (err) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  }
});
```

#### 4. 组件开发规范

```javascript
// components/course-card/index.js
Component({
  properties: {
    course: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { courseId: this.data.course.id });
    }
  }
});
```

### 🎯 样式开发规范

#### 1. 使用 rpx 单位

```css
/* 使用 rpx 实现响应式布局，750rpx = 屏幕宽度 */
.container {
  width: 750rpx;
  padding: 30rpx;
}

.title {
  font-size: 32rpx;
  line-height: 44rpx;
}
```

#### 2. 使用 CSS 变量

```css
/* app.wxss - 定义全局CSS变量 */
page {
  --primary-color: #1aad19;
  --text-color: #333333;
  --bg-color: #f5f5f5;
}

/* 页面中使用 */
.button {
  background-color: var(--primary-color);
  color: var(--text-color);
}
```

#### 3. 优先使用 WeUI 样式类

```html
<!-- 使用 WeUI 提供的样式类 -->
<view class="weui-panel weui-panel_access">
  <view class="weui-panel__hd">标题</view>
  <view class="weui-panel__bd">
    <view class="weui-media-box weui-media-box_text">
      <view class="weui-media-box__title">内容标题</view>
      <view class="weui-media-box__desc">内容描述</view>
    </view>
  </view>
</view>
```

### 🚀 性能优化规范

1. **图片优化**
   - 使用 WebP 格式
   - 压缩图片大小
   - 使用 CDN 加载远程图片
   - 懒加载长列表图片

2. **代码优化**
   - 使用分包加载
   - 按需加载组件
   - 避免频繁 setData
   - setData 数据量控制

3. **请求优化**
   - 合并接口请求
   - 使用缓存策略
   - 设置合理的超时时间

### 📱 适配规范

1. **屏幕适配**
   - 使用 rpx 单位
   - 支持 iPhone、Android 各种尺寸
   - 处理刘海屏、全面屏

2. **兼容性**
   - 基础库版本要求：>= 2.10.0
   - API 使用前检查兼容性
   - 降级处理方案

### ✅ 代码质量规范

1. **ESLint 规则**
   - 2空格缩进
   - 单引号字符串
   - 必须使用分号
   - 禁止 console（生产环境）

2. **命名规范**
   - 文件名：小写+连字符（kebab-case）
   - 变量名：驼峰命名（camelCase）
   - 常量名：大写+下划线（UPPER_CASE）
   - 组件名：小写+连字符（kebab-case）

3. **注释规范**
   ```javascript
   /**
    * 获取课程列表
    * @param {Object} params - 查询参数
    * @param {number} params.page - 页码
    * @param {number} params.pageSize - 每页数量
    * @returns {Promise} 课程列表数据
    */
   async getCourseList(params) {
     // 实现代码
   }
   ```
