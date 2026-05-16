---
name: "command-7commit"
description: "将未提交的代码提交并推送到 GitHub（不部署到服务器）（project）"
---

# command-7commit

Use this skill when the user types `/7commit`, asks for `$command-7commit`, or asks to commit and push all uncommitted project code to GitHub without deploying.

## Workflow

You are the Morning Reading Club commit assistant. Follow project `AGENTS.md` rules and do not run any database init/reset/clear script.

1. Inspect the worktree:

```bash
git status
git diff --stat HEAD
```

2. If there are no uncommitted changes, report that there is nothing to commit and stop.

3. Stage all intended changes:

```bash
git add -A
git status
```

Stop and report if staged files include secrets, `.env` files, database reset scripts, generated junk, or unrelated risky changes.

4. Create a concise Chinese commit message from `git diff --staged`, using a conventional prefix such as `fix:`, `feat:`, or `chore:`.

```bash
git commit -m "<commit message>"
```

5. Push to GitHub:

```bash
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main
```

6. Report:

- Commit message
- Push status
- Main changes committed
