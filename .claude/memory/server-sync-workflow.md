# 服务器代码同步工作流

## 📋 工作流概述

**触发条件**: 用户说"从服务器更新代码" 或类似表述

**操作目标**: 将服务器本地仓库的最新提交合并到本地开发机，再推送到GitHub

**执行时间**: ~2-3分钟（自动化）

---

## 🔑 服务器凭证信息

```
服务器地址: 123.207.223.93
用户名: ubuntu
密码: [安全存储]
本地仓库路径: /var/www/Morning_Reading_Club
```

**Git Remote 已配置**:
```
server  ssh://ubuntu@123.207.223.93/var/www/Morning_Reading_Club (fetch)
server  ssh://ubuntu@123.207.223.93/var/www/Morning_Reading_Club (push)
```

---

## 🔄 完整工作流步骤

### 第1步: 设置SSH认证
```bash
# 使用sshpass进行密码认证
export SERVER_PASSWORD="[password]"
export GIT_SSH_COMMAND="sshpass -p '$SERVER_PASSWORD' ssh -o StrictHostKeyChecking=accept-new"
```

### 第2步: 从服务器拉取最新代码
```bash
# 清理本地server分支跟踪
git fetch server main --prune

# 获取服务器未推送的提交
git fetch server main

# 显示服务器新增的提交
git log origin/main..server/main --oneline
```

### 第3步: 从GitHub拉取最新代码
```bash
# 更新GitHub的远程跟踪分支
git fetch origin main

# 显示本地比GitHub领先的提交
git log origin/main..HEAD --oneline
```

### 第4步: 创建并检出merge分支
```bash
# 基于当前main创建临时merge分支
git checkout -b merge/server-updates main

# 从服务器获取commit信息（便于自动化）
git diff origin/main...server/main --name-status > /tmp/server_changes.txt
```

### 第5步: 合并服务器提交
```bash
# 将server/main的提交合并到merge分支
git merge server/main -m "merge: 从服务器同步最新代码

从服务器获取的未推送提交：
$(git log origin/main..server/main --oneline | sed 's/^/- /')

同步的文件列表：
$(cat /tmp/server_changes.txt | sed 's/^/- /')"
```

### 第6步: 解决冲突（如有）
```bash
# 检查是否有冲突
git status

# 如有冲突，手动解决或使用自动策略
# 冲突后继续合并
git add .
git commit -m "resolve: 合并服务器更新时的冲突"
```

### 第7步: 确保与GitHub同步
```bash
# 检查是否需要rebase保持历史线性
# （可选，仅当要求历史整洁时）
git rebase origin/main merge/server-updates
```

### 第8步: 合并回main分支
```bash
# 切回main分支
git checkout main

# 合并merge分支到main
git merge merge/server-updates --ff-only
# 若ff-only失败，使用：
# git merge merge/server-updates -m "merge: 服务器代码同步完成"
```

### 第9步: 推送到GitHub
```bash
# 推送main分支
git push origin main

# 清理临时分支
git branch -d merge/server-updates
```

### 第10步: 验证和清理
```bash
# 验证推送成功
git status  # 应显示: Your branch is up to date with 'origin/main'

# 显示最新的几个提交
git log --oneline -5

# 清理环境变量
unset SERVER_PASSWORD
unset GIT_SSH_COMMAND
```

---

## 🤖 完整自动化脚本

**文件**: `.claude/commands/sync/sync-server-code.sh`

```bash
#!/bin/bash

set -e

# 配置
SERVER_IP="123.207.223.93"
SERVER_USER="ubuntu"
SERVER_PASSWORD="[password]"  # 从环境或其他安全源获取
REPO_PATH="/var/www/Morning_Reading_Club"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔄 开始从服务器同步代码${NC}"
echo ""

# 设置SSH命令
export GIT_SSH_COMMAND="sshpass -p '$SERVER_PASSWORD' ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

# 第1步: 从服务器拉取
echo -e "${YELLOW}[1/5]${NC} 从服务器 $SERVER_IP 拉取代码..."
git fetch server main --prune 2>/dev/null || true
git fetch server main

echo -e "${GREEN}✓ 服务器代码拉取完成${NC}"

# 获取变更文件列表
CHANGES=$(git diff origin/main...server/main --name-status | wc -l)
echo "  - 发现 $CHANGES 个变更"

# 第2步: 从GitHub拉取
echo -e "${YELLOW}[2/5]${NC} 从GitHub拉取最新代码..."
git fetch origin main

echo -e "${GREEN}✓ GitHub代码拉取完成${NC}"

# 第3步: 创建merge分支
echo -e "${YELLOW}[3/5]${NC} 创建临时merge分支..."
git checkout -b merge/server-updates-$(date +%s) main 2>/dev/null || true

echo -e "${GREEN}✓ Merge分支已创建${NC}"

# 第4步: 合并服务器代码
echo -e "${YELLOW}[4/5]${NC} 合并服务器提交..."

COMMIT_MSG=$(cat <<EOF
merge: 从服务器同步最新代码 $(date '+%Y-%m-%d %H:%M:%S')

服务器新增提交:
$(git log origin/main..server/main --oneline | sed 's/^/  - /')

同步的文件:
$(git diff origin/main...server/main --name-status | sed 's/^/  - /')
EOF
)

git merge server/main -m "$COMMIT_MSG" || {
    echo -e "${RED}✗ 合并时出现冲突${NC}"
    echo "请手动解决冲突，然后运行:"
    echo "  git add ."
    echo "  git commit -m 'resolve: 解决服务器同步冲突'"
    echo "  git checkout main"
    echo "  git merge --no-ff merge/server-updates-*"
    exit 1
}

echo -e "${GREEN}✓ 代码合并完成${NC}"

# 第5步: 推送到GitHub
echo -e "${YELLOW}[5/5]${NC} 推送到GitHub..."
git checkout main
git merge --ff-only merge/server-updates-* 2>/dev/null || \
git merge merge/server-updates-* -m "merge: 服务器代码同步完成"

git push origin main

# 清理临时分支
git branch -D merge/server-updates-* 2>/dev/null || true

# 清理环境
unset GIT_SSH_COMMAND
unset SERVER_PASSWORD

echo -e "${GREEN}✓ 同步完成！${NC}"
echo ""
echo -e "最新提交:"
git log --oneline -3
```

---

## 📊 常见场景处理

### 场景1: 服务器有新提交，本地也有新提交
```
处理: 自动合并，生成merge commit
结果: 推送到GitHub保持两边的历史
```

### 场景2: 存在文件冲突
```
处理: 暂停，提示用户手动解决
方法: 使用git mergetool或手动编辑
```

### 场景3: 服务器有 `.env.production` 或敏感文件
```
处理: 不会被合并到本地（已在.gitignore中）
结果: 只同步代码逻辑，跳过敏感配置
```

### 场景4: GitHub远程HEAD和服务器不同步
```
处理: 优先GitHub（远程主干），然后合并服务器
结果: 保持GitHub为真实主干
```

---

## ✅ 检查清单

执行前确认:
- [ ] 本地工作树干净（git status显示clean）
- [ ] GitHub远程可用
- [ ] 服务器可网络访问
- [ ] sshpass已安装 (`brew list sshpass`)

执行后验证:
- [ ] git log显示最新提交来自服务器
- [ ] git push已完成，无pending commits
- [ ] 新增文件在GitHub上可见
- [ ] 没有遗留的临时分支

---

## 🔐 安全注意事项

1. **密码存储**:
   - 不在任何git跟踪的文件中存储密码
   - 从环境变量或加密的密钥管理系统获取
   - 脚本执行后清除环境变量

2. **SSH密钥选项**:
   - 理想方案: 配置SSH密钥而不是密码
   - 临时方案: 使用sshpass + 环境变量
   - 最安全: 使用GitHub SSH部署密钥

3. **文件权限**:
   - 同步脚本权限: 700 (仅所有者可执行)
   - 凭证文件权限: 600 (仅所有者可读写)

---

## 📝 使用示例

```bash
# 方式1: 直接执行脚本
./.claude/commands/sync/sync-server-code.sh

# 方式2: 用户指令触发
用户: "从服务器更新代码"
Claude: [自动执行上述脚本]
```

---

## 🚀 快速参考

| 需求 | 命令 |
|------|------|
| 检查服务器新提交 | `git log origin/main..server/main` |
| 查看服务器修改的文件 | `git diff origin/main...server/main --name-status` |
| 强制使用服务器版本 | `git checkout server/main -- <file>` |
| 撤销同步 | `git reset --hard origin/main` |
| 查看合并冲突 | `git diff` |

---

**最后更新**: 2025-12-15
**维护人**: Claude Code
**关键字**: 服务器同步, git merge, 多仓库管理, 自动化工作流
