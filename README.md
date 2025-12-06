# 晨读营小程序

> 在晨光中,遇见更好的自己

## 项目简介

晨读营是一个基于微信小程序的习惯养成和打卡学习平台,通过23天的课程学习帮助用户培养良好的晨读习惯。

### 核心功能

- 📚 **课程学习**: 浏览和报名课程,查看每日学习内容
- ✅ **打卡系统**: 每日打卡记录学习心得,统计打卡数据
- ✨ **小凡看见**: AI生成个性化反馈,分享和权限管理
- 👥 **社群互动**: 评论、点赞、互动交流
- 📊 **数据统计**: 学习进度、打卡天数、完成率等

## 技术栈

### 前端
- **框架**: 微信小程序原生框架
- **样式**: WXSS (CSS变量系统)
- **状态管理**: 全局状态 + 本地存储

### 后端 API
- **架构**: RESTful API
- **认证**: JWT Token
- **基础URL**: `https://api.morning-reading.com/api/v1`

### 数据库
- **MySQL 8.0+**: 主数据库
- **Redis**: 缓存层

## 项目结构

```
miniprogram/
├── app.js                      # 应用入口
├── app.json                    # 应用配置
├── app.wxss                    # 全局样式
├── pages/                      # 页面目录
│   ├── index/                  # 首页(课程列表)
│   ├── profile/                # 个人中心
│   ├── login/                  # 登录页面
│   ├── course-detail/          # 课程详情
│   ├── checkin/                # 打卡页面
│   ├── insights/               # 小凡看见列表
│   ├── insight-detail/         # 反馈详情
│   ├── profile-others/         # 他人主页
│   └── share/                  # 分享卡片
├── components/                 # 组件目录
├── services/                   # API服务层
│   ├── auth.service.js         # 认证服务
│   ├── user.service.js         # 用户服务
│   ├── course.service.js       # 课程服务
│   ├── checkin.service.js      # 打卡服务
│   ├── insight.service.js      # 反馈服务
│   └── comment.service.js      # 评论服务
├── utils/                      # 工具函数
│   ├── request.js              # 网络请求
│   ├── storage.js              # 本地存储
│   ├── formatters.js           # 格式化工具
│   └── validators.js           # 验证工具
└── assets/                     # 静态资源
    ├── images/                 # 图片资源
    └── icons/                  # 图标资源
```

## 开发指南

### 环境准备

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 注册微信小程序账号,获取 AppID
3. 配置后端API服务器地址

### 快速开始

1. **克隆项目**
```bash
cd 晨读营项目目录
```

2. **配置 AppID**

打开 `project.config.json`,修改 appid:
```json
{
  "appid": "你的AppID"
}
```

3. **配置 API 地址**

打开 `miniprogram/app.js`,修改 apiBaseUrl:
```javascript
globalData: {
  apiBaseUrl: 'https://your-api-domain.com/api/v1'
}
```

4. **打开项目**

使用微信开发者工具打开 `miniprogram` 目录

5. **开始开发**

点击"编译"按钮,即可在模拟器中预览

### 开发规范

#### 命名规范

- **文件命名**: 小写字母,单词间用 `-` 连接,如 `course-detail.js`
- **变量命名**: 驼峰命名法,如 `userInfo`, `courseList`
- **常量命名**: 大写字母,单词间用 `_` 连接,如 `API_BASE_URL`
- **CSS类名**: 小写字母,单词间用 `-` 连接,如 `.course-item`

#### 代码风格

- 使用 2 空格缩进
- 使用单引号
- 每行代码不超过 100 字符
- 函数和方法添加注释说明

#### CSS 变量使用

项目使用 CSS 变量系统,定义在 `app.wxss` 中:

```css
/* 颜色 */
--color-primary: #4a90e2;
--color-text-primary: #2c3e50;

/* 间距 */
--spacing-sm: 16rpx;
--spacing-md: 24rpx;

/* 圆角 */
--radius-md: 16rpx;

/* 使用示例 */
.button {
  background: var(--color-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
}
```

## API 接口说明

### 认证相关

- `POST /auth/login` - 微信登录
- `POST /auth/refresh` - 刷新Token
- `POST /auth/logout` - 退出登录

### 用户相关

- `GET /user/profile` - 获取用户信息
- `PUT /user/profile` - 更新用户信息
- `GET /user/stats` - 获取用户统计

### 课程相关

- `GET /courses` - 获取课程列表
- `GET /courses/:id` - 获取课程详情
- `POST /periods/:id/enroll` - 报名课程

### 打卡相关

- `POST /checkins` - 提交打卡
- `GET /checkins/today` - 获取今日打卡状态
- `GET /checkins/stats` - 获取打卡统计

### 小凡看见相关

- `GET /insights/my` - 获取我的反馈列表
- `GET /insights/:id` - 获取反馈详情
- `POST /insights/:id/request` - 请求查看权限

更多API详情请参考 `架构设计-v2.0/晨读营小程序_API实现指南_v2.0.md`

## 设计规范

### 色彩系统

- **主色**: #4a90e2 (蓝色)
- **辅助色**: #51cf66 (绿色), #ffd93d (黄色)
- **文本色**: #2c3e50 (深色), #6b7280 (次要), #9ca3af (辅助)

### 字体规范

- **标题**: 32-40rpx, 字重 600-700
- **正文**: 28rpx, 字重 400
- **辅助**: 24-26rpx, 字重 400

### 间距规范

基于 8rpx 网格系统:
- xs: 8rpx
- sm: 16rpx
- md: 24rpx
- lg: 32rpx
- xl: 48rpx

## 部署发布

### 准备工作

1. 完成开发和测试
2. 检查代码质量和性能
3. 准备小程序相关资料(logo、截图等)

### 上传代码

1. 在微信开发者工具中点击"上传"
2. 填写版本号和项目备注
3. 上传成功后登录[微信公众平台](https://mp.weixin.qq.com/)

### 提交审核

1. 在"版本管理"中选择已上传的版本
2. 点击"提交审核"
3. 填写审核信息
4. 等待审核通过

### 发布上线

1. 审核通过后,在"版本管理"中点击"发布"
2. 确认发布版本
3. 发布成功

## 相关文档

### 📚 核心指南
- [主项目指南和快速参考](./CLAUDE.md) - 项目总体情况、工作流程、常见问题
- [开发流程指南](./DEVELOPMENT.md) - 标准工作流程、自测方法、文档更新
- [部署上线指南](./DEPLOYMENT.md) - 生产部署步骤、环保生成、配置管理
- [Bug修复经验库](./BUG_FIXES.md) - 30+ 个常见问题及解决方案

### 📖 专题文档
- [小程序开发指南](./MINIPROGRAM_GUIDE.md) - WeUI 规范、架构设计、最佳实践
- [Git工作流程](./GIT_WORKFLOW.md) - Git 操作、GitHub 认证、提交规范
- [安全文档](./SECURITY.md) - 安全最佳实践、数据保护、审计日志

### 📝 发布文档
- [v1.0.0 生产发布总结](./RELEASE_v1.0.0.md) - 发布内容、关键指标、已知问题
- [生产发布检查清单](./TESTING.md) - 上线前检查、测试验证、部署流程

### 🏗️ 历史文档
- [完整PRD文档](./prd-v2.1/)
- [架构设计文档](./架构设计-v2.0/)
- [HTML原型Demo](./demo-v3.0/)

## 问题反馈

如有问题或建议,请联系项目负责人。

## License

Copyright © 2025 晨读营团队
