# 开发服务启动脚本

这个目录包含用于快速启动、重启和停止所有开发服务的脚本。

## 📋 脚本列表

### 1. `start-all.sh` - 启动所有服务 ⭐ 推荐使用

**用途**: 一次性启动所有开发服务（MongoDB → 后端 → Admin Vue）

**启动顺序**:
1. 清理所有旧进程
2. 启动 MongoDB 数据库
3. 启动 Node.js 后端服务
4. 启动 Vue 3 Admin 管理后台
5. 显示所有服务信息和链接

**使用方法**:
```bash
# 在项目根目录运行
./.claude/commands/development/start-all.sh

# 或直接使用快捷命令（如果已配置）
npm run start:all
```

**输出信息**:
- ✓ 后端地址: http://localhost:3000
- ✓ API 地址: http://localhost:3000/api/v1
- ✓ Admin 地址: http://localhost:5173
- ✓ MongoDB: mongodb://localhost:27017
- ✓ 各服务的进程 ID (PID) 和日志位置

**特点**:
- ✅ **自动清理**: 三轮清理策略确保旧进程彻底杀死，包括占用的端口
- ✅ **健康检查**: 不仅检查进程存活，还检查 API 是否真正响应（最多30次尝试）
- ✅ **自动安装**: 自动检测依赖是否已安装，如需要会自动 npm install
- ✅ **智能诊断**: 启动失败时自动显示错误日志，快速定位问题
- ✅ **状态汇总**: 完整的启动状态报告，一目了然服务状态
- ✅ **后台运行**: 后台运行各个服务，不会被中断

---

### 2. `restart-all.sh` - 快速重启所有服务

**用途**: 杀掉所有运行中的服务，然后重新启动

**使用方法**:
```bash
./.claude/commands/development/restart-all.sh
```

**工作流程**:
1. 强制杀掉所有 npm 和 node 进程
2. 等待 2 秒钟
3. 调用 `start-all.sh` 重新启动所有服务

**何时使用**:
- 修改代码后服务未自动更新
- 服务出现异常需要完全重启
- 想要清洁启动所有服务

---

### 3. `stop-all.sh` - 停止所有服务

**用途**: 优雅地停止所有运行中的开发服务

**使用方法**:
```bash
./.claude/commands/development/stop-all.sh
```

**停止的服务**:
- npm 开发服务 (npm run dev)
- Node.js 进程
- MongoDB

**何时使用**:
- 不再需要开发环境
- 切换到其他项目
- 释放系统资源
- 从报错状态恢复

---

## 🔧 启动脚本优化说明 (2025-12-03更新)

### 改进内容

#### 1️⃣ 更强大的进程清理 (三轮清理)
```bash
第一轮：pkill -9 基础杀死
  ↓
第二轮：检查顽固进程，用 awk+xargs 强制清理
  ↓
第三轮：用 lsof 找出占用端口的进程，释放端口
```

**结果**：确保100%清理干净，即使进程被 nohup 或其他方式后台运行

#### 2️⃣ 更智能的健康检查 (自动重试30次)
```bash
不仅检查 process 存活  ✗
  ↓
还检查 API 实际能否响应  ✓
  ✓ 后端: 尝试 curl /api/v1/stats/dashboard
  ✓ Admin: 尝试 curl http://localhost:5173
  ✓ 最多重试30次，每次间隔1秒 (最多30秒)
```

**结果**：启动成功的真正标准是"可用"而不是"进程存在"

#### 3️⃣ 启动失败智能诊断
```bash
启动失败?  →  自动显示最后10行日志
  ↓
用户立即知道问题所在，无需手动查找
```

#### 4️⃣ 启动完成状态汇总
```bash
✅ 完整的状态报告:
   后端服务: ✓ 正常
   Admin Vue: ✓ 正常
   MongoDB: ✓ 正常
```

### 什么时候需要手动干预？

| 情况 | 原因 | 解决方案 |
|------|------|--------|
| 启动脚本卡住 | 某个进程死活杀不掉 | 手动：`ps aux \| grep node` 找PID，`kill -9 PID` |
| 端口被占用但 lsof 找不到 | 可能是系统进程 | `netstat -tlnp \| grep :3000` |
| MongoDB 无法启动 | 未安装或配置问题 | 按脚本提示用 Docker 或 Homebrew 启动 |
| 某个服务超过30秒还未就绪 | 硬件慢或编译耗时 | 脚本会警告，可以手动 `tail -f /tmp/backend.log` 查看进度 |

---

### 4. `start-backend.sh` - 仅启动后端

**用途**: 单独启动 Node.js 后端服务

**使用方法**:
```bash
./.claude/commands/development/start-backend.sh
```

**何时使用**:
- 只需要开发后端 API
- 其他服务已经运行
- 快速重启后端

---

### 5. `start-miniprogram.sh` - 小程序启动指南

**用途**: 显示小程序开发指南和快速链接

**使用方法**:
```bash
./.claude/commands/development/start-miniprogram.sh
```

**说明**: 小程序需要在微信开发工具中打开和调试，此脚本提供指导

---

## 🚀 快速开始

### 第一次开发

```bash
# 进入项目目录
cd /Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营

# 启动所有服务
./.claude/commands/development/start-all.sh

# 等待输出完成，记下各服务的地址和 PID
```

### 日常开发流程

```bash
# 1. 启动所有服务
./.claude/commands/development/start-all.sh

# 2. 打开浏览器
# - 后端 API: http://localhost:3000
# - Admin 管理后台: http://localhost:5173
# - 小程序: 在微信开发工具中开发

# 3. 修改代码后，自动热更新（HMR）

# 4. 开发完成后停止服务
./.claude/commands/development/stop-all.sh
```

### 服务出现问题

```bash
# 方案1: 快速重启（推荐）
./.claude/commands/development/restart-all.sh

# 方案2: 手动停止和启动
./.claude/commands/development/stop-all.sh
sleep 2
./.claude/commands/development/start-all.sh
```

---

## 📊 服务依赖关系

```
MongoDB (数据库)
    ↓
Backend (Node.js 后端)
    ↓
├─ Admin (Vue 3 管理后台)
└─ Miniprogram (微信小程序)
```

**关键点**:
- MongoDB 必须先启动，后端才能正常工作
- 后端启动后，Admin 和小程序才能正常通信
- Admin 和小程序 是独立的，可以互不影响

---

## 💡 常见问题

### Q: 后端无法启动怎么办？
A: 检查以下几点：
1. MongoDB 是否正常运行（看脚本输出）
2. 后端依赖是否已安装（first run 时脚本会自动安装）
3. 查看日志: `tail -f /tmp/backend.log`
4. 检查 3000 端口是否被其他进程占用

```bash
# 检查 3000 端口
lsof -i :3000

# 如果被占用，强制杀掉
pkill -9 -f "node"
```

### Q: Admin 无法启动怎么办？
A: 检查以下几点：
1. 后端是否已启动
2. 查看日志: `tail -f /tmp/admin.log`
3. 检查 5173 端口是否被其他进程占用

```bash
# 检查 5173 端口
lsof -i :5173
```

### Q: 如何查看服务日志？
A: 脚本会输出日志位置，可以使用以下命令：

```bash
# 查看后端日志（实时）
tail -f /tmp/backend.log

# 查看 Admin 日志（实时）
tail -f /tmp/admin.log

# 查看 MongoDB 日志
tail -f /tmp/mongod.log
```

### Q: 如何停止单个服务？
A: 使用 kill 命令，PID 在启动时会显示：

```bash
# 停止后端（假设 PID 是 12345）
kill 12345

# 或使用进程名称
pkill -f "node.*backend"
```

### Q: 想要修改启动端口怎么办？
A:
- **后端端口**: 修改 `backend/.env` 中的 `PORT`
- **Admin 端口**: 修改 `admin/vite.config.js` 中的 server 配置
- 修改后需要重启服务

### Q: 小程序如何配置后端地址？
A:
- 打开微信开发工具
- 项目目录选择 `miniprogram` 文件夹
- 开发工具会自动读取 `miniprogram/config/config.js` 中的 API 地址配置
- 默认已配置为 `http://localhost:3000/api/v1`

---

## 🔧 脚本内部工作原理

### start-all.sh 做了什么？

```
1. 验证项目结构（检查 backend、admin、miniprogram 目录）
2. 清理旧进程（pkill -9 -f "npm.*run dev" 等）
3. 检查 MongoDB：
   - 如果已运行，跳过
   - 如果未安装，显示安装提示
   - 如果已安装，启动服务
4. 启动后端（npm run dev，后台运行）
5. 等待后端就绪（sleep 4）
6. 验证后端进程是否存活
7. 启动 Admin Vue（npm run dev，后台运行）
8. 等待 Admin 就绪（sleep 3）
9. 验证 Admin 进程是否存活
10. 显示所有服务信息和命令提示
11. 进入 wait 模式（保持脚本运行）
```

### 如何退出 start-all.sh？

```bash
# 按 Ctrl+C 可以停止脚本
# 但这会同时停止所有后台服务
```

如果想保持脚本运行但想使用终端，可以：
```bash
# 后台运行脚本，不阻塞当前终端
nohup ./.claude/commands/development/start-all.sh &

# 或在 iTerm/tmux 中创建新标签页
```

---

## 📋 使用建议

### 开发环境最佳实践

1. **每次开发开始时**:
   ```bash
   ./.claude/commands/development/start-all.sh
   ```

2. **修改代码后**:
   - 后端和 Admin 会自动热更新（HMR）
   - 小程序在微信开发工具中实时预览
   - 无需手动重启（除非改了配置文件）

3. **遇到问题时**:
   ```bash
   ./.claude/commands/development/restart-all.sh
   ```

4. **开发完成后**:
   ```bash
   # 方案1: Ctrl+C 停止脚本（同时停止所有服务）

   # 方案2: 在另一个终端中停止服务
   ./.claude/commands/development/stop-all.sh
   ```

### 多终端工作流

```bash
# 终端1: 启动所有服务
./.claude/commands/development/start-all.sh

# 终端2: 查看后端日志
tail -f /tmp/backend.log

# 终端3: 查看 Admin 日志
tail -f /tmp/admin.log

# 终端4: 其他操作（git、npm、etc）
git status
npm test
...
```

---

## 🔗 相关文件

- **项目指南**: `CLAUDE.md`
- **开发流程**: `DEVELOPMENT.md`
- **小程序指南**: `MINIPROGRAM_GUIDE.md`
- **Git 工作流**: `GIT_WORKFLOW.md`
- **Bug 修复**: `BUG_FIXES.md`

---

## ✨ 脚本历史

| 版本 | 日期 | 改进 |
|------|------|------|
| v2.0 | 2025-12-03 | 完整重写，添加 MongoDB、Admin 支持，改进错误处理 |
| v1.0 | 2025-11-xx | 初始版本，仅启动后端 |

---

**最后更新**: 2025-12-03
**维护者**: Claude Code
**项目**: 晨读营小程序
