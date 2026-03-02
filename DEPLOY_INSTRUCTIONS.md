# 晨读营 - 完整部署指南

**最后更新**: 2026-03-02
**版本**: 3.0
**状态**: ✅ 生产就绪

---

## ⚡ 速查表（< 2 分钟找到答案）

### 快速命令速查

| 你需要做什么              | 快速命令                                                                                                                   | 时间     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| 🆕 **全新服务器首次部署** | `bash scripts/deploy-to-server.sh` → SSH → `bash scripts/setup-prod-server.sh` → `node backend/scripts/init-all.js` → 重启 | 5-10分钟 |
| 📝 **日常代码更新**       | `bash scripts/deploy-to-server.sh`                                                                                         | 3-5分钟  |
| 🔧 **重启后端服务**       | `pm2 restart morning-reading-backend`                                                                                      | < 1分钟  |
| 🔄 **重启管理后台**       | `sudo nginx -s reload`                                                                                                     | < 1分钟  |

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

## 第一章：全新服务器首次部署（4 步完整流程）

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

### 配置数据库访问密码

**仅在以下情况执行**：

- ✅ 首次部署后（推荐）
- ✅ 需要重置管理员密码
- ✅ 需要更新密码

### 执行步骤

SSH 到服务器：

```bash
ssh ubuntu@118.25.145.179

cd /var/www/morning-reading
```

运行密码配置脚本：

```bash
bash deploy-db-access-password.sh
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

### 灾难恢复

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
│   │   ├── deploy-db-access-password.sh
│   │   └── server/
│   │       ├── setup-server-env.sh     # 环境安装
│   │       ├── restart-backend.sh
│   │       └── restart-admin.sh
│   ├── docker-compose.yml              # Docker 编排
│   └── .backup/                        # 备份目录
└── morning-reading_bak_20260301_*     # 自动备份
```

### 部署脚本说明

| 脚本                                 | 执行位置 | 用途                    |
| ------------------------------------ | -------- | ----------------------- |
| `scripts/deploy-to-server.sh`        | 本地 Mac | 打包 & 上传代码         |
| `scripts/setup-prod-server.sh`       | 服务器   | 初始化数据库 & 启动服务 |
| `scripts/server/setup-server-env.sh` | 服务器   | 安装系统依赖（一次性）  |
| `backend/scripts/init-all.js`        | 服务器   | 初始化数据结构          |
| `deploy-db-access-password.sh`       | 服务器   | 配置密码                |

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

**文档版本**: 3.0
**最后更新**: 2026-03-02
**维护者**: Claude Code
**项目仓库**: https://github.com/flylion816/Morning_Reading_Club
