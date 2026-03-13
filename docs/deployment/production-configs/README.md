# 🚀 生产环境配置备份

> **重要提示**：此目录包含生产环境的关键配置文件备份，用于防止配置丢失。所有敏感信息（密码、密钥）已移除，使用 `.example` 文件作为模板。

---

## 📁 目录结构

```
production-configs/
├── nginx/                          # Nginx Web 服务器配置
│   ├── nginx.conf                 # 主配置文件
│   └── wx.shubai01.com.conf       # 晨读营站点配置
│
├── docker/                         # Docker 容器配置
│   └── docker-compose.yml.production
│
├── pm2/                           # PM2 进程管理配置
│   └── pm2.config.js.production
│
├── env-examples/                  # 环境变量示例（敏感信息已移除）
│   └── .env.production.example    # 生产环境配置模板
│
└── certificates/                  # SSL 证书（如需备份）
    └── README.md                  # 证书备份说明

```

---

## 📋 配置文件说明

### 1️⃣ **Nginx 配置** (`nginx/`)

**用途**：Web 服务器、反向代理、负载均衡、SSL/TLS

| 文件 | 说明 | 修改频率 |
|------|------|---------|
| `nginx.conf` | Nginx 主配置文件（全局设置） | 很少修改 |
| `wx.shubai01.com.conf` | 晨读营域名的站点配置 | 偶尔修改 |

**重要位置**：
```bash
生产服务器：/etc/nginx/nginx.conf
生产服务器：/etc/nginx/sites-available/wx.shubai01.com
```

**修改后重新加载**：
```bash
sudo nginx -t          # 验证语法
sudo systemctl reload nginx  # 重新加载配置
```

---

### 2️⃣ **Docker 配置** (`docker/`)

**用途**：定义 MongoDB、MySQL、Redis 容器的启动参数

| 文件 | 说明 | 用途 |
|------|------|------|
| `docker-compose.yml.production` | 生产环境 Docker 配置 | 启动数据库容器 |

**关键服务**：
- `mongodb`: 数据库（端口 27017）
- `mysql`: 关系数据库（端口 3306）
- `redis`: 缓存（端口 6379, 26379）

**重要位置**：
```bash
生产服务器：/var/www/morning-reading/backend/docker-compose.yml
```

**常用命令**：
```bash
cd /var/www/morning-reading/backend
docker compose up -d          # 启动容器
docker compose down           # 停止容器
docker compose restart        # 重启容器
```

---

### 3️⃣ **PM2 配置** (`pm2/`)

**用途**：管理 Node.js 后端进程的启动、重启、监控

| 文件 | 说明 | 用途 |
|------|------|------|
| `pm2.config.js.production` | 生产环境 PM2 配置 | 进程管理 |

**关键参数**：
- `instances: 'max'` - 自动检测 CPU 核心数，创建对应进程
- `exec_mode: 'cluster'` - 集群模式（多进程）
- `max_memory_restart: '500M'` - 内存超过 500MB 时重启
- `watch: ['src']` - 监听源代码变化（仅开发环境）

**重要位置**：
```bash
生产服务器：/var/www/morning-reading/backend/pm2.config.js
```

**常用命令**：
```bash
pm2 start pm2.config.js --env production   # 启动应用
pm2 restart morning-reading-backend        # 重启应用
pm2 logs morning-reading-backend           # 查看日志
pm2 status                                 # 查看状态
```

---

### 4️⃣ **环境变量** (`env-examples/`)

**用途**：敏感配置（密码、密钥、API 密钥等）

| 文件 | 说明 | 位置 |
|------|------|------|
| `.env.production.example` | 生产环境配置示例 | 本地备份 |
| `.env.production` | 实际生产环境配置 | `/var/www/morning-reading/backend/` |

**⚠️ 安全政策**：
- ❌ **永远不要**将真实的 `.env.production` 提交到 git
- ✅ 使用 `.example` 文件作为模板
- ✅ 部署时，在服务器上手动创建或 scp 复制 `.env.production`
- ✅ 所有敏感信息必须从密钥管理系统（如 1Password、Vault）获取

**包含的配置**：
```
✓ MongoDB 连接字符串
✓ MySQL 用户名/密码
✓ Redis 密码
✓ 微信小程序 AppID/Secret
✓ JWT 密钥
✓ 管理后台 URL
✓ API Base URL
```

**查看线上配置示例**：
```bash
ssh ubuntu@118.25.145.179
cat /var/www/morning-reading/backend/.env.production  # 查看实际配置（仅示例）
```

---

### 5️⃣ **SSL 证书** (`certificates/`)

**用途**：HTTPS 证书备份和恢复

**证书位置**（生产服务器）：
```
/etc/letsencrypt/live/wx.shubai01.com/       # 当前证书
/etc/letsencrypt/archive/wx.shubai01.com/    # 证书归档
```

**证书类型**：
- Let's Encrypt（免费，自动续期）
- 有效期：90 天
- 自动续期：Certbot 定时任务

**续期检查**：
```bash
# 查看证书有效期
sudo certbot certificates

# 手动续期
sudo certbot renew --dry-run

# 查看 Certbot 自动续期状态
sudo systemctl status certbot.timer
```

---

## 🔄 配置同步流程

### 📥 从生产环境拉取配置（备份）

```bash
# 拉取 Nginx 配置
scp -i ~/.ssh/id_rsa ubuntu@118.25.145.179:/etc/nginx/nginx.conf \
  docs/deployment/production-configs/nginx/

# 拉取 PM2 配置
scp -i ~/.ssh/id_rsa ubuntu@118.25.145.179:/var/www/morning-reading/backend/pm2.config.js \
  docs/deployment/production-configs/pm2/pm2.config.js.production

# 拉取 Docker 配置
scp -i ~/.ssh/id_rsa ubuntu@118.25.145.179:/var/www/morning-reading/backend/docker-compose.yml \
  docs/deployment/production-configs/docker/docker-compose.yml.production
```

### 📤 推送配置到生产环境（更新）

```bash
# 推送 Nginx 配置
scp -i ~/.ssh/id_rsa docs/deployment/production-configs/nginx/wx.shubai01.com.conf \
  ubuntu@118.25.145.179:/etc/nginx/sites-available/

# SSH 到服务器验证和重新加载
ssh -i ~/.ssh/id_rsa ubuntu@118.25.145.179
sudo nginx -t && sudo systemctl reload nginx

# 推送 PM2 配置
scp -i ~/.ssh/id_rsa docs/deployment/production-configs/pm2/pm2.config.js.production \
  ubuntu@118.25.145.179:/var/www/morning-reading/backend/pm2.config.js

# 重启应用
pm2 restart morning-reading-backend --update-env
```

---

## ⚠️ 常见问题

### Q: 为什么 `.env.production` 不在 git 中？

**A**: 包含敏感信息（密码、密钥）的文件不应该提交到 git，防止凭证泄露。
- 使用 `.example` 文件作为模板
- 实际部署时，在服务器上单独管理敏感配置
- 可使用加密秘密管理工具（GitHub Secrets、1Password 等）

### Q: 修改了 Nginx 配置，如何生效？

**A**:
```bash
# 1. 验证配置语法
sudo nginx -t

# 2. 重新加载配置（不中断现有连接）
sudo systemctl reload nginx

# 3. 或重启 Nginx（会中断连接）
sudo systemctl restart nginx
```

### Q: Certbot 证书自动续期失败怎么办？

**A**:
```bash
# 查看日志
sudo journalctl -u certbot

# 手动续期
sudo certbot renew

# 检查 Certbot 定时任务
sudo systemctl status certbot.timer
```

### Q: PM2 应用无法启动怎么排查？

**A**:
```bash
# 查看应用状态
pm2 status morning-reading-backend

# 查看应用日志
pm2 logs morning-reading-backend

# 验证配置文件语法
node pm2.config.js

# 重启应用
pm2 restart morning-reading-backend
```

---

## 📅 定期维护计划

| 任务 | 频率 | 操作 |
|------|------|------|
| 备份 Nginx 配置 | 每次修改后 | `git commit` |
| 备份 PM2 配置 | 每次修改后 | `git commit` |
| 检查证书有效期 | 每月 | `sudo certbot certificates` |
| 证书自动续期 | 自动 | Certbot 定时任务 |
| 清理日志 | 每周 | PM2 日志轮转 |
| 更新配置文档 | 每次重大变更 | 更新此文件 |

---

## 🔐 安全最佳实践

✅ **应该做**：
- 使用 `.example` 文件存储配置模板
- 将敏感信息存储在服务器或密钥管理系统中
- 定期备份配置到 git
- 修改后立即提交到 git
- 使用 SSH 密钥进行身份验证
- 在生产环境修改前，先在本地或测试环境验证

❌ **不应该做**：
- 将密码、密钥提交到 git
- 使用明文密码存储在配置文件
- 在公共渠道分享敏感信息
- 直接在生产环境编辑配置（应该通过 CI/CD）
- 忽视 Nginx 配置验证（可能导致服务中断）

---

## 📞 相关文档

- 📖 [部署指南](../DEPLOYMENT.md)
- 🐳 [Docker 配置指南](../DOCKER_SETUP.md)
- 🚀 [部署脚本说明](../../DEPLOY_SCRIPTS.md)
- 🔒 [安全配置最佳实践](../SECURITY.md)

---

## 📝 最后更新

- **日期**：2026-03-13
- **更新者**：Claude Code
- **版本**：1.0

---

## 💡 快速参考

### 紧急情况下的恢复步骤

```bash
# 1. 如果 Nginx 配置损坏导致无法访问
sudo cp docs/deployment/production-configs/nginx/wx.shubai01.com.conf \
  /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx

# 2. 如果 PM2 配置丢失
sudo cp docs/deployment/production-configs/pm2/pm2.config.js.production \
  /var/www/morning-reading/backend/pm2.config.js
pm2 restart morning-reading-backend --update-env

# 3. 如果 Docker 配置丢失
sudo cp docs/deployment/production-configs/docker/docker-compose.yml.production \
  /var/www/morning-reading/backend/docker-compose.yml
docker compose restart
```

---

**记住**：定期检查此目录，确保所有关键配置都已备份！🛡️
