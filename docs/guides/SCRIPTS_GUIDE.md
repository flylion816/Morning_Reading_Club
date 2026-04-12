# 📚 脚本使用指南

> 项目中所有可用脚本的说明和使用方法

> 线上重启、PM2 自启动、DNS 故障处理请配合阅读 [PRODUCTION_OPERATIONS_RUNBOOK.md](./PRODUCTION_OPERATIONS_RUNBOOK.md)

## 🎯 快速开始

### 本地开发环境

```bash
# 一键启动所有本地服务（推荐）
bash start-all-local.sh

# 一键停止所有本地服务
bash stop-all-local.sh
```

---

## 📖 完整脚本列表

### 🟢 本地开发脚本

#### 1. `start-all-local.sh` ⭐ 推荐

**用途**：本地开发环境一键启动
**启动的服务**：
- 后端 API（Node.js）→ `http://localhost:3000`
- 管理后台（Vue3 + Vite）→ `http://localhost:5173`
- MongoDB（本地数据库）
- Redis（缓存服务）

**使用方式**：
```bash
bash start-all-local.sh
```

**日志查看**：
```bash
# 后端日志
tail -f /tmp/backend.log

# 管理后台日志
tail -f /tmp/admin.log
```

**注意事项**：
- 需要本地已安装 MongoDB 和 Redis
- Homebrew 安装：`brew install mongodb-community redis`

---

#### 2. `stop-all-local.sh` ⭐ 推荐

**用途**：本地开发环境一键停止
**停止的服务**：后端、管理后台、Redis

**使用方式**：
```bash
bash stop-all-local.sh
```

**注意事项**：
- 默认不停止 MongoDB（可手动停止：`brew services stop mongodb-community`）

---

### 🟡 生产部署脚本

#### 3. `scripts/deploy-to-server.sh`

**用途**：生产环境一键部署
**执行位置**：本地（自动上传到线上服务器）

**功能**：
- 检查依赖（npm、tar、ssh、scp）
- 构建管理后台（Vue3）
- 备份服务器上的旧代码
- 打包所有代码和构建文件
- 上传到生产服务器
- 服务器上执行部署（重启 PM2）

**使用方式**：
```bash
bash scripts/deploy-to-server.sh
```

**预期输出示例**：
```
✓ 依赖检查通过
✓ 构建管理后台完成
✓ 创建服务器备份
✓ 本地打包完成
✓ 上传到服务器
✓ 部署完成
```

**回滚方式**：脚本会在输出中显示回滚命令
```bash
sshpass -p 'PASSWORD' ssh ubuntu@118.25.145.179 'rm -rf /var/www/morning-reading && mv /var/www/morning-reading_bak_TIMESTAMP /var/www/morning-reading'
```

---

#### 4. `scripts/verify-deployment.sh` ⭐ 推荐

**用途**：生产环境完整验收与重启后复核  
**执行位置**：线上服务器

**功能**：
- 检查磁盘、内存、网络
- 检查 PM2、Docker、Nginx、Certbot
- 检查 `pm2-ubuntu` 自启动服务
- 检查 `systemd-resolved`、`/etc/resolv.conf`、DNS 解析
- 检查容器、后端、本机 HTTP、公网 HTTPS、SSL 证书

**使用方式**：
```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading
bash scripts/verify-deployment.sh
```

**何时使用**：
- 每次部署完成后
- 每次服务器重启前
- 每次服务器重启后
- 怀疑 DNS 或 PM2 自启动异常时

---

### 🔧 工具脚本

#### 5. `quick-restart.sh`

**用途**：快速重启本地服务（应急工具）
**功能**：快速清理进程并重启

**使用方式**：
```bash
bash quick-restart.sh
```

---

#### 6. `scripts/install-test-hooks.sh`

**用途**：安装 Git Hooks（自动化工具）
**功能**：安装增强版 Git Hooks，进行代码质量检查

**使用方式**：
```bash
bash scripts/install-test-hooks.sh
```

---

#### 7. `scripts/fix-mocha-tests.sh`

**用途**：修复测试中的 Jest 语法问题（维护工具）
**功能**：将 Jest 的 `beforeAll/afterAll` 转换为 Mocha 的 `before/after`

**使用方式**：
```bash
bash scripts/fix-mocha-tests.sh
```

**何时使用**：
- 测试框架从 Jest 迁移到 Mocha 时
- 发现测试中有不兼容的语法时

---

## 📊 脚本总结表

| 脚本 | 用途 | 执行位置 | 优先级 |
|------|------|--------|--------|
| `start-all-local.sh` | 启动本地开发环境 | 本地 | ⭐⭐⭐ 必用 |
| `stop-all-local.sh` | 停止本地开发环境 | 本地 | ⭐⭐⭐ 必用 |
| `scripts/deploy-to-server.sh` | 生产部署 | 本地 | ⭐⭐⭐ 关键 |
| `scripts/verify-deployment.sh` | 生产验收/重启复核 | 线上服务器 | ⭐⭐⭐ 关键 |
| `quick-restart.sh` | 应急重启 | 本地 | ⭐ 可选 |
| `scripts/install-test-hooks.sh` | 安装 Git Hooks | 本地 | ⭐ 可选 |
| `scripts/fix-mocha-tests.sh` | 修复测试语法 | 本地 | ⭐ 可选 |

---

## 🚀 常见工作流

### 开始开发

```bash
# 1. 启动本地环境
bash start-all-local.sh

# 2. 打开微信开发工具，加载 miniprogram/ 目录
# 3. 浏览器访问管理后台：http://localhost:5173
```

### 部署到生产

```bash
# 1. 确保本地代码已提交
git add .
git commit -m "feat: your feature"

# 2. 执行部署脚本
bash scripts/deploy-to-server.sh

# 3. 脚本会自动上传并在服务器上重启服务

# 4. 验证部署
curl https://wx.shubai01.com/api/v1/health
```

### 停止开发

```bash
bash stop-all-local.sh
```

---

## ⚠️ 常见问题

### Q: 脚本没有执行权限？
A: 赋予执行权限
```bash
chmod +x script-name.sh
```

### Q: MongoDB/Redis 未安装？
A: 使用 Homebrew 安装
```bash
brew install mongodb-community redis
```

### Q: 部署失败？
A: 查看详细日志
```bash
# 查看部署输出中的错误信息
bash scripts/deploy-to-server.sh 2>&1 | tail -50
```

### Q: 如何回滚部署？
A: 使用脚本输出中提供的回滚命令，或手动连接服务器：
```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading
mv /var/www/morning-reading_bak_TIMESTAMP morning-reading
pm2 restart morning-reading-backend
```

---

## 📝 更新历史

- **2026-03-02**：脚本整理，删除过时脚本（start-prod.sh, start-local-dev.sh, setup-prod-server.sh）
- **2026-03-02**：创建新的 start-all-local.sh 和 stop-all-local.sh
