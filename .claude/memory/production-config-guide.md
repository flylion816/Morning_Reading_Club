# 🚀 生产环境配置指南

## 📌 配置现状与推荐方案

### 配置项检查清单

| 配置项             | 文件              | 当前状态 | 问题                                 | 推荐方案                  |
| ------------------ | ----------------- | -------- | ------------------------------------ | ------------------------- |
| **MySQL Host**     | `.env.production` | ❌       | 占位符 `prod-db-host.example.com`    | 阿里云 RDS 或自建         |
| **MySQL Password** | `.env.production` | ❌       | 占位符 `CHANGE_THIS_PASSWORD`        | 16+ 字符强密码            |
| **Redis Host**     | `.env.production` | ❌       | 占位符 `prod-redis-host.example.com` | 阿里云 ElastiCache        |
| **Redis Password** | `.env.production` | ❌       | 占位符 `CHANGE_THIS_PASSWORD`        | 强密码                    |
| **MongoDB URI**    | `.env.production` | ⚠️       | 本地地址 `127.0.0.1`                 | MongoDB Atlas (云) 或自建 |
| **JWT Secrets**    | `.env.production` | ✅       | 已配置                               | 保持                      |
| **WeChat Config**  | `.env.production` | ✅       | 生产 AppID                           | 保持                      |
| **Nginx**          | -                 | ❌       | 未配置                               | 反向代理 + SSL            |
| **PM2 Deploy**     | `pm2.config.js`   | ⚠️       | 占位符 host                          | 改为实际服务器 IP         |
| **SSL Cert**       | -                 | ❌       | 未申请                               | Let's Encrypt             |

---

## 🔧 两种推荐部署方案

### 方案 A：全云服务（⭐⭐⭐⭐⭐ 推荐）

**优点**：稳定、易扩展、无需管理底层基础设施
**成本**：约 ¥200-300/月

```
MongoDB Atlas (0.5GB免费) → MongoDB+
MySQL RDS (阿里云) → 按量付费
Redis ElastiCache → 按量付费
应用服务器 (ECS 2核4G) → ¥100-150/月
```

### 方案 B：自建服务器（⭐⭐⭐ 备选）

**优点**：成本低、完全控制
**成本**：¥50-100/月 (VPS)

```
单服务器 (4核8G) → ¥50-100/月
自建 MongoDB/MySQL/Redis (Docker)
```

---

## 📝 关键配置项详解

### 1. MySQL 配置

**当前问题**：

```bash
MYSQL_HOST=prod-db-host.example.com    # ❌ 占位符
MYSQL_PASSWORD=<从密钥管理服务读取>    # ❌ 占位符
```

**推荐值（阿里云 RDS）**：

```bash
MYSQL_HOST=rm-abc123xyz.mysql.rds.aliyuncs.com
MYSQL_PORT=3306
MYSQL_USER=morning_user
MYSQL_PASSWORD=<从密钥管理服务读取>  # 至少16字符，包含大小写+符号+数字
MYSQL_DATABASE=morning_reading
```

### 2. Redis 配置

**当前问题**：

```bash
REDIS_HOST=prod-redis-host.example.com    # ❌ 占位符
REDIS_PASSWORD=<从密钥管理服务读取>       # ❌ 占位符
```

**推荐值（阿里云 ElastiCache）**：

```bash
REDIS_HOST=r-abc123xyz.redis.rds.aliyuncs.com
REDIS_PORT=6379
REDIS_PASSWORD=<从密钥管理服务读取>  # 强密码
```

### 3. MongoDB 配置

**当前值**（使用本地）：

```bash
MONGODB_URI=mongodb://admin:CHANGE_ME@127.0.0.1:27017/morning_reading
```

**推荐改为 MongoDB Atlas**（免费 0.5GB）：

```bash
# 申请地址：https://www.mongodb.com/cloud/atlas
MONGODB_URI=mongodb+srv://username:CHANGE_ME@cluster0.xxxxx.mongodb.net/morning_reading?retryWrites=true&w=majority
```

---

## 🛡️ 安全建议

1. **密码策略**
   - 至少 16 个字符
   - 包含大小写字母、数字、符号
   - 不要使用词典中的单词
   - 定期轮换（3个月）

2. **JWT 密钥**（已配置，保持）
   - 不要改动现有密钥
   - 密钥泄露时需要立即轮换

3. **环境变量管理**
   - 不要提交 `.env.production` 到 Git
   - 使用 `.env.production.example` 作为模板
   - 在服务器使用密钥管理系统（KMS）

---

## 📦 Docker Compose 最佳实践

使用 `.env.prod` 文件管理敏感信息：

```bash
# .env.prod (不提交到 Git，.gitignore 包含此文件)
MYSQL_PASSWORD=<从密钥管理服务读取>
REDIS_PASSWORD=<从密钥管理服务读取>
JWT_SECRET=REDACTED_SECRET_FROM_ENV
JWT_REFRESH_SECRET=REDACTED_SECRET_FROM_ENV
WECHAT_SECRET=<从密钥管理服务读取>

# 启动
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

## 🚀 快速开始（推荐步骤）

### 1️⃣ 选择部署方案

- 💰 如果有预算：选择**方案 A（全云服务）**
- 💸 如果成本敏感：选择**方案 B（自建服务器）**

### 2️⃣ 创建云服务实例

```
阿里云控制台：
- RDS MySQL 8.0 (1核1G，按量) → 约¥60/月
- ElastiCache Redis (1GB，按量) → 约¥30/月
- ECS (2核4G) → 约¥100/月
```

### 3️⃣ 更新 .env.production

填入实际的数据库地址和密码

### 4️⃣ 配置 Nginx + SSL

参考下面的 Nginx 配置部分

### 5️⃣ 部署应用

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔒 Nginx 反向代理 + SSL 配置

### 申请 SSL 证书（免费 Let's Encrypt）

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d wx.shubai01.com

# 证书位置
/etc/letsencrypt/live/wx.shubai01.com/fullchain.pem
/etc/letsencrypt/live/wx.shubai01.com/privkey.pem
```

### Nginx 配置示例

```nginx
server {
    listen 443 ssl http2;
    server_name wx.shubai01.com;

    ssl_certificate /etc/letsencrypt/live/wx.shubai01.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wx.shubai01.com/privkey.pem;

    # 后端反向代理
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 支持（Socket.IO）
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name wx.shubai01.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 📊 监控和日志

### PM2 进程监控

```bash
# 查看实时日志
pm2 logs morning-reading-backend

# 查看进程状态
pm2 status

# 监控内存/CPU
pm2 monit
```

### 设置监控告警（推荐 PM2 Plus）

```bash
pm2 link <secret> <public>
pm2 monitor
```

---

## ✅ 部署前检查清单

- [ ] MySQL RDS 实例已创建并初始化
- [ ] Redis ElastiCache 实例已创建
- [ ] MongoDB Atlas 集群已创建（可选）
- [ ] SSL 证书已申请
- [ ] `.env.production` 已填入真实值
- [ ] Nginx 配置已完成
- [ ] 防火墙规则已配置（开放 80, 443 端口）
- [ ] 数据库备份计划已制定
- [ ] 监控告警已配置
- [ ] 所有 API 端点已测试

---

## 🆘 常见问题

**Q: 怎样生成强密码？**

```bash
openssl rand -base64 16  # 生成随机密码
```

**Q: 如何备份数据库？**

```bash
# MongoDB
mongodump --uri "mongodb+srv://user:CHANGE_ME@cluster.mongodb.net/morning_reading" --out /backup

# MySQL
mysqldump -h host -u user -p morning_reading > backup.sql
```

**Q: 如何监控磁盘空间？**

```bash
df -h           # 查看磁盘使用
du -sh /*       # 查看目录大小
```

---

## 📚 相关文档

- 完整配置方案：`/tmp/production-config-recommendation.md`
- 部署指南：`./DEPLOYMENT.md`
- 开发指南：`./DEVELOPMENT.md`
