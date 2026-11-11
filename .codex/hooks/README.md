# Git Hooks 系统

本项目配置了三个自动化的 Git hooks，用于提高代码质量和工作流程效率。

## 📋 Hook 说明

### 1. pre-commit （提交前检查）

在执行 `git commit` 时，**提交前自动运行**。

**检查项**：

- ✅ 禁止提交敏感文件（`.env`、密钥、凭证等）
- ✅ 禁止提交 `debugger` 语句
- ⚠️ 警告：检测 `console.log` (可提交，但会警告)
- ⚠️ 警告：检测行尾空白
- ⚠️ 警告：检测未解决的 TODO/FIXME

**执行位置**：`.git/hooks/pre-commit`

**行为**：

- 如有**严重错误**（如敏感文件、debugger）→ **阻止提交**，返回错误码 1
- 如有**警告信息** → 仅显示警告，**允许提交**

### 2. commit-msg （提交信息验证）

在输入 `git commit` 的提交信息时，**信息提交前自动运行**。

**验证规则**：

提交信息必须遵循格式：

```
<type>: <subject>

<body (optional)>
```

**允许的类型**：

- `feat` - 新功能
- `fix` - Bug修复
- `docs` - 文档更新
- `refactor` - 代码重构
- `perf` - 性能优化
- `test` - 测试相关
- `chore` - 杂务
- `style` - 代码格式
- `ci` - CI配置
- `build` - 构建相关

**示例**：

```
feat: 添加用户认证功能

详细描述...
```

**执行位置**：`.git/hooks/commit-msg`

**行为**：

- 格式错误 → **阻止提交**，显示详细的格式说明
- 格式正确 → **允许提交**

### 3. post-commit （提交后操作）

在 `git commit` **成功执行后**，自动运行。

**功能**：

- 📊 显示提交统计（改动文件数、增删行数）
- 🔍 检查是否更新了 Memory 系统文件
- 📝 检查是否更新了项目文档
- 📤 提示是否有待推送的提交

**执行位置**：`.git/hooks/post-commit`

**行为**：

- 永远不会阻止提交
- 仅用于提示和反馈

## 🚀 使用方法

### 自动触发

这些 hooks **完全自动化**，无需手动操作：

```bash
# 正常工作流程 - hooks 自动运行
git add .
git commit -m "feat: 新功能描述"  # 自动执行 pre-commit 和 commit-msg
                                    # 提交后自动执行 post-commit
```

### 验证安装

检查 hooks 是否正确安装和可执行：

```bash
# 方法1：运行安装脚本
.claude/hooks/install.sh

# 方法2：手动检查
ls -la .git/hooks/pre-commit
ls -la .git/hooks/commit-msg
ls -la .git/hooks/post-commit
```

输出应该显示这些文件可执行（带 `x` 权限）：

```
-rwxr-xr-x  pre-commit
-rwxr-xr-x  commit-msg
-rwxr-xr-x  post-commit
```

### 跳过 hooks（不推荐）

如果需要跳过 hooks（仅在特殊情况下使用）：

```bash
# 跳过所有 hooks
git commit --no-verify -m "message"

# 仅跳过 pre-commit hooks
git commit --no-verify-on
```

> ⚠️ **警告**：跳过 hooks 会降低代码质量，仅在必要时使用。

## 📝 Commit Message 快速参考

### 常见场景

**添加新功能**：

```bash
git commit -m "feat: 添加用户个人资料编辑功能"
```

**修复 Bug**：

```bash
git commit -m "fix: 修复登录页面布局错位问题"
```

**更新文档**：

```bash
git commit -m "docs: 更新README中的安装说明"
```

**代码重构**：

```bash
git commit -m "refactor: 优化用户认证模块的代码结构"
```

**性能优化**：

```bash
git commit -m "perf: 减少首页加载时间30%"
```

### 获取帮助

如果 commit message 格式错误，hooks 会显示详细的错误信息，告诉你应该如何修正。

## 🔧 故障排查

### 问题1：Hook 不执行

**症状**：提交时 hook 没有运行

**解决方案**：

```bash
# 检查 hooks 文件是否可执行
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/commit-msg
chmod +x .git/hooks/post-commit

# 重新安装
.claude/hooks/install.sh
```

### 问题2：Hook 阻止了合法提交

**症状**：提交被拒绝，但没有真正的问题

**解决方案**：

```bash
# 检查 pre-commit 的具体错误输出
# 通常是敏感文件或 debugger 语句

# 如果确实需要跳过，使用（不推荐）：
git commit --no-verify
```

### 问题3：Commit message 验证失败

**症状**：提示 "Commit message 格式不正确"

**解决方案**：

```bash
# 确保首行格式为 type: message
# 例如：
git commit -m "fix: 修复登录bug"  # ✅ 正确

# 不要这样做：
git commit -m "修复登录bug"       # ❌ 错误，缺少 type

# 查看详细的格式要求，hook 会在错误时显示
```

## 📊 Hooks 工作流程

```
git add files
     ↓
git commit -m "message"
     ↓
├─ pre-commit hook 运行
│  ├─ 检查敏感文件
│  ├─ 检查 debugger
│  └─ 检查 console.log（警告）
│     ↓
│  ❌ 发现严重错误 → 拒绝提交
│  ✅ 通过检查 → 继续
│
├─ commit-msg hook 运行
│  ├─ 验证格式
│  ├─ 检查类型前缀
│  └─ 检查首行长度
│     ↓
│  ❌ 格式错误 → 拒绝提交
│  ✅ 格式正确 → 继续
│
├─ Commit 成功
│  ↓
└─ post-commit hook 运行
   ├─ 显示提交统计
   ├─ 检查文档更新
   └─ 提示后续操作
```

## 🎯 最佳实践

1. **遵循 Commit Message 规范**
   - 类型 + 简短描述
   - 使用大写字母开头
   - 保持在 50 字符以内

2. **定期检查 hooks 输出**
   - pre-commit 的警告也很有价值
   - post-commit 的提示可以帮助改进工作流

3. **不要跳过 hooks**
   - Hooks 是质量保证的一部分
   - 只有在真正必要时才使用 `--no-verify`

4. **保持敏感文件在 .gitignore**
   - 确保 `.env` 等文件在 `.gitignore` 中
   - 这样可以完全避免意外提交

## 📚 相关文档

- [DEVELOPMENT.md](../../DEVELOPMENT.md) - 开发流程指南
- [GIT_WORKFLOW.md](../../GIT_WORKFLOW.md) - Git 工作流程详解
- [CLAUDE.md](../../CLAUDE.md) - 项目总体指南

## 🔄 更新和维护

### 更新 Hooks

如果需要修改 hooks 的行为，直接编辑 `.git/hooks/` 中的对应文件。

修改后，hooks 会在下一次提交时自动生效（无需重启或重新安装）。

### 检查 Hooks 版本

```bash
# 查看最后修改时间
ls -l .git/hooks/
```

## 💡 提示

- 这些 hooks 是**本地的**，不会影响其他开发者
- Hooks 在提交时自动运行，**无需手动操作**
- 所有 hooks 的输出都会清晰显示在终端中
- 你可以根据需要调整 hooks 的严格程度

---

**版本**：1.0
**最后更新**：2025-11-30
**维护者**：Claude Code
