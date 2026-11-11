# Change: 新增「看见卡」与「被看见」页面

## Why
点赞太轻、评论太重，书友常常不知道说什么。「看见」是产品的核心动词，应交到书友手里：对一篇打卡送一句预设短句，作者收到通知并能在「被看见」里回看。第一版项目尚未接入内容安全接口，因此只提供预设短句，不接受自由输入。

## What Changes
- 新增 `SeenCard` 模型（独立于评论），一人对同一篇打卡只有一张，可换短句、可撤回，不能给自己的打卡送。
- 新增接口（挂载前缀 `/api/v1/seen-cards`）：`PUT|DELETE|GET /checkin/:checkinId`、`POST /checkins/summary`、`GET /received`。
- 送卡需有该打卡所属期次的社群权限，且只能对自己看得到的打卡送。
- 首次送出时给作者发 `seen_received` 站内通知；更换短句不重复通知；不发订阅消息。
- 小程序新增 `services/seen-card.service.js`、`utils/seen-phrases.js` 和「被看见」页面 `pages/seen-received/seen-received`。

## Impact
- Affected specs: seen-cards（新增）
- Affected code: `backend/src/models/SeenCard.js`、`backend/src/controllers/seenCard.controller.js`、`backend/src/routes/seenCard.routes.js`、`backend/src/constants/seenPhrases.js`、`miniprogram/pages/seen-received/`、`miniprogram/services/seen-card.service.js`、`miniprogram/utils/seen-phrases.js`
- 仅新增集合和接口，不改已有字段，不做数据迁移。
- 入口（打卡下方的「看见」按钮、手账里的「被看见」入口）、`app.js` 路由挂载与小程序分包注册由后续接线完成。
