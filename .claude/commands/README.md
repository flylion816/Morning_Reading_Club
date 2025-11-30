# Claude Code 快速命令系统

本项目配置了一套快速命令（Commands），用于加速开发、测试和部署流程。

## 📋 命令概览

### 开发命令 (development/)

用于启动和管理开发服务。

#### 启动所有服务
```bash
.claude/commands/development/start-all.sh
```
- 启动后端服务
- 启动 MongoDB（如果需要）
- 显示服务地址和日志

#### 启动后端服务
```bash
.claude/commands/development/start-backend.sh
```
- 启动 Node.js 后端
- 自动安装依赖（如果需要）
- 后端地址：`http://localhost:3000`

#### 启动小程序开发
```bash
.claude/commands/development/start-miniprogram.sh
```
- 显示小程序项目位置
- 提供微信开发工具使用说明
- 配置快速参考

### 测试命令 (testing/)

用于测试 API 端点和功能。

#### 快速 API 测试
```bash
.claude/commands/testing/test-api.sh
```
**测试项**：
- ✅ 健康检查
- ✅ 管理员登录
- ✅ 仪表板数据
- ✅ 期次列表
- ✅ 用户信息

**输出**：完整的 API 测试结果和 token

#### 认证流程测试
```bash
.claude/commands/testing/test-auth.sh
```
**测试场景**：
- ✅ 正确的凭证
- ✅ 错误的密码
- ✅ 不存在的用户
- ✅ Token 访问受保护资源
- ✅ 无 Token 访问（应返回 401）

#### 打卡功能完整测试
```bash
.claude/commands/testing/test-insights.sh
```
**测试步骤**：
- ✅ 登录获取 Token
- ✅ 获取期次列表
- ✅ 获取打卡记录
- ✅ 获取打卡统计
- ✅ 创建打卡记录
- ✅ 更新打卡记录
- ✅ 删除打卡记录

### 搜索命令 (search/)

用于快速查询 Memory 系统和历史问题。

#### 搜索历史问题
```bash
# 显示帮助
.claude/commands/search/search-bug.sh

# 搜索特定关键词
.claude/commands/search/search-bug.sh "页面空白"
.claude/commands/search/search-bug.sh "用户ID"

# 按类别浏览
.claude/commands/search/search-bug.sh frontend    # 前端问题
.claude/commands/search/search-bug.sh backend     # 后端问题
.claude/commands/search/search-bug.sh common      # 通用问题
.claude/commands/search/search-bug.sh architecture # 架构决策
```

**功能**：
- ✅ 快速关键词搜索
- ✅ 按问题类别浏览
- ✅ 显示问题文件和位置
- ✅ 提供快速参考链接

### 部署命令 (deployment/)

用于检查部署状态和备份数据。

#### 检查部署状态
```bash
.claude/commands/deployment/check-deploy.sh
```
**检查项**：
- ✅ Git 仓库状态
- ✅ 后端服务运行状态
- ✅ 数据库连接
- ✅ 关键文件存在性
- ✅ 环境配置
- ✅ 部署前清单

#### 数据库备份
```bash
.claude/commands/deployment/backup-db.sh
```
**功能**：
- ✅ 检查 MongoDB 连接
- ✅ 导出数据库
- ✅ 压缩备份文件
- ✅ 保存到 `./backups/` 目录
- ✅ 显示恢复步骤

---

## 🚀 常见使用场景

### 场景1：开始开发

```bash
# 1. 启动后端服务
.claude/commands/development/start-backend.sh

# 2. 在另一个终端测试 API
.claude/commands/testing/test-api.sh

# 3. 打开小程序开发工具
.claude/commands/development/start-miniprogram.sh
```

### 场景2：测试新功能

```bash
# 快速测试认证流程
.claude/commands/testing/test-auth.sh

# 完整测试打卡功能
.claude/commands/testing/test-insights.sh

# 搜索相关历史问题
.claude/commands/search/search-bug.sh "认证"
```

### 场景3：部署前检查

```bash
# 检查部署状态
.claude/commands/deployment/check-deploy.sh

# 备份数据库
.claude/commands/deployment/backup-db.sh

# 确认所有变更已推送
git status
git log --oneline -5
```

### 场景4：快速问题诊断

```bash
# 搜索"页面空白"相关问题
.claude/commands/search/search-bug.sh "页面空白"

# 搜索所有前端问题
.claude/commands/search/search-bug.sh frontend

# 查看 Memory 快速参考
cat .claude/memory/quick-reference.md
```

---

## 📝 命令详细说明

### 开发命令

#### start-all.sh
```bash
.claude/commands/development/start-all.sh
```
- 清理旧进程
- 启动后端服务
- 显示服务地址
- 按 Ctrl+C 停止

#### start-backend.sh
```bash
.claude/commands/development/start-backend.sh
```
- 自动检查依赖
- 安装 npm 包（如果需要）
- 运行 `npm run dev`
- 后端运行在 Port 3000

#### start-miniprogram.sh
```bash
.claude/commands/development/start-miniprogram.sh
```
- 显示项目位置：`./miniprogram`
- 提供微信开发工具链接
- 配置说明

### 测试命令

#### test-api.sh
```bash
.claude/commands/testing/test-api.sh
```
输出示例：
```
🧪 API 快速测试
════════════════════════════════════════════

1️⃣ 健康检查
✅ 健康检查通过

2️⃣ 管理员登录
TOKEN: abc123def456...
✅ 登录成功

3️⃣ 获取仪表板数据
✅ 仪表板数据获取成功
```

#### test-auth.sh
```bash
.claude/commands/testing/test-auth.sh
```
**测试场景**：
1. 正确凭证 → ✅ 返回 token
2. 错误密码 → ✅ 返回 401
3. 不存在用户 → ✅ 返回 401
4. 有效 token → ✅ 访问成功
5. 无 token → ✅ 返回 401

#### test-insights.sh
```bash
.claude/commands/testing/test-insights.sh
```
**7个测试步骤**：
1. 管理员登录
2. 获取期次列表
3. 获取打卡记录
4. 获取打卡统计
5. 创建新打卡
6. 更新打卡
7. 删除打卡

### 搜索命令

#### search-bug.sh
```bash
# 显示帮助
.claude/commands/search/search-bug.sh

# 搜索关键词
.claude/commands/search/search-bug.sh "错误信息"

# 按类别浏览
.claude/commands/search/search-bug.sh frontend
```

**支持的类别**：
- `frontend` - 前端问题
- `backend` - 后端问题
- `common` - 通用问题
- `architecture` - 架构决策
- `standards` - 编码规范

### 部署命令

#### check-deploy.sh
```bash
.claude/commands/deployment/check-deploy.sh
```
**检查内容**：
- Git 分支和提交
- 后端服务状态
- 数据库连接
- 关键文件
- 环境配置

#### backup-db.sh
```bash
.claude/commands/deployment/backup-db.sh
```
**备份步骤**：
1. 检查 mongosh
2. 验证数据库连接
3. 导出数据库
4. 压缩备份文件
5. 保存到 `./backups/`

---

## 🔧 故障排查

### 问题：命令不可执行

```bash
# 检查权限
ls -la .claude/commands/*/

# 添加执行权限
chmod +x .claude/commands/*/*.sh
```

### 问题：后端启动失败

```bash
# 检查依赖
cd backend && npm install

# 查看错误日志
npm run dev

# 检查 Port 3000
lsof -i :3000
```

### 问题：API 测试失败

```bash
# 检查后端是否运行
curl http://localhost:3000/api/v1/health

# 检查网络连接
ping localhost

# 查看后端日志
.claude/commands/development/start-backend.sh
```

### 问题：Memory 搜索无结果

```bash
# 检查 Memory 目录
ls -la .claude/memory/

# 验证文件内容
cat .claude/memory/quick-reference.md

# 完整索引
cat .claude/memory/index.json | jq .
```

---

## 📚 相关文档

- **[DEVELOPMENT.md](../../DEVELOPMENT.md)** - 开发流程指南
- **[.claude/hooks/README.md](./.claude/hooks/README.md)** - Git Hooks 使用指南
- **[.claude/memory/quick-reference.md](./.claude/memory/quick-reference.md)** - 快速问题查询

---

## 💡 最佳实践

### 开发流程

```bash
# 1. 启动后端
.claude/commands/development/start-backend.sh &

# 2. 快速测试 API
.claude/commands/testing/test-api.sh

# 3. 详细功能测试
.claude/commands/testing/test-auth.sh
.claude/commands/testing/test-insights.sh

# 4. 部署前检查
.claude/commands/deployment/check-deploy.sh
```

### 问题诊断

```bash
# 1. 搜索历史问题
.claude/commands/search/search-bug.sh "问题关键词"

# 2. 快速查询 Memory
cat .claude/memory/quick-reference.md

# 3. 查看相关文件
cat .claude/memory/issues/frontend/components.md
```

### 快速参考

```bash
# 最常用命令
.claude/commands/development/start-backend.sh    # 启动后端
.claude/commands/testing/test-api.sh             # 测试 API
.claude/commands/search/search-bug.sh 关键词     # 搜索问题
.claude/commands/deployment/check-deploy.sh      # 部署检查
```

---

## 🚀 自定义命令

如果需要添加新命令，遵循以下规范：

1. **位置**：放在 `.claude/commands/` 的相应子目录
2. **命名**：使用 kebab-case（例：`my-command.sh`）
3. **权限**：`chmod +x` 使其可执行
4. **帮助**：包含 `--help` 选项
5. **颜色**：使用相同的颜色定义增强可读性

---

**版本**：1.0
**最后更新**：2025-11-30
**维护者**：Claude Code
**状态**：✅ 完全就绪，可投入使用
