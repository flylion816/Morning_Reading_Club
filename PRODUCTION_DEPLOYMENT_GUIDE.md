# 七个习惯晨读营 - 生产环境部署指南

## 📋 目录
- [部署架构](#部署架构)
- [服务器要求](#服务器要求)
- [部署步骤](#部署步骤)
- [环境变量配置](#环境变量配置)
- [数据库配置](#数据库配置)
- [微信小程序配置](#微信小程序配置)
- [安全加固](#安全加固)
- [监控与日志](#监控与日志)

## 🏗 部署架构

### 推荐架构
```
用户（微信小程序）
    ↓
CDN / 负载均衡
    ↓
Node.js 应用服务器（多实例）
    ↓
数据库集群
    ├── MongoDB 主从复制
    ├── MySQL 主从复制
    └── Redis 哨兵模式
```

## 💻 服务器要求

### 最低配置
- **CPU**: 2核
- **内存**: 4GB
- **存储**: 40GB SSD
- **带宽**: 5Mbps
- **操作系统**: Ubuntu 22.04 LTS / CentOS 8+

### 推荐配置（生产环境）
- **CPU**: 4核+
- **内存**: 8GB+
- **存储**: 100GB+ SSD
- **带宽**: 10Mbps+

### 所需软件
- Node.js >= 18.0.0
- MongoDB >= 6.0
- MySQL >= 8.0
- Redis >= 7.0
- Nginx >= 1.18
- PM2（进程管理）
- Git

## 🚀 部署步骤

### 1. 准备服务器

#### 1.1 更新系统
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

#### 1.2 安装Node.js
```bash
# 使用NVM安装
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
node --version  # 确认安装
```

#### 1.3 安装PM2
```bash
npm install -g pm2
pm2 --version
```

#### 1.4 安装Nginx
```bash
# Ubuntu/Debian
sudo apt install nginx -y

# CentOS/RHEL
sudo yum install nginx -y

# 启动Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. 安装数据库

#### 2.1 安装MongoDB
```bash
# Ubuntu 22.04
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# 启动MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# 创建管理员用户
mongosh
> use admin
> db.createUser({
    user: "admin",
    pwd: "YOUR_SECURE_PASSWORD",
    roles: ["root"]
  })
> use morning_reading
> db.createUser({
    user: "morning_user",
    pwd: "YOUR_DB_PASSWORD",
    roles: ["readWrite"]
  })
> exit
```

#### 2.2 安装MySQL
```bash
# Ubuntu
sudo apt install mysql-server -y

# 安全配置
sudo mysql_secure_installation

# 创建数据库和用户
sudo mysql
> CREATE DATABASE morning_reading CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE USER 'morning_user'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';
> GRANT ALL PRIVILEGES ON morning_reading.* TO 'morning_user'@'localhost';
> FLUSH PRIVILEGES;
> EXIT;
```

#### 2.3 安装Redis
```bash
# Ubuntu
sudo apt install redis-server -y

# 配置Redis密码
sudo nano /etc/redis/redis.conf
# 找到 # requirepass foobared
# 改为 requirepass YOUR_REDIS_PASSWORD

# 重启Redis
sudo systemctl restart redis
sudo systemctl enable redis
```

### 3. 部署应用代码

#### 3.1 克隆代码
```bash
# 创建应用目录
sudo mkdir -p /var/www/morning-reading
sudo chown $USER:$USER /var/www/morning-reading
cd /var/www/morning-reading

# 克隆代码（假设使用Git）
git clone YOUR_REPOSITORY_URL .
# 或者从本地上传代码
```

#### 3.2 安装依赖
```bash
cd backend
npm install --production
```

#### 3.3 配置环境变量
```bash
# 创建生产环境配置
cp .env.example .env.production

# 编辑配置文件
nano .env.production
```

**重要：必须修改以下配置**
```env
# Server
NODE_ENV=production
PORT=3000

# MongoDB（生产环境密码）
MONGODB_URI=mongodb://morning_user:YOUR_DB_PASSWORD@localhost:27017/morning_reading

# MySQL（生产环境密码）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=morning_reading
MYSQL_USER=morning_user
MYSQL_PASSWORD=YOUR_DB_PASSWORD

# Redis（生产环境密码）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# JWT（生成强随机密钥）
JWT_SECRET=YOUR_GENERATED_SECRET_KEY_HERE
JWT_REFRESH_SECRET=YOUR_GENERATED_REFRESH_SECRET_KEY_HERE
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=30d

# WeChat Mini Program（真实配置）
WECHAT_APP_ID=wx199d6d332344ed0a
WECHAT_APP_SECRET=YOUR_REAL_WECHAT_APP_SECRET
```

**生成安全的JWT密钥：**
```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### 3.4 初始化数据库
```bash
# 使用生产环境配置
NODE_ENV=production node scripts/init-mongodb.js
```

### 4. 配置PM2

#### 4.1 创建PM2配置文件
```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'morning-reading-api',
    script: './src/server.js',
    cwd: '/var/www/morning-reading/backend',
    instances: 2,  // 或 'max' 使用所有CPU核心
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    error_file: '/var/log/morning-reading/error.log',
    out_file: '/var/log/morning-reading/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M'
  }]
};
```

#### 4.2 启动应用
```bash
# 创建日志目录
sudo mkdir -p /var/log/morning-reading
sudo chown $USER:$USER /var/log/morning-reading

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs morning-reading-api

# 设置开机自启
pm2 startup
pm2 save
```

### 5. 配置Nginx反向代理

#### 5.1 创建Nginx配置
```bash
sudo nano /etc/nginx/sites-available/morning-reading
```

```nginx
# 上游服务器配置
upstream morning_reading_backend {
    least_conn;
    server 127.0.0.1:3000;
    # 如果有多个实例，添加更多服务器
    # server 127.0.0.1:3001;
    # server 127.0.0.1:3002;
}

# HTTP服务器（重定向到HTTPS）
server {
    listen 80;
    listen [::]:80;
    server_name api.morning-reading.com;

    # Let's Encrypt验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # 重定向到HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS服务器
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.morning-reading.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/api.morning-reading.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.morning-reading.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 日志
    access_log /var/log/nginx/morning-reading-access.log;
    error_log /var/log/nginx/morning-reading-error.log;

    # 客户端上传大小限制
    client_max_body_size 10M;

    # 代理到Node.js应用
    location /api/v1/ {
        proxy_pass http://morning_reading_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查
    location /health {
        proxy_pass http://morning_reading_backend;
        access_log off;
    }
}
```

#### 5.2 启用配置并重启Nginx
```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/morning-reading /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

### 6. 配置SSL证书（Let's Encrypt）

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d api.morning-reading.com

# 测试自动续期
sudo certbot renew --dry-run

# 自动续期已自动配置在cron中
```

### 7. 配置防火墙

```bash
# Ubuntu UFW
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# 检查状态
sudo ufw status
```

## 🔐 环境变量配置

### 完整的生产环境 .env.production

```env
# ==========================================
# Server Configuration
# ==========================================
NODE_ENV=production
PORT=3000

# ==========================================
# Database Configuration
# ==========================================

# MongoDB
MONGODB_URI=mongodb://morning_user:CHANGE_THIS_PASSWORD@localhost:27017/morning_reading

# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=morning_reading
MYSQL_USER=morning_user
MYSQL_PASSWORD=CHANGE_THIS_PASSWORD

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=CHANGE_THIS_PASSWORD

# ==========================================
# JWT Configuration
# ==========================================
JWT_SECRET=GENERATE_WITH_CRYPTO_RANDOM_BYTES
JWT_REFRESH_SECRET=GENERATE_WITH_CRYPTO_RANDOM_BYTES
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=30d

# ==========================================
# WeChat Mini Program Configuration
# ==========================================
WECHAT_APP_ID=wx199d6d332344ed0a
WECHAT_APP_SECRET=YOUR_REAL_WECHAT_APP_SECRET

# ==========================================
# Logging
# ==========================================
LOG_LEVEL=info
LOG_DIR=/var/log/morning-reading

# ==========================================
# CORS Configuration
# ==========================================
CORS_ORIGIN=https://your-domain.com
```

## 📱 微信小程序配置

### 1. 更新小程序环境配置

编辑 `miniprogram/config/env.js`:

```javascript
const envConfig = {
  // 生产环境
  prod: {
    apiBaseUrl: 'https://api.morning-reading.com/api/v1',
    wxAppId: 'wx199d6d332344ed0a',
    enableDebug: false,
    enableLog: false,
    useMock: false
  }
};

// 设置当前环境为生产
const currentEnv = 'prod';

module.exports = {
  ...envConfig[currentEnv],
  currentEnv
};
```

### 2. 配置服务器域名白名单

在微信公众平台（mp.weixin.qq.com）配置：

**开发设置 → 服务器域名**

- **request合法域名**: `https://api.morning-reading.com`
- **uploadFile合法域名**: `https://api.morning-reading.com`
- **downloadFile合法域名**: `https://api.morning-reading.com`

### 3. 上传小程序代码

```bash
# 在开发者工具中
1. 点击"上传"
2. 填写版本号和项目备注
3. 提交审核
4. 审核通过后发布
```

## 🔒 安全加固

### 1. 数据库安全

#### MongoDB
```bash
# 编辑MongoDB配置
sudo nano /etc/mongod.conf

# 启用认证并绑定到本地
security:
  authorization: enabled

net:
  bindIp: 127.0.0.1
  port: 27017

# 重启MongoDB
sudo systemctl restart mongod
```

#### MySQL
```bash
# 只允许本地连接
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# 设置
bind-address = 127.0.0.1

# 重启MySQL
sudo systemctl restart mysql
```

#### Redis
```bash
# 编辑Redis配置
sudo nano /etc/redis/redis.conf

# 设置
bind 127.0.0.1
requirepass YOUR_STRONG_PASSWORD
maxmemory 256mb
maxmemory-policy allkeys-lru

# 重启Redis
sudo systemctl restart redis
```

### 2. 应用安全

- ✅ 使用环境变量存储敏感信息
- ✅ 启用HTTPS（SSL/TLS）
- ✅ 设置强JWT密钥
- ✅ 限制CORS源
- ✅ 使用Helmet中间件（已配置）
- ✅ 输入验证和SQL注入防护
- ✅ 设置请求速率限制

### 3. 服务器安全

```bash
# 创建非root用户
sudo adduser appuser
sudo usermod -aG sudo appuser

# 禁用root SSH登录
sudo nano /etc/ssh/sshd_config
# 设置 PermitRootLogin no

# 配置SSH密钥认证
ssh-keygen -t rsa -b 4096
# 上传公钥到 ~/.ssh/authorized_keys

# 安装fail2ban防止暴力破解
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

## 📊 监控与日志

### 1. PM2监控

```bash
# 实时监控
pm2 monit

# 查看日志
pm2 logs

# 查看详细信息
pm2 show morning-reading-api
```

### 2. 配置日志轮转

```bash
# 创建logrotate配置
sudo nano /etc/logrotate.d/morning-reading

/var/log/morning-reading/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 appuser appuser
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. 配置监控告警

推荐使用：
- **PM2 Plus** - 应用性能监控
- **New Relic** - APM监控
- **Sentry** - 错误追踪
- **Grafana + Prometheus** - 系统监控

## 🔄 部署更新流程

### 方式1：手动部署

```bash
# 1. 拉取最新代码
cd /var/www/morning-reading
git pull origin main

# 2. 安装依赖
cd backend
npm install --production

# 3. 运行数据库迁移（如有）
# npm run migrate

# 4. 重启应用
pm2 reload ecosystem.config.js

# 5. 查看状态
pm2 status
pm2 logs --lines 100
```

### 方式2：CI/CD自动部署

使用GitHub Actions示例：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/morning-reading
            git pull origin main
            cd backend
            npm install --production
            pm2 reload ecosystem.config.js
```

## 📋 部署检查清单

部署前确认：

- [ ] 服务器配置满足要求
- [ ] 所有数据库已安装并配置
- [ ] 环境变量已正确设置
- [ ] JWT密钥已生成并配置
- [ ] 微信AppSecret已配置
- [ ] 数据库已初始化
- [ ] PM2已配置并启动
- [ ] Nginx已配置并启动
- [ ] SSL证书已配置
- [ ] 防火墙已配置
- [ ] 域名DNS已解析
- [ ] 微信小程序域名白名单已配置
- [ ] 日志轮转已配置
- [ ] 监控告警已配置
- [ ] 备份策略已制定

部署后测试：

- [ ] 健康检查：`curl https://api.morning-reading.com/health`
- [ ] API测试：登录、获取期次列表等
- [ ] 小程序测试：完整业务流程
- [ ] 性能测试：负载测试
- [ ] 安全测试：漏洞扫描

## 🆘 故障排查

### 应用无法启动

```bash
# 查看PM2日志
pm2 logs --err

# 查看系统日志
journalctl -u nginx -f

# 检查端口占用
sudo netstat -tulpn | grep :3000
```

### 数据库连接失败

```bash
# 测试MongoDB连接
mongosh mongodb://morning_user:PASSWORD@localhost:27017/morning_reading

# 测试MySQL连接
mysql -u morning_user -p morning_reading

# 测试Redis连接
redis-cli -a YOUR_PASSWORD ping
```

### Nginx 502错误

```bash
# 检查后端是否运行
pm2 status

# 检查Nginx错误日志
sudo tail -f /var/log/nginx/morning-reading-error.log

# 测试Nginx配置
sudo nginx -t
```

## 📞 支持与维护

### 定期维护任务

- **每日**: 检查日志、监控告警
- **每周**: 检查磁盘空间、数据库性能
- **每月**: 更新系统补丁、备份验证
- **每季度**: 安全审计、性能优化

### 备份策略

```bash
# MongoDB备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://morning_user:PASSWORD@localhost:27017/morning_reading" \
  --out="/backup/mongodb/$DATE"

# 保留最近30天的备份
find /backup/mongodb -type d -mtime +30 -exec rm -rf {} +
```

---

**文档版本**: v1.0
**最后更新**: 2025-11-13
**维护者**: 开发团队
