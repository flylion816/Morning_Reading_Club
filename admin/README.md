# 晨读营管理后台

Vue 3 + Element Plus 构建的晨读营小程序管理后台。

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 打开应用。

### 生产构建

```bash
npm run build
```

## 功能概述

- ✅ 管理员认证（登录/登出）
- ✅ 仪表板（统计和快速导航）
- ✅ 报名管理（审批、拒绝、详情查看）
- ✅ 支付记录（查看、统计、取消）
- ✅ 小凡看见管理（查看、编辑、删除反馈）
- ✅ 用户管理（用户列表、详情、权限管理）
- 🔄 期次管理（部分完成）

## 技术栈

- Vue 3
- TypeScript
- Vue Router
- Pinia
- Element Plus
- Axios
- Vite

## Demo 账号

- 邮箱: `admin@morningreading.com`
- 密码: `<从密钥管理服务读取>`

> ⚠️ 生产环境中必须更改默认密码

## 项目结构

```
src/
├── components/       # UI 组件（AdminLayout）
├── router/          # 路由配置
├── services/        # API 服务
├── stores/          # 状态管理
├── views/           # 页面组件
├── assets/          # 静态资源
├── App.vue          # 根组件
└── main.ts          # 应用入口
```

## 环境配置

修改 `.env.development` 和 `.env.production` 中的 API 地址。

## 推荐 IDE

VS Code + Vue (Official) 插件
