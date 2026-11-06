---
name: "source-command-deployment-deployment-guide"
description: "Migrated source command `deployment-DEPLOYMENT_GUIDE`"
---

# source-command-deployment-deployment-guide

Use this skill when the user asks to run the migrated source command `deployment-DEPLOYMENT_GUIDE`.

## Command Template

# 🚀 晨读营小程序 - 线上部署指南

> **最后更新**：2025-12-08
> **部署脚本**：`.Codex/deployment/deploy.sh`
> **环境模板**：`backend/.env.production.template`

---

## 📋 部署前检查清单

### 必须准备的信息

```
✅ 服务器IP地址：______________________
✅ 服务器用户名：ubuntu (默认)
✅ 服务器密码/密钥：已准备
✅ 域名：______________________
✅ MongoDB连接字符串：______________________
✅ 微信AppID：______________________
✅ 微信AppSecret：______________________
✅ JWT密钥：______________________
```

### 必须完成的操作

- [ ] SSH登录成功（22端口已开放）
- [ ] 安全组已配置（开放80、443、3000端口）
- [ ] DNS已配置（域名指向服务器IP）
- [ ] SSL证书已准备（或使用Let's Encrypt免费证书）
- [ ] MongoDB已创建（云服务或自建）

---

## 🚀 部署步骤

### 第1步：初始化服务器（仅需一次）

```bash
# 在你本地执行
bash .Codex/deployment/deploy.sh 123.207.223.93 init
```

**这会自动完成：**

- ✅ 更新系统软件
- ✅ 安装Node.js 18
- ✅ 安装PM2（进程管理）
- ✅ 安装Nginx（反向代理）
- ✅ 创建部署目录
- ✅ 配置防火墙

**执行时间**：10-15分钟

---

### 第2步：准备环境变量

在服务器上创建后端环境配置：

```bash
ssh ubuntu@123.207.223.93

# 进入后端目录
cd /var/www/morning-reading/backend

# 复制模板
cp ../../.env.production.template .env

# 编辑配置文件
nano .env  # 或 vi .env

# 填入以下关键信息：
# NODE_ENV=production
# MONGODB_URI=mongodb://...（你的MongoDB地址）
# API_BASE_URL=https://你的域名/api/v1
# JWT_SECRET=随机生成的密钥
# WECHAT_APPID=你的AppID
# WECHAT_SECRET=你的AppSecret
```

**生成安全的JWT密钥：**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 第3步：部署应用

```bash
# 在你本地执行
bash .Codex/deployment/deploy.sh 123.207.223.93 deploy
```

**这会自动完成：**

1. ✅ **克隆后端代码**
   - 从GitHub拉取最新代码
   - 安装生产依赖
   - 删除不必要的文件

2. ✅ **启动后端服务**
   - 使用PM2启动（2个实例集群模式）
   - 配置开机自启
   - 进行健康检查

3. ✅ **构建并部署前端**
   - 本地构建admin dist
   - 上传到服务器
   - 配置Nginx提供静态文件

4. ✅ **配置Nginx反向代理**
   - API请求代理到后端
   - 前端路由SPA支持
   - 安全头配置

5. ✅ **配置SSL证书**
   - 使用Let's Encrypt免费证书
   - 配置HTTPS
   - 自动续期

**执行时间**：15-20分钟

---

### 第4步：验证部署

```bash
# 在你本地执行
bash .Codex/deployment/deploy.sh 123.207.223.93 status
```

**应该看到：**

```
=== PM2服务状态 ===
│ id │ name                   │ mode    │ ↺ │ status
├────┼────────────────────────┼─────────┼──┼──────────┤
│ 0  │ morning-reading-api    │ cluster │ 0 │ online
│ 1  │ morning-reading-api    │ cluster │ 0 │ online

=== API健康检查 ===
{"status":"ok"}

=== Nginx状态 ===
Active: active (running)
```

**验证访问：**

```bash
# 验证后端API
curl -k https://你的域名/api/v1/health

# 验证前端
curl -k https://你的域名/admin
```

---

## 📝 常见操作

### 查看实时日志

```bash
bash .Codex/deployment/deploy.sh 123.207.223.93 logs
```

### 更新代码（有新提交时）

```bash
# 推送新代码到GitHub后，执行：
bash .Codex/deployment/deploy.sh 123.207.223.93 update

# 这会：
# 1. 拉取最新代码
# 2. 重新安装依赖（如果有改变）
# 3. 自动重启PM2
```

### 手动SSH连接服务器

```bash
ssh ubuntu@123.207.223.93

# 查看PM2状态
pm2 status
pm2 logs morning-reading-api

# 重启服务
pm2 restart morning-reading-api

# 停止服务
pm2 stop morning-reading-api

# 查看Nginx日志
tail -f /var/log/nginx/morning-reading-access.log
```

---

## ⚠️ 故障排查

### 问题1：API无法访问

```bash
# 检查PM2状态
ssh ubuntu@123.207.223.93 "pm2 status"

# 查看日志
ssh ubuntu@123.207.223.93 "pm2 logs morning-reading-api"

# 检查MongoDB连接
ssh ubuntu@123.207.223.93 "curl http://localhost:3000/api/v1/health"
```

**常见原因：**

- MongoDB连接字符串错误 → 检查 `.env` 文件
- 环境变量未设置 → 重启PM2
- 依赖版本问题 → 重新 `npm install`

### 问题2：HTTPS证书错误

```bash
# 检查证书过期日期
ssh ubuntu@123.207.223.93 "sudo openssl x509 -in /etc/nginx/ssl/certificate.crt -noout -dates"

# 手动续期
ssh ubuntu@123.207.223.93 "sudo certbot renew"
```

### 问题3：Nginx 502错误

```bash
# 检查Nginx配置
ssh ubuntu@123.207.223.93 "sudo nginx -t"

# 查看Nginx错误日志
ssh ubuntu@123.207.223.93 "tail -50 /var/log/nginx/morning-reading-error.log"

# 重启Nginx
ssh ubuntu@123.207.223.93 "sudo systemctl restart nginx"
```

### 问题4：磁盘空间满

```bash
# 查看磁盘使用
ssh ubuntu@123.207.223.93 "df -h"

# 清理日志
ssh ubuntu@123.207.223.93 "sudo journalctl --vacuum=100M"

# 清理PM2日志
ssh ubuntu@123.207.223.93 "pm2 flush"
```

---

## 📊 性能监控

### 实时监控

```bash
ssh ubuntu@123.207.223.93 << 'EOF'
# 查看进程占用
top

# 查看网络连接
netstat -an | grep ESTABLISHED

# 查看磁盘I/O
iostat -x 1 5
EOF
```

### 设置告警（可选）

连接到云厂商控制台：

**阿里云：**

```
控制台 → 云监控 → 告警规则 → 新建规则
- CPU > 80% 告警
- 内存 > 80% 告警
- 磁盘 > 90% 告警
```

**腾讯云：**

```
控制台 → 云监控 → 告警管理 → 新建策略
- CPU > 80% 告警
- 内存 > 80% 告警
```

---

## 🔒 安全建议

### ✅ 必做

- [ ] 修改SSH默认端口（可选但推荐）
- [ ] 禁用密码登录，仅允许密钥登录
- [ ] 配置防火墙只允许必要端口
- [ ] 定期更新系统和依赖
- [ ] 定期备份数据库

### 环境变量安全

```bash
# ✅ 正确：使用 .env 文件
WECHAT_SECRET=xxxxxxxxxxxx

# ❌ 错误：硬编码在代码中
const SECRET = "xxxxxxxxxxxx";

# ❌ 错误：在GitHub上提交 .env
git add .env  # 不要这样做！
```

### 日志安全

```bash
# 定期清理日志（防止磁盘满）
ssh ubuntu@123.207.223.93 << 'EOF'
# 清理7天前的日志
find /var/log -type f -name "*.log" -mtime +7 -delete

# 配置日志轮转
sudo vim /etc/logrotate.d/nginx
EOF
```

---

## 📈 后续优化

### 第1周

- [ ] 监控错误日志
- [ ] 收集用户反馈
- [ ] 修复发现的Bug
- [ ] 优化API性能

### 第2-4周

- [ ] 添加Redis缓存
- [ ] 优化数据库查询
- [ ] 启用CDN加速
- [ ] 添加更多功能

### 持续

- [ ] 定期备份
- [ ] 监控告警
- [ ] 代码审查
- [ ] 性能调优

---

## 🆘 获取帮助

遇到问题？按以下顺序尝试：

1. **查看日志**

   ```bash
   bash deploy.sh <IP> logs
   ```

2. **检查状态**

   ```bash
   bash deploy.sh <IP> status
   ```

3. **查看本文档故障排查部分**

4. **SSH连接服务器手动检查**

5. **提交Issue到GitHub**

---

## 📚 相关文档

- [部署脚本说明](.Codex/deployment/deploy.sh)
- [环境变量模板](./backend/.env.production.template)
- [在线部署计划](.Codex/memory/online-deployment-plan.md)
- [开发指南](./DEVELOPMENT.md)

---

**祝部署顺利！🎉**
