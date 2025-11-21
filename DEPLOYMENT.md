# 晨读营项目 - 部署指南

**版本**: 1.0.0
**日期**: 2025-11-21

---

## 📋 部署前检查清单

### 代码准备

- [ ] 所有测试通过（TESTING.md）
- [ ] 没有 P0 级 bug
- [ ] 没有调试代码或 console.log
- [ ] 没有敏感信息在代码中
- [ ] 依赖包更新到最新（npm audit 无高危漏洞）
- [ ] 代码已压缩和最小化
- [ ] 环境配置文件准备完成
- [ ] 数据库迁移脚本准备好

### 基础设施

- [ ] 服务器准备就绪（CPU、内存、磁盘足够）
- [ ] 数据库实例创建并初始化
- [ ] Redis 缓存实例（可选但推荐）
- [ ] CDN 配置完成
- [ ] DNS 记录配置正确
- [ ] SSL/TLS 证书申请并安装
- [ ] 备份和恢复系统测试

### 文档

- [ ] API 文档完整
- [ ] 部署说明文档
- [ ] 故障排除指南
- [ ] 灾难恢复计划
- [ ] 用户手册（可选）

---

## 🚀 部署架构

### 推荐架构

```
互联网
  ↓
CDN (静态资源)
  ↓
负载均衡器 (HAProxy / Nginx)
  ↓
  ├─ 应用服务器 1 (Node.js)
  ├─ 应用服务器 2 (Node.js)
  └─ 应用服务器 3 (Node.js)
  ↓
Redis (缓存)
  ↓
MongoDB (主从副本集)
  ↓
文件存储 (S3 / 阿里云 OSS)
```

---

## 🏗️ 部署步骤

### Step 1: 后端部署

#### 1.1 服务器配置

```bash
# 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 安装 Node.js (推荐 LTS 版本)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version  # v18.x.x
npm --version   # 9.x.x

# 安装 PM2 进程管理器
sudo npm install -g pm2

# 安装 Nginx
sudo apt-get install -y nginx

# 安装 MongoDB (如果服务器本地部署)
# 或使用云服务 (MongoDB Atlas, 阿里云等)
```

#### 1.2 克隆和安装

```bash
# 创建应用目录
mkdir -p /var/www/morning-reading
cd /var/www/morning-reading

# 克隆代码（使用 SSH 密钥或 HTTPS）
git clone https://github.com/flylion816/Morning_Reading_Club.git .

# 安装后端依赖
cd backend
npm ci  # 使用 ci 而不是 install，保证 lock 文件准确

# 创建 .env 文件
cat > .env << EOF
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/morning-reading
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
API_DOMAIN=https://api.morningreading.com
UPLOAD_LIMIT=52428800
ALLOWED_ORIGINS=https://morningreading.com,https://admin.morningreading.com
EOF

# 测试启动
npm start
```

#### 1.3 PM2 配置

```bash
# 创建 ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'morning-reading-api',
    script: './src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 保存 PM2 配置以便重启时自动启动
pm2 startup
pm2 save

# 验证运行
pm2 status
pm2 logs morning-reading-api
```

#### 1.4 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/morning-reading-api
upstream api_server {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.morningreading.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.morningreading.com;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/morningreading.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/morningreading.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 压缩
    gzip on;
    gzip_types text/plain text/css text/xml application/json application/javascript;
    gzip_min_length 1000;

    # 反向代理配置
    location / {
        proxy_pass http://api_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # 禁止访问上传目录的脚本
    location /uploads/ {
        location ~ \.php$ { deny all; }
        location ~ \.sh$ { deny all; }
        location ~ \.py$ { deny all; }
        location ~ \.js$ { deny all; }
    }
}
```

```bash
# 启用网站配置
sudo ln -s /etc/nginx/sites-available/morning-reading-api \
           /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

#### 1.5 数据库初始化

```bash
# 创建初始化脚本
cd backend
npm run init:mongodb

# 验证数据库
mongo mongodb://localhost:27017/morning-reading
> show collections
> db.periods.find().count()
```

---

### Step 2: 前端部署

#### 2.1 小程序部署

```bash
# 使用微信开发者工具
1. 打开微信开发者工具
2. 点击 "上传"
3. 填写版本号和变更说明
4. 选择 "上传至官方体验版"

# 或使用命令行
cd miniprogram
npm run build  # 构建项目

# 使用 ci/cli 工具上传
# 详见：https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html
```

#### 2.2 管理后台部署

```bash
# 构建前端
cd admin
npm run build

# 验证构建产物
ls -la dist/

# 部署到服务器
scp -r dist/* user@admin.morningreading.com:/var/www/admin/

# 或使用 nginx 配置
```

#### 2.3 管理后台 Nginx 配置

```nginx
# /etc/nginx/sites-available/morning-reading-admin
server {
    listen 80;
    listen [::]:80;
    server_name admin.morningreading.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.morningreading.com;

    root /var/www/admin;
    index index.html;

    # SSL 证书配置（同 API）
    ssl_certificate /etc/letsencrypt/live/morningreading.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/morningreading.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline'" always;

    # Vue Router 支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
```

---

### Step 3: 监控和日志

#### 3.1 日志聚合

```bash
# 安装 logrotate（日志轮换）
cat > /etc/logrotate.d/morning-reading << EOF
/var/www/morning-reading/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 nobody nobody
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

#### 3.2 性能监控

```bash
# 安装 PM2 监控
pm2 install pm2-auto-pull  # 自动拉取最新代码
pm2 install pm2-logrotate  # 自动轮换日志

# 查看实时监控
pm2 monit
```

#### 3.3 告警配置

```bash
# 使用 PM2 Plus（可选付费服务）
pm2 link <secret_key> <instance_id>

# 或使用自定义脚本
cat > /usr/local/bin/check-health.sh << 'EOF'
#!/bin/bash
# 检查 API 健康状态
response=$(curl -s -o /dev/null -w "%{http_code}" https://api.morningreading.com/health)

if [ "$response" != "200" ]; then
    # 发送告警
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
        -d "{\"text\":\"API health check failed: $response\"}"

    # 尝试重启
    pm2 restart morning-reading-api
fi
EOF

chmod +x /usr/local/bin/check-health.sh

# 添加到 crontab（每 5 分钟检查一次）
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/check-health.sh") | crontab -
```

---

### Step 4: 备份和恢复

#### 4.1 数据库备份

```bash
# 创建备份脚本
cat > /usr/local/bin/backup-mongodb.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/mongodb"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="morning-reading"
MONGODB_URI="mongodb+srv://..."

mkdir -p $BACKUP_DIR

# 执行备份
mongodump --uri "$MONGODB_URI" \
          --out "$BACKUP_DIR/backup_$TIMESTAMP"

# 压缩备份
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" \
         "$BACKUP_DIR/backup_$TIMESTAMP"

# 删除原始备份目录
rm -rf "$BACKUP_DIR/backup_$TIMESTAMP"

# 清理 30 天前的备份
find $BACKUP_DIR -type f -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
EOF

chmod +x /usr/local/bin/backup-mongodb.sh

# 每天 2 点执行备份
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-mongodb.sh") | crontab -
```

#### 4.2 文件备份

```bash
# 备份上传的文件
rsync -avz /var/www/morning-reading/backend/uploads/ \
           backup@backup-server:/backups/uploads/

# 备份 .env 等配置文件
cp /var/www/morning-reading/backend/.env \
   /var/backups/config/.env.$(date +%Y%m%d)
```

#### 4.3 恢复流程

```bash
# 恢复数据库
mongorestore --uri "mongodb+srv://..." \
             --archive=backup.tar.gz \
             --gzip

# 恢复文件
rsync -avz backup-server:/backups/uploads/ \
           /var/www/morning-reading/backend/uploads/

# 重启服务
pm2 restart morning-reading-api
```

---

## 📊 生产环境检查清单

### 上线前必查

| 项目 | 检查 | 状态 |
|------|------|------|
| 代码质量 | npm audit, ESLint | ⬜ |
| 功能测试 | 所有场景通过 | ⬜ |
| 性能测试 | 负载测试通过 | ⬜ |
| 安全测试 | 安全审计完成 | ⬜ |
| 数据库 | 备份验证 | ⬜ |
| SSL/TLS | 证书安装 | ⬜ |
| DNS | 记录配置 | ⬜ |
| CDN | 静态资源配置 | ⬜ |
| 日志 | 日志收集配置 | ⬜ |
| 监控 | 告警规则配置 | ⬜ |

### 上线后检查

| 项目 | 检查 | 状态 |
|------|------|------|
| API 健康 | /health 返回 200 | ⬜ |
| 前端访问 | 页面可正常访问 | ⬜ |
| 用户认证 | 登录功能正常 | ⬜ |
| 数据库连接 | 查询执行正常 | ⬜ |
| 文件上传 | 上传功能可用 | ⬜ |
| 邮件通知 | 通知正常发送 | ⬜ |
| 错误处理 | 错误日志记录 | ⬜ |
| 性能指标 | 响应时间正常 | ⬜ |

---

## 🔄 灾难恢复计划

### RTO 和 RPO 目标

| 场景 | RTO | RPO |
|------|-----|-----|
| 文件服务器故障 | 1 小时 | 1 小时 |
| 数据库故障 | 2 小时 | 15 分钟 |
| 应用服务故障 | 15 分钟 | 0（无状态） |
| 全站故障 | 4 小时 | 1 小时 |

### 故障转移流程

```
检测到故障
  ↓
激活告警
  ↓
通知运维团队
  ↓
切换到备份系统/恢复
  ↓
验证服务正常
  ↓
通知用户
  ↓
事后分析和改进
```

---

## 🔧 常见问题排查

### 问题 1: API 连接超时

```bash
# 检查 API 进程
pm2 status

# 查看 API 日志
pm2 logs morning-reading-api

# 检查端口占用
sudo netstat -tlnp | grep 3000

# 检查 Nginx 配置
sudo nginx -t

# 重启服务
pm2 restart morning-reading-api
```

### 问题 2: 数据库连接失败

```bash
# 检查连接字符串
grep MONGODB_URI /var/www/morning-reading/backend/.env

# 测试连接
mongo $MONGODB_URI

# 检查网络连接
ping mongo-server

# 查看连接日志
tail -f /var/log/mongodb/mongodb.log
```

### 问题 3: 前端页面空白

```bash
# 检查构建产物
ls -la /var/www/admin/dist/

# 查看浏览器控制台错误
# F12 → Console 标签页

# 检查 API 连接
curl -i https://api.morningreading.com/health

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

---

## 📈 扩展性规划

### 水平扩展

```bash
# 添加新的应用服务器
1. 使用相同配置启动新服务器
2. 将其添加到负载均衡器
3. 验证流量分配

# 配置
upstream api_server {
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
    server 10.0.1.12:3000;
}
```

### 垂直扩展

```bash
# 增加服务器资源（CPU、内存）
1. 在云平台调整实例类型
2. 执行滚动更新（无停机）
3. 监控性能指标
```

### 数据库扩展

```bash
# 使用 MongoDB 副本集和分片
rs.initiate()  # 初始化副本集
db.enableSharding("morning-reading")  # 启用分片
```

---

**最后更新**: 2025-11-21
**维护人**: DevOps Team
**下次审查**: 发布前
