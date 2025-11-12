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

## 🐛 Bug修复经验库

> **重要：每次修复bug后，将值得复用的经验总结到这里**

### 💡 经验总结原则

1. **记录问题现象** - 用户看到的表面问题
2. **分析根本原因** - 深层次的技术原因
3. **提供解决方案** - 可复用的修复方法
4. **提炼经验教训** - 举一反三的通用原则

---

### 1. 页面空白问题（WXSS编译错误）

**问题现象**：首页完全空白，不显示任何内容

**根本原因**：`app.wxss` 使用了微信小程序不支持的复杂CSS变量语法
```css
/* ❌ 错误：微信小程序不完全支持CSS变量 */
page {
  --color-primary: #4a90e2;
  --color-primary-light: #e8f4ff;
}
.btn {
  background: var(--color-primary);
}
```

**解决方案**：简化CSS，使用基础语法
```css
/* ✅ 正确：使用基础CSS */
page {
  background-color: #f5f5f5;
  font-size: 28rpx;
}
.btn {
  background: #4a90e2;
}
```

**经验教训**：
- ⚠️ 微信小程序对CSS支持有限，避免使用复杂特性
- ⚠️ WXSS编译错误会导致整个页面不渲染
- ✅ 优先使用WeUI提供的样式类
- ✅ 出现空白页第一时间检查Console的WXSS编译错误

---

### 2. 日期格式兼容性问题

**问题现象**：Console出现大量黄色警告："new Date不支持此格式"

**根本原因**：使用了iOS不兼容的日期格式
```javascript
// ❌ 错误：iOS不支持这种格式
new Date("2025-11-10 05:59:00")
```

**解决方案**：使用iOS兼容的格式
```javascript
// ✅ 正确：使用斜杠分隔
new Date("2025/11/10 05:59:00")
```

**经验教训**：
- ⚠️ iOS对日期格式要求严格，必须使用 `yyyy/MM/dd` 格式
- ⚠️ Android两种格式都支持，但要兼容iOS
- ✅ 所有日期字符串统一使用斜杠格式
- ✅ Mock数据中的日期也要遵循此规范

---

### 3. setData异步问题

**问题现象**：Profile页面一直显示loading，未登录状态判断错误

**根本原因**：`setData`是异步的，不能立即读取更新后的值
```javascript
// ❌ 错误：setData后立即读取this.data
this.setData({ isLogin: true });
if (this.data.isLogin) {  // 可能还是旧值！
  this.loadUserData();
}
```

**解决方案**：使用其他数据源或回调
```javascript
// ✅ 正确：使用globalData或回调
const app = getApp();
const isLogin = app.globalData.isLogin;
this.setData({ isLogin });
if (isLogin) {  // 使用之前获取的值
  this.loadUserData();
}
```

**经验教训**：
- ⚠️ `setData`是异步操作，不会立即更新`this.data`
- ⚠️ 不要在`setData`后立即读取相同的数据
- ✅ 使用`app.globalData`存储需要跨页面同步的状态
- ✅ 或者在回调中操作：`this.setData({...}, () => { /* 这里可以读取 */ })`

---

### 4. 自定义组件数据传递问题

**问题现象**：点击课程卡片报错"课程信息不存在"

**根本原因**：组件内部使用`this.data.course`而不是`this.properties.course`
```javascript
// ❌ 错误：properties不会自动同步到data
Component({
  properties: { course: Object },
  methods: {
    onTap() {
      const course = this.data.course;  // undefined!
    }
  }
});
```

**解决方案**：使用`this.properties`
```javascript
// ✅ 正确：直接使用properties
Component({
  properties: { course: Object },
  methods: {
    onTap() {
      const course = this.properties.course;  // 正确
    }
  }
});
```

**经验教训**：
- ⚠️ 组件的`properties`和`data`是独立的
- ⚠️ 父组件传入的数据在`this.properties`中，不在`this.data`中
- ✅ 组件内部访问传入的数据要用`this.properties.xxx`
- ✅ 如需在data中使用，要在observer中手动同步

---

### 5. 自定义组件事件绑定问题

**问题现象**：点击自定义组件，父组件的事件处理函数没有触发

**根本原因**：自定义组件的自定义事件绑定方式错误
```xml
<!-- ❌ 错误：自定义事件不能用bindtap -->
<course-card bindtap="handleCourseClick" />
```

**解决方案**：使用冒号语法
```xml
<!-- ✅ 正确：自定义事件用bind:eventname -->
<course-card bind:tap="handleCourseClick" />
```

**经验教训**：
- ⚠️ 自定义组件的**原生事件**用`bindtap`（如view的tap）
- ⚠️ 自定义组件的**自定义事件**用`bind:eventname`（组件triggerEvent触发的）
- ✅ 区分原生事件和自定义事件的绑定方式
- ✅ 组件内部用`this.triggerEvent('tap', {...})`触发，父组件用`bind:tap`接收

---

### 6. 事件冒泡问题

**问题现象**：事件处理函数被调用两次，第二次数据错误

**根本原因**：原生事件冒泡导致父组件再次触发
```xml
<!-- 组件内部 -->
<view bindtap="onCardTap">...</view>
<!-- 触发顺序：1. onCardTap -> 2. 冒泡到父组件 -> 3. 父组件handleCourseClick -->
```

**解决方案**：使用`catchtap`阻止冒泡
```xml
<!-- ✅ 正确：catchtap阻止冒泡 -->
<view catchtap="onCardTap">...</view>
```

**经验教训**：
- ⚠️ `bindtap`：触发后继续冒泡
- ⚠️ `catchtap`：触发后阻止冒泡（相当于`e.stopPropagation()`）
- ✅ 使用`catchtap`后不需要手动调用`e.stopPropagation()`
- ✅ 如果手动调用会报错：`TypeError: e.stopPropagation is not a function`
- ✅ 自定义组件通常用`catchtap`避免冒泡问题

---

### 7. 微信隐私API调用时机问题

**问题现象**：`getUserProfile:fail can only be invoked by user TAP gesture`

**根本原因**：`wx.getUserProfile`必须在用户点击事件中**直接同步调用**
```javascript
// ❌ 错误：在Promise链中调用
async handleLogin() {
  const code = await getWxCode();  // 异步
  const userInfo = await wx.getUserProfile();  // 错误！不在点击事件中
}
```

**解决方案**：在点击事件中第一步就同步调用
```javascript
// ✅ 正确：在点击事件中直接调用
async handleLogin() {
  // 第一步：直接同步调用getUserProfile
  const userInfo = await new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => resolve(res.userInfo),
      fail: reject
    });
  });

  // 后续的异步操作
  const code = await getWxCode();
  await login(code, userInfo);
}
```

**经验教训**：
- ⚠️ 微信隐私API（`getUserProfile`、`chooseImage`等）必须由用户点击直接触发
- ⚠️ 不能在异步回调、Promise链、setTimeout中调用
- ✅ 在按钮点击处理函数的**第一步**就同步调用API
- ✅ 获取结果后再进行其他异步操作
- ✅ 开发环境可以使用Mock登录绕过此限制

---

### 8. Mock数据时间过期问题

**问题现象**：首页显示"暂无待打卡课程"，但实际有Mock数据

**根本原因**：Mock数据的时间是固定的过去时间，筛选逻辑过滤掉了
```javascript
// ❌ 问题：固定时间会过期
const mockData = {
  startTime: '2025-10-10 06:00:00',  // 上个月的时间
  endTime: '2025-10-12 06:00:00'
};

// 筛选逻辑
const now = Date.now();
const isValid = now >= startTime && now <= endTime;  // false！
```

**解决方案**：使用相对时间或动态更新
```javascript
// ✅ 方案1：使用相对时间
const today = new Date();
const mockData = {
  startTime: new Date(today.setDate(today.getDate() - 1)),  // 昨天
  endTime: new Date(today.setDate(today.getDate() + 2))     // 明天
};

// ✅ 方案2：手动更新Mock数据时间到当前月份
```

**经验教训**：
- ⚠️ Mock数据使用固定时间会很快过期
- ⚠️ 特别注意时间相关的筛选逻辑
- ✅ Mock数据时间使用相对时间（如"今天"、"昨天"）
- ✅ 或者定期更新Mock数据到当前时间范围
- ✅ 测试时注意检查筛选条件是否生效

---

## 🎯 调试技巧总结

### 1. 页面空白问题排查流程

```
1. 检查Console是否有WXSS编译错误（红色）
   ↓ 有错误
2. 修复WXSS语法问题
   ↓ 无错误
3. 检查页面是否有JS运行时错误
   ↓ 有错误
4. 修复JS错误
   ↓ 无错误
5. 检查数据是否正确加载（添加console.log）
   ↓ 数据为空
6. 检查API调用/Mock数据
```

### 2. 事件不触发问题排查流程

```
1. 添加console.log确认事件处理函数是否被调用
   ↓ 未调用
2. 检查事件绑定语法是否正确
   - 原生事件: bindtap / catchtap
   - 自定义事件: bind:eventname
   ↓ 语法正确
3. 检查组件是否正确引用和注册
   ↓ 正确
4. 检查事件冒泡是否被阻止
```

### 3. 数据传递问题排查流程

```
1. 在数据传递的每个环节添加console.log
   - 父组件：传递前
   - 子组件：接收后
   - 事件触发：回传时
   ↓ 找到数据丢失的环节
2. 检查数据结构是否匹配
3. 检查是否使用了正确的数据源
   - 组件: this.properties vs this.data
   - 页面: this.data vs app.globalData
```

### 4. 必备调试日志模板

```javascript
// 页面加载
onLoad(options) {
  console.log('===== 页面加载 =====');
  console.log('参数:', options);
}

// 数据获取
async loadData() {
  console.log('开始加载数据...');
  const res = await api.getData();
  console.log('获取到数据:', res);
  this.setData({ data: res });
  console.log('数据设置完成');
}

// 事件处理
handleClick(e) {
  console.log('===== 事件触发 =====');
  console.log('事件对象:', e);
  console.log('e.detail:', e.detail);
  console.log('e.currentTarget:', e.currentTarget);
}
```

---

## 📝 Bug修复清单模板

每次修复bug后，按此模板记录：

```markdown
### X. 问题标题

**问题现象**：用户看到的表面问题

**根本原因**：深层次技术原因
[错误代码示例]

**解决方案**：正确的实现方式
[正确代码示例]

**经验教训**：
- ⚠️ 需要注意的陷阱
- ✅ 正确的做法
- ✅ 通用原则
```

---

**最后更新**: 2025-11-12
**维护者**: Claude Code
