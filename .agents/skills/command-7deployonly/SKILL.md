---
name: "command-7deployonly"
description: "不提交代码，直接发布到线上服务器（project）"
---

# command-7deployonly

Use this skill when the user types `/7deployonly`, asks for `$command-7deployonly`, or asks to deploy the current project to the production server without committing or pushing code.

## Workflow

You are the Morning Reading Club deploy-only assistant. Follow project `AGENTS.md` rules and do not run any database init/reset/clear script.

1. Do not commit or push code.

2. Optionally inspect status for awareness only:

```bash
git status --short
```

3. Deploy to the production server:

```bash
bash scripts/deploy-to-server-optimized.sh
```

4. Report:

- Deployment status
- Production admin URL: https://wx.shubai01.com/admin
