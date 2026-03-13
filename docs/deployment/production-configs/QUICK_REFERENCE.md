# 🚀 生产环境配置快速参考

> 常用的配置文件位置、命令和排查步骤

---

## 📂 配置文件一览表

| 文件 | 本地位置 | 服务器位置 | 用途 | 修改频率 |
|------|---------|----------|------|---------|
| Nginx 主配置 | `nginx/nginx.conf` | `/etc/nginx/nginx.conf` | 全局 Web 配置 | 很少 |
| 站点配置 | `nginx/wx.shubai01.com.conf` | `/etc/nginx/sites-available/wx.shubai01.com` | 晨读营站点 | 有时 |
| PM2 配置 | `pm2/pm2.config.js.production` | `/var/www/morning-reading/backend/pm2.config.js` | 进程管理 | 有时 |
| Docker 配置 | `docker/docker-compose.yml.production` | `/var/www/morning-reading/backend/docker-compose.yml` | 容器编排 | 有时 |
| 环境变量 | `.env.production.example` | `/var/www/morning-reading/backend/.env.production` | 敏感配置 | 很少 |
| 证书 | - | `/etc/letsencrypt/live/wx.shubai01.com/` | HTTPS | 自动 |

---

## ⚡ 常用命令速查

### 🌐 Nginx 相关

```bash
# 验证配置语法（修改前必须）
sudo nginx -t

# 重新加载配置（不中断连接）
sudo systemctl reload nginx

# 重启 Nginx（会中断连接）
sudo systemctl restart nginx

# 查看 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 查看 Nginx 进程
ps aux | grep nginx
```

### 🚀 PM2 相关

```bash
# 查看应用状态
pm2 status

# 查看特定应用状态
pm2 status morning-reading-backend

# 启动应用
pm2 start pm2.config.js --env production

# 重启应用
pm2 restart morning-reading-backend

# 停止应用
pm2 stop morning-reading-backend

# 删除应用
pm2 delete morning-reading-backend

# 查看应用日志
pm2 logs morning-reading-backend

# 查看实时监控
pm2 monit

# 保存 PM2 状态（重启后自动启动）
pm2 save
pm2 startup
```

### 🐳 Docker 相关

```bash
# 启动所有容器
cd /var/www/morning-reading/backend
docker compose up -d

# 查看运行中的容器
docker ps

# 查看所有容器（包括停止的）
docker ps -a

# 查看容器日志
docker logs morning-reading-mongodb
docker logs morning-reading-mysql
docker logs morning-reading-redis

# 重启特定容器
docker compose restart mongodb
docker compose restart mysql
docker compose restart redis

# 停止所有容器
docker compose down

# 删除并重建容器
docker compose up -d --force-recreate

# 查看 Docker 磁盘占用
docker system df
```

### 🔐 SSL 证书相关

```bash
# 查看证书有效期
sudo certbot certificates

# 测试续期（不实际续期）
sudo certbot renew --dry-run

# 手动续期
sudo certbot renew

# 查看 Certbot 日志
sudo journalctl -u certbot.timer
```

### 📊 监控和日志

```bash
# 查看磁盘空间
df -h

# 查看进程内存使用
top
ps aux | grep node

# 查看系统日志
sudo tail -f /var/log/syslog

# 查看应用日志（PM2）
pm2 logs morning-reading-backend

# 查看容器日志（Docker）
docker logs morning-reading-mongodb
docker logs morning-reading-mysql
docker logs morning-reading-redis

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

---

## 🆘 常见问题排查

### ❌ API 无法访问

**症状**：`curl https://wx.shubai01.com/api/v1/health` 返回错误

**排查步骤**：
```bash
# 1. 检查 Nginx 是否运行
sudo systemctl status nginx

# 2. 检查 Nginx 配置
sudo nginx -t

# 3. 检查后端进程是否运行
pm2 status morning-reading-backend

# 4. 检查后端日志
pm2 logs morning-reading-backend | tail -50

# 5. 检查 Docker 容器
docker ps | grep morning-reading

# 6. 检查防火墙
sudo ufw status
```

### ❌ Nginx 无法重新加载

**症状**：`sudo systemctl reload nginx` 失败

**排查步骤**：
```bash
# 1. 检查配置语法
sudo nginx -t

# 2. 如果有错误，根据提示修改配置文件
# 配置文件位置：/etc/nginx/sites-available/wx.shubai01.com

# 3. 修改后再次验证
sudo nginx -t

# 4. 重新加载
sudo systemctl reload nginx
```

### ❌ 数据库无法连接

**症状**：PM2 日志显示 MongoDB/MySQL 连接失败

**排查步骤**：
```bash
# 1. 检查容器状态
docker ps | grep -E "mongodb|mysql|redis"

# 2. 查看容器日志
docker logs morning-reading-mongodb
docker logs morning-reading-mysql

# 3. 重启容器
docker compose restart mongodb
docker compose restart mysql

# 4. 检查 .env 配置
cat /var/www/morning-reading/backend/.env.production | grep -E "MONGO|MYSQL|REDIS"

# 5. 测试数据库连接
# MongoDB
mongosh -u admin -p YOUR_PASSWORD localhost:27017/morning_reading

# MySQL
mysql -h 127.0.0.1 -u morning_user -p YOUR_PASSWORD morning_reading
```

### ❌ 证书过期导致 HTTPS 失败

**症状**：浏览器显示证书错误

**排查步骤**：
```bash
# 1. 检查证书有效期
sudo certbot certificates

# 2. 如果已过期，手动续期
sudo certbot renew

# 3. 重新加载 Nginx
sudo systemctl reload nginx

# 4. 测试 HTTPS
curl -I https://wx.shubai01.com/api/v1/health
```

### ❌ 磁盘空间不足

**症状**：应用无法写入日志、数据库容器无法启动

**排查步骤**：
```bash
# 1. 检查磁盘使用
df -h

# 2. 清理日志
pm2 flush

# 3. 清理 Docker
docker system prune -a

# 4. 清理临时文件
sudo rm -rf /tmp/*
```

---

## 🔄 配置修改流程

### 修改 Nginx 配置

```bash
# 1. 在本地编辑配置
vim docs/deployment/production-configs/nginx/wx.shubai01.com.conf

# 2. 上传到服务器
scp -i ~/.ssh/id_rsa docs/deployment/production-configs/nginx/wx.shubai01.com.conf \
  ubuntu@118.25.145.179:/etc/nginx/sites-available/

# 3. SSH 到服务器验证
ssh -i ~/.ssh/id_rsa ubuntu@118.25.145.179
sudo nginx -t

# 4. 重新加载
sudo systemctl reload nginx

# 5. 本地 git 提交
git add docs/deployment/production-configs/nginx/
git commit -m "config: update nginx configuration for wx.shubai01.com"
```

### 修改 PM2 配置

```bash
# 1. 在本地编辑配置
vim docs/deployment/production-configs/pm2/pm2.config.js.production

# 2. 上传到服务器
scp -i ~/.ssh/id_rsa docs/deployment/production-configs/pm2/pm2.config.js.production \
  ubuntu@118.25.145.179:/var/www/morning-reading/backend/pm2.config.js

# 3. SSH 到服务器重启
ssh -i ~/.ssh/id_rsa ubuntu@118.25.145.179
pm2 restart morning-reading-backend --update-env

# 4. 本地 git 提交
git add docs/deployment/production-configs/pm2/
git commit -m "config: update PM2 configuration"
```

### 修改环境变量

⚠️ **重要**：`.env.production` 包含敏感信息，不要提交到 git

```bash
# 1. SSH 到服务器
ssh -i ~/.ssh/id_rsa ubuntu@118.25.145.179

# 2. 编辑配置（仅在服务器上）
sudo vim /var/www/morning-reading/backend/.env.production

# 3. 重启应用
pm2 restart morning-reading-backend --update-env

# 4. 验证
pm2 logs morning-reading-backend
```

---

## 📋 定期维护清单

### 每周
- [ ] 检查磁盘空间（`df -h`）
- [ ] 查看应用日志是否有错误
- [ ] 检查 PM2 应用是否正常运行

### 每月
- [ ] 检查 SSL 证书有效期（`sudo certbot certificates`）
- [ ] 检查 Docker 容器日志
- [ ] 备份数据库
- [ ] 更新此文档

### 每季度
- [ ] 全系统安全审计
- [ ] 检查依赖版本更新
- [ ] 性能优化评估

---

## 🆘 紧急联系清单

| 问题 | 快速修复 | 详细文档 |
|------|---------|---------|
| API 无法访问 | 检查 PM2 和 Nginx | [此文档](#常见问题排查) |
| 证书过期 | `sudo certbot renew` | [certificates/README.md](./certificates/README.md) |
| 磁盘满 | 清理日志和 Docker | [部署指南](../DEPLOYMENT.md) |
| 数据库连接失败 | 检查 Docker 容器 | [此文档](#常见问题排查) |

---

## 📚 相关文档

- 📖 [完整部署指南](../DEPLOYMENT.md)
- 🐳 [Docker 配置详解](../production-configs/README.md#-docker-配置-docker)
- 🚀 [PM2 进程管理](../production-configs/README.md#-pm2-配置-pm2)
- 🔐 [SSL 证书管理](./certificates/README.md)

---

**最后更新**：2026-03-13

💡 **提示**：收藏此页面以便快速参考！
