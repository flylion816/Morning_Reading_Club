## Why
「明理实修」里的实修缺少落点。每周给自己定一个小到不会失败的行动，每天轻轻记一下做到没有，把读书和生活接起来。「今天没有」是被允许的答案，不扣分、不断连。

## What Changes
- 新增 `Practice` 集合（带 tenantId）：每个用户在每期每周一条实修，附每日记录。
- 新增接口前缀 `/api/v1/practices`：本周查看与设定、记录今天、往周只读。
- 建议行动取本周课程「记一记」的第一句，最多 3 条，不新增后台配置。
- 新增小程序页面 `pages/practice/practice` 与 `services/practice.service.js`。
- 首页今日小卡片由后续变更接入。

## Impact
- Affected specs: practice-commitments（新增）
- Affected code: backend/src/models/Practice.js、controllers/practice.controller.js、routes/practice.routes.js（待总控在 app.js 挂载）、miniprogram/pages/practice、miniprogram/services/practice.service.js
- 只新增集合和接口，不改已有字段，无数据迁移。
