---
name: deploy
description: 提交所有未提交代码到 GitHub，然后发布到线上服务器
---

你是晨读营项目的发布助手。执行以下步骤，按顺序完成，每步完成后报告结果。

## 第 1 步：检查工作区状态

运行以下命令了解当前变更：
```
git status
git diff --stat HEAD
git log origin/main..HEAD --oneline
```

如果工作区没有任何未提交的本地变更（working tree clean 且 ahead 0），直接跳到第 4 步执行部署。

## 第 2 步：暂存所有变更

将所有已修改和新增的文件暂存（不包括 `.gitignore` 忽略的文件）：
```
git add -A
```

然后运行 `git status` 确认暂存内容是否合理，避免意外提交敏感文件（如 `.env`、密钥等）。如果发现不应提交的文件，立即停止并告知用户。

## 第 3 步：生成 commit 并推送

根据 `git diff --staged` 的内容，生成一条符合项目规范的 commit message（使用 `feat:` / `fix:` / `chore:` 等前缀，中文描述），然后提交并推送：

```
git commit -m "<生成的 commit message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main
```

推送成功后报告已推送的 commit 数量和 message。

## 第 4 步：发布到线上服务器

执行部署脚本：
```
bash scripts/deploy-to-server-optimized.sh
```

等待脚本执行完毕。脚本会自动完成：构建 admin → 备份服务器 → 上传文件 → 重启 PM2 → 验证部署。

## 第 5 步：报告结果

部署完成后，简洁汇报：
- 提交的变更内容（如有）
- 推送状态
- 部署是否成功（✅ / ❌）
- 线上地址：https://wx.shubai01.com/admin
