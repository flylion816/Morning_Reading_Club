# 🚀 线上服务器 Claude Code 部署和运维指南

**文档版本**: v1.0.0
**最后更新**: 2025-12-04
**适用范围**: 晨读营项目线上服务器部署和运维
**受众**: 系统管理员、运维工程师、技术主管

---

## 📋 目录

1. [环境准备](#环境准备)
2. [Claude Code 安装](#claude-code-安装)
3. [生产环境配置](#生产环境配置)
4. [部署流程](#部署流程)
5. [数据初始化](#数据初始化)
6. [监控告警](#监控告警)
7. [故障排查](#故障排查)
8. [备份和恢复](#备份和恢复)
9. [回滚流程](#回滚流程)

---

## 🔧 环境准备

### 系统要求

| 项目 | 要求 | 说明 |
|------|------|------|
| 操作系统 | Ubuntu 20.04+ 或 CentOS 8+ | 推荐 Ubuntu 22.04 LTS |
| CPU | 4 核+ | 最少 2 核，建议 4 核 |
| 内存 | 8GB+ | 最少 4GB，建议 8GB+ |
| 硬盘 | 100GB+ | SSD 优先 |
| 网络 | 100Mbps+ | 稳定的互联网连接 |

### 前置依赖安装

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    jq \
    net-tools \
    build-essential

# 安装 Node.js (v20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证 Node.js 版本
node --version  # 应该显示 v20.x.x

# 安装 npm 包管理工具
npm install -g npm@latest

# 安装 Docker 和 Docker Compose
sudo apt install -y docker.io docker-compose

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 验证 Docker
docker --version
docker-compose --version

# 安装 MongoDB 客户端工具
sudo apt install -y mongodb-org-tools

# 验证 MongoDB 工具
mongosh --version
```

### 创建项目用户

```bash
# 创建专用用户（使用非 root 权限）
sudo useradd -m -s /bin/bash appuser

# 创建项目目录
sudo mkdir -p /var/www/morning-reading-club
sudo chown -R appuser:appuser /var/www/morning-reading-club

# 创建日志目录
sudo mkdir -p /var/log/morning-reading-club
sudo chown -R appuser:appuser /var/log/morning-reading-club

# 创建备份目录
sudo mkdir -p /var/backups/morning-reading-club
sudo chown -R appuser:appuser /var/backups/morning-reading-club
```

---

## 🔐 Claude Code 安装

### 步骤 1: 安装 Claude Code CLI

```bash
# 使用 npm 全局安装 Claude Code
sudo npm install -g @anthropic-ai/claude-code

# 验证安装
claude-code --version

# 初始化 Claude Code 配置
claude-code init
```

### 步骤 2: 配置 API 密钥

```bash
# 设置 Anthropic API 密钥（通过环境变量）
echo 'export ANTHROPIC_API_KEY="your-api-key-here"' >> ~/.bashrc
source ~/.bashrc

# 验证 API 密钥
echo $ANTHROPIC_API_KEY
```

> **⚠️ 重要**: 将 API 密钥存储在 `.env` 文件中，不要提交到 Git

### 步骤 3: 配置 Git 认证

```bash
# 配置 Git 全局设置
git config --global user.name "CI Bot"
git config --global user.email "ci@morningreading.com"

# 设置 GitHub 访问令牌（使用 gh CLI）
# 1. 安装 gh CLI
curl -fsSL https://cli.github.com/install.sh | sudo bash

# 2. 进行 GitHub 认证
gh auth login
# 选择：
# - What is your preferred protocol for Git operations? → HTTPS
# - Authenticate with GitHub? → Yes
# - How would you like to authenticate GitHub CLI? → Paste an authentication token

# 3. 验证认证
gh repo list
```

### 步骤 4: 设置 Claude Code 工作目录

```bash
# 切换到应用用户
su - appuser

# 进入项目目录
cd /var/www/morning-reading-club

# 克隆项目仓库（使用 HTTPS）
git clone https://github.com/flylion816/Morning_Reading_Club.git .

# 验证克隆
ls -la
```

---

## 🏢 生产环境配置

### 步骤 1: 配置环境变量

```bash
# 创建生产环境配置文件
cat > /var/www/morning-reading-club/.env.production << 'EOF'
# 应用配置
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# MongoDB 配置
MONGODB_URI=mongodb://mongo_user:mongo_password@mongodb:27017/morning_reading?authSource=admin

# JWT 配置
JWT_SECRET=your-production-jwt-secret-change-this-to-random-string
JWT_REFRESH_SECRET=your-production-refresh-secret-change-this-to-random-string

# 微信小程序配置
WECHAT_APPID=your-wechat-app-id
WECHAT_SECRET=your-wechat-app-secret

# API 基础 URL
API_BASE_URL=https://api.morningreading.com

# 日志配置
LOG_DIR=/var/log/morning-reading-club
LOG_LEVEL=info

# 备份配置
BACKUP_DIR=/var/backups/morning-reading-club
BACKUP_RETENTION_DAYS=30

# 邮件通知配置（可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL=admin@morningreading.com
EOF

# 设置文件权限
chmod 600 /var/www/morning-reading-club/.env.production

# 验证配置
cat /var/www/morning-reading-club/.env.production
```

### 步骤 2: 配置 Docker Compose

```bash
# 创建生产用 docker-compose 配置
cat > /var/www/morning-reading-club/docker-compose.prod.yml << 'EOF'
version: '3.8'

name: morning-reading-club-prod

services:
  # MongoDB 数据库
  mongodb:
    image: mongo:7.0-alpine
    container_name: morning-reading-mongodb-prod
    restart: always

    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:-changeme}
      MONGO_INITDB_DATABASE: morning_reading

    ports:
      - "27017:27017"

    volumes:
      - mongodb_data:/data/db
      - mongodb_config:/data/configdb

    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s

    networks:
      - morning-reading-network

    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M

  # 后端 API 服务
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile

    container_name: morning-reading-backend-prod
    restart: always

    depends_on:
      mongodb:
        condition: service_healthy

    environment:
      NODE_ENV: production
      PORT: 3000
      MONGODB_URI: mongodb://${MONGO_USER:-admin}:${MONGO_PASSWORD:-changeme}@mongodb:27017/morning_reading?authSource=admin
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      WECHAT_APPID: ${WECHAT_APPID}
      WECHAT_SECRET: ${WECHAT_SECRET}
      LOG_LEVEL: info
      API_BASE_URL: ${API_BASE_URL}

    ports:
      - "3000:3000"

    volumes:
      - ./backend/src:/app/src:ro
      - /var/log/morning-reading-club:/app/logs
      - ./backend/uploads:/app/uploads

    working_dir: /app

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s

    networks:
      - morning-reading-network

    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M

  # Nginx 反向代理（可选）
  nginx:
    image: nginx:alpine
    container_name: morning-reading-nginx-prod
    restart: always

    ports:
      - "80:80"
      - "443:443"

    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./admin/dist:/usr/share/nginx/html:ro

    depends_on:
      - backend

    networks:
      - morning-reading-network

    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 256M

volumes:
  mongodb_data:
    driver: local
  mongodb_config:
    driver: local

networks:
  morning-reading-network:
    driver: bridge
EOF

# 设置权限
chmod 644 /var/www/morning-reading-club/docker-compose.prod.yml
```

### 步骤 3: 配置 Nginx（反向代理）

```bash
# 创建 Nginx 配置
sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

cat > /etc/nginx/sites-available/morning-reading << 'EOF'
upstream backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name api.morningreading.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.morningreading.com;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/morningreading.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/morningreading.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志配置
    access_log /var/log/nginx/morning-reading-access.log;
    error_log /var/log/nginx/morning-reading-error.log;

    # 代理配置
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查端点
    location /api/v1/health {
        proxy_pass http://backend;
        access_log off;
    }
}
EOF

# 启用站点配置
sudo ln -s /etc/nginx/sites-available/morning-reading /etc/nginx/sites-enabled/

# 测试 Nginx 配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

---

## 🚀 部署流程

### 部署前检查清单

```bash
# 1. 验证环境
[ -d "/var/www/morning-reading-club" ] && echo "✅ 项目目录存在"
[ -f "/var/www/morning-reading-club/.env.production" ] && echo "✅ 环境配置存在"
[ -x "$(command -v docker)" ] && echo "✅ Docker 已安装"
[ -x "$(command -v git)" ] && echo "✅ Git 已安装"

# 2. 验证数据库连接
docker exec morning-reading-mongodb-prod mongosh --version

# 3. 验证备份目录
[ -d "/var/backups/morning-reading-club" ] && echo "✅ 备份目录存在"
```

### 自动化部署脚本

```bash
# 创建部署脚本
cat > /var/www/morning-reading-club/deploy-production.sh << 'EOF'
#!/bin/bash

set -e

# 配置
PROJECT_DIR="/var/www/morning-reading-club"
BACKUP_DIR="/var/backups/morning-reading-club"
LOG_FILE="/var/log/morning-reading-club/deploy.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# 日志函数
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log "========== 开始生产部署 =========="

# 1. 切换到项目目录
cd "$PROJECT_DIR"
log "✓ 进入项目目录: $PROJECT_DIR"

# 2. 备份当前状态
log "正在备份数据库..."
docker exec morning-reading-mongodb-prod mongodump \
    -u admin \
    -p $MONGO_PASSWORD \
    --authenticationDatabase admin \
    --out "$BACKUP_DIR/mongo-$(date +%Y%m%d-%H%M%S)"
log "✓ 数据库备份完成"

# 3. 拉取最新代码
log "正在拉取最新代码..."
git fetch origin main
git reset --hard origin/main
log "✓ 代码已更新"

# 4. 构建 Docker 镜像
log "正在构建 Docker 镜像..."
docker-compose -f docker-compose.prod.yml build --no-cache
log "✓ 镜像构建完成"

# 5. 停止旧容器
log "正在停止旧容器..."
docker-compose -f docker-compose.prod.yml down
log "✓ 旧容器已停止"

# 6. 启动新容器
log "正在启动新容器..."
docker-compose -f docker-compose.prod.yml up -d
log "✓ 新容器已启动"

# 7. 等待服务就绪
log "等待服务就绪..."
sleep 5
for i in {1..30}; do
    if curl -f http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        log "✓ 后端服务已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        log "❌ 后端服务启动失败"
        exit 1
    fi
    sleep 1
done

# 8. 运行数据初始化（如需要）
log "正在初始化数据..."
node backend/scripts/init-production.js || true
log "✓ 数据初始化完成"

# 9. 验证部署
log "正在验证部署..."
HEALTH=$(curl -s http://localhost:3000/api/v1/health)
if echo "$HEALTH" | grep -q "ok"; then
    log "✅ 部署验证成功"
    log "========== 部署完成 =========="
    exit 0
else
    log "❌ 部署验证失败"
    log "响应: $HEALTH"
    exit 1
fi
EOF

# 设置可执行权限
chmod +x /var/www/morning-reading-club/deploy-production.sh
```

### 执行部署

```bash
# 加载环境变量
cd /var/www/morning-reading-club
set -a
source .env.production
set +a

# 执行部署脚本
sudo -u appuser ./deploy-production.sh

# 查看部署日志
tail -100 /var/log/morning-reading-club/deploy.log
```

---

## 💾 数据初始化

### 步骤 1: 初始化 MongoDB 数据库

```bash
# 创建初始化脚本
cat > /var/www/morning-reading-club/init-db.sh << 'EOF'
#!/bin/bash

# 连接到 MongoDB 并初始化数据
docker exec morning-reading-mongodb-prod mongosh \
    -u admin \
    -p $MONGO_PASSWORD \
    --authenticationDatabase admin \
    morning_reading << 'MONGO'

// 创建集合和索引
db.createCollection("users");
db.createCollection("insights");
db.createCollection("comments");
db.createCollection("periods");

// 创建索引
db.users.createIndex({ "openid": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.insights.createIndex({ "userId": 1, "createdAt": -1 });
db.insights.createIndex({ "periodId": 1 });
db.comments.createIndex({ "insightId": 1, "createdAt": -1 });

// 插入初始数据
db.periods.insertOne({
    _id: ObjectId(),
    name: "第一期 - 心流之境",
    startDate: new Date("2025-12-01"),
    endDate: new Date("2026-01-31"),
    description: "学习和实践七个习惯的第一期",
    isActive: true,
    createdAt: new Date()
});

console.log("✅ 数据库初始化完成");
MONGO

EOF

chmod +x /var/www/morning-reading-club/init-db.sh

# 执行初始化
./init-db.sh
```

### 步骤 2: 初始化应用数据

```bash
# 创建初始管理员用户
docker exec morning-reading-backend-prod node backend/scripts/init-admin.js

# 初始化系统参数
docker exec morning-reading-backend-prod node backend/scripts/init-settings.js

# 验证初始化
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/users
```

---

## 📊 监控告警

### 步骤 1: 安装监控工具

```bash
# 安装 Prometheus（监控工具）
docker run -d \
    --name prometheus \
    -p 9090:9090 \
    -v /etc/prometheus:/etc/prometheus:ro \
    -v prometheus_data:/prometheus \
    prom/prometheus

# 安装 Grafana（可视化工具）
docker run -d \
    --name grafana \
    -p 3001:3000 \
    -e GF_SECURITY_ADMIN_PASSWORD=admin \
    -v grafana_data:/var/lib/grafana \
    grafana/grafana
```

### 步骤 2: 配置告警规则

```bash
# 创建告警规则文件
cat > /etc/prometheus/alerts.yml << 'EOF'
groups:
  - name: morning-reading
    rules:
      # 后端服务不可用
      - alert: BackendDown
        expr: up{job="backend"} == 0
        for: 1m
        annotations:
          summary: "后端服务已宕机"
          description: "后端服务已离线超过 1 分钟"

      # 内存使用过高
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
        for: 5m
        annotations:
          summary: "内存使用过高"
          description: "容器内存使用率超过 80%"

      # 磁盘空间不足
      - alert: LowDiskSpace
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        annotations:
          summary: "磁盘空间不足"
          description: "剩余磁盘空间低于 10%"

      # 数据库连接失败
      - alert: DatabaseConnectionError
        expr: mongodb_up == 0
        for: 2m
        annotations:
          summary: "数据库连接失败"
          description: "无法连接到 MongoDB"
EOF
```

### 步骤 3: 配置日志聚合

```bash
# 安装 ELK Stack（日志聚合）
docker-compose -f docker-compose.elk.yml up -d

# 配置日志收集
cat > /etc/logstash/conf.d/morning-reading.conf << 'EOF'
input {
  file {
    path => "/var/log/morning-reading-club/*.log"
    start_position => "beginning"
  }
}

filter {
  grok {
    match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
  }
  date {
    match => [ "timestamp", "ISO8601" ]
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "morning-reading-%{+YYYY.MM.dd}"
  }
}
EOF
```

---

## 🔍 故障排查

### 常见问题和解决方案

#### 问题 1: 后端服务无法启动

```bash
# 查看容器日志
docker logs morning-reading-backend-prod

# 检查环境变量
docker inspect morning-reading-backend-prod | grep -A 50 "Env"

# 检查数据库连接
docker exec morning-reading-backend-prod curl mongodb:27017

# 重启容器
docker restart morning-reading-backend-prod
```

#### 问题 2: 数据库连接超时

```bash
# 检查数据库容器状态
docker ps | grep mongodb

# 检查数据库日志
docker logs morning-reading-mongodb-prod

# 检查网络连接
docker network ls
docker network inspect morning-reading-network

# 重启数据库
docker restart morning-reading-mongodb-prod
```

#### 问题 3: 磁盘空间不足

```bash
# 检查磁盘使用
df -h

# 清理 Docker 镜像
docker image prune -a

# 清理 Docker 容器
docker container prune

# 清理日志
sudo truncate -s 0 /var/log/morning-reading-club/*.log
```

#### 问题 4: 性能下降

```bash
# 检查系统资源
top -b -n 1

# 检查网络连接
netstat -an | grep ESTABLISHED

# 检查数据库性能
docker exec morning-reading-mongodb-prod mongosh --eval "db.stats()"

# 优化数据库索引
docker exec morning-reading-mongodb-prod mongosh << 'EOF'
db.insights.find().explain("executionStats")
db.users.find().explain("executionStats")
EOF
```

---

## 💾 备份和恢复

### 步骤 1: 自动备份脚本

```bash
# 创建备份脚本
cat > /var/www/morning-reading-club/backup-production.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/morning-reading-club"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

# 数据库备份
echo "正在备份数据库..."
docker exec morning-reading-mongodb-prod mongodump \
    -u admin \
    -p $MONGO_PASSWORD \
    --authenticationDatabase admin \
    --out "$BACKUP_DIR/mongo-$TIMESTAMP"

# 应用数据备份
echo "正在备份应用数据..."
tar -czf "$BACKUP_DIR/app-$TIMESTAMP.tar.gz" \
    /var/www/morning-reading-club/backend/uploads

# 清理旧备份
find "$BACKUP_DIR" -type d -name "mongo-*" -mtime +$RETENTION_DAYS -exec rm -rf {} \;
find "$BACKUP_DIR" -type f -name "app-*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ 备份完成: $BACKUP_DIR/mongo-$TIMESTAMP"
EOF

chmod +x /var/www/morning-reading-club/backup-production.sh
```

### 步骤 2: 定时备份（Cron）

```bash
# 配置每天午夜备份
(crontab -l 2>/dev/null; echo "0 0 * * * /var/www/morning-reading-club/backup-production.sh") | crontab -

# 验证 Cron 任务
crontab -l
```

### 步骤 3: 恢复数据

```bash
# 恢复数据库
docker exec morning-reading-mongodb-prod mongorestore \
    -u admin \
    -p $MONGO_PASSWORD \
    --authenticationDatabase admin \
    /backup/mongo-20251204-120000

# 恢复应用数据
tar -xzf /backup/app-20251204-120000.tar.gz -C /
```

---

## ↩️ 回滚流程

### 紧急回滚

```bash
# 1. 停止当前服务
docker-compose -f docker-compose.prod.yml down

# 2. 恢复代码到上一个版本
cd /var/www/morning-reading-club
git log --oneline | head -5  # 查看最近提交
git revert <commit-hash>     # 或使用 git reset --hard <old-commit>

# 3. 恢复数据库
docker exec morning-reading-mongodb-prod mongorestore \
    -u admin \
    -p $MONGO_PASSWORD \
    --authenticationDatabase admin \
    --drop \
    /backup/mongo-20251204-120000

# 4. 重新启动服务
docker-compose -f docker-compose.prod.yml up -d

# 5. 验证服务
curl http://localhost:3000/api/v1/health

# 6. 通知相关人员
echo "⚠️ 已执行紧急回滚，服务已恢复"
```

### 优雅回滚（保留新功能）

```bash
# 1. 创建新的特性分支
git checkout -b hotfix/rollback-<feature>

# 2. 撤销特定功能的代码
git revert <commit-range>

# 3. 提交回滚提交
git commit -m "revert: 回滚 <功能名称>"

# 4. 部署
./deploy-production.sh

# 5. 监控日志
tail -f /var/log/morning-reading-club/combined.log
```

---

## 📋 运维检查清单

### 每日检查

- [ ] 检查服务健康状态：`curl http://localhost:3000/api/v1/health`
- [ ] 检查日志错误：`grep ERROR /var/log/morning-reading-club/*.log`
- [ ] 检查磁盘空间：`df -h`
- [ ] 检查 Docker 容器：`docker ps`
- [ ] 检查数据库连接：`docker logs morning-reading-mongodb-prod`

### 周期检查

- [ ] 备份完整性检查
- [ ] 性能基准对比
- [ ] 安全补丁更新
- [ ] 日志归档
- [ ] 容量规划评估

### 月度检查

- [ ] 灾难恢复演练
- [ ] 安全审计
- [ ] 性能优化
- [ ] 容量扩展规划
- [ ] 文档更新

---

## 🔗 相关命令快速参考

```bash
# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 停止服务
docker-compose -f docker-compose.prod.yml down

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f backend

# 进入容器
docker exec -it morning-reading-backend-prod bash

# 重启容器
docker-compose -f docker-compose.prod.yml restart backend

# 查看容器资源使用
docker stats morning-reading-backend-prod

# 清理无用资源
docker system prune -a
```

---

## 📞 支持和联系

- **技术支持**: support@morningreading.com
- **紧急告警**: emergency@morningreading.com
- **文档**: https://github.com/flylion816/Morning_Reading_Club/wiki
- **问题追踪**: https://github.com/flylion816/Morning_Reading_Club/issues

---

**最后更新**: 2025-12-04
**版本**: v1.0.0
**维护者**: 晨读营技术团队
