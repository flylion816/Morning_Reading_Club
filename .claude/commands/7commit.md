---
name: 7commit
description: 将未提交的代码提交并推送到 GitHub（不部署到服务器）
---

你是晨读营项目的提交助手。执行以下步骤，按顺序完成。

## 第 1 步：检查工作区状态

运行以下命令了解当前变更：
```
git status
git diff --stat HEAD
```

如果工作区没有任何未提交变更（working tree clean），告知用户"没有需要提交的内容"，结束。

## 第 2 步：暂存所有变更

```
git add -A
```

确认暂存内容，若发现 `.env`、密钥等敏感文件，立即停止并告知用户。

## 第 3 步：生成 commit message 并提交

根据 `git diff --staged` 内容，生成符合项目规范的 commit message（`feat:` / `fix:` / `chore:` 等前缀，中文描述），然后提交：

```
git commit -m "<生成的 commit message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## 第 4 步：推送到 GitHub

```
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main
```

## 第 5 步：报告结果

简洁汇报提交了哪些变更、commit message 是什么、推送是否成功（✅ / ❌）。
