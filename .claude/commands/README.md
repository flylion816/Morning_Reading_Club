# 🚀 Claude Code 命令系统

项目启动、测试、搜索和部署脚本集合。自动检测环境并设置相应的变量。

---

## 📁 目录结构

### `development/` - 开发环境脚本（带 `dev-` 前缀）

用于**本地开发**，自动启用完整日志输出。

| 脚本 | 功能 |
|------|------|
| `dev-start-all.sh` | 启动所有服务（后端+Admin+小程序） |
| `dev-start-backend.sh` | 仅启动后端服务 |
| `dev-start-admin.sh` | 仅启动Admin Vue前端 |
| `dev-start-miniprogram.sh` | 启动小程序编译 |
| `dev-restart-all.sh` | 重启所有服务 |
| `dev-stop-all.sh` | 停止所有服务 |
| `verify-dev.sh` | 验证本地开发环境就绪（检查MongoDB、Redis等） |

**自动设置的环境变量**：
- `NODE_ENV=development`
- `DEBUG_LOG=true` （显示所有日志）

**日志输出**：完整（debug + info + warn + error）

---

### `deployment/` - 生产/部署环境脚本

#### 启动脚本（带 `prod-start-` 前缀）

用于**线上部署**，自动禁用调试日志。

| 脚本 | 功能 |
|------|------|
| `prod-start-backend.sh` | 启动后端服务（生产模式） |
| `prod-start-admin.sh` | 启动Admin Vue（生产模式） |

**自动设置的环境变量**：
- `NODE_ENV=production`
- `DEBUG_LOG=false` （仅显示错误日志）

**日志输出**：仅错误日志（error only）

#### 停止脚本（带 `prod-stop-` 前缀）

优雅停止服务，不丢失现有请求。

| 脚本 | 功能 |
|------|------|
| `prod-stop-backend.sh` | 停止后端服务 |
| `prod-stop-admin.sh` | 停止Admin Vue服务 |

#### 验证脚本（部署检查）

| 脚本 | 功能 |
|------|------|
| `verify-prod.sh` | 验证生产环境部署完成（检查所有服务状态） |

#### 其他辅助脚本（独立功能）

| 脚本 | 功能 |
|------|------|
| `check-deploy.sh` | 部署前检查清单 |
| `backup-db.sh` | 手动备份数据库 |
| `setup-cron-backup.sh` | 配置定时自动备份 |

---

## 💻 使用示例

### 本地开发

```bash
# 验证开发环境就绪
bash .claude/commands/development/verify-dev.sh

# 启动所有服务
bash .claude/commands/development/dev-start-all.sh

# 或启动单个服务
bash .claude/commands/development/dev-start-backend.sh    # 仅后端
bash .claude/commands/development/dev-start-admin.sh      # 仅前端

# 停止服务
bash .claude/commands/development/dev-stop-all.sh
```

### 线上部署

```bash
# 部署前检查
bash .claude/commands/deployment/check-deploy.sh

# 备份数据库
bash .claude/commands/deployment/backup-db.sh

# 启动生产服务
bash .claude/commands/deployment/prod-start-backend.sh
bash .claude/commands/deployment/prod-start-admin.sh

# 部署完成后验证所有服务
bash .claude/commands/deployment/verify-prod.sh

# 查看日志
tail -f backend/logs/combined.log

# 停止服务
bash .claude/commands/deployment/prod-stop-backend.sh
bash .claude/commands/deployment/prod-stop-admin.sh
```

---

## 📊 脚本对应关系

| 功能 | 开发脚本 | 生产脚本 |
|------|--------|--------|
| **启动后端** | `dev-start-backend.sh` | `prod-start-backend.sh` |
| **启动前端** | `dev-start-admin.sh` | `prod-start-admin.sh` |
| **停止后端** | `dev-stop-all.sh` | `prod-stop-backend.sh` |
| **停止前端** | `dev-stop-all.sh` | `prod-stop-admin.sh` |

---

## 🎯 核心差异

### 环境变量自动设置

| 变量 | 开发环境 | 生产环境 |
|-----|--------|--------|
| `NODE_ENV` | `development` | `production` |
| `DEBUG_LOG` | `true` | `false` |
| `PORT` | 3000 | 3000 |

### 日志输出对比

**开发环境**（DEBUG_LOG=true）：
```
[DEBUG] 连接数据库...
[INFO] 查询用户列表...
[DEBUG] 用户ID: 12345
✓ 数据加载完成
```

**生产环境**（DEBUG_LOG=false）：
```
✓ 数据加载完成    // 仅显示关键信息或错误
```

---

## 💡 最佳实践

1. **本地开发**：使用 `dev-` 脚本，获得完整日志反馈
2. **线上部署**：使用 `prod-` 脚本，自动禁用调试日志
3. **环境变量**：在 `.env.production` 中配置，脚本自动读取
4. **日志管理**：使用后端的 Winston 日志系统，自动轮换日志文件
5. **进程管理**：使用 PM2 或 systemd，提高可靠性

---

## 🔧 PM2 生产配置（可选）

创建 `pm2.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'backend/src/server.js',
      env: {
        NODE_ENV: 'production',
        DEBUG_LOG: 'false',
        PORT: 3000
      },
      instances: 'max',
      exec_mode: 'cluster'
    }
  ]
};
```

启动：
```bash
pm2 start pm2.config.js
pm2 logs backend
pm2 stop backend
```

---

## 📋 验证脚本详解

### verify-dev.sh（本地开发环境验证）

快速检查本地开发环境中所有服务是否正常运行。

**检查项**：
- ✅ MongoDB 连接
- ✅ Redis 连接
- ✅ Node.js 环境
- ✅ npm/yarn 依赖
- ✅ 端口可用性（3000、5173等）
- ✅ 环境变量配置

**用途**：
- 开发前快速诊断环境问题
- 避免启动服务时出现连接错误
- 节省调试时间

### verify-prod.sh（生产环境部署验证）

部署完成后，全面检查所有服务是否正确启动和运行。

**检查项**：
- ✅ 后端服务状态
- ✅ Admin Vue 前端状态
- ✅ MongoDB 连接
- ✅ 小程序 API 可达性
- ✅ CORS 配置
- ✅ JWT 认证
- ✅ 日志文件存在性
- ✅ 进程内存占用

**用途**：
- 部署后完整性检查
- 快速定位线上问题
- 生成部署验证报告

---

**最后更新**：2025-12-06
**维护者**：Claude Code
**版本**：2.1 (Scripts Reorganized from /scripts to /.claude/commands)
