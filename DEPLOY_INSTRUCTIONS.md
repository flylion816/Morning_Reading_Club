# 晨读营 - 完整部署指南

**最后更新**: 2026-03-02
**版本**: 2.0
**状态**: ✅ 生产就绪

---

## ⚡ 速查表（< 2 分钟找到答案）

### 场景速查

| 你需要做什么          | 查看章节 | 快速命令                                                           |
| --------------------- | -------- | ------------------------------------------------------------------ |
| 🆕 全新服务器初始化   | 第一章   | `bash scripts/server/setup-server-env.sh`                          |
| 🚀 首次部署代码       | 第二章   | `bash scripts/deploy-to-server.sh` 然后密码配置                    |
| 📝 日常代码更新       | 第三章   | `bash scripts/deploy-to-server.sh`                                 |
| 🔧 重启后端服务       | 第四章   | `ssh ... "bash /var/www/morning-reading/restart-backend.sh"`       |
| 🔄 重启管理后台       | 第四章   | `ssh ... "bash /var/www/morning-reading/restart-admin.sh"`         |
| 🔐 配置数据库访问密码 | 第五章   | `cd /var/www/morning-reading && bash deploy-db-access-password.sh` |
| 🔙 回滚部署           | 第四章   | 见回滚命令                                                         |

### 密码速查表

| 服务               | 用户                     | 密码                   |
| ------------------ | ------------------------ | ---------------------- |
| **MongoDB**        | admin                    | p62CWhV0Kd1Unq         |
| **MySQL root**     | root                     | Root@Prod@User0816!    |
| **MySQL app**      | morning_user             | Morning@Prod@User0816! |
| **Redis**          | —                        | Redis@Prod@User0816!   |
| **管理员登录**     | admin@morningreading.com | Km7$Px2Qw9             |
| **数据库访问密码** | —                        | Jb3#Rl8Tn5             |

### 服务器信息

| 项目      | 值                                             |
| --------- | ---------------------------------------------- |
| 服务器 IP | 118.25.145.179                                 |
| 登录用户  | ubuntu                                         |
| SSH Key   | ~/.ssh/id_rsa                                  |
| 后端路径  | /var/www/morning-reading/backend               |
| 前端路径  | /var/www/morning-reading/admin/dist            |
| PM2 应用  | morning-reading-backend 或 morning-reading-api |
| OS        | Ubuntu 24.04.3 LTS (x86_64)                    |

---

## 第一章：全新服务器初始化

### 何时使用

**仅在以下情况使用**：

- ✅ 全新服务器首次配置
- ✅ 服务器需要重置环境
- ✅ 需要重新安装所有依赖（Node.js、PM2、Nginx、数据库）

**不要在以下情况使用**：

- ❌ 更新代码（用 `scripts/deploy-to-server.sh`）
- ❌ 仅重启服务（用 `scripts/server/restart-backend.sh`）
- ❌ 仅配置密码（用 `scripts/deploy-db-access-password.sh`）

### 前置条件

确保以下条件满足：

1. ✅ 有服务器的 SSH 访问权限
2. ✅ SSH 密钥已配置：`~/.ssh/id_rsa`
3. ✅ 服务器运行 Ubuntu 24.04 LTS
4. ✅ 互联网连接稳定（需要下载包）

### 执行步骤

#### 步骤 1：SSH 到服务器

```bash
ssh ubuntu@118.25.145.179
```

#### 步骤 2：下载或上传脚本

**方式 A：从 Git 克隆（推荐）**

```bash
# 克隆项目
cd /tmp
git clone https://github.com/flylion816/Morning_Reading_Club.git
cd Morning_Reading_Club

# 执行安装脚本
bash scripts/server/setup-server-env.sh
```

**方式 B：从本地上传脚本**

```bash
# 在本地 Mac 上执行
scp -i ~/.ssh/id_rsa scripts/server/setup-server-env.sh ubuntu@118.25.145.179:/tmp/

# SSH 到服务器
ssh ubuntu@118.25.145.179

# 在服务器上执行
bash /tmp/setup-server-env.sh
```

#### 步骤 3：等待安装完成

脚本会自动执行以下步骤：

```
✓ 更新 apt 包列表
✓ 安装 Node.js 20 LTS
✓ 安装 PM2
✓ 安装 Nginx
✓ 安装 MongoDB 7.0 + 配置认证
✓ 安装 MySQL 8 + 初始化数据库
✓ 安装 Redis 7 + 配置密码
✓ 验证所有服务
```

整个过程通常需要 5-10 分钟。

#### 步骤 4：查看完成报告

脚本完成后会显示：

```
服务器环境已完全准备就绪！

关键信息：
  • MongoDB:  mongodb://admin:***@127.0.0.1:27017/admin
  • MySQL:    morning_user@127.0.0.1:3306/morning_reading
  • Redis:    127.0.0.1:6379

下一步：
  1. 返回本地，执行部署脚本：bash scripts/deploy-to-server.sh
  2. SSH 到服务器验证安装
```

### 验证安装

返回本地，验证安装是否成功：

```bash
# 检查 Node.js
ssh ubuntu@118.25.145.179 "node --version"
# 期望: v20.x.x

# 检查 PM2
ssh ubuntu@118.25.145.179 "pm2 --version"
# 期望: 5.x.x

# 检查 MongoDB
ssh ubuntu@118.25.145.179 "mongosh -u admin -p p62CWhV0Kd1Unq --eval 'db.runCommand({ping:1})'"
# 期望: { ok: 1 }

# 检查 MySQL
ssh ubuntu@118.25.145.179 "mysql -u morning_user -pMorning@Prod@User0816! -e 'SELECT 1'"
# 期望: 1

# 检查 Redis
ssh ubuntu@118.25.145.179 "redis-cli -a Redis@Prod@User0816! ping"
# 期望: PONG
```

### 脚本工作原理

脚本按以下顺序执行：

1. **更新系统** (< 1 分钟)
   - 更新 apt 包列表

2. **安装开发工具** (3-5 分钟)
   - Node.js 20 LTS
   - PM2（进程管理器）
   - Nginx（反向代理）

3. **安装数据库** (5-10 分钟)
   - MongoDB 7.0 + 管理员认证
   - MySQL 8 + 初始化数据库和用户
   - Redis 7 + 密码保护

4. **验证服务** (< 1 分钟)
   - 连接测试所有数据库
   - 显示最终报告

### 故障排查

#### 问题：权限拒绝

```
[✗] 权限拒绝，无法运行 apt-get
```

**解决**：确保使用正确的 sudo 权限

```bash
# 脚本会自动要求输入 sudo 密码
# 如果失败，检查用户是否在 sudoers 中
sudo usermod -aG sudo $USER
```

#### 问题：包下载失败

```
[✗] apt-get update 失败
```

**解决**：检查网络连接和镜像源

```bash
# 检查网络
ping 8.8.8.8

# 重试脚本
bash setup-server-env.sh
```

#### 问题：MongoDB/MySQL/Redis 启动失败

```
[✗] MongoDB 连接失败
```

**解决**：检查服务状态并手动重启

```bash
# 检查 MongoDB 状态
sudo systemctl status mongod

# 重启 MongoDB
sudo systemctl restart mongod

# 查看日志
sudo journalctl -u mongod -n 50
```

---

## 第二章：首次部署代码

### 前置条件

确保完成了第一章的服务器初始化：

- ✅ Node.js、PM2、Nginx 已安装
- ✅ MongoDB、MySQL、Redis 已就绪
- ✅ SSH 可正常连接
- ✅ 本地项目代码已准备

### 执行步骤

#### 步骤 1：在本地执行部署脚本

```bash
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营

bash scripts/deploy-to-server.sh
```

脚本会：

1. ✅ 检查本地依赖（npm、tar、sshpass）
2. ✅ 构建管理后台（npm run build）
3. ✅ 备份服务器上的代码
4. ✅ 打包本地代码
5. ✅ 上传到服务器
6. ✅ 部署并重启服务

#### 步骤 2：初始化 MySQL 表结构

SSH 到服务器，手动初始化 MySQL：

```bash
ssh ubuntu@118.25.145.179

cd /var/www/morning-reading/backend
NODE_ENV=production node scripts/init-mysql.js
```

**期望输出**：

```
✅ MySQL 表结构初始化成功
```

#### 步骤 3：配置数据库访问密码

回到本地项目目录：

```bash
cd /var/www/morning-reading

bash deploy-db-access-password.sh
```

**脚本会执行**：

- ✅ 检查 MongoDB 连接
- ✅ 备份 .env.production
- ✅ 更新管理员密码：Km7$Px2Qw9
- ✅ 更新数据库访问密码：Jb3#Rl8Tn5
- ✅ 验证配置

#### 步骤 4：重启后端服务

```bash
ssh ubuntu@118.25.145.179

pm2 restart morning-reading-backend
# 或
pm2 restart morning-reading-api
```

#### 步骤 5：验证部署

检查后端是否正常运行：

```bash
# 检查 PM2 状态
ssh ubuntu@118.25.145.179 "pm2 status"

# 测试 API
curl https://wx.shubai01.com/api/v1/health

# 应该返回: {"code":0,"message":"健康检查通过",...}
```

测试管理员登录：

```bash
curl -X POST https://wx.shubai01.com/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@morningreading.com",
    "password": "Km7$Px2Qw9"
  }'

# 期望返回: {"code":0,"message":"登录成功",...}
```

### 部署前检查清单

- [ ] 所有测试在本地通过
- [ ] 代码已提交到 Git（commit 和 push）
- [ ] 已备份数据库
- [ ] 已备份 .env.production 文件
- [ ] 已通知团队成员部署时间

### 部署后检查清单

- [ ] 后端 API 可访问
- [ ] 管理员可以登录
- [ ] 数据库访问密码可用
- [ ] 管理后台页面可正常加载
- [ ] 主要功能已测试（打卡、查询等）
- [ ] 日志中无严重错误

---

## 第三章：日常代码更新

### 什么时候使用

- ✅ 需要更新后端代码
- ✅ 需要更新管理后台页面
- ✅ 需要更新前端小程序
- ✅ 需要更新 npm 依赖

### 执行步骤

#### 最简单的方式：一键部署

```bash
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营

bash scripts/deploy-to-server.sh
```

脚本会自动：

1. ✅ 检查依赖
2. ✅ 构建管理后台
3. ✅ 备份现有代码（用于回滚）
4. ✅ 打包新代码
5. ✅ 上传到服务器
6. ✅ npm install（更新依赖）
7. ✅ pm2 reload（零停机重启）
8. ✅ Nginx 重载（刷新静态文件）
9. ✅ 验证部署成功

整个过程通常需要 3-5 分钟。

#### 部署前验证

```bash
# 1. 检查本地代码
git status
git log --oneline | head -3

# 2. 本地构建测试
npm run build

# 3. 全部提交到 Git
git add -A
git commit -m "feat: 功能描述"
git push
```

#### 部署后验证

```bash
# 1. 检查后端状态
curl https://wx.shubai01.com/api/v1/health

# 2. 检查管理后台
https://wx.shubai01.com/admin

# 3. 查看日志
ssh ubuntu@118.25.145.179 "pm2 logs morning-reading-api --lines 20"
```

### 部署失败时

脚本显示的回滚命令示例：

```bash
sshpass -p 'PASSWORD' ssh ubuntu@118.25.145.179 \
  'rm -rf /var/www/morning-reading && \
   mv /var/www/morning-reading_bak_20260301_152600 /var/www/morning-reading'
```

直接复制执行即可。

---

## 第四章：服务管理

### 重启后端 PM2 服务

#### 方式 1：远程执行（推荐）

```bash
ssh ubuntu@118.25.145.179 \
  "bash /var/www/morning-reading/scripts/server/restart-backend.sh"
```

或者使用 PM2 命令：

```bash
ssh ubuntu@118.25.145.179 "pm2 restart morning-reading-api"
```

#### 方式 2：SSH 手动操作

```bash
ssh ubuntu@118.25.145.179

# 进入后端目录
cd /var/www/morning-reading/backend

# 更新依赖
npm install --production

# 重载 PM2（零停机）
pm2 reload morning-reading-api

# 验证状态
pm2 status
pm2 logs morning-reading-api --lines 10
```

### 重启管理后台（Nginx）

#### 远程执行

```bash
ssh ubuntu@118.25.145.179 \
  "bash /var/www/morning-reading/scripts/server/restart-admin.sh"
```

或手动操作：

```bash
ssh ubuntu@118.25.145.179

# 验证配置
sudo nginx -t

# 重载 Nginx
sudo nginx -s reload

# 验证状态
sudo systemctl status nginx
```

### 查看服务状态

```bash
# PM2 应用状态
ssh ubuntu@118.25.145.179 "pm2 status"

# PM2 实时监控
ssh ubuntu@118.25.145.179 "pm2 monit"

# PM2 日志
ssh ubuntu@118.25.145.179 "pm2 logs"

# Nginx 状态
ssh ubuntu@118.25.145.179 "sudo systemctl status nginx"

# 数据库状态
ssh ubuntu@118.25.145.179 "sudo systemctl status mongod"
ssh ubuntu@118.25.145.179 "sudo systemctl status mysql"
ssh ubuntu@118.25.145.179 "sudo systemctl status redis-server"
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

从上面找到要恢复的备份时间戳，然后执行：

```bash
BACKUP_TIMESTAMP="20260301_152600"

ssh ubuntu@118.25.145.179 \
  "rm -rf /var/www/morning-reading && \
   mv /var/www/morning-reading_bak_${BACKUP_TIMESTAMP} /var/www/morning-reading && \
   cd /var/www/morning-reading/backend && \
   npm install --production && \
   pm2 reload morning-reading-api"
```

#### 验证回滚

```bash
# 检查 PM2 状态
ssh ubuntu@118.25.145.179 "pm2 status"

# 测试 API
curl https://wx.shubai01.com/api/v1/health

# 查看日志
ssh ubuntu@118.25.145.179 "pm2 logs morning-reading-api --lines 20"
```

---

## 第五章：密码配置（deploy-db-access-password.sh）

### 何时执行

- ✅ 首次部署后（必须执行）
- ✅ 需要重置管理员密码
- ✅ 需要更新数据库访问密码
- ✅ 需要重新配置其他数据库密码

### 执行步骤

#### 步骤 1：SSH 到服务器

```bash
ssh ubuntu@118.25.145.179

cd /var/www/morning-reading
```

#### 步骤 2：运行脚本

```bash
# 赋予执行权限（如果需要）
chmod +x deploy-db-access-password.sh

# 执行脚本
./deploy-db-access-password.sh
```

#### 步骤 3：确认开始

脚本会提示：

```
⚠️  确认开始部署？
  此操作将修改生产环境配置，请确保已有备份
请输入 'yes' 确认: yes
```

输入 `yes` 后，脚本自动执行：

1. ✅ 检查 MongoDB 连接
2. ✅ 备份 .env.production（保存到 .backup/）
3. ✅ 更新环境变量：
   - ADMIN_DEFAULT_PASSWORD = Km7$Px2Qw9
   - ADMIN_DB_ACCESS_PASSWORD = Jb3#Rl8Tn5
   - MYSQL_PASSWORD = Prod_User@Secure123!
   - REDIS_PASSWORD = Prod_Redis@Secure123!
4. ✅ 更新 MongoDB 中的管理员记录
5. ✅ 验证配置

### 脚本执行示例

```
════════════════════════════════════════════════════════
  晨读营线上部署 - 数据库访问密码安全更新
════════════════════════════════════════════════════════

ℹ️  脚本将执行以下操作：
  1. 检查 MongoDB 连接
  2. 备份 .env.production 配置文件
  3. 更新 .env.production 新增环境变量
  4. 验证配置文件格式
  5. 执行管理员密码重置脚本
  6. 验证部署结果

✅ Node.js 已安装
✅ MongoDB 连接成功

ℹ️  检查先决条件...
⚠️  确认开始部署？请输入 'yes' 确认: yes

✅ 备份文件: /var/www/morning-reading/.backup/.env.production.backup.20260301

✅ .env.production 配置已更新
✅ .env.production 格式验证通过
✅ 密码更新成功！

📋 管理员信息：
   邮箱: admin@morningreading.com
   新登录密码: Km7$Px2Qw9
   新数据库访问密码: Jb3#Rl8Tn5

✅ 部署完成！
════════════════════════════════════════════════════════
```

### 验证配置

配置完成后，验证密码是否生效：

```bash
# 验证管理员登录
curl -X POST https://wx.shubai01.com/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@morningreading.com",
    "password": "Km7$Px2Qw9"
  }'

# 应该返回登录成功和 token
# {"code":0,"message":"登录成功","data":{"token":"...","admin":{...}}}
```

获得 token 后，验证数据库访问密码：

```bash
TOKEN="从上面的响应中复制"

curl -X POST https://wx.shubai01.com/api/v1/auth/admin/verify-db-access \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"password": "Jb3#Rl8Tn5"}'

# 应该返回验证成功
# {"code":0,"message":"验证成功","data":{"verified":true}}
```

在管理后台验证：

1. 打开：https://wx.shubai01.com/admin
2. 登录：admin@morningreading.com / Km7$Px2Qw9
3. 点击：左侧菜单 "🗄️ 数据库管理"
4. 输入密码：Jb3#Rl8Tn5
5. 应该显示：数据库管理页面

### 灾难恢复

如果脚本失败，恢复备份：

```bash
# 查看备份
ls -la /var/www/morning-reading/.backup/

# 恢复备份
cp /var/www/morning-reading/.backup/.env.production.backup.* \
   /var/www/morning-reading/backend/.env.production

# 重启服务
pm2 restart morning-reading-api
```

---

## 第六章：架构参考

### 服务器目录结构

```
/var/www/
├── morning-reading/                    # 项目根目录
│   ├── backend/                        # Node.js 后端
│   │   ├── src/
│   │   │   ├── models/                 # MongoDB 模型
│   │   │   ├── controllers/            # 业务逻辑
│   │   │   ├── routes/                 # API 路由
│   │   │   ├── middleware/             # 中间件
│   │   │   └── utils/                  # 工具函数
│   │   ├── scripts/
│   │   │   ├── init-mysql.js           # MySQL 初始化
│   │   │   ├── init-superadmin.js      # 管理员初始化
│   │   │   └── reset-admin-password.js # 密码重置
│   │   ├── .env.production             # 生产环境变量
│   │   ├── package.json
│   │   └── pm2.config.js               # PM2 配置
│   ├── admin/                          # Vue 3 管理后台
│   │   ├── src/
│   │   ├── dist/                       # 构建产物（由 Nginx 提供）
│   │   └── package.json
│   ├── miniprogram/                    # 小程序代码
│   ├── scripts/
│   │   ├── deploy-to-server.sh         # 部署脚本
│   │   ├── deploy-db-access-password.sh # 密码配置脚本
│   │   └── server/
│   │       ├── setup-server-env.sh     # 环境安装脚本
│   │       ├── restart-backend.sh      # 后端重启脚本
│   │       └── restart-admin.sh        # 前端重启脚本
│   └── docker-compose.yml              # Docker 编排配置
├── morning-reading_bak_20260301_*     # 备份目录
└── ...
```

### 服务端口配置

| 服务           | 端口   | 说明       |
| -------------- | ------ | ---------- |
| Node.js 后端   | 3000   | 本地监听   |
| Nginx 反向代理 | 80/443 | 暴露给外网 |
| MongoDB        | 27017  | 本地数据库 |
| MySQL          | 3306   | 本地数据库 |
| Redis          | 6379   | 本地缓存   |

### Nginx 反向代理配置

Nginx 配置文件位置：`/etc/nginx/sites-enabled/morning-reading`

关键配置：

- ✅ 反向代理 Node.js 3000 端口
- ✅ SSL/TLS 加密（HTTPS）
- ✅ 静态文件缓存
- ✅ 安全头设置
- ✅ 日志记录

### PM2 进程管理

PM2 配置文件位置：`/var/www/morning-reading/backend/pm2.config.js`

关键配置：

- ✅ 集群模式（max 实例）
- ✅ 自动重启
- ✅ 内存限制（1GB）
- ✅ 日志文件轮换
- ✅ 优雅关闭（10 秒超时）

### 数据库连接

```javascript
// MongoDB
mongodb://admin:p62CWhV0Kd1Unq@127.0.0.1:27017/morning_reading

// MySQL
mysql://morning_user:Morning@Prod@User0816!@127.0.0.1:3306/morning_reading

// Redis
redis://:Redis@Prod@User0816!@127.0.0.1:6379
```

### 数据库备份

创建 MongoDB 备份：

```bash
ssh ubuntu@118.25.145.179

# 备份 MongoDB
mongodump --uri "mongodb://admin:p62CWhV0Kd1Unq@127.0.0.1:27017/morning_reading" \
          --out /var/backups/mongodb/backup_$(date +%Y%m%d_%H%M%S)

# 备份 MySQL
mysqldump -u morning_user -pMorning@Prod@User0816! morning_reading \
          > /var/backups/mysql/backup_$(date +%Y%m%d_%H%M%S).sql
```

恢复备份：

```bash
# 恢复 MongoDB
mongorestore --uri "mongodb://admin:p62CWhV0Kd1Unq@127.0.0.1:27017/" \
             /var/backups/mongodb/backup_TIMESTAMP

# 恢复 MySQL
mysql -u morning_user -pMorning@Prod@User0816! morning_reading \
      < /var/backups/mysql/backup_TIMESTAMP.sql
```

---

## 第七章：故障排查

### 问题 1：后端 API 无法访问

#### 症状

```
curl: (7) Failed to connect to wx.shubai01.com port 443
# 或
HTTP 503 Service Unavailable
```

#### 排查步骤

```bash
# 1. 检查 PM2 进程
ssh ubuntu@118.25.145.179 "pm2 status"
# 应该显示 morning-reading-api: online

# 2. 如果显示 stopped 或 errored，重启
ssh ubuntu@118.25.145.179 "pm2 restart morning-reading-api"

# 3. 查看详细日志
ssh ubuntu@118.25.145.179 "pm2 logs morning-reading-api --lines 50"

# 4. 检查端口占用
ssh ubuntu@118.25.145.179 "netstat -tlnp | grep 3000"

# 5. 检查 Nginx 状态
ssh ubuntu@118.25.145.179 "sudo systemctl status nginx"

# 6. 查看 Nginx 错误日志
ssh ubuntu@118.25.145.179 "sudo tail -f /var/log/nginx/error.log"
```

#### 常见原因和解决方案

| 原因           | 症状                                 | 解决                       |
| -------------- | ------------------------------------ | -------------------------- |
| 依赖缺失       | `Cannot find module`                 | `npm install --production` |
| 环境变量错误   | `MONGODB_URI undefined`              | 检查 .env.production       |
| 数据库连接失败 | `MongoError: connect ECONNREFUSED`   | 检查数据库是否运行         |
| 端口被占用     | `EADDRINUSE: address already in use` | `lsof -i :3000`            |
| 内存不足       | `killed: out of memory`              | 增加服务器内存或优化代码   |

### 问题 2：数据库连接失败

#### MongoDB 连接失败

```bash
# 检查 MongoDB 服务
ssh ubuntu@118.25.145.179 "sudo systemctl status mongod"

# 重启 MongoDB
ssh ubuntu@118.25.145.179 "sudo systemctl restart mongod"

# 测试连接
ssh ubuntu@118.25.145.179 \
  "mongosh -u admin -p p62CWhV0Kd1Unq --eval 'db.runCommand({ping:1})'"
```

#### MySQL 连接失败

```bash
# 检查 MySQL 服务
ssh ubuntu@118.25.145.179 "sudo systemctl status mysql"

# 重启 MySQL
ssh ubuntu@118.25.145.179 "sudo systemctl restart mysql"

# 测试连接
ssh ubuntu@118.25.145.179 \
  "mysql -u morning_user -pMorning@Prod@User0816! -e 'SELECT 1'"
```

#### Redis 连接失败

```bash
# 检查 Redis 服务
ssh ubuntu@118.25.145.179 "sudo systemctl status redis-server"

# 重启 Redis
ssh ubuntu@118.25.145.179 "sudo systemctl restart redis-server"

# 测试连接
ssh ubuntu@118.25.145.179 \
  "redis-cli -a Redis@Prod@User0816! ping"
```

### 问题 3：管理后台页面空白

#### 症状

浏览器访问 https://wx.shubai01.com/admin 显示空白页面

#### 排查步骤

```bash
# 1. 检查静态文件是否存在
ssh ubuntu@118.25.145.179 \
  "ls -la /var/www/morning-reading/admin/dist/index.html"

# 2. 如果文件不存在，需要重新部署
bash scripts/deploy-to-server.sh

# 3. 检查 Nginx 配置
ssh ubuntu@118.25.145.179 "sudo nginx -t"

# 4. 查看浏览器控制台错误
# F12 → Console 标签页

# 5. 检查网络请求
# F12 → Network 标签页
```

#### 常见原因

| 原因                  | 解决                               |
| --------------------- | ---------------------------------- |
| dist 目录不存在或为空 | `bash scripts/deploy-to-server.sh` |
| Nginx 配置错误        | `sudo nginx -t` 检查配置           |
| API 连接失败          | 检查 API 是否运行                  |
| 缓存问题              | `Ctrl + Shift + R` 硬刷新          |

### 问题 4：部署脚本失败

#### 错误：sshpass not found

```
sshpass: not found
```

**解决**（在 Mac 上）：

```bash
brew install hudochenkov/sshpass/sshpass
```

#### 错误：SSH 连接超时

```
ssh: connect to host 118.25.145.179 port 22: Operation timed out
```

**解决**：

```bash
# 检查网络连接
ping 118.25.145.179

# 检查 SSH 密钥权限
ls -la ~/.ssh/id_rsa
# 应该是 -rw------- (600)

# 手动测试 SSH
ssh -v ubuntu@118.25.145.179

# 可能需要更新 known_hosts
ssh-keyscan 118.25.145.179 >> ~/.ssh/known_hosts
```

#### 错误：npm install 失败

```
ERR! code ERESOLVE
ERR! ERESOLVE unable to resolve dependency tree
```

**解决**：

```bash
ssh ubuntu@118.25.145.179

cd /var/www/morning-reading/backend

# 强制安装
npm install --legacy-peer-deps --production

# 或者清除缓存后重试
npm cache clean --force
npm install --production
```

#### 错误：PM2 重启失败

```
[ERR] Restart failed: Cannot find app name
```

**解决**：

```bash
ssh ubuntu@118.25.145.179

# 查看已有的应用
pm2 list

# 检查应用名称（可能是 morning-reading-api 或 morning-reading-backend）
pm2 status

# 使用正确的名称重启
pm2 restart morning-reading-api
```

### 问题 5：数据丢失

#### 如何备份数据

```bash
# 自动每天备份
ssh ubuntu@118.25.145.179

# 手动备份 MongoDB
mkdir -p /var/backups/mongodb
mongodump --uri "mongodb://admin:p62CWhV0Kd1Unq@127.0.0.1:27017/morning_reading" \
          --out /var/backups/mongodb/backup_$(date +%Y%m%d_%H%M%S)

# 手动备份 MySQL
mkdir -p /var/backups/mysql
mysqldump -u morning_user -pMorning@Prod@User0816! morning_reading \
          > /var/backups/mysql/backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 如何恢复数据

```bash
# 恢复 MongoDB（选择备份目录）
mongorestore --uri "mongodb://admin:p62CWhV0Kd1Unq@127.0.0.1:27017/" \
             /var/backups/mongodb/backup_20260301_120000

# 恢复 MySQL（选择备份文件）
mysql -u morning_user -pMorning@Prod@User0816! morning_reading \
      < /var/backups/mysql/backup_20260301_120000.sql
```

---

## 附录：常见命令速查

### SSH 相关

```bash
# 连接服务器
ssh ubuntu@118.25.145.179

# 不输入密码直接连接（需要配置 SSH 密钥）
ssh -i ~/.ssh/id_rsa ubuntu@118.25.145.179

# 执行单个命令
ssh ubuntu@118.25.145.179 "pm2 status"

# 传输文件
scp -r local_path ubuntu@118.25.145.179:/remote/path
```

### PM2 相关

```bash
# 查看应用列表
pm2 list

# 查看应用详细状态
pm2 status

# 启动应用
pm2 start ecosystem.config.js

# 重启应用
pm2 restart morning-reading-api

# 重载应用（零停机）
pm2 reload morning-reading-api

# 停止应用
pm2 stop morning-reading-api

# 删除应用
pm2 delete morning-reading-api

# 查看日志
pm2 logs morning-reading-api

# 实时监控
pm2 monit
```

### 系统相关

```bash
# 查看系统资源使用
top

# 查看磁盘空间
df -h

# 查看内存使用
free -h

# 查看进程
ps aux | grep node

# 查看端口占用
netstat -tlnp | grep 3000

# 查看日志
tail -f /var/log/syslog
```

### 数据库相关

```bash
# MongoDB 客户端
mongosh -u admin -p p62CWhV0Kd1Unq

# MySQL 客户端
mysql -u morning_user -pMorning@Prod@User0816! morning_reading

# Redis 客户端
redis-cli -a Redis@Prod@User0816!
```

---

## 总结

### 三种主要的部署场景

| 场景           | 命令                                      | 何时使用   |
| -------------- | ----------------------------------------- | ---------- |
| **全新服务器** | `bash scripts/server/setup-server-env.sh` | 首次配置   |
| **代码更新**   | `bash scripts/deploy-to-server.sh`        | 日常部署   |
| **密码配置**   | `bash deploy-db-access-password.sh`       | 首次部署后 |

### 日常操作

1. **本地开发** → 提交到 Git → `bash scripts/deploy-to-server.sh` → 验证
2. **紧急修复** → 本地修改 → Git 提交 → 一键部署 → 验证
3. **性能优化** → 本地测试 → Git 提交 → 部署 → 监控日志

### 安全提示

- ⚠️ **不要在 Git 中提交 .env.production**
- ⚠️ **使用密钥认证而不是密码 SSH**
- ⚠️ **定期备份数据库**
- ⚠️ **监控日志发现异常**
- ⚠️ **限制管理员账户访问**

---

**文档版本**: 2.0
**最后更新**: 2026-03-02
**维护者**: Claude Code
**项目仓库**: https://github.com/flylion816/Morning_Reading_Club
