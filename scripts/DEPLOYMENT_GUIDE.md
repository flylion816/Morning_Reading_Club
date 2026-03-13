# 📦 晨读营部署系统完整指南

> 基于 Method C: Hybrid Reuse 架构的完整自动化部署系统

---

## 🚀 快速开始

### 全新服务器部署（一键部署）

```bash
# 1️⃣ SSH 到服务器
ssh ubuntu@your-server-ip

# 2️⃣ 克隆项目
git clone https://github.com/flylion816/Morning_Reading_Club.git
cd Morning_Reading_Club

# 3️⃣ 执行 6 步部署脚本
bash scripts/1-initial-setup.sh          # 第 1 步：系统初始化（2-3 分钟）
bash scripts/2-install-dependencies.sh   # 第 2 步：安装依赖（5-8 分钟）
bash scripts/3-setup-infrastructure.sh   # 第 3 步：基础设施（1-2 分钟）
bash scripts/4-init-database.sh          # 第 4 步：初始化数据库（3-5 分钟）
bash scripts/5-setup-nginx.sh            # 第 5 步：Nginx + SSL（2-3 分钟）
bash scripts/6-deploy-app.sh             # 第 6 步：部署应用（2-3 分钟）

# 4️⃣ 验证部署
bash scripts/verify-deployment.sh
```

**总耗时: 15-25 分钟** ⏱️

---

## 📋 6 步部署流程详解

### 第 1 步：系统初始化 (2-3 分钟)

```bash
bash scripts/1-initial-setup.sh
```

**做什么**:
- ✅ 验证 sudo 权限
- ✅ 检查系统架构（x86_64 或 ARM64）
- ✅ 检查磁盘空间（需要 20GB）
- ✅ 创建 /var/www/morning-reading 目录
- ✅ 设置正确的文件权限

**输出示例**:
```
[✓] sudo 权限验证成功
[✓] 系统架构: x86_64
[✓] 磁盘空间充足（可用: 100GB，需要: 20GB）
[✓] 应用目录已创建: /var/www/morning-reading
```

---

### 第 2 步：安装依赖 (5-8 分钟)

```bash
bash scripts/2-install-dependencies.sh
```

**做什么**:
- ✅ 安装 Node.js v18+ 和 npm
- ✅ 安装 Docker 和 Docker Compose
- ✅ 安装 PM2（全局）
- ✅ 安装 Nginx
- ✅ 安装 Certbot（Let's Encrypt）
- ✅ 验证所有安装

**输出示例**:
```
[✓] Node.js 安装完成: v18.17.0
[✓] Docker 安装完成: 24.0.0
[✓] Docker Compose 安装完成: v2.18.0
[✓] PM2 安装完成: 5.3.0
[✓] Nginx 安装完成: 1.18.0
[✓] Certbot 安装完成: 2.5.0
```

---

### 第 3 步：基础设施设置 (1-2 分钟)

```bash
bash scripts/3-setup-infrastructure.sh [git-url] [branch]

# 示例
bash scripts/3-setup-infrastructure.sh https://github.com/flylion816/Morning_Reading_Club.git main
```

**做什么**:
- ✅ 克隆或更新 Git 仓库
- ✅ 复制 .env.config.js 配置
- ✅ 创建日志、管理后台、备份目录
- ✅ 设置文件权限

**输出示例**:
```
[✓] 项目代码已克隆 (main 分支)
[✓] 后端 package.json 已验证
[✓] 管理后台 package.json 已验证
[✓] 日志目录已创建: /var/www/morning-reading/backend/logs
```

---

### 第 4 步：初始化数据库 (3-5 分钟)

```bash
bash scripts/4-init-database.sh [course-script]

# 示例
bash scripts/4-init-database.sh                    # 使用默认数据
bash scripts/4-init-database.sh init-23-days.js   # 替换为 23 天课程
```

**做什么**:
- ✅ 启动 Docker 容器（MongoDB、MySQL、Redis）
- ✅ 等待容器就绪（总共 60 秒超时）
- ✅ 验证数据库连接
- ✅ 运行 init-all.js 初始化数据库
- ✅ 可选：加载特定课程数据

**输出示例**:
```
[✓] Docker 容器已启动
[✓] MongoDB 就绪 (localhost:27017)
[✓] MySQL 就绪 (localhost:3306)
[✓] Redis 就绪 (localhost:6379)
[✓] 数据库初始化脚本已执行
```

---

### 第 5 步：Nginx 和 SSL 配置 (2-3 分钟)

```bash
bash scripts/5-setup-nginx.sh [domain] [email]

# 示例
bash scripts/5-setup-nginx.sh wx.shubai01.com admin@morningreading.com
```

**做什么**:
- ✅ 复制 Nginx 配置文件
- ✅ 验证 Nginx 配置语法
- ✅ 申请 Let's Encrypt SSL 证书
- ✅ 配置 Certbot 自动续期
- ✅ 重新加载 Nginx

**输出示例**:
```
[✓] Nginx 已安装并运行
[✓] 站点配置已复制: wx.shubai01.com
[✓] SSL 证书已申请成功
[✓] Certbot 自动续期已启用
[✓] Nginx 已重新加载
```

---

### 第 6 步：部署应用 (2-3 分钟)

```bash
bash scripts/6-deploy-app.sh
```

**做什么**:
- ✅ 安装后端依赖 (npm install)
- ✅ 启动 PM2 应用
- ✅ 配置 PM2 日志轮转（500MB/文件 × 10 个）
- ✅ 部署管理后台
- ✅ 验证后端服务
- ✅ 重新加载 Nginx

**输出示例**:
```
[✓] 后端依赖已安装
[✓] PM2 应用已启动: morning-reading-backend
[✓] 日志轮转已配置: 500MB/文件 × 10个 = 5GB总量
[✓] 后端服务已启动: http://127.0.0.1:3000/api/v1/health
[✓] Nginx 已重新加载
```

---

## 📊 部署时间预估

| 步骤 | 任务 | 耗时 |
|------|------|------|
| 1️⃣ | 系统初始化 | 2-3 分钟 |
| 2️⃣ | 安装依赖 | 5-8 分钟 |
| 3️⃣ | 基础设施 | 1-2 分钟 |
| 4️⃣ | 初始化数据库 | 3-5 分钟 |
| 5️⃣ | Nginx + SSL | 2-3 分钟 |
| 6️⃣ | 部署应用 | 2-3 分钟 |
| **总计** | **完整部署** | **15-25 分钟** |

---

## 🔄 日常更新部署

如果只是更新代码（不需要重新初始化服务器）：

```bash
bash scripts/deploy-to-server.sh
# 耗时：3-5 分钟
```

这个脚本会：
1. 本地构建管理后台
2. 创建服务器备份
3. 上传代码包
4. 重启后端服务
5. 重新加载 Nginx

---

## ✅ 验证部署

部署完成后，运行验证脚本：

```bash
bash scripts/verify-deployment.sh
```

**检查内容**:
- ✅ 系统检查（磁盘、内存、网络）
- ✅ 依赖验证（Node.js、Docker、PM2、Nginx）
- ✅ 容器状态（MongoDB、MySQL、Redis）
- ✅ 应用状态（后端、管理后台）
- ✅ API 健康检查
- ✅ SSL 证书有效期

---

## 🆘 常见问题和解决方案

### Q1: "sudo 权限验证失败"

**症状**: 第 1 步失败，提示需要 sudo 权限

**解决**:
```bash
# SSH 到服务器后，运行
sudo visudo

# 添加以下行（在文件末尾）
ubuntu ALL=(ALL) NOPASSWD:ALL

# 保存并退出（Ctrl+X，然后按 Y）
```

---

### Q2: "Docker 安装失败"

**症状**: 第 2 步失败，Docker 无法下载

**解决**:
```bash
# 方案 1：使用包管理器
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# 方案 2：手动安装
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 添加用户到 docker 组
sudo usermod -aG docker ubuntu
```

---

### Q3: "MongoDB 启动超时"

**症状**: 第 4 步失败，MongoDB 无法启动

**解决**:
```bash
# 查看 Docker 日志
docker logs morning-reading-mongodb

# 检查磁盘空间
df -h

# 重启 Docker
docker compose down
docker compose up -d
```

---

### Q4: "Nginx 配置验证失败"

**症状**: 第 5 步失败，Nginx 配置错误

**解决**:
```bash
# 检查配置文件
sudo nginx -t

# 查看详细错误
sudo cat /var/log/nginx/error.log

# 恢复默认配置
sudo cp /etc/nginx/nginx.conf.bak /etc/nginx/nginx.conf
```

---

### Q5: "后端应用启动失败"

**症状**: 第 6 步失败，PM2 应用无法启动

**解决**:
```bash
# 查看 PM2 日志
pm2 logs morning-reading-backend --lines 100

# 检查后端配置
cat /var/www/morning-reading/backend/.env

# 手动启动测试
cd /var/www/morning-reading/backend
npm start
```

---

### Q6: "SSL 证书申请失败"

**症状**: 第 5 步失败，Certbot 无法申请证书

**解决**:
```bash
# 检查域名 DNS
nslookup your-domain.com

# 检查防火墙
sudo ufw status

# 手动申请证书
sudo certbot certonly --nginx -d your-domain.com --email your-email@example.com

# 查看已申请证书
sudo certbot certificates
```

---

## 📂 部署系统目录结构

```
scripts/
├── lib/
│   ├── utils.sh                      # 基础工具库（137 行）
│   ├── deploy-functions.sh           # 部署函数库（~400 行）
│   ├── database-functions.sh         # 数据库函数库（~400 行）
│   ├── infrastructure-functions.sh   # 基础设施函数库（~350 行）
│   └── README.md                     # 函数库文档
│
├── 1-initial-setup.sh                # 系统初始化（~70 行）
├── 2-install-dependencies.sh         # 安装依赖（~90 行）
├── 3-setup-infrastructure.sh         # 基础设施设置（~140 行）
├── 4-init-database.sh                # 初始化数据库（~120 行）
├── 5-setup-nginx.sh                  # Nginx + SSL（~170 行）
├── 6-deploy-app.sh                   # 部署应用（~130 行）
│
├── verify-deployment.sh              # 验证部署（待创建）
├── recovery.sh                       # 灾难恢复（待创建）
├── deploy-to-server.sh               # 日常部署（已存在，待优化）
│
└── DEPLOYMENT_GUIDE.md               # 本文档
```

---

## 🏗️ 架构设计

```
用户执行脚本序列：
  scripts/1-initial-setup.sh
         ↓
  scripts/2-install-dependencies.sh
         ↓
  scripts/3-setup-infrastructure.sh
         ↓
  scripts/4-init-database.sh
         ↓
  scripts/5-setup-nginx.sh
         ↓
  scripts/6-deploy-app.sh

每个脚本都独立加载需要的函数库：
  ┌─ scripts/lib/utils.sh (基础)
  ├─ scripts/lib/deploy-functions.sh
  ├─ scripts/lib/database-functions.sh
  └─ scripts/lib/infrastructure-functions.sh
```

---

## 💾 备份和恢复

### 自动备份
每次运行 `deploy-to-server.sh` 时，自动创建备份：
```bash
/var/www/morning-reading_bak_20260313_120000.tar.gz
```

### 手动备份
```bash
cd /var/www
sudo tar --exclude='morning-reading/logs' -czf \
  morning-reading_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  morning-reading/
```

### 恢复备份
```bash
cd /var/www
sudo rm -rf morning-reading
sudo tar -xzf morning-reading_bak_20260313_120000.tar.gz
pm2 restart morning-reading-backend
sudo systemctl reload nginx
```

---

## 📝 环境变量配置

### .env.config.js
位置：`/var/www/morning-reading/.env.config.js`

```javascript
module.exports = {
  config: {
    backend: {
      nodeEnv: 'production',
      port: 3000,
      mongodbUri: 'mongodb://admin:password@localhost:27017/morning_reading?authSource=admin',
      mysqlHost: 'localhost',
      mysqlUser: 'morning_user',
      mysqlPassword: 'your_password',
      redisUrl: 'redis://:password@localhost:6379',
    },
    // ... 更多配置
  }
};
```

---

## 🔐 安全建议

1. **更改默认密码**
   ```bash
   # MongoDB
   mongosh -u admin -p old_password localhost:27017/admin
   > db.changeUserPassword("admin", "new_strong_password")
   ```

2. **配置防火墙**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. **定期备份**
   ```bash
   # 每天凌晨 2 点自动备份
   0 2 * * * /var/www/morning-reading/scripts/backup.sh
   ```

4. **监控磁盘空间**
   ```bash
   # 使用 PM2 日志轮转防止磁盘满
   pm2 set pm2-logrotate:max_size 500M
   ```

---

## 📞 获取帮助

1. **查看脚本文档**
   ```bash
   cat scripts/lib/README.md
   ```

2. **查看应用日志**
   ```bash
   pm2 logs morning-reading-backend
   docker logs morning-reading-mongodb
   sudo tail -f /var/log/nginx/error.log
   ```

3. **检查系统状态**
   ```bash
   pm2 status
   docker ps
   sudo systemctl status nginx
   ```

---

## 🎯 下一步

- [ ] 在测试服务器上验证完整部署流程
- [ ] 创建 `scripts/verify-deployment.sh`
- [ ] 创建 `scripts/recovery.sh`
- [ ] 优化 `scripts/deploy-to-server.sh`
- [ ] 编写故障排查指南

---

**最后更新**: 2026-03-13
**版本**: 1.0
**作者**: Claude Code
**项目**: 晨读营小程序完整部署系统
