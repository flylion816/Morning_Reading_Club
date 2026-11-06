# 🏠 本地完整部署指南

## 📌 概述

这是一个**本地完整的生产级环境**，包含：
- ✅ MongoDB（文档数据库）
- ✅ MySQL（关系数据库）
- ✅ Redis（缓存和队列）
- ✅ 后端应用（Node.js）
- ✅ 管理后台（Vue 3）
- ✅ 强化的安全认证

---

## 🚀 快速开始

### 方式 1：使用启动脚本（推荐）

```bash
# 进入项目目录
cd "/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营"

# 执行启动脚本
./start-local-dev.sh
```

脚本会自动：
1. 启动 Docker 容器（MongoDB、MySQL、Redis）
2. 等待数据库启动完成
3. 启动后端应用
4. 启动管理后台
5. 显示所有服务的访问地址和密码

### 方式 2：手动启动

```bash
# 1️⃣ 启动数据库
cd backend
docker-compose --env-file .env.docker up -d

# 2️⃣ 启动后端
npm run dev

# 3️⃣ 新开终端，启动管理后台
cd admin
npm run dev
```

---

## 📊 服务访问地址

| 服务 | 地址 | 用途 |
|------|------|------|
| **后端 API** | `http://localhost:3000` | 小程序调用 |
| **健康检查** | `http://localhost:3000/api/v1/health` | 验证后端 |
| **管理后台** | `http://localhost:5173` | 后台管理 |
| **MongoDB** | `localhost:27017` | 数据库 |
| **MySQL** | `localhost:3306` | 数据库 |
| **Redis** | `localhost:6379` | 缓存队列 |

---

## 🔐 数据库连接信息

### MongoDB

```
主机: localhost
端口: 27017
用户: admin
密码: <MONGODB_PASSWORD_FROM_ENV>
数据库: morning_reading
```

**连接字符串：**
```
mongodb://admin:CHANGE_ME@localhost:27017/morning_reading?authSource=admin
```

### MySQL

```
主机: localhost
端口: 3306
用户: morning_user
密码: REDACTED_SECRET_FROM_ENV
根用户密码: <MYSQL_ROOT_PASSWORD_FROM_ENV>
数据库: morning_reading
```

**连接字符串：**
```
mysql://morning_user:CHANGE_ME@localhost:3306/morning_reading
```

### Redis

```
主机: localhost
端口: 6379
密码: REDACTED_SECRET_FROM_ENV
数据库: 0
```

**连接命令：**
```bash
redis-cli -h localhost -p 6379 -a REDACTED_SECRET_FROM_ENV
```

---

## 📝 管理员账号

### 登录后端管理后台

```
URL: http://localhost:5173
邮箱: admin@morningreading.com
密码: <从密钥管理服务读取>
```

### API 认证

所有需要认证的 API 端点需要在请求头中包含：

```
Authorization: Bearer <access_token>
```

获取 token：

```bash
curl -X POST http://localhost:3000/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@morningreading.com","password":"<从密钥管理服务读取>"}'
```

---

## 🔧 数据库操作

### MongoDB 客户端连接

```bash
# 使用 mongosh
mongosh mongodb://admin:CHANGE_ME@localhost:27017/morning_reading

# 或使用 MongoDB Compass
# 连接字符串: mongodb://admin:CHANGE_ME@localhost:27017/morning_reading?authSource=admin
```

### MySQL 命令行连接

```bash
# 以普通用户连接
mysql -h localhost -u morning_user -p morning_reading
# 密码: REDACTED_SECRET_FROM_ENV

# 以 root 连接
mysql -h localhost -u root -p
# 密码: <MYSQL_ROOT_PASSWORD_FROM_ENV>
```

### Redis CLI 连接

```bash
# 使用 redis-cli
redis-cli -h localhost -p 6379 -a REDACTED_SECRET_FROM_ENV

# 或在容器内
docker exec -it morning-reading-redis redis-cli -a REDACTED_SECRET_FROM_ENV
```

---

## 📋 常用命令

### 查看容器状态

```bash
cd backend
docker-compose ps
```

### 查看容器日志

```bash
# MongoDB
docker-compose logs -f mongodb

# MySQL
docker-compose logs -f mysql

# Redis
docker-compose logs -f redis
```

### 重启容器

```bash
# 重启所有容器
docker-compose restart

# 重启特定容器
docker-compose restart mongodb
```

### 停止服务

```bash
# 停止 Docker 容器
docker-compose down

# 保留数据并停止
docker-compose stop

# 完全删除容器和数据
docker-compose down -v
```

### 查看应用日志

```bash
# 后端日志
tail -f /tmp/backend.log

# 管理后台日志
tail -f /tmp/admin.log
```

### 清除旧进程

```bash
# 杀死所有 npm 进程
pkill -f "npm run dev"

# 杀死特定 Node 进程
pkill -f "node.*src/server"
```

---

## 🧪 测试 API

### 测试后端连接

```bash
# 健康检查
curl http://localhost:3000/api/v1/health

# 应该返回
{"status":"ok","timestamp":"2026-02-25T..."}
```

### 测试数据库同步

修改用户信息，验证是否同步到所有数据库：

```bash
# 在后端控制台可以看到
[info] Processing sync event from queue
[info] Sync completed successfully
```

---

## 🚨 常见问题

**Q: 启动脚本失败？**
```bash
# 检查 Docker 是否运行
docker ps

# 检查端口是否被占用
lsof -i :3000
lsof -i :27017
lsof -i :3306
lsof -i :6379

# 清理旧容器
docker-compose down -v
```

**Q: 数据库连接超时？**
```bash
# 检查容器是否真的运行
docker ps | grep morning-reading

# 查看容器日志
docker logs morning-reading-mongodb
docker logs morning-reading-mysql
docker logs morning-reading-redis
```

**Q: 忘记了密码？**
检查以下文件：
- `backend/.env.local` - 应用使用的密码
- `backend/.env.docker` - Docker 容器使用的密码

**Q: 想要重置数据库？**
```bash
# 删除 Docker 数据卷
docker-compose down -v

# 重新启动（会创建新的空数据库）
docker-compose up -d
```

---

## 📊 性能优化建议

### 本地开发机制

Docker Compose 已配置：
- ✅ 内存限制：各容器 512MB
- ✅ CPU 限制：各容器 1 核
- ✅ 健康检查：自动监控服务状态
- ✅ 自动重启：容器崩溃时自动重启

### 日志级别

后端使用 `debug` 级别（适合开发）：
```
LOG_LEVEL=debug  # 开发
LOG_LEVEL=info   # 生产
```

### 数据库优化

```bash
# 创建索引加快查询
# MongoDB
db.users.createIndex({ openid: 1 })

# MySQL
CREATE INDEX idx_user_openid ON users(openid);
```

---

## 🔄 工作流程

### 典型开发流程

1. **启动环境**
   ```bash
   ./start-local-dev.sh
   ```

2. **修改代码**
   - 后端：`backend/src/**/*.js`
   - 管理后台：`admin/src/**/*.{ts,vue}`

3. **自动重新加载**
   - 后端：nodemon 自动重启（src 目录变化）
   - 管理后台：Vite HMR 热更新

4. **测试修改**
   - 打开 `http://localhost:5173` 测试管理后台
   - 使用 Postman 或 curl 测试 API
   - 在微信开发工具中指向 `http://localhost:3000`

5. **查看日志**
   - 后端日志：`tail -f /tmp/backend.log`
   - 管理后台日志：`tail -f /tmp/admin.log`
   - 容器日志：`docker-compose logs -f`

---

## 📚 相关文档

- 完整配置：`CLAUDE.md`
- 部署指南：`DEPLOYMENT.md`
- 开发规范：`DEVELOPMENT.md`
- Git 工作流：`GIT_WORKFLOW.md`
