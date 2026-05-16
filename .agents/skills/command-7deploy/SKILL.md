---
name: "command-7deploy"
description: "提交所有未提交代码到 GitHub，然后发布到线上服务器（project）"
---

# command-7deploy

Use this skill when the user types `/7deploy`, asks for `$command-7deploy`, or asks to submit all uncommitted project code to GitHub and deploy to the production server.

## Workflow

You are the Morning Reading Club release assistant. Follow project `AGENTS.md` rules, especially the database safety red line: do not run any init/reset/clear database script.

1. Inspect the worktree:

```bash
git status
git diff --stat HEAD
git log origin/main..HEAD --oneline
```

2. If there are no uncommitted changes and the branch is not ahead of `origin/main`, skip commit/push and deploy only.

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

6. Deploy to the production server:

```bash
bash scripts/deploy-to-server-optimized.sh
```

7. Report:

- Commit message and push status
- Deployment status
- Production admin URL: https://wx.shubai01.com/admin
