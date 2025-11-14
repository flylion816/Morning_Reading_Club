# 📚 项目文档索引

> 快速找到你需要的文档

## 🎯 我要做什么？

### 场景1: 我是开发人员，想在本地调试
**👉 查看**: [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md)

**你会得到**:
- ✅ 完整的本地环境搭建步骤
- ✅ Docker数据库配置
- ✅ 后端服务启动
- ✅ 小程序连接本地服务
- ✅ 测试数据初始化
- ✅ 常见问题解决方案

**预计时间**: 10-15分钟

---

### 场景2: 我要部署到线上生产环境
**👉 查看**: [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)

**你会得到**:
- ✅ 服务器配置要求
- ✅ 完整部署步骤
- ✅ 安全配置指南
- ✅ Nginx反向代理配置
- ✅ SSL证书配置
- ✅ PM2进程管理
- ✅ 监控和日志配置
- ✅ 故障排查指南

**预计时间**: 1-2小时

---

### 场景3: 我要对接API接口
**👉 查看**: [backend/API文档v3.0.md](./backend/API文档v3.0.md)

**你会得到**:
- ✅ 所有API端点详细说明
- ✅ 请求/响应格式
- ✅ 认证方式
- ✅ 错误代码说明
- ✅ 接口调用示例

---

### 场景4: 我要了解项目整体情况
**👉 查看**: [README.md](./README.md)

**你会得到**:
- ✅ 项目简介
- ✅ 核心功能
- ✅ 技术栈
- ✅ 项目结构

---

## 📁 所有文档清单

| 文档名称 | 用途 | 适用人员 | 重要程度 |
|---------|------|---------|---------|
| [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) | 本地开发环境搭建 | 开发人员 | ⭐⭐⭐⭐⭐ |
| [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md) | 生产环境部署 | 运维人员 | ⭐⭐⭐⭐⭐ |
| [backend/API文档v3.0.md](./backend/API文档v3.0.md) | API接口文档 | 前后端开发 | ⭐⭐⭐⭐⭐ |
| [README.md](./README.md) | 项目概览 | 所有人 | ⭐⭐⭐⭐ |
| [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) | 文档索引（本文档） | 所有人 | ⭐⭐⭐ |

---

## 🔥 快速命令参考

### 本地开发

```bash
# 1. 启动数据库（第一次需要等待镜像下载）
cd backend
docker-compose up -d

# 2. 安装依赖
npm install

# 3. 初始化测试数据
npm run init:mongodb

# 4. 启动后端服务
npm run dev

# 后端服务运行在: http://localhost:3000
```

### 生产部署

```bash
# 1. 上传代码到服务器
git clone YOUR_REPO_URL /var/www/morning-reading

# 2. 安装依赖
cd /var/www/morning-reading/backend
npm install --production

# 3. 配置环境变量
cp .env.example .env.production
nano .env.production  # 修改为生产配置

# 4. 初始化数据库
NODE_ENV=production node scripts/init-mongodb.js

# 5. 使用PM2启动
pm2 start ecosystem.config.js

# 6. 保存PM2配置
pm2 save
```

### 常用维护命令

```bash
# 查看PM2状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 reload all

# 停止服务
pm2 stop all

# 查看Docker容器状态
docker-compose ps

# 查看Docker日志
docker-compose logs -f mongodb
```

---

## 🛠 技术栈速查

### 前端
- 微信小程序原生框架
- JavaScript, WXML, WXSS

### 后端
- **运行时**: Node.js 18+
- **框架**: Express 4.x
- **数据库**: MongoDB 6.0, MySQL 8.0, Redis 7.0
- **认证**: JWT
- **ORM**: Mongoose

### 部署
- **容器**: Docker, Docker Compose
- **进程管理**: PM2
- **反向代理**: Nginx
- **SSL**: Let's Encrypt

---

## 📊 数据库信息

### 本地开发（Docker）
```
MongoDB:
- 地址: localhost:27017
- 数据库: morning_reading
- 用户: admin
- 密码: admin123

MySQL:
- 地址: localhost:3306
- 数据库: morning_reading
- 用户: morning_user
- 密码: morning123

Redis:
- 地址: localhost:6379
- 密码: 无
```

### 生产环境
需要在 `.env.production` 中配置真实的强密码！

---

## 🔑 环境变量配置

### 必须修改的配置

生产环境部署前，**必须修改**:

1. ✅ `MONGODB_URI` - MongoDB连接字符串（包含强密码）
2. ✅ `MYSQL_PASSWORD` - MySQL密码（强密码）
3. ✅ `REDIS_PASSWORD` - Redis密码（强密码）
4. ✅ `JWT_SECRET` - JWT密钥（强随机密钥）
5. ✅ `JWT_REFRESH_SECRET` - JWT刷新密钥（强随机密钥）
6. ✅ `WECHAT_APP_SECRET` - 微信AppSecret（真实值）

**生成强随机密钥**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 🌐 服务地址

### 本地开发
- 后端API: http://localhost:3000
- 健康检查: http://localhost:3000/health
- API基础路径: http://localhost:3000/api/v1

### 生产环境
- 后端API: https://api.morning-reading.com
- 健康检查: https://api.morning-reading.com/health
- API基础路径: https://api.morning-reading.com/api/v1

---

## 🎓 学习路径

### 新人入门

1. **了解项目** (5分钟)
   - 阅读 [README.md](./README.md)

2. **搭建本地环境** (15分钟)
   - 按照 [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) 操作

3. **熟悉API** (30分钟)
   - 阅读 [backend/API文档v3.0.md](./backend/API文档v3.0.md)
   - 使用curl测试几个接口

4. **开始开发**
   - 在小程序开发者工具中运行项目
   - 尝试修改代码并测试

### 部署上线

1. **准备工作** (1小时)
   - 阅读 [PRODUCTION_DEPLOYMENT_GUIDE.md](./PRODUCTION_DEPLOYMENT_GUIDE.md)
   - 准备服务器和域名
   - 配置DNS解析

2. **部署服务** (2小时)
   - 安装所需软件
   - 配置数据库
   - 部署应用代码
   - 配置Nginx和SSL

3. **上线验证** (30分钟)
   - 测试API接口
   - 配置微信小程序域名白名单
   - 小程序端到端测试

---

## ❓ 常见问题快速解答

### Q: Docker启动失败？
**A**: 确保Docker Desktop正在运行: `open -a "Docker"`

### Q: 端口被占用？
**A**: 查看占用进程: `lsof -i :3000`，或修改 `.env` 中的 `PORT`

### Q: MongoDB连接失败？
**A**: 检查容器状态: `docker-compose ps`，查看日志: `docker-compose logs mongodb`

### Q: 小程序无法连接后端？
**A**:
1. 确认后端运行: `curl http://localhost:3000/health`
2. 微信开发者工具勾选"不校验合法域名"
3. 检查 `miniprogram/config/env.js` 配置

### Q: 如何重新初始化数据？
**A**:
```bash
docker-compose down -v
docker-compose up -d
sleep 10
npm run init:mongodb
```

---

## 📞 获取帮助

### 遇到问题？

1. **查看文档**: 先在本索引中找到对应文档
2. **查看日志**: `pm2 logs` 或 `docker-compose logs`
3. **常见问题**: 各文档都有"常见问题"章节
4. **提交Issue**: 如果问题未解决，提交详细的问题描述

---

## 🎉 开始吧！

选择你的场景，找到对应文档，跟着步骤操作即可！

所有文档都经过实际验证，可以直接使用。

**祝你开发/部署顺利！🚀**

---

**文档索引版本**: v1.0
**创建时间**: 2025-11-13
**维护者**: 开发团队
