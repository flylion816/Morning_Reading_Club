## 🔧 Git 操作规范

### ⚠️ 重要：使用 gh 命令而不是 git

**本项目必须使用 `gh` 命令进行代码提交和推送，不要直接使用 `git push`。**

### 正确的提交流程

```bash
# 1. 查看修改状态
git status

# 2. 添加修改的文件
git add .
# 或添加特定文件
git add <file-path>

# 3. 提交到本地仓库
git commit -m "提交信息

详细说明（可选）

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. 使用 gh 推送（重要！）
# 方法1: 直接使用带token的URL推送
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main

# 方法2: 先配置credential，再推送
git config --local credential.helper store
git push origin main
```

### ❌ 禁止的操作

```bash
# 不要直接使用 git push（会失败）
git push origin main  # ❌ 错误

# 不要使用 SSH 方式（未配置SSH密钥）
git push git@github.com:flylion816/Morning_Reading_Club.git main  # ❌ 错误
```

### ✅ 推荐的完整提交命令

```bash
# 一键提交并推送
cd "/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营" && \
git add -A && \
git commit -m "feat: 添加新功能

详细描述改动内容

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>" && \
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main
```

## 📝 提交信息规范

### Commit Message 格式

```
<type>: <subject>

<body>

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Type 类型说明

- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构代码
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

### 示例

```bash
git commit -m "feat: 实现课程详情页

- 添加课程基本信息展示
- 实现23天打卡日历
- 支持查看已打卡状态
- 添加报名功能

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 🚫 .gitignore 规则

以下文件/目录会被自动忽略，不会提交到仓库：

```
# 系统文件
.DS_Store
*.log

# 配置文件
project.private.config.json

# Node.js
node_modules/
npm-debug.log*
package-lock.json

# 编译产物
miniprogram_npm/

# IDE配置
.vscode/
.idea/

# 云开发
.cloudbase/
```

## 📂 项目结构

```
晨读营小程序/
├── miniprogram/              # 小程序主目录
│   ├── app.js               # 应用入口
│   ├── app.json             # 应用配置
│   ├── app.wxss             # 全局样式
│   ├── config/              # 配置文件
│   ├── utils/               # 工具函数
│   ├── services/            # API服务层
│   ├── pages/               # 页面目录
│   ├── components/          # 组件目录
│   └── assets/              # 静态资源
├── prd-v2.1/                # PRD文档
├── 架构设计-v2.0/           # 架构设计文档
├── demo-v3.0/               # HTML原型
├── README.md                # 项目说明
├── CLAUDE.md                # 本文件
├── package.json             # Node.js配置
├── project.config.json      # 小程序项目配置
└── .gitignore              # Git忽略规则
```

## 🔑 认证配置

### gh CLI 已配置

项目已配置 GitHub CLI (gh)，认证信息存储在系统中。

### 检查认证状态

```bash
# 检查gh认证状态
gh auth status

# 查看当前token
gh auth token

# 重新登录（如需要）
gh auth login
```

## 📌 重要提醒

1. **始终使用 gh 命令推送代码**
2. **提交前检查 .gitignore 是否正确排除了不需要的文件**
3. **每次提交都要写清楚的 commit message**
4. **不要提交敏感信息（token, 密钥等）**
5. **大文件（>5MB）不要直接提交，使用 Git LFS 或对象存储**

## 🔄 常用 Git 命令

```bash
# 查看状态
git status

# 查看提交历史
git log --oneline -10

# 查看远程仓库
git remote -v

# 拉取最新代码
git pull origin main

# 查看分支
git branch -a

# 撤销未提交的修改