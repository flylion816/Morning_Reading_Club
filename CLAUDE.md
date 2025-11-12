# Claude Code 开发指南

本文档为 Claude Code 提供项目开发的重要说明和规范。

## 📋 项目信息

- **项目名称**: 晨读营小程序
- **仓库地址**: https://github.com/flylion816/Morning_Reading_Club
- **项目类型**: 微信小程序
- **技术栈**: 微信小程序原生框架 + Node.js
- **UI框架**: 微信官方样式库 WeUI

## 📂 交流指导原则

### **请用中文回答我的所有问题**

在协助开发时，请遵循以下原则：
- 用审视的目光仔细分析我的需求，指出潜在问题
- 提供在我思考框架之外的建议和最佳实践
- 如果发现明显的错误或不合理的设计，务必纠正我
- 主动提示可能的风险和更好的替代方案

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
const request = (options) => {
  const token = wx.getStorageSync('auth_token');
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
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
  --primary-color: #1AAD19;
  --text-color: #333333;
  --bg-color: #F5F5F5;
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

## 🔧 Git 操作规范

### ⚠️ 重要：使用 gh 命令而不是 git

**本项目必须使用 `gh` 命令进行代码提交和推送，不要直接使用 `git push`。**

### 正确的提交流程

```bash
# 1. 查看修改状态
git status

# 2. 添加修改的文件
git add .
# 或添加特定文件
git add <file-path>

# 3. 提交到本地仓库
git commit -m "提交信息

详细说明（可选）

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. 使用 gh 推送（重要！）
# 方法1: 直接使用带token的URL推送
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main

# 方法2: 先配置credential，再推送
git config --local credential.helper store
git push origin main
```

### ❌ 禁止的操作

```bash
# 不要直接使用 git push（会失败）
git push origin main  # ❌ 错误

# 不要使用 SSH 方式（未配置SSH密钥）
git push git@github.com:flylion816/Morning_Reading_Club.git main  # ❌ 错误
```

### ✅ 推荐的完整提交命令

```bash
# 一键提交并推送
cd "/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营" && \
git add -A && \
git commit -m "feat: 添加新功能

详细描述改动内容

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>" && \
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main
```

## 📝 提交信息规范

### Commit Message 格式

```
<type>: <subject>

<body>

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Type 类型说明

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构代码
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

### 示例

```bash
git commit -m "feat: 实现课程详情页

- 添加课程基本信息展示
- 实现23天打卡日历
- 支持查看已打卡状态
- 添加报名功能

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 🚫 .gitignore 规则

以下文件/目录会被自动忽略，不会提交到仓库：

```
# 系统文件
.DS_Store
*.log

# 配置文件
project.private.config.json

# Node.js
node_modules/
npm-debug.log*
package-lock.json

# 编译产物
miniprogram_npm/

# IDE配置
.vscode/
.idea/

# 云开发
.cloudbase/
```

## 📂 项目结构

```
晨读营小程序/
├── miniprogram/              # 小程序主目录
│   ├── app.js               # 应用入口
│   ├── app.json             # 应用配置
│   ├── app.wxss             # 全局样式
│   ├── config/              # 配置文件
│   ├── utils/               # 工具函数
│   ├── services/            # API服务层
│   ├── pages/               # 页面目录
│   ├── components/          # 组件目录
│   └── assets/              # 静态资源
├── prd-v2.1/                # PRD文档
├── 架构设计-v2.0/           # 架构设计文档
├── demo-v3.0/               # HTML原型
├── README.md                # 项目说明
├── CLAUDE.md                # 本文件
├── package.json             # Node.js配置
├── project.config.json      # 小程序项目配置
└── .gitignore              # Git忽略规则
```

## 🔑 认证配置

### gh CLI 已配置

项目已配置 GitHub CLI (gh)，认证信息存储在系统中。

### 检查认证状态

```bash
# 检查gh认证状态
gh auth status

# 查看当前token
gh auth token

# 重新登录（如需要）
gh auth login
```

## 📌 重要提醒

1. **始终使用 gh 命令推送代码**
2. **提交前检查 .gitignore 是否正确排除了不需要的文件**
3. **每次提交都要写清楚的 commit message**
4. **不要提交敏感信息（token, 密钥等）**
5. **大文件（>5MB）不要直接提交，使用 Git LFS 或对象存储**

## 🔄 常用 Git 命令

```bash
# 查看状态
git status

# 查看提交历史
git log --oneline -10

# 查看远程仓库
git remote -v

# 拉取最新代码
git pull origin main

# 查看分支
git branch -a

# 撤销未提交的修改
git checkout -- <file>

# 撤销已暂存的文件
git reset HEAD <file>
```

## 🐛 问题排查

### 推送失败

如果推送失败，检查：

1. gh 认证是否有效：`gh auth status`
2. 网络连接是否正常
3. 仓库权限是否正确

### 解决方案

```bash
# 重新配置credential
git config --local --unset-all credential.helper
git config --local credential.helper store

# 使用token推送
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main
```

## 📖 参考资源

- [GitHub CLI 文档](https://cli.github.com/manual/)
- [Git 官方文档](https://git-scm.com/doc)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)

---

**最后更新**: 2025-01-12
**维护者**: Claude Code
