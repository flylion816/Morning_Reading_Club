# 生产服务器初始化快速指南

一键初始化生产服务器数据库和后端服务。

---

## 🚀 30 秒快速开始

```bash
# 在项目根目录执行
bash scripts/setup-prod-server.sh
```

脚本会：

1. ✅ 启动 Docker 数据库（MongoDB、MySQL、Redis）
2. ✅ 初始化 MySQL 表结构
3. ✅ 重启后端 PM2 服务
4. ✅ 创建超级管理员账户
5. ✅ 验证服务就绪

完成后显示操作报告和后续步骤。

---

## 📋 何时使用

| 场景                        | 使用此脚本？                      |
| --------------------------- | --------------------------------- |
| **首次部署服务器**          | ✅ 是                             |
| **服务器数据库容器停止**    | ✅ 是                             |
| **需要重新初始化 MySQL 表** | ✅ 是                             |
| **需要重建超级管理员账户**  | ✅ 是                             |
| **更新后端代码**            | ❌ 否（用 `deploy-to-server.sh`） |
| **更新管理后台**            | ❌ 否（用 `deploy-to-server.sh`） |
| **仅重启服务**              | ❌ 否（用 `restart-backend.sh`）  |

---

## 📝 前置条件

脚本执行前，确保：

- ✅ 后端代码已部署到服务器：`/var/www/morning-reading/backend`
- ✅ PM2 应用 `morning-reading-backend` 已存在
- ✅ SSH 密钥已配置：`~/.ssh/id_rsa`
- ✅ 服务器已安装 Docker 和 docker-compose
  ```bash
  # SSH 到服务器验证
  ssh ubuntu@118.25.145.179 "docker --version && docker-compose --version"
  ```

---

## 🎯 执行步骤

### 步骤 1：在本地项目根目录执行

```bash
cd "/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营"
bash scripts/setup-prod-server.sh
```

### 步骤 2：监控执行进度

脚本会输出彩色日志，显示每一步的进度：

```
[INFO] 检查依赖
[✓] ssh 已安装
[✓] scp 已安装
[✓] SSH 密钥存在

[INFO] 生成生产环境 env 文件
[✓] 生成完成: /tmp/.env.docker.prod-20260301_120000

[INFO] 上传文件到服务器
[✓] 服务器目录就绪
[✓] docker-compose.yml 上传完成
[✓] .env.docker 上传完成

[INFO] 在服务器上启动数据库
[✓] Docker 已安装
[✓] docker-compose 已安装
[✓] 容器启动完成
[INFO] 等待数据库服务健康...
[✓] MongoDB 已就绪
[✓] MySQL 已就绪
[✓] Redis 已就绪

[INFO] 初始化数据库
[✓] 数据库初始化成功

[INFO] 重启后端服务
[✓] 后端服务重启成功

[INFO] 初始化超级管理员
[✓] 超级管理员初始化成功

[INFO] 验证服务
[✓] 后端服务已就绪
```

### 步骤 3：查看完成报告

脚本完成后会显示：

```
═══════════════════════════════════════════════════════
初始化完成！ 🎉
═══════════════════════════════════════════════════════

[INFO] 关键信息：
  • 服务器 IP: 118.25.145.179
  • 后端路径: /var/www/morning-reading/backend
  • PM2 应用: morning-reading-backend

[INFO] 数据库服务：
  • MongoDB: mongodb://admin:***@127.0.0.1:27017/morning_reading
  • MySQL: morning_user@127.0.0.1:3306/morning_reading
  • Redis: 127.0.0.1:6379

[INFO] 验证命令：
  # 查看 Docker 容器
  ssh -i /Users/pica_1/.ssh/id_rsa ubuntu@118.25.145.179 'docker ps | grep morning-reading'

  # 查看 PM2 状态
  ssh -i /Users/pica_1/.ssh/id_rsa ubuntu@118.25.145.179 'pm2 status'

  # 查看后端日志
  ssh -i /Users/pica_1/.ssh/id_rsa ubuntu@118.25.145.179 'pm2 logs morning-reading-backend --lines 50'
```

### 步骤 4：验证初始化成功

```bash
# 查看 Docker 容器
ssh ubuntu@118.25.145.179 "docker ps | grep morning-reading"

# 输出示例：
# 7c9a8b7 morning-reading-mongodb-prod    mongo:6-alpine    "mongod..."        10 minutes ago    Up 9 minutes    127.0.0.1:27017->27017/tcp
# 8d0b9c8 morning-reading-mysql-prod      mysql:8.0-alpine  "docker-entrypoint..." 10 minutes ago    Up 9 minutes    127.0.0.1:3306->3306/tcp
# 9e1cAd9 morning-reading-redis-prod      redis:7-alpine    "redis-server..."   10 minutes ago    Up 9 minutes    127.0.0.1:6379->6379/tcp

# 查看 PM2 状态
ssh ubuntu@118.25.145.179 "pm2 status"

# 输出示例应该显示：
# morning-reading-backend    |  online
```

---

## 🔧 故障排查

### 问题 1: SSH 连接失败

```
[✗] 无法创建服务器目录
```

**原因**：SSH 密钥或服务器地址配置有误

**解决**：

```bash
# 检查 SSH 密钥权限
ls -la ~/.ssh/id_rsa
# 应该输出：-rw-------

# 测试 SSH 连接
ssh -i ~/.ssh/id_rsa ubuntu@118.25.145.179 "echo 'SSH 连接成功'"
```

### 问题 2: Docker 未安装

```
[✗] Docker 未安装，请先安装 Docker
```

**原因**：服务器上未安装 Docker

**解决**：SSH 到服务器并安装

```bash
ssh ubuntu@118.25.145.179

# 在服务器上执行：
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo usermod -aG docker $USER

# 验证
docker --version
docker-compose --version
```

### 问题 3: 等待数据库超时

```
[✗] 等待超时：数据库服务未在规定时间内就绪
```

**原因**：数据库容器启动失败

**解决**：

```bash
ssh ubuntu@118.25.145.179

# 查看容器日志
docker logs morning-reading-mongodb-prod
docker logs morning-reading-mysql-prod
docker logs morning-reading-redis-prod

# 如果有错误，重启容器
cd /var/www/morning-reading
docker-compose down
docker-compose up -d

# 重新运行初始化脚本
bash scripts/setup-prod-server.sh
```

### 问题 4: MySQL 初始化失败

```
[✗] MySQL 初始化失败
```

**原因**：MySQL 服务未就绪或权限问题

**解决**：

```bash
ssh ubuntu@118.25.145.179

# 检查 MySQL 容器状态
docker ps | grep mysql

# 手动验证 MySQL 连接
docker exec morning-reading-mysql-prod mysql -u morning_user \
  -p'Morning@Prod@User0816!' -e "SELECT 1"

# 手动运行初始化
cd /var/www/morning-reading/backend
NODE_ENV=production node scripts/init-mysql.js
```

### 问题 5: 后端服务未启动

```
[⚠] 后端服务重启可能失败
```

**原因**：PM2 应用不存在或配置有误

**解决**：

```bash
ssh ubuntu@118.25.145.179

# 查看 PM2 状态
pm2 status

# 手动启动应用
cd /var/www/morning-reading/backend
npm install
pm2 start pm2.config.js --env production

# 保存 PM2 配置
pm2 save
pm2 startup
```

### 问题 6: 超级管理员初始化失败

```
[⚠] 超级管理员初始化可能失败或已存在
```

**原因**：后端服务未就绪或超级管理员已存在

**解决**：

```bash
ssh ubuntu@118.25.145.179

# 检查后端是否运行
pm2 status

# 等待后端启动，然后手动初始化
cd /var/www/morning-reading/backend
NODE_ENV=production node scripts/init-superadmin.js

# 查看后端日志
pm2 logs morning-reading-backend --lines 100
```

---

## 🔐 安全说明

脚本采用多项安全措施：

| 措施             | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| **密码管理**     | 生产环境密码在本地临时生成，脚本完成后自动删除，不提交到 git |
| **数据保护**     | 不执行 `init-mongodb.js`，遵守数据保护规则，防止数据丢失     |
| **SSH 认证**     | 使用 SSH 密钥认证，不使用密码登录，安全性更高                |
| **临时文件清理** | 脚本通过 `trap cleanup EXIT` 确保临时文件被删除              |
| **环境隔离**     | 使用 SSH 远程执行，本地不修改 git 跟踪文件                   |

---

## 📚 相关文档

- 完整文档：[`DEPLOY_SCRIPTS.md`](./DEPLOY_SCRIPTS.md)
- 脚本源码：[`scripts/setup-prod-server.sh`](./scripts/setup-prod-server.sh)
- 部署脚本系统：[`DEPLOY_SCRIPTS.md`](./DEPLOY_SCRIPTS.md)

---

## 💡 常见场景

### 场景 1：首次部署生产服务器

```bash
# 1. 部署后端代码到服务器
bash scripts/deploy-to-server.sh

# 2. 初始化数据库和服务
bash scripts/setup-prod-server.sh

# 完成！服务已上线
```

### 场景 2：生产服务器重置（删除所有数据）

```bash
# 1. SSH 到服务器，停止并删除容器
ssh ubuntu@118.25.145.179
docker-compose -f /var/www/morning-reading/docker-compose.yml down -v

# 2. 回到本地，重新初始化
bash scripts/setup-prod-server.sh

# 数据已重置，新的空数据库已准备好
```

### 场景 3：后端代码更新

```bash
# 使用部署脚本（不使用初始化脚本）
bash scripts/deploy-to-server.sh
```

### 场景 4：仅重启后端服务

```bash
# 使用服务器脚本（远程执行）
ssh ubuntu@118.25.145.179 "bash /var/www/morning-reading/restart-backend.sh"
```

---

## ✅ 完成检查清单

初始化完成后，确认：

- [ ] Docker 容器全部运行（`docker ps | grep morning-reading`）
- [ ] PM2 应用状态为 online（`pm2 status`）
- [ ] 后端 API 可访问（`curl http://localhost:3000/api/v1/health`）
- [ ] 超级管理员账户已创建
- [ ] MySQL 表结构已初始化
- [ ] 可以正常登录管理后台

---

## 🆘 需要帮助？

如果遇到问题：

1. 查看脚本的彩色输出，找出失败的步骤
2. 查看本文的"故障排查"部分
3. 检查完整文档：[`DEPLOY_SCRIPTS.md`](./DEPLOY_SCRIPTS.md)
4. SSH 到服务器手动检查：
   ```bash
   docker ps              # 查看容器
   pm2 status            # 查看 PM2 应用
   pm2 logs             # 查看后端日志
   ```

---

**最后更新**：2026-03-01
**脚本位置**：`scripts/setup-prod-server.sh`
**文档位置**：`DEPLOY_SCRIPTS.md`
