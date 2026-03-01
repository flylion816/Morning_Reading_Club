# 部署脚本使用指南

本文档说明如何使用自动部署脚本快速将代码部署到线上服务器。

---

## 📋 快速概览

| 脚本                                | 执行位置 | 用途                       | 触发方式                           |
| ----------------------------------- | -------- | -------------------------- | ---------------------------------- |
| `scripts/deploy-to-server.sh`       | 本地 Mac | 一键部署（打包+上传+部署） | `bash scripts/deploy-to-server.sh` |
| `scripts/server/restart-backend.sh` | 服务器上 | 重启后端 PM2 服务          | SSH 远程执行                       |
| `scripts/server/restart-admin.sh`   | 服务器上 | Nginx 重载（更新静态文件） | SSH 远程执行                       |

---

## 🚀 一键部署（推荐）

### 什么时候使用

当你需要将**后端代码** + **管理后台** 同时部署到线上时：

- ✅ 后端功能更新
- ✅ 管理后台页面更新
- ✅ 数据库迁移完成，需要重启服务

### 执行步骤

#### 第 1 步：在本地项目根目录执行

```bash
bash scripts/deploy-to-server.sh
```

#### 第 2 步：等待部署完成

脚本会自动执行：

```
✓ 检查依赖 (sshpass, npm, tar)
✓ 构建管理后台 (npm run build)
✓ 在服务器上创建备份 (时间戳备份)
✓ 本地打包 (tar.gz)
✓ 上传到服务器 (scp)
✓ 服务器端解压和部署
✓ npm install (更新依赖)
✓ pm2 reload (重启服务)
✓ nginx reload (重载静态文件)
✓ 验证部署成功
```

#### 第 3 步：验证部署

脚本完成后会显示验证信息：

```
关键信息:
  • 后端 API: https://wx.shubai01.com/api/v1/health
  • 管理后台: https://wx.shubai01.com/admin
  • 服务器备份: /var/www/morning-reading_bak_20260301_152600
  • PM2 应用: morning-reading-api

回滚命令（如需要）:
  sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \
    'rm -rf /var/www/morning-reading && mv /var/www/morning-reading_bak_20260301_152600 /var/www/morning-reading'
```

手动验证：

```bash
# 1. 检查后端 API
curl https://wx.shubai01.com/api/v1/health

# 2. 浏览器访问管理后台
https://wx.shubai01.com/admin

# 3. SSH 进服务器查看状态
sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 "pm2 status"
```

---

## 🔧 单独重启服务（高级）

如果只想重启后端或管理后台（不上传新代码），可以单独执行服务器脚本。

### 重启后端 PM2 服务

#### 远程执行（推荐）

```bash
# 直接执行
sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \
  "bash /var/www/morning-reading/restart-backend.sh"

# 或者（如果脚本已在服务器上）
ssh ubuntu@118.25.145.179 "bash /var/www/morning-reading/restart-backend.sh"
```

#### 手动 SSH 进服务器执行

```bash
# 1. SSH 进服务器
ssh ubuntu@118.25.145.179

# 2. 执行重启脚本
bash /var/www/morning-reading/restart-backend.sh

# 3. 查看 PM2 状态
pm2 status

# 4. 查看日志
pm2 logs morning-reading-api --lines 20
```

### 重载管理后台（Nginx）

#### 远程执行

```bash
# 直接执行
sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \
  "bash /var/www/morning-reading/restart-admin.sh"
```

#### 手动 SSH 进服务器执行

```bash
# 1. SSH 进服务器
ssh ubuntu@118.25.145.179

# 2. 执行重载脚本
bash /var/www/morning-reading/restart-admin.sh

# 3. 浏览器访问管理后台验证
https://wx.shubai01.com/admin
```

---

## 🔄 回滚（如部署出现问题）

### 快速回滚（恢复最近的备份）

如果部署出现问题，脚本会在输出中显示回滚命令：

```bash
sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \
  'rm -rf /var/www/morning-reading && mv /var/www/morning-reading_bak_20260301_152600 /var/www/morning-reading'
```

直接复制执行即可。

### 查看可用的备份

```bash
# 列出所有备份
sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \
  "ls -lh /var/www/ | grep morning-reading"
```

输出示例：

```
drwxr-xr-x  morning-reading
drwxr-xr-x  morning-reading_bak_20260228_150000
drwxr-xr-x  morning-reading_bak_20260301_152600
```

### 恢复到指定备份

```bash
# 替换 20260301_152600 为需要的备份时间戳
BACKUP_TIMESTAMP="20260301_152600"

sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \
  "rm -rf /var/www/morning-reading && \
   mv /var/www/morning-reading_bak_${BACKUP_TIMESTAMP} /var/www/morning-reading && \
   cd /var/www/morning-reading/backend && \
   npm install --production && \
   pm2 reload morning-reading-api"
```

---

## 🔍 排查问题

### 部署脚本执行失败

#### 问题 1: `sshpass: not found`

**原因**：macOS 上未安装 sshpass

**解决**：

```bash
brew install hudochenkov/sshpass/sshpass
```

#### 问题 2: SSH 连接超时

**原因**：网络不稳定或服务器地址变化

**解决**：

1. 检查服务器 IP 是否正确（当前: 118.25.145.179）
2. 尝试手动 SSH 连接测试：
   ```bash
   ssh ubuntu@118.25.145.179
   ```

#### 问题 3: npm 权限错误

**原因**：服务器上 npm install 权限不足

**解决**：

1. SSH 进服务器
2. 手动执行：
   ```bash
   cd /var/www/morning-reading/backend
   npm install --production --no-optional
   ```

#### 问题 4: PM2 应用未启动

**原因**：后端启动失败

**解决**：

1. 检查日志：
   ```bash
   ssh ubuntu@118.25.145.179 "pm2 logs morning-reading-api --lines 50"
   ```
2. 检查 `.env.production` 配置是否正确：
   ```bash
   ssh ubuntu@118.25.145.179 "cat /var/www/morning-reading/backend/.env.production"
   ```

#### 问题 5: Nginx 重载失败

**原因**：Nginx 配置错误

**解决**：

```bash
# 1. SSH 进服务器
ssh ubuntu@118.25.145.179

# 2. 测试 Nginx 配置
sudo nginx -t

# 3. 查看错误信息
sudo systemctl status nginx

# 4. 重启 Nginx
sudo systemctl restart nginx
```

### 后端 API 无法访问

#### 测试 API 连接

```bash
# 1. 测试健康检查端点
curl https://wx.shubai01.com/api/v1/health

# 2. 检查 PM2 状态
sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 "pm2 status"

# 3. 查看最近日志
sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \
  "pm2 logs morning-reading-api --lines 20 --nostream"
```

### 管理后台无法加载

#### 测试静态文件

```bash
# 1. 检查文件是否存在
sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \
  "ls -lh /var/www/morning-reading/admin/dist/index.html"

# 2. 浏览器访问并查看源代码
https://wx.shubai01.com/admin

# 3. 检查浏览器控制台的网络请求
- 查看 index.html 的响应状态码（应该是 200）
- 查看 .js 和 .css 文件是否加载成功
```

---

## 📝 脚本详解

### deploy-to-server.sh 的完整工作流程

```
1️⃣ 检查依赖
   ├─ sshpass (用于免交互 SSH)
   ├─ npm (构建管理后台)
   ├─ tar (打包文件)
   ├─ ssh / scp (远程传输)
   └─ ✓ 所有依赖检查通过

2️⃣ 构建管理后台
   ├─ cd admin
   ├─ npm install --silent
   ├─ npm run build
   └─ ✓ dist 目录生成完成

3️⃣ 创建服务器备份
   ├─ SSH 到服务器
   ├─ cp -r /var/www/morning-reading → /var/www/morning-reading_bak_${TIMESTAMP}
   └─ ✓ 备份完成（可用于回滚）

4️⃣ 本地打包
   ├─ 创建临时目录
   ├─ 复制 backend/src, package.json, pm2.config.js
   ├─ 复制 admin/dist
   ├─ 复制 scripts/server/*.sh
   ├─ tar -czf morning-reading-deploy_${TIMESTAMP}.tar.gz
   └─ ✓ 打包完成

5️⃣ 上传到服务器
   ├─ scp 传输 tar.gz 到 /tmp/
   └─ ✓ 上传完成

6️⃣ 服务器端部署
   ├─ 解压 tar.gz
   ├─ 覆盖 backend/src, backend/package.json
   ├─ 覆盖 admin/dist
   ├─ npm install --production
   ├─ pm2 reload morning-reading-api
   ├─ sudo nginx -s reload
   └─ ✓ 部署完成

7️⃣ 清理
   ├─ 删除服务器上的临时文件
   ├─ 删除本地临时目录
   └─ ✓ 清理完成
```

### restart-backend.sh 的工作流程

```
1. 进入后端目录: /var/www/morning-reading/backend
2. npm install --production (更新依赖)
3. pm2 reload morning-reading-api (零停机重载)
4. 检查服务状态 (应该是 online)
5. 显示详细信息和最近日志
```

### restart-admin.sh 的工作流程

```
1. 验证管理后台目录存在
2. sudo nginx -t (测试配置)
3. sudo nginx -s reload (重载配置)
4. 验证 Nginx 状态
5. 显示管理后台文件信息
```

---

## 🔐 安全说明

### 密码管理

- 服务器密码存储在脚本中（**不推荐用于生产**）
- 建议改用 SSH 密钥认证（免密码）

### 改用 SSH 密钥认证（推荐）

```bash
# 1. 生成本地 SSH 密钥（如未生成）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa

# 2. 将公钥上传到服务器
ssh-copy-id -i ~/.ssh/id_rsa.pub ubuntu@118.25.145.179

# 3. 修改脚本：删除 sshpass，直接使用 ssh/scp
# 示例（修改前）：
sshpass -p "$SERVER_PASSWORD" ssh ubuntu@$SERVER_IP "..."

# 示例（修改后）：
ssh ubuntu@$SERVER_IP "..."
```

### 环境变量保护

脚本不覆盖服务器上的 `.env*` 文件，确保敏感信息（API密钥、数据库密码）不被泄露。

---

## 🎯 最佳实践

### 部署前检查清单

- [ ] 所有功能已在本地测试
- [ ] API 端点已用 curl 验证
- [ ] 管理后台已在开发工具中验证
- [ ] Git 代码已提交（可追溯部署版本）
- [ ] `.env.production` 配置正确（如有修改）

### 部署后验证清单

- [ ] 后端 API 可访问（`curl https://wx.shubai01.com/api/v1/health`）
- [ ] 管理后台可访问（浏览器访问 `https://wx.shubai01.com/admin`）
- [ ] PM2 服务状态正常（`pm2 status`）
- [ ] 关键功能已测试（登录、数据查询等）

### 生产部署建议

1. **关键时段避免部署**：避免在用户活跃期间部署
2. **备份当前版本**：脚本自动创建备份（保留 1-2 个最新版本）
3. **逐步灰度**：先验证后端，再验证管理后台
4. **监控日志**：部署后持续观察 `pm2 logs` 的错误信息

---

## 📞 常见问题

**Q: 部署失败后如何快速回滚？**

A: 脚本会显示回滚命令，直接复制执行即可。或手动使用 `morning-reading_bak_*` 备份目录恢复。

**Q: 可以自定义部署目录吗？**

A: 可以，修改脚本顶部的配置变量：

```bash
SERVER_BACKEND_PATH="/var/www/morning-reading/backend"
SERVER_ADMIN_PATH="/var/www/morning-reading/admin/dist"
```

**Q: 可以跳过管理后台构建吗？**

A: 可以，注释掉 `build_admin` 函数的调用。但仍然会打包并部署服务器上的 `admin/dist` 目录。

**Q: 脚本支持其他服务器吗？**

A: 可以，修改配置变量即可支持任意服务器：

```bash
SERVER_IP="your-server-ip"
SERVER_USER="your-username"
SERVER_PASSWORD="your-password"
```

---

## 📚 相关文档

- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发流程与规范
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南
- [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) - Git 工作流程

---

**最后更新**: 2026-03-01
**维护者**: Claude Code
**项目仓库**: https://github.com/flylion816/Morning_Reading_Club
