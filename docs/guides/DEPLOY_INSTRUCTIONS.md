# 晨读营 - 完整部署指南

**最后更新**: 2026-03-03 (SSL 证书过期通知已配置)
**版本**: 3.3
**状态**: ✅ 生产就绪 + HTTPS + 自动续期通知

> 📌 **重要**：本部署指南涵盖所有部署步骤和环境配置说明。发布前，请仔细阅读本文档。
>
> 📌 **运维补充**：线上重启、DNS、PM2 自启动、重启后验收请参考 [PRODUCTION_OPERATIONS_RUNBOOK.md](./PRODUCTION_OPERATIONS_RUNBOOK.md)

---

## ⚡ 速查表（< 2 分钟找到答案）

### 快速命令速查

| 你需要做什么              | 快速命令                                                               | 时间     |
| ------------------------- | ---------------------------------------------------------------------- | -------- |
| ⚙️ **环境安装**（一次性） | SSH → `bash scripts/server/setup-server-env.sh`                        | 5-10分钟 |
| 🆕 **首次部署代码**       | Step 1: 本地 `bash scripts/deploy-to-server.sh` → Step 2-4: 参考第一章 | 5-10分钟 |
| 📝 **日常代码更新**       | `bash scripts/deploy-to-server.sh`                                     | 3-5分钟  |
| 🛡️ **重启前/后巡检**     | `ssh ubuntu@118.25.145.179 'cd /var/www/morning-reading && bash scripts/verify-deployment.sh'` | 2-5分钟 |
| 🔁 **服务器重启 Runbook** | 参考 `docs/guides/PRODUCTION_OPERATIONS_RUNBOOK.md`                    | 5-15分钟 |
| 🔧 **重启后端服务**       | `pm2 restart morning-reading-backend`                                  | < 1分钟  |
| 🔄 **重启管理后台**       | `sudo nginx -s reload`                                                 | < 1分钟  |
| 🔄 **重启管理后台**       | `sudo nginx -s reload`                                                 | < 1分钟  |

### 密码速查表

**⚠️ 所有密码来自 `.env.config.js`，不应手工编辑。参考第二部分《环境配置管理》了解如何修改密码。**

| 服务               | 用户    | 密码                    | 说明                          |
| ------------------ | ------- | ---------------------- | ----------------------------- |
| **MongoDB**        | admin   | ProdMongodbSecure123   | 从 .env.config.js → prod      |
| **MySQL root**     | root    | L55PWzePtXYPNkn7       | 从 .env.config.js → prod      |
| **MySQL app**      | root    | L55PWzePtXYPNkn7       | Docker 中使用 root 用户       |
| **Redis**          | —       | Redis@Prod@User0816!   | 从 .env.config.js → prod      |
| **管理员登录**     | admin@morningreading.com | admin123456      | 初始化脚本自动创建           |

### 服务器信息

| 项目      | 值                                  |
| --------- | ----------------------------------- |
| 服务器 IP | 118.25.145.179                      |
| 登录用户  | ubuntu                              |
| SSH Key   | ~/.ssh/id_rsa                       |
| 后端路径  | /var/www/morning-reading/backend    |
| 前端路径  | /var/www/morning-reading/admin/dist |
| PM2 应用  | morning-reading-backend             |
| OS        | Ubuntu 24.04.3 LTS (x86_64)         |

---

## 📌 环境配置管理（所有密码的唯一来源）

### 配置体系说明

项目采用**三层配置系统**确保所有环境一致性：

```
第一层：.env.config.js ← 【唯一来源】所有密码在这里定义
   ↓ （自动生成）
第二层：.env.docker / .env.production ← 运行环境使用的配置
   ↓ （应用读取）
第三层：Docker 容器 / Node.js 进程 ← 实际运行的应用
```

### 文件说明

| 文件                 | 用途                          | 提交 Git? | 编辑方式          |
| -------------------- | ----------------------------- | --------- | ------------------- |
| `.env.config.js`     | 所有密码配置的唯一来源        | ✅ 是     | 直接编辑          |
| `.env.docker`        | Docker 环境配置（自动生成）   | ❌ 否     | 运行脚本生成      |
| `.env.production`    | 服务器环境配置（自动生成）    | ❌ 否     | 运行脚本生成      |

### 修改密码的完整流程

**场景：需要更改生产环境 MongoDB 密码**

```bash
# 1️⃣ 编辑配置源
vim .env.config.js
# 修改：prod.backend.mongodbUri 中的密码

# 2️⃣ 生成新的环境配置
node scripts/generate-env-production.js --server

# 3️⃣ 推送到服务器
scp backend/.env.production ubuntu@118.25.145.179:/var/www/morning-reading/backend/

# 4️⃣ 重启应用
ssh ubuntu@118.25.145.179 "pm2 restart morning-reading-backend"
```

### 关键要点

- ✅ **总是修改 `.env.config.js`**，不要手工编辑 `.env.production`
- ✅ **修改后运行生成脚本**：`node scripts/generate-env-production.js --server`
- ✅ **一个地方修改，所有环境同步** —— 避免密码不一致
- ❌ **不要提交 `.env.docker` 和 `.env.production`** —— 已在 `.gitignore` 中

---

## 💻 Nginx 和 SSL 证书配置

### 域名和 DNS 配置

在配置 SSL 之前，确保 DNS 解析正确：

```bash
# 验证 DNS 记录（应该指向服务器 IP）
dig wx.shubai01.com

# 应该返回：
# wx.shubai01.com.     300  IN  A  118.25.145.179
```

### SSL 证书申请（Let's Encrypt）

使用 Certbot 自动申请和配置 SSL 证书：

```bash
# SSH 到服务器
ssh ubuntu@118.25.145.179

# 申请证书（需要 Certbot 已安装，通过 setup-server-env.sh 完成）
sudo certbot certonly --nginx -d wx.shubai01.com \
  --non-interactive --agree-tos --email admin@morningreading.com

# 验证证书已申请成功
sudo certbot certificates
```

**证书位置**：
- 完整链：`/etc/letsencrypt/live/wx.shubai01.com/fullchain.pem`
- 私钥：`/etc/letsencrypt/live/wx.shubai01.com/privkey.pem`
- 自动续期：Certbot 会每 60 天自动续期

### Nginx 虚拟主机配置

创建 Nginx 配置文件 `/etc/nginx/sites-available/wx.shubai01.com`：

```nginx
server {
    server_name wx.shubai01.com;

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # 健康检查端点
    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 管理后台静态文件
    location /admin {
        alias /var/www/morning-reading/admin/dist;
        try_files $uri $uri/ /admin/index.html;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 默认首页重定向到管理后台
    location = / {
        return 301 /admin;
    }

    # SSL 配置
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/wx.shubai01.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wx.shubai01.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# HTTP 自动重定向到 HTTPS
server {
    listen 80;
    server_name wx.shubai01.com;
    return 301 https://$host$request_uri;
}
```

### 启用 Nginx 配置

```bash
# 创建软链接以启用配置
sudo ln -sf /etc/nginx/sites-available/wx.shubai01.com /etc/nginx/sites-enabled/

# 验证配置语法
sudo nginx -t

# 重启 Nginx
sudo systemctl reload nginx

# 验证启用状态
ls -la /etc/nginx/sites-enabled/ | grep wx.shubai01.com
```

### 验证 HTTPS 访问

```bash
# 测试后端 API
curl -I https://wx.shubai01.com/api/v1/health

# 预期返回：HTTP/1.1 200 OK

# 测试管理后台
curl -I https://wx.shubai01.com/admin

# 预期返回：HTTP/1.1 301 Moved Permanently（重定向到 /admin/）

# 验证 SSL 证书
openssl s_client -connect wx.shubai01.com:443 -servername wx.shubai01.com </dev/null 2>&1 | \
  openssl x509 -noout -text | grep -E "Subject:|Issuer:|Not Before|Not After"

# 预期输出：
# Subject: CN=wx.shubai01.com
# Issuer: C=US, O=Let's Encrypt, CN=E8
# Not Before: Mar  3 02:09:26 2026 GMT
# Not After : Jun  1 02:09:25 2026 GMT
```

### SSL 证书有效期和续期通知

**当前证书状态（wx.shubai01.com）**：
- ✅ 签发日期：2026-03-03
- ✅ 过期日期：**2026-06-01**（还剩 **89 天**）
- ✅ 过期通知邮箱：308965039@qq.com

**续期方案**：
1. Certbot 会在证书过期前 **30 天** 开始每天尝试自动续期
2. 续期成功后，自动调用通知脚本，发送邮件到 `308965039@qq.com`
3. 邮件通知内容：续期完成、新过期时间、无需手动操作
4. **无需手动干预** —— 自动续期和通知完全自动化

### 自动续期检查

```bash
# 检查 Let's Encrypt 续期状态（模拟运行，不实际续期）
sudo certbot renew --dry-run

# 手动触发续期（测试通知脚本，不会真正续期如果还有90天以上）
sudo certbot renew --force-renewal

# 设置自动续期（通常已通过 Certbot 设置）
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 查看续期日志
sudo journalctl -u certbot.timer -n 50

# 查看系统通知日志
sudo tail -f /var/log/certbot-renewal.log
```

### 快到期时需要做什么

**当你收到过期通知邮件时**：

| 场景 | 需要做什么 |
|------|-----------|
| 📧 **收到续期成功邮件** | ✅ **无需操作** — 证书已自动更新，Nginx 已加载新证书 |
| ❌ **没有收到邮件（快到期）** | 手动检查：`sudo certbot renew --force-renewal` |
| 🔧 **续期失败** | 检查日志：`sudo journalctl -u certbot.timer \| tail -20` |
| 🔒 **证书已过期** | 紧急续期：`sudo certbot renew --force-renewal` |

### 续期失败的手动修复

如果自动续期失败，手动续期步骤：

```bash
# 1️⃣ SSH 到服务器
ssh ubuntu@118.25.145.179

# 2️⃣ 强制续期
sudo certbot renew --force-renewal

# 3️⃣ 验证证书已更新
sudo certbot certificates

# 4️⃣ 重启 Nginx（通常 Certbot 会自动处理）
sudo systemctl reload nginx

# 5️⃣ 验证 HTTPS 仍可访问
curl -I https://wx.shubai01.com/api/v1/health
```

### 邮件通知配置详情

续期通知的配置位置：
```bash
# Certbot 续期配置文件
/etc/letsencrypt/renewal/wx.shubai01.com.conf
  ├─ email = 308965039@qq.com  (通知邮箱)
  └─ renew_hook = /usr/local/bin/certbot-renewal-hook.sh  (续期后调用)

# 续期通知脚本
/usr/local/bin/certbot-renewal-hook.sh
  ├─ 记录续期事件到日志
  └─ 发送邮件通知到 308965039@qq.com
```

### 修改通知邮箱地址

如果需要更改通知邮箱：

```bash
# 1️⃣ SSH 到服务器
ssh ubuntu@118.25.145.179

# 2️⃣ 编辑 Certbot 配置
sudo sed -i 's/email = .*/email = 新邮箱@example.com/' \
  /etc/letsencrypt/renewal/wx.shubai01.com.conf

# 3️⃣ 验证修改
sudo grep email /etc/letsencrypt/renewal/wx.shubai01.com.conf
```

### 常见问题

**问题 1：DNS 不解析**
```bash
# 检查 DNS A 记录是否指向正确的服务器 IP
dig wx.shubai01.com +short
# 应该返回：118.25.145.179

# 如果不正确，在阿里云或域名注册商的管理后台更新 DNS 记录
```

**问题 2：证书申请失败**
```bash
# 常见原因：HTTP 端口 80 不可达
# 确保防火墙允许 80 和 443 端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# 查看 Certbot 日志
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

**问题 3：HTTPS 仍然显示证书错误**
```bash
# 确保浏览器缓存已清除
# 可以用隐身窗口/无痕浏览测试
# 或使用 curl 强制清除缓存：
curl -I --insecure https://wx.shubai01.com/admin
```

---

## 第一章：全新服务器首次部署（4 步完整流程）

### 前置条件

全新服务器部署需要先安装系统依赖：

```bash
# SSH 到服务器
ssh ubuntu@118.25.145.179

# 执行环境安装脚本（一次性）
# 安装：Node.js 20、PM2、Nginx、Docker、MongoDB、MySQL、Redis
bash /tmp/setup-server-env.sh

# 或从项目克隆
cd /tmp && git clone https://github.com/flylion816/Morning_Reading_Club.git
cd Morning_Reading_Club && bash scripts/server/setup-server-env.sh
```

**这一步完成后**，服务器上已安装所有必要的依赖，可以执行后续部署步骤。

### 部署流程图

```
┌─ 步骤 1：本地执行
│  └─ bash scripts/deploy-to-server.sh
│     • 检查依赖
│     • 构建管理后台
│     • 打包代码
│     • 上传到服务器
│
├─ 步骤 2：服务器初始化
│  └─ SSH 连接 + bash scripts/setup-prod-server.sh
│     • 检查 Docker 已安装
│     • 启动数据库容器（MongoDB、MySQL、Redis）
│     • 等待服务健康
│     • 初始化 MySQL 表结构
│     • 重启后端 PM2
│     • 验证后端就绪
│
├─ 步骤 3：数据初始化
│  └─ SSH 执行 + node backend/scripts/init-all.js
│     • 创建超级管理员
│     • 初始化 MongoDB 索引
│     • 初始化其他数据结构
│
└─ 步骤 4：最后重启
   └─ 重启 PM2 应用
      • pm2 restart morning-reading-backend
```

### 详细步骤

#### 步骤 1️⃣：本地执行部署脚本（打包 & 上传）

在本地项目根目录执行：

```bash
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营

# 执行一键部署脚本
bash scripts/deploy-to-server.sh
```

**脚本会自动做**：

- ✅ 检查本地依赖（npm、tar、ssh、scp）
- ✅ 构建管理后台（`npm run build`）
- ✅ 创建备份（服务器上的旧代码）
- ✅ 打包本地代码（tar.gz）
- ✅ 上传到服务器（scp）

**预期输出**：

```
[✓] 依赖检查通过
[✓] 构建管理后台完成
[✓] 创建服务器备份
[✓] 本地打包完成
[✓] 上传到服务器
```

该步骤通常需要 **3-5 分钟**。

#### 步骤 2️⃣：SSH 到服务器并初始化

打开新的终端窗口，SSH 到服务器：

```bash
ssh ubuntu@118.25.145.179

# 进入项目目录
cd /var/www/morning-reading
```

执行初始化脚本：

```bash
# 执行服务器端初始化脚本
bash scripts/setup-prod-server.sh
```

**脚本会自动做**：

- ✅ 检查 Docker 已安装
- ✅ 启动 MongoDB、MySQL、Redis 容器
- ✅ 等待数据库就绪（最多 2 分钟）
- ✅ 初始化 MySQL 表结构
- ✅ 重启后端 PM2 服务
- ✅ 验证后端 API 就绪

**预期输出**：

```
[✓] Docker 已安装
[✓] 启动数据库容器
[✓] MongoDB 已就绪
[✓] MySQL 已就绪
[✓] Redis 已就绪
[✓] MySQL 初始化成功
[✓] 后端服务重启成功
[✓] 后端 API 验证通过
```

该步骤通常需要 **2-3 分钟**。

#### 步骤 3️⃣：初始化数据

执行数据初始化脚本：

```bash
cd /var/www/morning-reading/backend

# 执行初始化脚本（创建超级管理员、索引等）
NODE_ENV=production node scripts/init-all.js
```

**脚本会初始化**：

- ✅ MongoDB 索引和集合
- ✅ 超级管理员账户
- ✅ 其他初始数据

**预期输出**：

```
✓ MongoDB 连接成功
✓ 创建超级管理员
✓ 初始化索引
✓ 数据初始化完成
```

该步骤通常需要 **< 1 分钟**。

#### 步骤 4️⃣：最后重启服务

重启 PM2 应用确保所有配置生效：

```bash
pm2 restart morning-reading-backend

# 验证状态
pm2 status
```

**预期输出**：

```
│ 0 │ morning-reading-backend │ fork │ online │ 0s   │ 0B │ 0%  │
```

### ✅ 部署完成检查清单

部署完成后，验证以下内容：

```bash
# 1. 检查后端是否运行
curl http://localhost:3000/api/v1/health
# 应该返回: {"code":0,"message":"健康检查通过",...}

# 2. 检查 PM2 状态
pm2 status
# 应该显示: morning-reading-backend online

# 3. 查看日志确认无错误
pm2 logs morning-reading-backend --lines 10
```

### 验证管理员账户

返回本地，测试管理员登录：

```bash
curl -X POST https://wx.shubai01.com/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@morningreading.com",
    "password": "Km7$Px2Qw9"
  }'

# 期望返回登录成功和 token
```

### 故障排查

#### 问题：deploy-to-server.sh 失败

```bash
# 检查依赖是否已安装
npm --version
tar --version
ssh -V

# 重新执行脚本
bash scripts/deploy-to-server.sh
```

#### 问题：setup-prod-server.sh 数据库启动失败

```bash
# 查看 docker-compose 日志
docker-compose logs

# 重新启动
docker-compose down
docker-compose up -d

# 重新运行初始化脚本
bash scripts/setup-prod-server.sh
```

#### 问题：init-all.js 执行失败

```bash
# 检查 MongoDB 连接
mongosh -u admin -p p62CWhV0Kd1Unq --eval "db.runCommand({ping:1})"

# 检查后端日志
pm2 logs morning-reading-backend

# 重新执行
NODE_ENV=production node backend/scripts/init-all.js
```

---

## 第二章：日常代码更新

### 何时执行

- ✅ 更新后端代码
- ✅ 更新管理后台页面
- ✅ 更新依赖包
- ✅ 修复 Bug

### 执行步骤

#### 最简单的方式：一键部署

在本地项目根目录执行：

```bash
bash scripts/deploy-to-server.sh
```

脚本会自动：

1. ✅ 构建管理后台
2. ✅ 打包代码
3. ✅ 上传到服务器
4. ✅ npm install（更新依赖）
5. ✅ pm2 reload（零停机重启）
6. ✅ Nginx 重载（刷新静态文件）

该步骤通常需要 **3-5 分钟**。

#### 部署前验证

```bash
# 检查本地代码
git status
git log --oneline | head -3

# 构建测试
npm run build

# 提交到 Git
git add -A
git commit -m "feat: 功能描述"
git push
```

#### 部署后验证

```bash
# 检查后端状态
curl https://wx.shubai01.com/api/v1/health

# 检查管理后台
https://wx.shubai01.com/admin

# 查看日志
ssh ubuntu@118.25.145.179 "pm2 logs morning-reading-backend --lines 20"
```

### 部署失败的快速回滚

脚本会显示回滚命令，复制执行即可：

```bash
ssh ubuntu@118.25.145.179 \
  'rm -rf /var/www/morning-reading && \
   mv /var/www/morning-reading_bak_20260301_152600 /var/www/morning-reading && \
   cd /var/www/morning-reading/backend && \
   npm install --production && \
   pm2 reload morning-reading-backend'
```

---

## 第三章：服务管理

### 重启后端服务

#### 方式 1：远程 SSH 执行

```bash
# 在本地执行
ssh ubuntu@118.25.145.179 "pm2 restart morning-reading-backend"

# 验证状态
ssh ubuntu@118.25.145.179 "pm2 status"
```

#### 方式 2：SSH 登录后手动操作

```bash
ssh ubuntu@118.25.145.179

# 重启 PM2（零停机）
pm2 reload morning-reading-backend

# 或强制重启
pm2 restart morning-reading-backend

# 查看状态
pm2 status
pm2 logs morning-reading-backend --lines 20
```

### 重启管理后台

```bash
ssh ubuntu@118.25.145.179

# 验证 Nginx 配置
sudo nginx -t

# 重载 Nginx
sudo nginx -s reload

# 验证状态
sudo systemctl status nginx
```

### 查看服务状态

```bash
ssh ubuntu@118.25.145.179

# PM2 应用状态
pm2 status

# PM2 实时监控
pm2 monit

# PM2 日志
pm2 logs

# Nginx 状态
sudo systemctl status nginx

# 数据库状态
sudo systemctl status docker  # Docker 容器运行状态
```

### 回滚部署

#### 查看可用的备份

```bash
ssh ubuntu@118.25.145.179 "ls -lh /var/www/ | grep morning-reading"

# 输出示例：
# drwxr-xr-x  morning-reading
# drwxr-xr-x  morning-reading_bak_20260301_152600
# drwxr-xr-x  morning-reading_bak_20260228_102030
```

#### 执行回滚

```bash
BACKUP_TIMESTAMP="20260301_152600"

ssh ubuntu@118.25.145.179 \
  "rm -rf /var/www/morning-reading && \
   mv /var/www/morning-reading_bak_${BACKUP_TIMESTAMP} /var/www/morning-reading && \
   cd /var/www/morning-reading/backend && \
   npm install --production && \
   pm2 reload morning-reading-backend"
```

#### 验证回滚

```bash
# 检查状态
ssh ubuntu@118.25.145.179 "pm2 status"

# 测试 API
curl https://wx.shubai01.com/api/v1/health

# 查看日志
ssh ubuntu@118.25.145.179 "pm2 logs morning-reading-backend --lines 20"
```

---

## 第四章：密码配置与数据库管理

### 管理员密码

管理员密码由 `init-all.js` 脚本自动生成并设置，包含两种密码：

- **登录密码**：用于管理后台登录（在 .env.production 中配置）
- **数据库访问密码**：用于管理后台中的数据库管理功能（在 .env.production 中配置）

所有密码信息存储在 `.env.production` 文件中，请妥善保管。

### 密码信息（来自 .env.production）

| 用途                    | 密码                   |
| ----------------------- | ---------------------- |
| MongoDB 用户 admin      | p62CWhV0Kd1Unq         |
| MySQL 用户 morning_user | Morning@Prod@User0816! |
| Redis                   | Redis@Prod@User0816!   |

### 更新密码

如需更新密码：

1. **编辑 .env.production**：

   ```bash
   ssh ubuntu@118.25.145.179
   cd /var/www/morning-reading/backend
   nano .env.production
   # 修改所需密码
   ```

2. **重启后端服务**：
   ```bash
   pm2 restart morning-reading-backend
   ```

脚本会提示确认：

```
⚠️  确认开始部署？
  此操作将修改生产环境配置，请确保已有备份
请输入 'yes' 确认: yes
```

输入 `yes` 后，脚本自动执行：

1. ✅ 检查 MongoDB 连接
2. ✅ 备份 .env.production
3. ✅ 更新管理员密码：Km7$Px2Qw9
4. ✅ 更新数据库访问密码：Jb3#Rl8Tn5
5. ✅ 验证配置

### 验证密码

配置完成后，验证密码是否生效：

```bash
# 测试管理员登录
curl -X POST https://wx.shubai01.com/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@morningreading.com",
    "password": "Km7$Px2Qw9"
  }'

# 应该返回登录成功
# {"code":0,"message":"登录成功","data":{"token":"...",...}}
```

获得 token 后，验证数据库访问密码：

```bash
TOKEN="从上面复制"

curl -X POST https://wx.shubai01.com/api/v1/auth/admin/verify-db-access \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"password": "Jb3#Rl8Tn5"}'

# 应该返回验证成功
# {"code":0,"message":"验证成功","data":{"verified":true}}
```

### 灾难恢复（环境配置）

如果脚本失败，恢复备份：

```bash
ssh ubuntu@118.25.145.179

# 查看备份
ls -la /var/www/morning-reading/.backup/

# 恢复备份
cp /var/www/morning-reading/.backup/.env.production.backup.* \
   /var/www/morning-reading/backend/.env.production

# 重启服务
pm2 restart morning-reading-backend
```

### 数据库自动备份

系统通过 `backup.service.js` 中的 `node-cron` 定时任务自动执行备份，随后端服务启动。

#### 定时任务计划（北京时间）

| 时间 | 任务 | 说明 |
|------|------|------|
| 01:00 | MongoDB→MySQL 全量同步 | 将 MongoDB 数据同步到 MySQL（双重保障） |
| 02:00 | MongoDB 备份 | `docker exec mongodump`，gzip 压缩，存储到 `/var/backups/mongodb/` |
| 02:30 | MySQL 备份 | 通过连接池导出所有表为 JSON + schema SQL，存储到 `/var/backups/mysql/` |
| 03:00 | 清理过期备份 | 删除 30 天前的备份文件 |

#### 备份文件位置

```
/var/backups/
├── mongodb/
│   └── mongodb-backup-YYYY-MM-DD-TIMESTAMP/
│       ├── morning_reading/        # 各集合的 .bson.gz 文件
│       └── backup-meta.json        # 备份元数据
└── mysql/
    └── mysql-backup-YYYY-MM-DD-TIMESTAMP/
        ├── users.json              # 各表数据（JSON格式）
        ├── periods.json
        ├── sections.json
        ├── ...
        ├── _schema.sql             # 所有表的 CREATE TABLE 语句
        └── backup-meta.json        # 备份元数据
```

#### 检查备份状态

```bash
# 查看备份是否正常执行（检查 PM2 日志）
grep -iE "backup.*completed|backup.*failed" /var/www/logs/morning-reading-out.log | tail -10

# 查看备份文件
ls -lt /var/backups/mongodb/ | head -5
ls -lt /var/backups/mysql/ | head -5
```

### 数据库恢复（灾难恢复）

使用恢复脚本 `backend/scripts/restore-from-backup.js`。

#### 查看可用备份

```bash
cd /var/www/morning-reading/backend
node scripts/restore-from-backup.js --list
```

#### 恢复 MongoDB

```bash
node scripts/restore-from-backup.js --mongodb mongodb-backup-2026-03-15-1773555079127
```

执行后会显示备份详情并要求确认（输入 `y`），使用 `mongorestore --drop` 恢复，会先删除现有集合再导入。

#### 恢复 MySQL

```bash
node scripts/restore-from-backup.js --mysql mysql-backup-2026-03-15-1773555079400
```

通过连接池逐表清空并重新插入 JSON 数据。

#### 同时恢复 MongoDB + MySQL（推荐）

```bash
# 按日期自动查找并恢复当天最新的备份
node scripts/restore-from-backup.js --both 2026-03-15
```

#### 恢复注意事项

- 恢复前建议先手动执行一次备份（以防万一）
- 恢复操作会**覆盖**现有数据
- 每次恢复前都需要手动确认
- 恢复完成后重启后端服务：`pm2 restart morning-reading-backend`

---

## 第五章：故障排查

### 问题 1：后端 API 无法访问

#### 症状

```
curl: (7) Failed to connect
# 或
HTTP 503 Service Unavailable
```

#### 排查步骤

```bash
ssh ubuntu@118.25.145.179

# 1. 检查 PM2 进程
pm2 status
# 应该显示 morning-reading-backend: online

# 2. 如果显示 stopped，重启
pm2 restart morning-reading-backend

# 3. 查看详细日志
pm2 logs morning-reading-backend --lines 50

# 4. 检查端口占用
netstat -tlnp | grep 3000

# 5. 检查 Nginx 状态
sudo systemctl status nginx

# 6. 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

#### 常见原因和解决

| 原因           | 症状                                 | 解决                       |
| -------------- | ------------------------------------ | -------------------------- |
| 依赖缺失       | `Cannot find module`                 | `npm install --production` |
| 环境变量错误   | `MONGODB_URI undefined`              | 检查 .env.production       |
| 数据库连接失败 | `MongoError: connect ECONNREFUSED`   | 检查数据库容器             |
| 端口被占用     | `EADDRINUSE: address already in use` | `lsof -i :3000`            |

### 问题 2：数据库连接失败

#### MongoDB 连接失败

```bash
ssh ubuntu@118.25.145.179

# 检查容器状态
docker ps | grep mongodb

# 查看容器日志
docker logs morning-reading-mongodb-prod

# 重启容器
docker restart morning-reading-mongodb-prod

# 测试连接
mongosh -u admin -p p62CWhV0Kd1Unq --eval "db.runCommand({ping:1})"
```

#### MySQL 连接失败

```bash
# 检查容器状态
docker ps | grep mysql

# 查看容器日志
docker logs morning-reading-mysql-prod

# 重启容器
docker restart morning-reading-mysql-prod

# 测试连接
docker exec morning-reading-mysql-prod mysql -u morning_user \
  -pMorning@Prod@User0816! -e "SELECT 1"
```

#### Redis 连接失败

```bash
# 检查容器状态
docker ps | grep redis

# 重启容器
docker restart morning-reading-redis-prod

# 测试连接
redis-cli -a Redis@Prod@User0816! ping
```

### 问题 3：管理后台页面空白

#### 排查步骤

```bash
# 1. 检查静态文件是否存在
ssh ubuntu@118.25.145.179 \
  "ls -la /var/www/morning-reading/admin/dist/index.html"

# 2. 如果文件不存在或为空，重新部署
bash scripts/deploy-to-server.sh

# 3. 检查 Nginx 配置
ssh ubuntu@118.25.145.179 "sudo nginx -t"

# 4. 浏览器按 F12 查看控制台错误信息
```

### 问题 4：部署脚本失败

#### SSH 连接超时

```bash
# 检查网络
ping 118.25.145.179

# 检查 SSH 密钥权限
ls -la ~/.ssh/id_rsa
# 应该是 -rw------- (600)

# 测试 SSH
ssh -v ubuntu@118.25.145.179
```

#### npm install 失败

```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading/backend

# 清除缓存
npm cache clean --force

# 强制安装
npm install --legacy-peer-deps --production

# 重启 PM2
pm2 restart morning-reading-backend
```

---

## 第六章：架构参考

### 服务器目录结构

```
/var/www/
├── morning-reading/                    # 项目根目录
│   ├── backend/                        # Node.js 后端
│   │   ├── src/
│   │   │   ├── models/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── middleware/
│   │   ├── scripts/
│   │   │   ├── init-all.js             # 全量初始化
│   │   │   ├── init-mysql.js           # MySQL 初始化
│   │   │   ├── init-superadmin.js      # 管理员初始化
│   │   │   └── init-production.js
│   │   ├── .env.production             # 生产环境变量
│   │   └── package.json
│   ├── admin/                          # Vue 3 管理后台
│   │   └── dist/                       # 构建产物
│   ├── miniprogram/                    # 小程序代码
│   ├── scripts/
│   │   ├── deploy-to-server.sh         # 部署脚本（本地执行）
│   │   ├── setup-prod-server.sh        # 初始化脚本（服务器执行）
│   │   └── server/
│   │       ├── setup-server-env.sh     # 环境安装
│   │       ├── restart-backend.sh
│   │       └── restart-admin.sh
│   ├── docker-compose.yml              # Docker 编排
│   └── .backup/                        # 备份目录
└── morning-reading_bak_20260301_*     # 自动备份
```

### 部署脚本说明

| 脚本                                 | 执行位置 | 用途                                                    | 何时执行             |
| ------------------------------------ | -------- | ------------------------------------------------------- | -------------------- |
| `scripts/server/setup-server-env.sh` | 服务器   | 安装 Node.js、PM2、Nginx、Docker、MongoDB、MySQL、Redis | 首次初始化（一次性） |
| `scripts/deploy-to-server.sh`        | 本地 Mac | 构建、打包、上传代码                                    | 首次部署 + 日常更新  |
| `scripts/setup-prod-server.sh`       | 服务器   | 启动 Docker、初始化 MySQL、启动 PM2                     | 首次部署后           |
| `backend/scripts/init-all.js`        | 服务器   | 创建管理员、初始化 MongoDB、初始化数据                  | 首次部署后           |

### Docker 容器配置

```bash
# 查看运行中的容器
docker ps | grep morning-reading

# 容器列表：
# morning-reading-mongodb-prod  MongoDB 7.0
# morning-reading-mysql-prod    MySQL 8.0
# morning-reading-redis-prod    Redis 7.0
```

### 数据库连接字符串

```javascript
// MongoDB
mongodb://admin:p62CWhV0Kd1Unq@127.0.0.1:27017/morning_reading

// MySQL
mysql://morning_user:Morning@Prod@User0816!@127.0.0.1:3306/morning_reading

// Redis
redis://:Redis@Prod@User0816!@127.0.0.1:6379
```

---

## 第七章：常用命令速查

### SSH 相关

```bash
# 连接服务器
ssh ubuntu@118.25.145.179

# 远程执行单个命令
ssh ubuntu@118.25.145.179 "pm2 status"

# 传输文件
scp -r local_path ubuntu@118.25.145.179:/remote/path
```

### PM2 相关

```bash
# 查看应用列表
pm2 list

# 查看应用状态
pm2 status

# 重启应用
pm2 restart morning-reading-backend

# 重载应用（零停机）
pm2 reload morning-reading-backend

# 查看日志
pm2 logs morning-reading-backend

# 实时监控
pm2 monit
```

### Docker 相关

```bash
# 查看容器
docker ps | grep morning-reading

# 查看容器日志
docker logs morning-reading-mongodb-prod

# 重启容器
docker restart morning-reading-mongodb-prod

# 进入容器
docker exec -it morning-reading-mongodb-prod mongosh
```

### 系统相关

```bash
# 检查系统资源
top
free -h
df -h

# 查看端口占用
netstat -tlnp | grep 3000

# 查看系统日志
sudo journalctl -u docker -n 50
```

---

## 总结

### 三种部署场景

| 场景            | 第一步（本地）        | 第二步（服务器）       | 第三步               | 总耗时   |
| --------------- | --------------------- | ---------------------- | -------------------- | -------- |
| 🆕 **全新部署** | `deploy-to-server.sh` | `setup-prod-server.sh` | `init-all.js` + 重启 | 5-10分钟 |
| 📝 **日常更新** | `deploy-to-server.sh` | 无需操作               | 无需操作             | 3-5分钟  |
| 🔧 **仅重启**   | 无需操作              | `pm2 restart`          | 无需操作             | < 1分钟  |

### 核心原则

1. **本地做的工作**：打包、构建、上传
2. **服务器做的工作**：初始化、启动、运行
3. **数据初始化**：统一用 init-all.js
4. **最后重启**：确保所有配置生效

### 安全提示

- ⚠️ **不要在 Git 中提交 .env.production**
- ⚠️ **定期备份数据库**
- ⚠️ **监控日志发现异常**
- ⚠️ **使用 SSH 密钥认证而不是密码**
- ⚠️ **限制管理员账户访问**

---

**文档版本**: 3.3
**最后更新**: 2026-03-03 (SSL 证书 + 过期通知配置完成)
**维护者**: Claude Code
**项目仓库**: https://github.com/flylion816/Morning_Reading_Club
