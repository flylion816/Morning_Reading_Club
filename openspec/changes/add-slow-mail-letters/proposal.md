# Change: 慢递邮局第一版（写给结营那天的自己）

## Why
晨读营的仪式感需要一个“慢”的出口：开营时给结营那天的自己写一封信，结营当天送达。

## What Changes
- 新增 Letter 模型与 `/api/v1/letters` 接口（状态、草稿、投递、拆信、回信、我的信件）。
- 新增定时服务，每 10 分钟扫描到点的封存信，标记送达并创建 `letter_delivered` 站内通知。
- 新增小程序服务 `letter.service.js` 与页面 `pages/slow-mail/slow-mail`。
- 送达时间不入库，按期次 `endDate` 东八区 6:00 实时计算。

## Impact
- Affected specs: slow-mail（新增）
- Affected code: backend/src/models/Letter.js、controllers/letter.controller.js、routes/letter.routes.js、services/letter-delivery.service.js；miniprogram/services/letter.service.js、pages/slow-mail/
- 接线（总控）：app.js 挂载 `/api/v1/letters`，server.js 调用 `letter-delivery.service.start()`，app.json 注册分包页面。
